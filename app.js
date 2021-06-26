const videourl = new URLSearchParams(window.location.search).get("file");
// let video;
window.electron.ripsub(videourl).then(captions => {
    console.log(captions);

    $(() => {
        document.querySelector("#videocont").innerHTML = `<video id="video" src="${videourl}" autoplay controls>`;
        let video = document.querySelector("#video");
        let captionholder = document.querySelector("#captioncont");
        const doSomethingWithTheFrame = (now, metadata) => {
            // Do something with the frame.
            let current_caption = captions.filter(cap => (cap.data.start <= video.currentTime * 1000) && (video.currentTime * 1000 <= cap.data.end));
            if (current_caption.length) {
                current_caption = current_caption[0].data.text;
            } else {
                current_caption = "";
            }
            if (captionholder.innerHTML !== current_caption) {
                captionholder.innerHTML = current_caption;
            }
            // Re-register the callback to be notified about the next frame.
            video.requestVideoFrameCallback(doSomethingWithTheFrame);
        };
        // Initially register the callback to be notified about the first frame.
        video.requestVideoFrameCallback(doSomethingWithTheFrame);
    });
});

