package ccwu.yuanfang.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

import com.getcapacitor.Bridge;

/**
 * 媒体播放前台服务 —— 干两件事：把进程钉在前台态（后台不冻结 JS），
 * 以及承载锁屏 / 通知栏的媒体控件（方案 A）。
 *
 * 根因（实测确认）：App 退到后台后音频本身还能继续播（媒体管线在浏览器进程里，
 * 不受 JS 冻结影响），但**安卓会冻结 WebView 的 JS 执行**。而「一首放完自动切下一首」
 * 是靠 JS 处理 audio 的 ended 事件完成的 —— JS 冻住，事件排队但处理器不跑，
 * 于是第一首放完就停在那儿。
 *
 * 光加 WakeLock 不够：它只防 CPU 休眠，不解冻 WebView 的 JS 线程。
 * 必须用前台服务把进程保持在「前台态」，系统才不冻结它。
 *
 * 必须有 MediaSession：安卓 14+ 对 mediaPlayback 类型的前台服务有硬性要求 ——
 * 应用得有一个**活跃的** MediaSession，否则系统判定为滥用该类型并把服务收掉。
 * 症状很有辨识度：**解锁屏幕后通知消失、同时又不自动切歌**（前台态一丢，JS 又被冻）。
 *
 * 方案 A 的数据流（两个方向，别搞混）：
 *
 *   系统按钮 → MediaSession.Callback（**binder 线程**）→ Bridge.eval
 *            → 网页里的 window.__ymNativeControl(action) → Pinia store → APlayer
 *
 *   网页 → PlaybackForeground.updateNowPlaying(...) → 本服务
 *        → session.setMetadata + 通知文案刷新
 *
 * 用平台自带的 android.media.session / Notification.MediaStyle（API 21+），
 * **不引 androidx.media** —— 少一个依赖，少一处构建风险。
 */
public class PlaybackService extends Service {

    private static final String CHANNEL_ID = "yuanfang_playback";
    private static final int NOTIFY_ID = 1001;

    /** 当前曲目，供通知文案用。由网页通过 updateNowPlaying 推过来 */
    private String title = "";
    private String artist = "";
    private boolean playingNow = true;

    /** 活跃的媒体会话，见类注释 */
    private MediaSession session;

    /** 供 PlaybackPlugin 反查（updateNowPlaying 是静态入口，拿不到实例） */
    private static volatile PlaybackService instance;

    /**
     * 服务是否在跑。诊断用（ping 探针）。
     */
    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, PlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, PlaybackService.class));
    }

    /**
     * 网页推来「现在在放哪首、放没放」。
     *
     * 服务没起来就安静忽略 —— 前端的 play 处理里是**先 start() 再 sync**，
     * 正常不会走到这条。真走到了也没什么可更新的（没有会话、没有通知）。
     */
    public static void updateNowPlaying(String title, String artist, boolean playing) {
        PlaybackService s = instance;
        if (s == null) return;
        s.applyNowPlaying(title, artist, playing);
    }

    private void applyNowPlaying(String t, String a, boolean playing) {
        title = t == null ? "" : t;
        artist = a == null ? "" : a;
        playingNow = playing;

        if (session != null) {
            session.setMetadata(new MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                    .putString(MediaMetadata.METADATA_KEY_ALBUM, artist)
                    .build());
            // 暂停时状态要跟着变，否则锁屏上的按钮一直是"暂停"图标
            session.setPlaybackState(buildPlaybackState());
        }

        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            // 同一个 NOTIFY_ID —— 原地替换，不会堆出第二条
            nm.notify(NOTIFY_ID, buildNotification());
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        instance = this;
        createChannel();
        createSession();
    }

    /**
     * 立一个活跃的 MediaSession，并接上按钮回调。
     *
     * 三条理由，缺一不可：
     *   ① 系统要求 —— 安卓 14+ 的 mediaPlayback 前台服务必须有活跃 session，
     *      否则服务会被收掉（通知消失 + 前台态丢失 + JS 又被冻）。
     *   ② 它是锁屏/通知栏控件的**唯一**挂载点。
     *   ③ 没有 Callback 时，系统画得出按钮、点下去却没人接。
     */
    private void createSession() {
        session = new MediaSession(this, "yuanfang_playback");

        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendToWeb("play");
            }

            @Override
            public void onPause() {
                sendToWeb("pause");
            }

            @Override
            public void onSkipToNext() {
                sendToWeb("next");
            }

            @Override
            public void onSkipToPrevious() {
                sendToWeb("prev");
            }
        });

        // 框架 MediaSession 收媒体按钮要靠这两个 flag
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);

        session.setPlaybackState(buildPlaybackState());
        session.setActive(true);
    }

    /**
     * 播放状态。
     *
     * 位置与速度是**故意**给 UNKNOWN 的：真正的进度在 WebView 的 <audio> 里，
     * 原生侧拿不到也不该假装拿到（这一版也不做进度条）。
     * setActions 里声明了哪些动作，系统就画哪几个按钮。
     */
    private PlaybackState buildPlaybackState() {
        return new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY
                        | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE
                        | PlaybackState.ACTION_SKIP_TO_NEXT
                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(
                        playingNow ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        PlaybackState.PLAYBACK_POSITION_UNKNOWN,
                        playingNow ? 1.0f : 0f)
                .build();
    }

    /**
     * 把系统按钮转发给网页。
     *
     * ⚠️ 回调跑在【系统 binder 线程】，不是主线程，也不是插件线程 ——
     * 只能走 Bridge.eval()，它自己会 post 到主线程。绝不能在这里直接碰 WebView。
     */
    private void sendToWeb(String action) {
        Bridge b = PlaybackPlugin.bridge();
        if (b == null) return;
        b.eval("window.__ymNativeControl && window.__ymNativeControl('" + action + "')", null);
    }

    @Override
    public void onDestroy() {
        running = false;
        instance = null;
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 此刻 createSession() 已经跑过（onCreate 先于 onStartCommand），
        // 所以 buildNotification() 拿得到 session token —— 顺序不能换
        startForeground(NOTIFY_ID, buildNotification());
        // START_STICKY：被系统回收后尽量拉回来，配合队列继续播
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        // 不需要绑定 —— JS 侧只调 start/stop/updateNowPlaying 三个动作
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "播放中", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("保持后台播放不中断");
        ch.setShowBadge(false);
        ch.setSound(null, null);
        nm.createNotificationChannel(ch);
    }

    /**
     * 通知。
     *
     * ⚠️ 关键在 setStyle(MediaStyle) + setMediaSession(token)：**这就是**
     * 「系统把它当媒体通知」的开关。少了它，它只是一条普通常驻通知 ——
     * 锁屏不出现媒体卡片、下拉通知栏也没有那三个按钮。
     *
     * 用【框架】Notification.Builder 而不是 NotificationCompat.Builder：
     * MediaStyle 是框架类，Compat 的 Builder 塞不进框架 Style。
     * 这样就不必为了一个通知去引 androidx.media。
     *
     * 按钮**不在这里画**：Android 13+ 由系统从 MediaSession 自动渲染
     * （媒体卡片 + 锁屏），画了反而重复。
     */
    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        // 点通知回到 App（不新建实例）
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

        Notification.MediaStyle style = new Notification.MediaStyle();
        if (session != null) {
            style.setMediaSession(session.getSessionToken());
        }

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
            b.setPriority(Notification.PRIORITY_LOW);
        }

        return b.setContentTitle(title.isEmpty() ? "远方音乐" : title)
                .setContentText(artist.isEmpty() ? "正在播放" : artist)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentIntent(pi)
                .setStyle(style)
                // 不加这个，安全锁屏上会显示成"内容已隐藏"
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)        // 不可划掉：划掉就等于停服务、JS 又被冻
                .setOnlyAlertOnce(true)  // 切歌刷新文案时别反复叮
                .build();
    }
}
