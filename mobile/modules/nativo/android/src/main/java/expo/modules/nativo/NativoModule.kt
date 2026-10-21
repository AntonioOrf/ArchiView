package expo.modules.nativo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class NativoModule : Module() {
  private fun percorso(uri: String): String =
    Uri.parse(uri).path ?: throw CodedException("ERR_SORGENTE", "percorso non valido: $uri", null)

  override fun definition() = ModuleDefinition {
    Name("Nativo")

    AsyncFunction("impronta") { uri: String ->
      val f = File(percorso(uri))
      val md = MessageDigest.getInstance("SHA-256")
      FileInputStream(f).use { s ->
        val buf = ByteArray(1 shl 16)
        while (true) {
          val n = s.read(buf)
          if (n < 0) break
          md.update(buf, 0, n)
        }
      }
      mapOf("sha256" to md.digest().joinToString("") { "%02x".format(it) }, "byte" to f.length().toDouble())
    }

    AsyncFunction("preparaScanner") { promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val scanner = GmsDocumentScanning.getClient(GmsDocumentScannerOptions.Builder().build())
      ModuleInstall.getClient(context)
        .installModules(ModuleInstallRequest.newBuilder().addApi(scanner).build())
        .addOnSuccessListener { promise.resolve(it.areModulesAlreadyInstalled()) }
        .addOnFailureListener { promise.reject(CodedException("ERR_SCANNER", it.message ?: "modulo dello scanner non installato", it)) }
    }

    AsyncFunction("raddrizza") { sorgente: String, angoli: List<Double>, latoMassimo: Int, qualita: Int ->
      if (angoli.size != 8) throw CodedException("ERR_ANGOLI", "servono 8 coordinate", null)
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val file = percorso(sorgente)
      val gradi = when (ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90
        ExifInterface.ORIENTATION_ROTATE_180 -> 180
        ExifInterface.ORIENTATION_ROTATE_270 -> 270
        else -> 0
      }
      val bmp = BitmapFactory.decodeFile(file) ?: throw CodedException("ERR_SORGENTE", "immagine illeggibile: $sorgente", null)
      try {
        val w = (if (gradi % 180 == 0) bmp.width else bmp.height).toFloat()
        val h = (if (gradi % 180 == 0) bmp.height else bmp.width).toFloat()
        val p = FloatArray(8) { i -> (angoli[i] * if (i % 2 == 0) w else h).toFloat() }
        fun lato(a: Int, b: Int) = hypot(p[2 * a] - p[2 * b], p[2 * a + 1] - p[2 * b + 1])
        val lw = (lato(0, 1) + lato(3, 2)) / 2
        val lh = (lato(0, 3) + lato(1, 2)) / 2
        val k = min(1f, latoMassimo / max(max(lw, lh), 1f))
        val ow = max(1, (lw * k).roundToInt())
        val oh = max(1, (lh * k).roundToInt())

        val m = Matrix()
        m.setRotate(gradi.toFloat())
        when (gradi) {
          90 -> m.postTranslate(bmp.height.toFloat(), 0f)
          180 -> m.postTranslate(bmp.width.toFloat(), bmp.height.toFloat())
          270 -> m.postTranslate(0f, bmp.width.toFloat())
        }
        val prospettiva = Matrix()
        val rettangolo = floatArrayOf(0f, 0f, ow.toFloat(), 0f, ow.toFloat(), oh.toFloat(), 0f, oh.toFloat())
        if (!prospettiva.setPolyToPoly(p, 0, rettangolo, 0, 4)) throw CodedException("ERR_ANGOLI", "quadrilatero degenere", null)
        m.postConcat(prospettiva)

        val out = Bitmap.createBitmap(ow, oh, Bitmap.Config.ARGB_8888)
        try {
          Canvas(out).drawBitmap(bmp, m, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
          val dest = File(context.cacheDir, "raddrizzata-${System.nanoTime()}.jpg")
          FileOutputStream(dest).use { out.compress(Bitmap.CompressFormat.JPEG, qualita, it) }
          mapOf("uri" to Uri.fromFile(dest).toString(), "width" to ow, "height" to oh)
        } finally {
          out.recycle()
        }
      } finally {
        bmp.recycle()
      }
    }
  }
}
