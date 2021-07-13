// index.js

// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain, dialog} = require('electron')

// https://www.electronforge.io/config/makers/squirrel.windows#my-app-is-launching-multiple-times-during-install
if (require('electron-squirrel-startup')) return app.quit();

// update.electronjs.org
require('update-electron-app')();


const path = require('path')
let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: "icon.ico"
    })

    // and load the index.html of the app.
    mainWindow.loadFile('entry.html')

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
    return await getvideodata(args);
});
ipcMain.handle('ripsub', async (event, args) => {
    // this event rips and parses the subtitles from a video file
    return await ripsub(args, event);
});

ipcMain.handle('export-data', async (event, args) => {
    // this event rips and parses the subtitles from a video file
    return await export_final(event, args);
});
const commandExists = require('command-exists');
ipcMain.handle('ffmpeg-exists', async (event, args) => {
    return await Promise.all([commandExists("ffmpeg"), commandExists("ffprobe")]);
});

ipcMain.handle('select-dirs', async (event, arg) => {
    return await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
});
ipcMain.handle('analyze-dataset', async (event, arg) => {
    return analyze_dataset(arg);
});

function execfilepromise(file, args) {
    return new Promise(((resolve, reject) => {
        child_process.execFile(file, args, (error, stdout, stderr) => {
            if (error) reject(error);
            resolve({stdout: stdout, stderr: stderr});
        })
    }))
}

function analyze_dataset(folderpath) {
    return new Promise((resolve, reject) => {
        // check if folder has list.txt
        fileExistsProm(path.join(folderpath, "list.txt")).then(exists => {
            if (exists) {
                // read list.txt if it exists
                fs.readFile(path.join(folderpath, "list.txt"), 'utf8', (err, data) => {
                    // reject if error
                    if (err) {
                        reject(err);
                    }
                    let fileexistproms = []; // list of promises for creating the ffmpeg ones
                    let proms = []; // list of ffmpeg promises
                    // for every line in list.txt
                    data.split("\n").map((line, i) => {

                        // ignore if line doesnt have | char basically
                        line = line.split("|", 2);
                        if (line.length !== 2) {
                            console.error(`malformed syntax on line ${i}`);
                            return
                        }

                        fileexistproms.push(
                            // if the supposed file in this entry exists
                            fileExistsProm(path.join(folderpath, line[0])).then(wexists => {
                                if (wexists) {
                                    // create a promise to read the file duration
                                    proms.push(execfilepromise('ffprobe', [path.join(folderpath, line[0]), "-v", "panic", "-show_entries",
                                        "format=duration", "-of", "default=noprint_wrappers=1:nokey=1"]
                                    ));
                                } else {
                                    // log and ignore if file isnt found
                                    console.error(`couldn't find ${line[0]}`)
                                }
                            })
                        )
                    })
                    // once all file exist promises are resolved
                    // this waits for the previous loop to either create an ffmpeg promise or not based on if the file exists
                    Promise.allSettled(fileexistproms).then(() => {
                        // we know that all promises that will be added to proms are added, wait for proms to finish
                        Promise.all(proms).then(result => {
                            console.log(result)
                            // reject if there's no valid entries
                            if (result.length === 0) {
                                reject("No valid entries in list.txt")
                            } else {
                                // parse stdout to a float, add all floats together
                                const len = result.map(x => parseFloat(x.stdout)).reduce((a, b) => a + b, 0);
                                // return seconds of data, lines of data
                                resolve([len, result.length]);
                            }
                        });
                    })
                })
            } else {
                // reject if no list.txt found
                reject("No list.txt found in folder.");
            }
        })
    })
}

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

function fileExistsProm(path) {
    return new Promise(((resolve, reject) => {
        try {
            fs.access(path, fs.constants.F_OK, err => {
                resolve(!err);
            })
        } catch (err) {
            reject(err);
        }
    }))
}

const open_file_explorer = require('open-file-explorer');

function export_final(event, args) {
    return new Promise((resolve, reject) => {
        try {
            // unpack arguments
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
                        child_process_promise.execFile("ffmpeg",
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
                    resolve(true);
                }, 1000);
            });
        } catch (e) {
            reject(e);
        }
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
    const vlengthproc = child_process.execFile("ffprobe", ["-show_entries", "format=duration", "-print_format", "json", "-loglevel", "panic", filename])
    vlengthproc.then(r => {
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

function ripsub(filepath, event) {
    return new Promise((resolve, reject) => {
        try {
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
                resolve(subs);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function getvideodata(video) {
    return new Promise((resolve, reject) => {
        // ask ffmpeg for a json-formatted overview of the file
        child_process.exec(`ffprobe -show_format -show_streams -print_format json -loglevel error "${video}"`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            // parse the result and send it back
            const file_data = JSON.parse(stdout);
            resolve(file_data);
        });
    })
}
