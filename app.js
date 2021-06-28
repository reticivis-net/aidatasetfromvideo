// get video URL, passed through GET params
const videourl = new URLSearchParams(window.location.search).get("file");

// TODO: replace current_sub_index with char_data.length
let current_sub_index = 0;
let char_data = [];


function export_data(captions) {

}

// extracting subtitles requires FFMPEG, must be performed by main thread
// see ripsub() in index.js
window.electron.ipcinvoke("ripsub", videourl).then(subtitles => {
    console.log("Captions:", subtitles);
    $(() => { // waits for DOM to load, if it hasnt it runs immediately (i think?)
        // char is short for character, not letters but people.
        let num_of_chars = 0;
        // hovering over a character has a dynamically generated tooltip displaying name, # of lines, and s of data
        // dynamically generated because its easier than keeping track each operation (thanks undo)
        function char_tooltip(index) {
            // index will be undefined if called by bootstrap when a tooltip is generated
            // index will be defined if called on char click (contents need to be changed but still hovering so its done manually)
            if (index === undefined) {
                // get index from html attr
                index = parseInt(this.getAttribute('data-index'));
            }
            // get total lines and s of data based on index
            let all_assignments = subtitles.filter(cap => cap.assigned_to === index)
            let total_data = 0;
            all_assignments.forEach(assignment => total_data += (assignment.data.end - assignment.data.start) / 1000);
            // return tooltip title based on data
            return `<p>Assign to '${char_data[index].name}'.</p><div class="char-data text-muted"><p>${all_assignments.length} lines</p><p>${total_data.toFixed(2)}s of data</p></div>`;
        }

        // no need to display video before subtitles are loaded and the url has to be grabbed in JS anyways so its added now
        document.querySelector("#videocont").innerHTML = `<video id="video" src="${videourl}" autoplay>`;
        let video = document.querySelector("#video");

        // current_sub_index++ except if we hit the end
        function nextsub() {
            console.log(subtitles);
            if (current_sub_index + 1 >= subtitles.length) { // there are no more subtitles to assign, we are finished.
                bootbox.alert("Sorted entire video!")
                export_data(subtitles);
            } else {
                current_sub_index++;
            }

        }

        // adds undo button, having it exist on the first caption is confusing and i really should just have it hidden oh well
        function addundobutton() {
            // add undo button html
            document.querySelector("#do-not-assign").insertAdjacentHTML("beforebegin", undo_html);
            // add click event
            document.querySelector("#undo").onclick = () => {
                // decrement current sub and remove its assignment
                current_sub_index--;
                subtitles[current_sub_index].assigned_to = undefined;

                if (current_sub_index === 0) { // if we're back to sub 0, remove button
                    document.querySelector("#undo").remove();
                    refreshtooltips();
                }
                // play video from new (old?) sub
                video.currentTime = subtitles[current_sub_index].data.start / 1000;
                video.play();
            }
            refreshtooltips();
        }

        // replay current sub on clicking the video
        video.onclick = () => {
            video.currentTime = subtitles[current_sub_index].data.start / 1000;
            video.play();
        };
        // when clicking the do not assign button
        document.querySelector("#do-not-assign").onclick = () => {
            // assign current caption to nobody and increment sub
            subtitles[current_sub_index].assigned_to = null;
            if (current_sub_index === 0) {
                addundobutton();
            }
            nextsub()
            video.play();
        }

        // when a character button is clicked
        function on_char_click(index) {
            // assign current sub to this char and increment sub
            subtitles[current_sub_index].assigned_to = index;
            if (current_sub_index === 0) {
                addundobutton();
            }
            nextsub();
            // update tooltip contents
            let thischar = document.querySelector(`#char-${index}`);
            let tt = bootstrap.Tooltip.getInstance(thischar);
            if (tt) {
                tt.tip.querySelector(".tooltip-inner").innerHTML = char_tooltip(index);
            }
            video.play();
        }

        // fix index in place for this event, probably a better approach but i Dont Care
        function construct_char_event(index) {
            return () => {
                on_char_click(index);
            }
        }

        // make html for constructing a char button
        function make_char_box(index, name) {
            return `
            <div class="col char" id="char-${index}" data-char-name="${name}" data-index=${index}>
                <i class="fas fa-user"></i> #${index}
            </div>`;
        }

        // when adding a new char
        document.querySelector("#new-char").onclick = () => {
            // ask for name
            bootbox.prompt({
                title: "What is the name of this character?",
                closeButton: false,
                centerVertical: true,
                callback: (name) => {
                    // blank name seems annoying/confusing
                    if (!name) {
                        name = `Character #${num_of_chars}`
                    }
                    // just in case?
                    name = name.replace("\"", "");
                    // assign current sub to this new char
                    subtitles[current_sub_index].assigned_to = num_of_chars;
                    if (current_sub_index === 0) {
                        addundobutton();
                    }
                    // create new char box
                    document.querySelector("#new-char").insertAdjacentHTML("beforebegin",
                        make_char_box(num_of_chars, name));
                    // assign it a click event and tooltip
                    let thischar = document.querySelector(`#char-${num_of_chars}`);
                    thischar.onclick = construct_char_event(num_of_chars);
                    new bootstrap.Tooltip(thischar, {
                        placement: "top",
                        title: char_tooltip,
                        customClass: "char-tooltip",
                        html: true
                    })
                    // add its name to char_data
                    char_data.push({
                        name: name,
                        index: num_of_chars,
                    })
                    // num_of_chars is more really the index to use for the next char
                    num_of_chars++;
                    // increment sub and continue
                    nextsub();
                    video.play();
                    refreshtooltips();
                }
            });

        }
        let captionholder = document.querySelector("#captioncont");
        // should run "between 4hz and 60hz", doesnt need to be frame-perfect
        video.ontimeupdate = () => {
            // UNUSED CODE to display subtitles based on time
            /*
            let current_caption = subtitles.filter(cap => (cap.data.start <= video.currentTime * 1000) && (video.currentTime * 1000 <= cap.data.end));
            if (current_caption.length) {
                current_caption = current_caption[0].data.text;
            } else {
                current_caption = "";
            }
            */


            // display sub based on current sub. video pausing is a bit slow so this is easier on the user
            let current_caption = subtitles[current_sub_index].data.text;
            // no practical purpose, it just makes me feel good (and looks better in inspect element)
            if (captionholder.innerHTML !== current_caption) {
                captionholder.innerHTML = current_caption;
            }
            // skip to beginning of the sub if current time is before
            if (subtitles[current_sub_index].data.start / 1000 > video.currentTime) {
                video.currentTime = subtitles[current_sub_index].data.start / 1000;
                video.play();
            }
            // pause video and rewind to end of current sub once its finished
            if (subtitles[current_sub_index].data.end / 1000 < video.currentTime) {
                video.pause();
                // rewinding is because pausing can happen a little late, not entirely sure why
                video.currentTime = subtitles[current_sub_index].data.end / 1000;
            }
        };
    });
});

function refreshtooltips() {
    // really ugly without jquery
    // activate tooltips

    // tooltips persist if element is removed (like undo button), remove all existing tooltips for this reason
    document.querySelectorAll(".tooltip").forEach((item) => {
        item.remove();
    });
    // based on bootstrap docs code to activate all tooltips based on attrs
    [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });
}

// initially activate tooltips
$(() => refreshtooltips());

// html content of the undo button, not sure why its down here
let undo_html = `
<div class="col char bg-secondary" data-bs-toggle="tooltip" data-bs-placement="top" title="Undo the last assignment" data-bs-custom-class="char-tooltip" id="undo">
    <i class="fas fa-user-times"></i>
</div>`;
