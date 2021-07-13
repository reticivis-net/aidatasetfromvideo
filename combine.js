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

let selectedfolders = [];

// gets passed folders from the user, needs further validation
function handleFolderUpload(folder) {
    if (selectedfolders.includes(folder)) {
        errorshake("Already added folder!");
    } else {
        selectedfolders.push(folder);
        const name = folder.split(/[\/\\]/).pop();
        let node = document.createElement("div");
        node.classList.add("folder")
        node.innerHTML = `<h3><i class="fas fa-folder"></i> ${name} <span class="text-danger folderdelete" onclick="deletefolder(this)"><i class="fas fa-times"></i></span></h3>
                          <h4><i class="fas fa-folder-tree"></i> Processing...</h4>`;
        const elem = document.querySelector("#folderdisplay").appendChild(node);
    }

}

function deletefolder(e) {
    // function gets called from X button, traverse to parent div
    let element = e.parentElement.parentElement;
    // get index of div
    const index = [...element.parentNode.children].indexOf(element);
    // remove it from folders list
    selectedfolders.splice(index, 1);
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

