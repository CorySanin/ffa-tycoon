function removeChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.lastChild);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const fileInputs = document.querySelectorAll('.fileupload .fileinput');

    for (const input of fileInputs) {
        const form = input.parentElement.parentElement;
        const textbox = form.querySelector('label.input');
        const uploadbtn = form.querySelector('button.button');

        const updateText = () => {
            const files = input.files;
            let newText = 'No file selected';
            if (!(uploadbtn.disabled = files.length == 0)) {
                newText = files[0].name;
            }
            removeChildren(textbox);
            textbox.appendChild(document.createTextNode(newText));
        }

        const resetForm = () => {
            form.reset();
            updateText();
        }

        resetForm();

        input.addEventListener('change', updateText);

        uploadbtn.addEventListener('click', () => {
            const files = input.files;
            if (files.length > 0) {
                const file = files[0];
                const formData = new FormData();
                formData.append('park', file);
                uploadbtn.disabled = true;

                fetch(form.action, {
                    method: 'PUT',
                    body: formData
                }).then(data => {
                    if (data.ok) {
                        resetForm();
                        location.reload(true);
                    }
                }).catch(err => {
                    console.log(err);
                })
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const deletebtn = document.getElementById('deletebtn');
    let confirm = 0;

    deletebtn.addEventListener('click', () => {
        if (confirm === 1) {
            deletebtn.disabled = true;
            deletebtn.classList.add('is-loading');
            fetch(`/api${window.location.pathname}`, {
                method: 'DELETE'
            })
                .then(data => {
                    deletebtn.classList.remove('is-loading');
                    removeChildren(deletebtn);
                    if (data.ok) {
                        deletebtn.classList.add('is-success');
                        deletebtn.appendChild(document.createTextNode("Deleted"));
                        setTimeout(() => {
                            location.href = '/archive';
                        }, 1500);
                    }
                    else {
                        deletebtn.classList.add('is-danger');
                        deletebtn.appendChild(document.createTextNode("Failure"));
                    }
                }).catch(err => {
                    deletebtn.classList.remove('is-loading');
                    removeChildren(deletebtn);
                    deletebtn.classList.add('is-danger');
                    deletebtn.appendChild(document.createTextNode("Failure"));
                });
        }
        else {
            removeChildren(deletebtn);
            deletebtn.classList.add('is-warning');
            deletebtn.appendChild(document.createTextNode("Confirm?"));
        }
        confirm++;
    });
});