package ccwu.yuanfang.music;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 网页 ↔ 原生的桥。三个方向各一件事：
 *
 *   网页 → 原生   start / stop   置「正在播放」意图，起停前台服务
 *   网页 → 原生   updateNowPlaying 推当前曲目，喂给锁屏 / 通知栏的媒体卡片
 *   原生 → 网页   （不在这里）PlaybackService 通过 bridge.eval 回调
 *                  window.__ymNativeControl(action)
 *
 * ⚠️ 设计要点（踩过坑）：**核心职责和尽力而为的部分必须解耦**。
 *
 *   playing 标志  —— 决定 MainActivity.onPause() 要不要把 WebView 一起暂停。
 *                   这是「后台能自动切歌」的**唯一必要保证**，纯内存操作，不会失败。
 *   PlaybackService —— 把进程钉在前台态、并承载媒体控件。
 *                   它是加分项，**起不来也不能影响上面那条**。
 *
 *   初版把两者绑在一起（onPause 查 PlaybackService.isRunning()），结果服务一旦起不来，
 *   WebView 照样被暂停，等于什么都没做。
 */
@CapacitorPlugin(name = "PlaybackForeground")
public class PlaybackPlugin extends Plugin {

    private static volatile boolean playing = false;

    /**
     * 给 PlaybackService 回调用 —— 服务要往网页里发 JS，但它自己拿不到 Bridge。
     *
     * ⚠️ 只在 load() 里【存引用】，**不能在这发 JS**：load() 跑在
     * webView.loadUrl() 之前（Bridge.java 里 registerAllPlugins 先于 loadWebView），
     * 那时候页面还是空的，eval 必然落空。
     */
    private static volatile Bridge sBridge = null;

    public static Bridge bridge() {
        return sBridge;
    }

    @Override
    public void load() {
        sBridge = getBridge();
    }

    public static boolean isPlaying() {
        return playing;
    }

    @PluginMethod
    public void start(PluginCall call) {
        playing = true;

        JSObject ret = new JSObject();
        ret.put("ok", true);
        String note = "service-started";
        try {
            PlaybackService.start(getContext());
        } catch (Throwable t) {
            // 服务起不来不影响「不暂停 WebView」，但要把原因带回去，别静默
            ret.put("ok", false);
            note = t.getClass().getSimpleName() + ": " + t.getMessage();
        }
        ret.put("note", note);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        playing = false;
        try {
            PlaybackService.stop(getContext());
        } catch (Throwable ignored) {
            // 停不掉也不影响什么
        }
        call.resolve();
    }

    /**
     * 网页推来当前曲目 —— 锁屏 / 通知栏媒体卡片显示的就是这份数据。
     *
     * 由 MusicPlayer.vue 的 syncMediaSession() 调用，那个函数本来就在
     * 播放 / 暂停 / 切歌时都会被触发，所以不需要额外加调用点。
     */
    @PluginMethod
    public void updateNowPlaying(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        Boolean playing = call.getBoolean("playing", Boolean.TRUE);
        // 封面必须是**绝对 URL**（前端用 location.origin 拼好的）——
        // 相对路径原生这边下载不了
        String cover = call.getString("cover", "");
        // 当前歌词行。空串 = 没有歌词，原生侧会落回显示歌手
        String lyric = call.getString("lyric", "");

        PlaybackService.updateNowPlaying(title, artist, playing == null || playing, cover, lyric);
        call.resolve();
    }

    /**
     * 读本机 APK 的版本号 —— 给前端的「检查有没有新版」用。
     *
     * 为什么放在这个插件、而不是引 @capacitor/app：
     * 插件已经在 MainActivity 注册、前端也已经在用 PlaybackForeground 这个名字，
     * 加一个方法零成本；而多一个依赖就多一处构建风险。
     *
     * 失败时回 versionCode = 0 —— 前端判断是「读不到就不提示更新」，
     * 不会因为读不到而误报有新版本。
     */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void getAppVersion(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageInfo info = getContext()
                    .getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;
            ret.put("versionCode", code);
            ret.put("versionName", info.versionName);
        } catch (Throwable t) {
            ret.put("versionCode", 0L);
            ret.put("versionName", "");
        }
        call.resolve(ret);
    }

    /**
     * 用系统浏览器打开一个链接（目前只给「下载更新」用）。
     *
     * ⚠️ 为什么不能只用网页里的 window.open —— 这是实测出来的：
     *
     *   壳模式下页面和 APK 是【同源】的（都在 yuanfang-music.pages.dev）。
     *   Capacitor 的 WebView 只把【站外】链接交给系统浏览器处理，
     *   同源链接它当成页内跳转，于是 WebView 自己去加载那个 .apk ——
     *   加载不了、又没有 DownloadListener，结果就是「点了完全没反应」。
     *
     *   旁证：OpenShop 那个按钮同样用 window.open 就好用，因为它指向别的域名。
     *
     * 所以这里直接发 ACTION_VIEW，把"交给谁"这件事从 WebView 手里拿回来。
     */
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) {
            // 没装浏览器之类的情况：把原因带回去，前端会显示出来
            call.reject(t.getClass().getSimpleName() + ": " + t.getMessage());
        }
    }

    /**
     * 探针：只回答「网页能不能调到原生插件」。
     *
     * 为什么单独要它：诊断「后台不切歌」时，之前的线索全都要先播上歌才产生
     * （播放事件才触发插件调用）。一旦有什么原因放不出声，就没有任何信号，
     * 只能靠"通知栏是不是空的"间接猜。这个探针在页面加载时就调，不依赖播放。
     */
    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("bridge", "ok");
        ret.put("playing", playing);
        ret.put("serviceRunning", PlaybackService.isRunning());
        call.resolve(ret);
    }
}
