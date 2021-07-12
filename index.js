// index.js

// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')

// https://www.electronforge.io/config/makers/squirrel.windows#my-app-is-launching-multiple-times-during-install
if (require('electron-squirrel-startup')) return app.quit();

// update.electronjs.org
require('update-electron-app')();


const path = require('path')

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: "icon.ico"
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
const child_process_promise = require("child-process-promise")
const util = require('util');
const subtitle = require("subtitle");

// handle events called from renderer
ipcMain.handle('check-video-streams', async (event, args) => {
    // this event gets data about the video to validate it has video, audio, and subtitles
    const prom = util.promisify(getvideodata);
    return await prom(args);
})
ipcMain.handle('ripsub', async (event, args) => {
    // this event rips and parses the subtitles from a video file
    const prom = util.promisify(ripsub);
    return await prom(args, event);
})

ipcMain.handle('export-data', async (event, args) => {
    // this event rips and parses the subtitles from a video file
    const prom = util.promisify(export_final);
    return await prom([event, args]);
})
const commandExists = require('command-exists');
ipcMain.handle('ffmpeg-exists', async (event, args) => {
    return await Promise.all([commandExists("ffmpeg"), commandExists("ffprobe")]);
})
const fs = require("fs")

function fileExists(path) {
    // yes this syntax is stupid but i didnt make it
    try {
        fs.accessSync(path, fs.constants.F_OK);
        return true
    } catch (err) {
        return false
    }
}

const open_file_explorer = require('open-file-explorer');

function export_final(data, callback) {
    // unpack arguments
    let [event, args] = data;
    let [captions, char_names, video_path] = args;
    // send status
    event.sender.send("export-progress", ["Preparing...", 0])
    // folder to dump results into
    let outpath = "./datasets-0"
    // try out-1, out-2, out-3, etc. if out exists
    if (fileExists("./datasets-0")) {
        let index = 1;
        while (true) {
            if (!fileExists(`./datasets-${index}`)) {
                outpath = `./datasets-${index}`;
                break;
            }
            index++;
        }
    }
    // create the new folder
    fs.mkdirSync(outpath);
    // sort captions by who theyre assigned to and make the "data" the whole object
    let captions_sorted = [];
    // for every character
    for (const x of Array(char_names.length).keys()) {
        // push a list of all subs that belong to that character
        captions_sorted.push(captions.filter(item => item.assigned_to === x).map(cap => cap.data));
        // and make a subdir of outdir for the char while we're at it
        fs.mkdirSync(path.join(outpath, `char-${x}`));
    }
    event.sender.send("export-progress", ["Creating dataset...", 0]);
    let splitpromises = []; // a list of all promises of ffmpeg split events so i can wait for them all to finish
    // "meta.txt" file at root of out folder, contains osme info
    let metatxt = `datasets generated from ${video_path.split(/[\\\/]/).pop()}:\n`;
    // for every character
    captions_sorted.forEach((caps, charindex) => {
        let chardataseconds = 0; // seconds of data, will be calculated in coming loop
        let chardatalines = caps.length;
        let listtxt = "";
        // for every line of that character
        caps.forEach((cap, capindex) => {
            // split the source video according to the line's beginning and end, add the promise to the list to wait on
            splitpromises.push(
                child_process_promise.spawn("ffmpeg",
                    ["-i", video_path, "-ss", cap.start / 1000, "-t", (cap.end - cap.start) / 1000, "-c:a", "pcm_s16le",
                        `${outpath}/char-${charindex}/${capindex}.wav`]
                )
            );
            // add the filename and text to the "list.txt" (transcript) file
            listtxt += `${capindex}.wav|${cap.text.replace("\n", "")}\n`;
            // add data to meta
            chardataseconds += (cap.end - cap.start) / 1000;
        });
        // write the transcripts to a file, add the promise to the list
        splitpromises.push(fs.promises.writeFile(`${outpath}/char-${charindex}/list.txt`, listtxt))
        // add info to meta.txt
        metatxt += `char-${charindex}: "${char_names[charindex]}" (${chardataseconds.toFixed(2)}s; ${chardatalines} line${chardatalines === 1 ? '' : 's'})\n`;
    });
    metatxt += "\nGenerated by aidatasetfromvideo https://github.com/HexCodeFFF/aidatasetfromvideo";
    splitpromises.push(fs.promises.writeFile(`${outpath}/meta.txt`, metatxt));
    // when a promise completes, tell the renderer.
    let completeproms = 0;
    splitpromises.forEach(prom => {
        prom.then(() => {
            completeproms++;
            event.sender.send("export-progress", ["Creating dataset...", (completeproms / splitpromises.length) * 100]);
        });
    });
    // when all promises are complete
    Promise.allSettled(splitpromises).then(([result]) => {
        event.sender.send("export-progress", ["Complete!", 100]);
        // open the folder where we wrote everything
        open_file_explorer(path.resolve(outpath));
        // redirect back to the file upload screen which should™️ reset the state of the program and leave it ready for more!
        setTimeout(() => {
            callback(null, true);
        }, 1000);
    });
}

function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
}


function getSubtitleStream(filename, event, callback) {
    // send raw srt subtitles to callback()
    /*child_process.exec(`ffmpeg -i "${filename}" -map 0:s:0 -f srt -loglevel error pipe:1`,
        (error, stdout, stderr) => {
            console.log(error);
            callback(stdout)
        });*/
    // spawn process to rip srt subtitles from video
    const proc = child_process.spawn("ffmpeg", ["-i", filename, "-map", "0:s:0", "-f", "srt", "-loglevel", "error", "pipe:1", "-progress", "pipe:2", "-nostats"])
    // concat stdout (where subtitles are sent) and send to callback
    streamToString(proc.stdout).then(callback);
    // get video duration
    const vlengthproc = child_process.spawn("ffprobe", ["-show_entries", "format=duration", "-print_format", "json", "-loglevel", "panic", filename])
    streamToString(vlengthproc.stdout).then(r => {
        // parse raw output from ffprobe into number (vider duration)
        const vlength = Number(JSON.parse(r).format.duration);
        // progress is sent to stderr, call function when getting progress report
        proc.stderr.on('data', (data) => {
            // progress has many entries with each line being `key=value`, turn this into a dict
            let prog = {};
            data.toString('utf8').split("\n").forEach(line => {
                const lsplit = line.split("=");
                prog[lsplit[0]] = lsplit[1];
            });
            // get current time in parsing in seconds
            const out_time = Number(prog["out_time_us"]) * (0.000001);
            // each time it gets an update from stderr
            const percentdone = (out_time / vlength) * 100;
            // send progress back to renderer
            event.sender.send("ripsub-progress", percentdone);
        });
    })


}

function ripsub(filepath, event, callback) {
    // regex patterns to clean subtitles
    const tagpattern = /<[^>]*?>/g; // removes html tags
    const bracketpattern = /\[[^[]*]/g; // removes bracket patterns, i.e. "[screams]"
    const dashpattern = /^[-‐]/mg; // removes dashes from beginning of lines because thats a thing?
    const newlinepattern = /[\n\r]+/g; // removes newlines
    getSubtitleStream(filepath, event, rawsubdata => { // get raw srt subtitles from ffmpeg
        let subs = subtitle.parseSync(rawsubdata); // parse them using subtitle lib
        // yes its a sync function but this lib only has sync functions and pipe which i DO NOT UNDERSTAND, i tried
        subs = subs.map(sub => { // apply regex cleaning to subtitles
            sub.data.text = sub.data.text.replace(tagpattern, "")
                .replace(bracketpattern, "")
                .replace(dashpattern, "")
                .replace(newlinepattern, " ")
                .trim()
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
