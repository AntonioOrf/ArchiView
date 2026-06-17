import os

file_path = "src/renderer/js/logic/driveLogic.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

sync_search = "const newSyncTime = await apiCloud.sync(window.lastDriveModifiedTime);"
sync_replace = """const newSyncTime = await apiCloud.sync(window.lastDriveModifiedTime);
            
            try {
                if (apiCloud.syncAttachments) {
                    await apiCloud.syncAttachments();
                }
            } catch (attErr) {
                console.error("Errore sync allegati:", attErr);
                if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio("Sincronizzazione DB completata, ma errore negli allegati: " + attErr.message, "warning");
            }"""

content = content.replace(sync_search, sync_replace)

sync_retry_search = "const newRetryTime = await apiCloud.sync(window.lastDriveModifiedTime);"
sync_retry_replace = """const newRetryTime = await apiCloud.sync(window.lastDriveModifiedTime);
                    try {
                        if (apiCloud.syncAttachments) {
                            await apiCloud.syncAttachments();
                        }
                    } catch (attErr) {
                        console.error("Errore sync allegati:", attErr);
                    }"""

content = content.replace(sync_retry_search, sync_retry_replace)

pull_search = """if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
            }"""
pull_replace = """if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                try {
                    if (apiCloud.syncAttachments) {
                        await apiCloud.syncAttachments();
                    }
                } catch (attErr) {
                    console.error("Errore sync allegati:", attErr);
                }
            }"""

# But eseguiScaricamentoDalCloud has this exact pattern:
#                 if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
#             }
# Let's target eseguiScaricamentoDalCloud directly

pull_func_search = """window.incomingStructuralChanges = [];
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
            }
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_scaricamento_completato", "Scaricamento completato!"), "success");
"""

pull_func_replace = """window.incomingStructuralChanges = [];
                if (typeof window.renderSourceControl === 'function') window.renderSourceControl();
                
                try {
                    if (apiCloud.syncAttachments) {
                        await apiCloud.syncAttachments();
                    }
                } catch (attErr) {
                    console.error("Errore sync allegati:", attErr);
                }
            }
            if (!silent && typeof mostraMessaggio === 'function') mostraMessaggio(window.t("msg_scaricamento_completato", "Scaricamento completato!"), "success");
"""

content = content.replace(pull_func_search, pull_func_replace)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated driveLogic.ts")
