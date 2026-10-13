package ccwu.yuanfang.music;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 把「正在播放」这个意图告诉原生，并顺手起一个前台服务。
 *
 * ⚠️ 设计要点（踩过坑）：**核心职责和尽力而为的部分必须解耦**。
 *
 *   playing 标志  —— 决定 MainActivity.onPause() 要不要暂停 WebView。
 *                   这是「后台能自动切歌」的**唯一必要保证**，纯内存操作，不会失败。
 *   PlaybackService —— 只是把进程钉在前台态、降低被系统回收的概率。
 *                   它是加分项，**起不来也不能影响上面那条**。
 *
 *   初版把两者绑在一起（onPause 查 PlaybackService.isRunning()），结果服务一旦起不来，
 *   WebView 照样被暂停，等于什么都没做。
 */
@CapacitorPlugin(name = "PlaybackForeground")
public class PlaybackPlugin extends Plugin {

    private static volatile boolean playing = false;

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
