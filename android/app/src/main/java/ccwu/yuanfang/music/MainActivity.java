package ccwu.yuanfang.music;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int REQ_NOTIFY = 1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地插件必须显式注册（npm 安装的插件才会被自动发现）
        registerPlugin(PlaybackPlugin.class);
        super.onCreate(savedInstanceState);

        // 安卓 13+ 的通知权限**不会自动弹**，必须主动请求。
        // 不请求的话前台服务照跑，但通知栏一片空白，看着像没生效。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
            }
        }
    }

    /**
     * 播放中【不要】把 WebView 一起暂停。
     *
     * 这是「后台只能播一首、不自动切歌」的真正开关。上一版只加了前台服务，
     * 治不了这个 —— 因为 Capacitor 的 super.onPause() 会调 webView.onPause()，
     * 而它的语义就是「停掉这个 WebView 的定时器与 JS 处理」：
     * 音频本身还在播（媒体管线在浏览器进程里），但 JS 里处理 audio 的 ended
     * 事件、进而切下一首的那段代码永远不会跑。
     *
     * 不调 super 的代价是 Capacitor 自身的 onPause 生命周期（通知插件等）不走，
     * 对「后台持续播放」这个诉求来说是必要取舍。
     */
    @Override
    public void onPause() {
        // ⚠️ 先照常走 Capacitor 的生命周期，**不要**整个跳过。
        //
        // 曾经写成 `if (playing) return;`（跳过 super）—— 那是拿"整条 onPause
        // 生命周期"去换"JS 不被冻"，一刀太粗：super.onPause() 除了暂停 JS，
        // 还牵动 WebView 与音频的生命周期，结果是**回主页音频立刻停**（比原来更糟）。
        //
        // 精准的做法是走完 super 之后，把被它停掉的 JS 定时器单独恢复回来。
        super.onPause();

        if (PlaybackPlugin.isPlaying() && getBridge() != null) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                // resumeTimers() 只影响 JS 定时器/事件，不碰音频播放
                wv.resumeTimers();
            }
        }
    }

    /**
     * 返回键。
     *
     * ⚠️ 不覆写的话走 Capacitor 默认行为 —— **finish 掉 Activity**，连带把 WebView
     * 一起销毁。声音立刻断；但前台服务不依赖 Activity，通知照旧挂着。
     * 症状因此很有辨识度：**按返回键后停在通知栏、却不播了，必须重开 App 才恢复**。
     *
     * 按 home 键走的是 moveTaskToBack（只把任务挪到后台），WebView 活着，所以正常 ——
     * 用户实测的差别（home 正常 / 返回断音）正好对上这个根因。
     *
     * 播放中一律改成「挪到后台」，和 home 键同一个语义，也是音乐类 App 的通行做法。
     * 没在播时才放行走默认逻辑（正常返回上一页 / 退出）。
     */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (PlaybackPlugin.isPlaying()) {
            moveTaskToBack(true);
            return;
        }
        super.onBackPressed();
    }
}
