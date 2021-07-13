let dropArea;
let root = document.documentElement;

// register event listeners related to drag-and-drop file uploading

function noffmpeg() {
    bootbox.alert({
        title: "<i class=\"fas fa-exclamation-triangle\"></i> Cannot locate FFmpeg!",
        closeButton: false,
        centerVertical: true,
        message: "You're seeing this error message because ffmpeg and/or ffprobe could not be located. Make sure FFmpeg is installed and that both of these are in PATH (on Windows).",
        callback: noffmpeg
    });
}

function noelectron() {
    bootbox.alert({
        title: "<i class=\"fas fa-exclamation-triangle\"></i> Cannot access electron!",
        closeButton: false,
        centerVertical: true,
        message: "You're seeing this error message because the renderer process (me) is unable to communicate with Electron's main process. Ensure you're running me using electron, not in browser.",
        callback: noelectron
    });
}

document.addEventListener("DOMContentLoaded", function (event) {
    if (window.electron) {
        window.electron.ipcinvoke("ffmpeg-exists").catch(() => {
            noffmpeg();
        });
    } else {
        noelectron();
    }
    dropArea = document; //document.getElementById('dropzone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false)
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false)
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false)
    });
    dropArea.addEventListener('drop', handleDrop, false)
    document.querySelector('#folderupload').addEventListener("click", handleSelect);
    document.querySelector('#combine').addEventListener("click", process);
});

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

// highlight class if file is hovering over the window, actual effects of this are css only
function highlight(e) {
    document.getElementById('dropborder').classList.add('highlight')
}

function unhighlight(e) {
    document.getElementById('dropborder').classList.remove('highlight')
}

function handleSelect(e) {
    // redirect file uploads (not drag-n-drop) to the file function
    // possible to do folder select within the renderer, but it recursively returns every file (slow), this doesnt
    window.electron.ipcinvoke("select-dirs").then(result => {
        if (!result.cancelled) {
            result.filePaths.forEach(handleFolderUpload)
        }
    });
}

function handleDrop(e) {
    // redirect file drops to the file function
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
        // the full filepath is only available under dataTransfer.items, but info on if its a directory or not is only
        // available under dataTransfer.items using webkitGetAsEntry so... this
        if (e.dataTransfer.items[i].webkitGetAsEntry().isDirectory) {
            handleFolderUpload(e.dataTransfer.files[i].path);
        }
    }
}

function process() {
    document.querySelector("#allcont").classList.add("d-none");
    document.querySelector("#progresscont").classList.remove("d-none");
    window.electron.ipcinvoke("combine-datasets", selectedfolders).then((e) => {
        // returns after explorer window is opened
        window.location = "entry.html";
    })
    window.electron.ipcon("combine-progress", (event, arg) => {
        let [text, progress] = arg;
        document.querySelector("#progresstext").innerHTML = text;
        document.querySelector("#progressbar").style.width = `${progress}%`;
        document.querySelector("#progressbar").innerHTML = `${Math.round(progress)}%`;
        if (progress >= 100) {
            let spinny = document.querySelector("#spinny");
            if (spinny) {
                spinny.parentElement.replaceChild(document.createRange().createContextualFragment("<i class=\"fad fa-check-circle\"></i>"), spinny);
            }
        }
    });
}

function refreshcreatebutton() {
    let button = document.querySelector("#combine");
    let text = document.querySelector("#combine-text");
    if (selectedfolders.filter(x => x.verified).length >= 2) {
        button.classList.remove("disabled");
        text.innerHTML = "";
        let totalseconds = 0;
        let totallines = 0;
        selectedfolders.filter(x => x.hasOwnProperty('secondsofdata')).map(x => {
            totalseconds += x.secondsofdata;
            totallines += x.linesofdata;
        })
        document.querySelector("#combined").innerHTML = `<i class="fas fa-hourglass"></i> ${totalseconds.toFixed(2)} seconds <i class="fas fa-align-left"></i> ${totallines} lines`;
    } else {
        button.classList.add("disabled");
        text.innerHTML = "Select at least 2 valid datasets to combine.";
        document.querySelector("#combined").innerHTML = "";
    }
}

let selectedfolders = [];

// gets passed folders from the user, needs further validation
function handleFolderUpload(folder) {
    if (selectedfolders.map(x => x.path).includes(folder)) {
        errorshake("Already added folder!");
    } else {
        selectedfolders.push({path: folder, verified: false});
        const name = folder.split(/[\/\\]/).pop();
        let node = document.createElement("div");
        node.classList.add("folder")
        node.innerHTML = `<h3><i class="fas fa-folder"></i> ${name} <span class="text-danger folderdelete d-none" onclick="deletefolder(this)"><i class="fas fa-times"></i></span></h3>
                          <h4 class="indent"><span class="folder-data"><i class="fad fa-spinner-third fa-spin"></i> Processing...</span></h4>`;
        const elem = document.querySelector("#folderdisplay").appendChild(node);
        window.electron.ipcinvoke('analyze-dataset', folder).then(([secondsofdata, linesofdata]) => {
            elem.querySelector(".folder-data").innerHTML = `<i class="fas fa-hourglass"></i> ${secondsofdata.toFixed(2)} seconds <i class="fas fa-align-left"></i> ${linesofdata} lines`;
            const i = selectedfolders.map(x => x.path).indexOf(folder);
            selectedfolders[i].verified = true;
            selectedfolders[i].secondsofdata = secondsofdata;
            selectedfolders[i].linesofdata = linesofdata;
            refreshcreatebutton();
            elem.querySelector(".folderdelete").classList.remove("d-none");
        }).catch(reason => {
            elem.querySelector(".folder-data").innerHTML = `<span class="text-danger">${reason}</span>`;
            elem.querySelector(".folderdelete").classList.remove("d-none");
        })
    }
}

function deletefolder(e) {
    // function gets called from X button, traverse to parent div
    let element = e.parentElement.parentElement;
    // get index of div
    const index = [...element.parentNode.children].indexOf(element);
    // remove it from folders list
    selectedfolders.splice(index, 1);
    // delete the element
    element.remove();
    refreshcreatebutton();
}

function errorshake(message) {
    document.querySelector("#error-message").innerHTML = message;
    // play animation
    let cl = document.querySelector(".shake-holder");
    cl.classList.add("error-shake");
    // restart animation
    cl.style.animation = 'none';
    cl.offsetHeight; //trigger reflow
    cl.style.animation = null;
}

