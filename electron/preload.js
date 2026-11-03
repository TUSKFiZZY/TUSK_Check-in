const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tuskfizzy", {
  connectHoYoLab: (profileId) => ipcRenderer.invoke("hoyo:connect", profileId),
  getDailyNote: (profileId, uid, server) =>
    ipcRenderer.invoke("hoyo:daily-note", { profileId, uid, server }),
  openHoYoLabCheckin: (profileId) => ipcRenderer.invoke("hoyo:checkin", profileId)
});
