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
const subtitle = require("subtitle");

// handle events called from renderer
ipcMain.handle('check-video-streams', async (event, args) => {
    const prom = util.promisify(getvideodata);
    return await prom(args);
})
ipcMain.handle('ripsub', async (event, args) => {
    const prom = util.promisify(ripsub);
    return await prom(args);
})

function getSubtitleStream(filename, callback) {
    // send raw srt subtitles to callback()
    child_process.exec(`ffmpeg -i ${filename} -map 0:s:0 -f srt -loglevel error pipe:1`,
        (error, stdout, stderr) => {
            callback(stdout)
        });
}

function ripsub(filepath, callback) {
    // regex patterns to clean subtitles
    const tagpattern = /<[^>]*?>/g; // removes html tags
    const bracketpattern = /\[[^[]*]/g; // removes bracket patterns, i.e. "[screams]"
    const dashpattern = /^[-‐]/mg; // removes dashes from beginning of lines because thats a thing?
    const newlinepattern = /[\n\r]+/g; // removes newlines
    getSubtitleStream(filepath, rawsubdata => { // get raw srt subtitles from ffmpeg
        let subs = subtitle.parseSync(rawsubdata); // parse them using subtitle lib
        // yes its a sync function but this lib only has sync functions and pipe which i DO NOT UNDERSTAND, i tried
        subs = subs.map(sub => { // apply regex cleaning to subtitles
            sub.data.text = sub.data.text.replace(tagpattern, "")
                .replace(bracketpattern, "")
                .replace(dashpattern, "")
                .replace(newlinepattern, " ")
            return sub
        });
        subs = subs.filter(sub => { // remove empty subtitles
            return sub.data.text.replace(/\s/, "") !== ""
        })
        // send subtitles back (callback format is 'cause promisify)
        callback(null, subs);
    });
}

function getvideodata(video, callback) {
    // ask ffmpeg for a json-formatted overview of the file
    child_process.exec(`ffprobe -show_format -show_streams -print_format json -loglevel error "${video}"`, (error, stdout, stderr) => {
        // callback format is (error,result), its what promisify expects idk
        if (error) {
            callback(error, null);
        }
        // parse the result and send it back
        const file_data = JSON.parse(stdout);
        callback(null, file_data);
    });
}
