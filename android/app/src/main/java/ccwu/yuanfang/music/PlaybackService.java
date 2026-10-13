package ccwu.yuanfang.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * 媒体播放前台服务 —— 解决「后台只能播一首、不自动切歌」。
 *
 * 根因（实测确认）：App 退到后台后音频本身还能继续播（媒体管线在浏览器进程里，
 * 不受 JS 冻结影响），但**安卓会冻结 WebView 的 JS 执行**。而「一首放完自动切下一首」
 * 是靠 JS 处理 audio 的 ended 事件完成的 —— JS 冻住，事件排队但处理器不跑，
 * 于是第一首放完就停在那儿。
 *
 * 光加 WakeLock 不够：它只防 CPU 休眠，不解冻 WebView 的渲染/JS 线程。
 * 必须用前台服务把进程保持在「前台态」，系统才不冻结它。
 *
 * 注意：这里**不做**锁屏控件/通知栏切歌（那是后续的 Capacitor 原生 MediaSession 插件的事）。
 * 这个通知只负责"让进程活下去"，所以刻意做得没有存在感、也不可点掉。
 */
public class PlaybackService extends Service {

    private static final String CHANNEL_ID = "yuanfang_playback";
    private static final int NOTIFY_ID = 1001;

    /**
     * 服务是否在跑。MainActivity 用它决定「要不要跟着 Activity 一起暂停 WebView」——
     * 这是「后台不自动切歌」的真正开关，见 MainActivity.onPause()。
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

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        createChannel();
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFY_ID, buildNotification());
        // START_STICKY：被系统回收后尽量拉回来，配合队列继续播
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        // 不需要绑定 —— JS 侧只调 start/stop 两个动作
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

    private Notification buildNotification() {
        // 点通知回到 App（不新建实例）
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("远方音乐")
                .setContentText("正在后台播放")
                .setSmallIcon(getApplicationInfo().icon)
                .setContentIntent(pi)
                .setOngoing(true)          // 不可划掉：划掉就等于停服务、JS 又被冻
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }
}
