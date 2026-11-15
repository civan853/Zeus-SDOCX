package dev.zeus.sdocx

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import java.io.OutputStream

@Suppress("DEPRECATION")
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var chooser: ValueCallback<Array<Uri>>? = null
    private var out: OutputStream? = null
    private var outUri: Uri? = null
    private var failed = false

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        web = WebView(this); setContentView(web)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest) = loader.shouldInterceptRequest(r.url)

            // Bellek dolunca WebView süreci ölür; uygulamayı da öldürmek yerine yeniden başlat.
            override fun onRenderProcessGone(v: WebView, d: RenderProcessGoneDetail): Boolean {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Bellek doldu, uygulama yeniden başlıyor. Dosyalar kaydedildiyse İndirilenler/ZeusSDOCX içindedir.", Toast.LENGTH_LONG).show()
                    (v.parent as? ViewGroup)?.removeView(v); v.destroy(); recreate()
                }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                chooser?.onReceiveValue(null); chooser = cb
                startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), 1)
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    override fun onActivityResult(rc: Int, res: Int, d: Intent?) {
        if (rc == 1) { chooser?.onReceiveValue(d?.data?.takeIf { res == RESULT_OK }?.let { arrayOf(it) }); chooser = null }
    }

    inner class Bridge {
        @JavascriptInterface fun begin(name: String, mime: String, dir: String): Boolean = try {
            failed = false
            val d = dir.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().ifEmpty { "Notlar" }
            val v = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name); put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, "Download/ZeusSDOCX/$d"); put(MediaStore.Downloads.IS_PENDING, 1)
            }
            outUri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v)
            out = contentResolver.openOutputStream(outUri!!); true
        } catch (e: Exception) { false }

        @JavascriptInterface fun chunk(b64: String) {
            try { out?.write(Base64.decode(b64, Base64.DEFAULT)) } catch (e: Exception) { failed = true }
        }

        @JavascriptInterface fun end(): String = try {
            out?.close(); out = null
            val u = outUri
            if (failed || u == null) "" else {
                contentResolver.update(u, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
                u.toString()
            }
        } catch (e: Exception) { "" }

        @JavascriptInterface fun open(uri: String, mime: String) {
            runOnUiThread {
                try { startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }
                catch (e: Exception) { Toast.makeText(this@MainActivity, "Açacak uygulama bulunamadı", Toast.LENGTH_LONG).show() }
            }
        }

        @JavascriptInterface fun keepAwake(on: Boolean) {
            runOnUiThread {
                if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}
