const videourl = new URLSearchParams(window.location.search).get("file");
// let video;
let current_sub_index = 0;
window.electron.ripsub(videourl).then(captions => {
    console.log("Captions:", captions);
    $(() => {
        let num_of_chars = 0;
        document.querySelector("#videocont").innerHTML = `<video id="video" src="${videourl}" autoplay>`;
        let video = document.querySelector("#video");

        function nextsub() {
            console.log(captions);
            if (current_sub_index + 1 >= captions.length) {
                bootbox.alert("Sorted entire video!")
                //TODO: implement export behavior
            } else {
                current_sub_index++;
            }

        }

        function addundobutton() {
            document.querySelector("#do-not-assign").insertAdjacentHTML("beforebegin", undo_html);
            document.querySelector("#undo").onclick = () => {
                current_sub_index--;
                captions[current_sub_index].assigned_to = null;
                if (current_sub_index === 0) {
                    document.querySelector("#undo").remove();
                    refreshtooltips();
                }
                video.currentTime = captions[current_sub_index].data.start / 1000;
                video.play();
            }
            refreshtooltips();
        }

        video.onclick = () => {
            video.currentTime = captions[current_sub_index].data.start / 1000;
            video.play();
        };
        document.querySelector("#do-not-assign").onclick = () => {
            captions[current_sub_index].assigned_to = null;
            if (current_sub_index === 0) {
                addundobutton();
            }
            nextsub()
            video.play();
        }

        function on_char_click(index) {
            captions[current_sub_index].assigned_to = index;
            if (current_sub_index === 0) {
                addundobutton();
            }
            nextsub()
            video.play();
        }

        function construct_char_event(index) {
            return () => {
                on_char_click(index);
            }
        }

        function make_char_box(index, name) {
            let color = `var(--bs-${['blue', 'indigo', 'purple', 'pink', 'orange', 'yellow', 'cyan'].random()})`
            return `
            <div class="col char" data-bs-toggle="tooltip" data-bs-placement="top" title="Assign to '${name}'." data-char-name="${name}" data-bs-custom-class="char-tooltip" id="char-${index}" style="background: ${color}" data-index=${index}>
                <i class="fas fa-user"></i> #${index}
            </div>`;
        }

        document.querySelector("#new-char").onclick = () => {
            bootbox.prompt({
                title: "What is the name of this character?",
                closeButton: false,
                centerVertical: true,
                callback: (name) => {
                    if (!name) {
                        name = `Character #${num_of_chars}`
                    }
                    name = name.replace("\"", "");
                    captions[current_sub_index].assigned_to = num_of_chars;
                    if (current_sub_index === 0) {
                        addundobutton();
                    }

                    document.querySelector("#new-char").insertAdjacentHTML("beforebegin",
                        make_char_box(num_of_chars, name));
                    document.querySelector(`#char-${num_of_chars}`).onclick = construct_char_event(num_of_chars)
                    num_of_chars++;
                    nextsub();
                    video.play();
                    refreshtooltips();
                }
            });

        }
        let captionholder = document.querySelector("#captioncont");
        video.ontimeupdate = () => {
            // display captions based on time
            // let current_caption = captions.filter(cap => (cap.data.start <= video.currentTime * 1000) && (video.currentTime * 1000 <= cap.data.end));
            // if (current_caption.length) {
            //     current_caption = current_caption[0].data.text;
            // } else {
            //     current_caption = "";
            // }
            let current_caption = captions[current_sub_index].data.text;

            if (captionholder.innerHTML !== current_caption) {
                captionholder.innerHTML = current_caption;
            }
            // handle "current caption" logic
            if (captions[current_sub_index].data.start / 1000 > video.currentTime) {
                video.currentTime = captions[current_sub_index].data.start / 1000;
                video.play();
            }
            if (captions[current_sub_index].data.end / 1000 < video.currentTime) {
                video.pause();
                video.currentTime = captions[current_sub_index].data.end / 1000;
            }
        };
    });
});

function refreshtooltips() {
    // jquery :noperms:
    // activate tooltips
    document.querySelectorAll(".tooltip").forEach((item) => {
        item.remove();
    });
    [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });
}

$(() => refreshtooltips());


let undo_html = `
<div class="col char bg-secondary" data-bs-toggle="tooltip" data-bs-placement="top" title="Undo the last assignment" data-bs-custom-class="char-tooltip" id="undo">
    <i class="fas fa-user-times"></i>
</div>`;
Array.prototype.random = function () {
    return this[Math.floor((Math.random() * this.length))];
}
