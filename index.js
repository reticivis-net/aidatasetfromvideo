// index.js

// update.electronjs.org
require('update-electron-app')()

// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('filepicker.html')

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const child_process = require("child_process");
const util = require('util');
const ripsubtitles = require("rip-subtitles");
const subtitle = require("subtitle");

ipcMain.handle('check-video-streams', async (event, args) => {
    const prom = util.promisify(getvideodata);
    return await prom(args);
})
ipcMain.handle('ripsub', async (event, args) => {
    const prom = util.promisify(ripsub);
    return await prom(args);
})

function getSubtitleStream(filename, callback) {
    let ffmpeg = child_process.exec(`ffmpeg -i ${filename} -map 0:s:0 -f srt -loglevel error pipe:1`,
        (error, stdout, stderr) => {
            callback(stdout)
        });
}

function ripsub(filepath, callback) {
    const tagpattern = /<[^>]*?>/g;
    const bracketpattern = /\[[^[]*\]/g;
    const dashpattern = /^[-‐]/mg;
    const newlinepattern = /[\n\r]{2,}/g;
    getSubtitleStream(filepath, rawsubdata => {
        let subs = subtitle.parseSync(rawsubdata);
        subs = subs.map(sub => {
            sub.data.text = sub.data.text.replace(tagpattern, "")
                .replace(bracketpattern, "")
                .replace(dashpattern, "")
                .replace(newlinepattern, "\n")
            return sub
        });
        callback(null, subs);
    });
}

function getvideodata(video, callback) {
    child_process.exec("ffprobe -show_format -show_streams -print_format json -loglevel error " + video, (error, stdout, stderr) => {
        if (error) {
            callback(error, null);
        }
        const file_data = JSON.parse(stdout);
        callback(null, file_data);
    });
}
