package expo.modules.revocapermessi

import android.Manifest
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Togliere il consenso toglie anche il permesso della fotocamera (PIANO-BENVENUTO Fase 3).
class RevocaPermessiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RevocaPermessi")

    // Da Android 13 l'app rinuncia da sola: Android ritira il permesso quando il processo termina.
    // false sotto Android 13: lì lo toglie solo l'utente dalle impostazioni di sistema.
    Function("rinunciaFotocamera") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@Function false
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.revokeSelfPermissionsOnKill(listOf(Manifest.permission.CAMERA))
      true
    }
  }
}
