// preload.js

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const {
    contextBridge,
    ipcRenderer
} = require("electron");
const fs = require("fs");
contextBridge.exposeInMainWorld("electron", {
    checkvideostreams: (filepath) => {
        return ipcRenderer.invoke('check-video-streams', filepath)
    },
    ripsub: (filepath) => {
        return ipcRenderer.invoke('ripsub', filepath)
    },
})