package com.tempo.agenda

import android.util.Base64
import java.security.SecureRandom
import java.security.MessageDigest
import com.facebook.react.bridge.Arguments
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TempoDeviceModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  private var savePromise: Promise? = null
  private var saveContent: String? = null
  private var printView: WebView? = null
  init { context.addActivityEventListener(this) }
  override fun getName() = "TempoDevice"

  @ReactMethod
  fun createPkce(promise: Promise) {
    val random = SecureRandom()
    val bytes = ByteArray(32).also { random.nextBytes(it) }
    val verifier = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    val challenge = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8)), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    val flowBytes = ByteArray(16).also { random.nextBytes(it) }
    val flow = flowBytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    promise.resolve(Arguments.createMap().apply { putString("verifier", verifier); putString("challenge", challenge); putString("flow", flow) })
  }

  @ReactMethod
  fun saveFile(filename: String, mime: String, content: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) { promise.reject("NO_ACTIVITY", "Open Tempo to save this file."); return }
    if (content.length > 5000000) { promise.reject("TOO_LARGE", "The export is too large."); return }
    activity.runOnUiThread {
      if (savePromise != null) { promise.reject("BUSY", "Finish the current export first."); return@runOnUiThread }
      savePromise = promise
      saveContent = content
      val safeName = filename.replace(Regex("[^A-Za-z0-9_.-]"), "_").take(100).ifBlank { "tempo-calendar.ics" }
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mime
        putExtra(Intent.EXTRA_TITLE, safeName)
      }
      try { activity.startActivityForResult(intent, 42891) }
      catch (error: Exception) { savePromise = null; saveContent = null; promise.reject("SAVE_FAILED", error.message) }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != 42891) return
    val promise = savePromise ?: return
    val contents = saveContent
    savePromise = null
    saveContent = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null || contents == null) { promise.resolve(false); return }
    Thread {
      try {
        val stream = context.contentResolver.openOutputStream(uri) ?: throw Exception("Could not open the selected file.")
        stream.use { it.write(contents.toByteArray(Charsets.UTF_8)) }
        promise.resolve(true)
      } catch (error: Exception) { promise.reject("SAVE_FAILED", error.message) }
    }.start()
  }
  override fun onNewIntent(intent: Intent) {}

  @ReactMethod
  fun print(html: String, baseURL: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) { promise.reject("NO_ACTIVITY", "Open Tempo to print."); return }
    if (html.length > 5000000) { promise.reject("TOO_LARGE", "The print document is too large."); return }
    activity.runOnUiThread {
      try {
        printView?.destroy()
        val view = WebView(activity)
        printView = view
        view.settings.javaScriptEnabled = false
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        var presented = false
        view.webViewClient = object : WebViewClient() {
          override fun onPageFinished(webView: WebView, url: String) {
            if (presented) return
            presented = true
            try {
              val manager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
              manager.print("Tempo calendar", webView.createPrintDocumentAdapter("Tempo calendar"), null)
              promise.resolve(null)
            } catch (error: Exception) { promise.reject("PRINT_FAILED", error.message) }
          }
        }
        view.loadDataWithBaseURL(baseURL, html, "text/html", "UTF-8", null)
      } catch (error: Exception) { promise.reject("PRINT_FAILED", error.message) }
    }
  }
}
