package expo.modules.revocapermessi

import android.Manifest
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RevocaPermessiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RevocaPermessi")

    Function("rinunciaFotocamera") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return@Function false
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.revokeSelfPermissionsOnKill(listOf(Manifest.permission.CAMERA))
      true
    }
  }
}
