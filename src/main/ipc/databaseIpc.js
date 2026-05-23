const { ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs').promises;
const { state } = require('../workspaceManager');

function setupDatabaseIpc() {
  ipcMain.handle('leggi-dati', async () => {
    try {
      if (state.dataFilePath && fs.existsSync(state.dataFilePath)) {
        const data = await fsp.readFile(state.dataFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) { 
      console.error(error); 
    }
    return null;
  });

  ipcMain.handle('salva-dati', async (event, dati) => {
    try {
      if (!state.dataFilePath) throw new Error("Percorso file dati non impostato");
      await fsp.writeFile(state.dataFilePath, JSON.stringify(dati, null, 2));
      return { success: true };
    } catch (error) { 
      return { success: false, error: error.message }; 
    }
  });
}

module.exports = { setupDatabaseIpc };
