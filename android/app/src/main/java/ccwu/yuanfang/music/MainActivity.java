package ccwu.yuanfang.music;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int REQ_NOTIFY = 1;

    /**
     * 返回键：播放中不销毁 Activity。见 handleOnBackPressed() 里的长注释。
     *
     * ⚠️ 用 dispatcher 而不是覆写 onBackPressed()。Capacitor 的 BridgeActivity
     * 没有覆写返回键，androidx ComponentActivity 的默认实现会走 OnBackPressedDispatcher；
     * 而 Android 13+ 一旦启用预测性返回，框架**根本不调用 onBackPressed()** ——
     * 覆写它等于没写（这就是上一版改了却毫无效果的原因）。
     * dispatcher 这条路两种机制通吃：androidx 会在启用预测性返回时自动把它
     * 桥接成 OnBackInvokedCallback。
     */
    private final OnBackPressedCallback backCallback = new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
            if (PlaybackPlugin.isPlaying()) {
                // 播放中：挪到后台，与 home 键同语义。
                // 不能放行 —— 默认行为是 finish 掉 Activity，连带销毁 WebView，
                // 声音立刻断，而前台服务不依赖 Activity 所以通知还挂着；
                // 更糟的是 PlaybackPlugin 里静态存着的那个 Bridge 变成指向死 WebView，
                // 于是通知栏/锁屏的控件全部失灵（用户实测正是这三条）。
                moveTaskToBack(true);
                return;
            }
            // 没在播：交还默认行为（正常返回上一页 / 退出）。
            // 先自禁用再转发，避免自己又被调一次造成死循环。
            setEnabled(false);
            getOnBackPressedDispatcher().onBackPressed();
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地插件必须显式注册（npm 安装的插件才会被自动发现）
        registerPlugin(PlaybackPlugin.class);
        super.onCreate(savedInstanceState);

        // 注册在 super.onCreate 之后：dispatcher 是「后注册的先执行」，
        // 这样我们排在 Capacitor / androidx 可能注册的任何回调之前
        getOnBackPressedDispatcher().addCallback(this, backCallback);

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

}
