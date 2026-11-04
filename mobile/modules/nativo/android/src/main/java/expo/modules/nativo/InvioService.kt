package expo.modules.nativo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

class InvioService : Service() {
  companion object {
    @Volatile private var attivo: InvioService? = null
    @Volatile private var daFermare = false

    fun preparaAvvio() { daFermare = false }

    fun ferma() {
      daFermare = true
      attivo?.chiudi()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n = Notifiche.avanzamento(this, intent?.getStringExtra("titolo") ?: "", intent?.getStringExtra("testo") ?: "", 0, 0)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(Notifiche.ID_INVIO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      else startForeground(Notifiche.ID_INVIO, n)
    } catch (e: Exception) {
      Log.w("Nativo", "servizio d'invio non in primo piano", e)
      stopSelf()
      return START_NOT_STICKY
    }
    attivo = this
    if (daFermare) chiudi()
    return START_NOT_STICKY
  }

  private fun chiudi() {
    attivo = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    chiudi()
  }

  override fun onDestroy() {
    if (attivo === this) attivo = null
    super.onDestroy()
  }
}

object Notifiche {
  const val ID_INVIO = 4101
  const val ID_ESITO = 4102
  private const val CANALE_INVIO = "invio"
  private const val CANALE_ESITO = "esito"

  fun canali(ctx: Context, invio: String, esito: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    nm.createNotificationChannel(NotificationChannel(CANALE_INVIO, invio, NotificationManager.IMPORTANCE_LOW))
    nm.createNotificationChannel(NotificationChannel(CANALE_ESITO, esito, NotificationManager.IMPORTANCE_DEFAULT))
  }

  private fun apriApp(ctx: Context): PendingIntent? {
    val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    return PendingIntent.getActivity(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  @Suppress("DEPRECATION")
  private fun builder(ctx: Context, canale: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, canale) else Notification.Builder(ctx)

  fun avanzamento(ctx: Context, titolo: String, testo: String, fatte: Int, totali: Int): Notification =
    builder(ctx, CANALE_INVIO)
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setContentTitle(titolo)
      .setContentText(testo)
      .setContentIntent(apriApp(ctx))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setProgress(totali, fatte, totali <= 0)
      .build()

  fun esito(ctx: Context, titolo: String, testo: String, ok: Boolean): Notification =
    builder(ctx, CANALE_ESITO)
      .setSmallIcon(if (ok) android.R.drawable.stat_sys_upload_done else android.R.drawable.stat_notify_error)
      .setContentTitle(titolo)
      .setContentText(testo)
      .setContentIntent(apriApp(ctx))
      .setAutoCancel(true)
      .build()
}
