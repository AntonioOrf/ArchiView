import { app } from 'electron';

const e2eUserData = process.env.ARCHIVIEW_E2E_USER_DATA;
if (e2eUserData) {
  try {
    app.setPath('userData', e2eUserData);
    app.setPath('sessionData', e2eUserData);
  } catch (e) {
    console.error('[e2eBootstrap] setPath userData fallito:', e);
  }
}

if (e2eUserData && process.env.ARCHIVIEW_E2E_BACKGROUND) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
}

export {  };
