let dropArea;
let root = document.documentElement;
document.addEventListener("DOMContentLoaded", function (event) {
    dropArea = document.getElementById('dropzone');
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
    document.querySelector('#choosefile').addEventListener("change", handleSelect);
});

function handleSelect(e) {
    handleFileUpload(e.target.files);
}

function handleDrop(e) {
    handleFileUpload(e.dataTransfer.files);
}

// const {ipcRenderer} = require('electron');

function handleFileUpload(filelist) {
    if (filelist.length !== 1) {
        document.querySelector("#error-message").innerHTML = "Too many files!";
        errorshake();
        return
    }
    let file = filelist[0];
    if (!file.type.includes("video")) {
        document.querySelector("#error-message").innerHTML = "File must be video!";
        errorshake();
        return
    }
    console.log(filelist);
    document.querySelector("#upload-icon").innerHTML = "<i class=\"fad fa-spinner-third fa-9x fa-spin\"></i>";
    document.querySelector("#choose-text").innerHTML = "Checking video...";
    document.querySelector("#error-message").innerHTML = "";
    document.querySelector("#dropzone").style.animationDuration = "0.1s";
    // window.location = `app.html?file=${encodeURIComponent(file.path)}`;
    // window.checkIfVideoHasRequiredStreams(file.path);
    if (window.electron) { // theres a reason im using electron.......,,,
        window.electron.checkvideostreams(file.path).then((reply) => {
            const types = reply.streams.map(x => x.codec_type);
            // video must have video, audio, and subtitles
            console.log(reply);
            let success = ['video', 'audio', 'subtitle'].every(i => types.includes(i));
            if (success) {
                window.location = `app.html?file=${encodeURIComponent(file.path)}`;
            } else {
                document.querySelector("#error-message").innerHTML = "File needs to have video, audio, and subtitles.";
                errorshake();
            }
        });
    } else {
        document.querySelector("#error-message").innerHTML = "Unable to access electron.";
        errorshake();
    }

}

function errorshake() {
    document.querySelector("#upload-icon").innerHTML = "<i class=\"fas fa-upload fa-9x\"></i>";
    document.querySelector("#choose-text").innerHTML = "Choose a file.";
    document.querySelector("#dropzone").style.animationDuration = null;
    let cl = document.querySelector("#shake-holder");
    cl.classList.add("error-shake");
    // restart animation
    cl.style.animation = 'none';
    cl.offsetHeight; //trigger reflow
    cl.style.animation = null;
}

function preventDefaults(e) {
    e.preventDefault()
    e.stopPropagation()
}

function highlight(e) {
    dropArea.classList.add('highlight')
}

function unhighlight(e) {
    dropArea.classList.remove('highlight')
}