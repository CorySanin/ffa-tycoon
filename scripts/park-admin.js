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

document.addEventListener('DOMContentLoaded', function () {
    const flattenBtn = document.getElementById('rm-all');

    if (flattenBtn) {
        const parkfilesdiv = document.querySelector('.parkfiles');
        const acceptBtns = document.querySelectorAll('.parkfiles .select-save');
        const rmBtns = document.querySelectorAll('.parkfiles .rm-save');

        flattenBtn.addEventListener('click', () => {
            flattenBtn.disabled = true;
            flattenBtn.classList.add('is-loading');
            fetch(`/api${window.location.pathname}/save`.replace('//', '/'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'rm-all'
                })
            })
                .then(data => {
                    flattenBtn.classList.remove('is-loading');
                    if (data.ok) {
                        removeChildren(parkfilesdiv);
                    }
                    else {
                        removeChildren(flattenBtn);
                        flattenBtn.classList.add('is-danger');
                        flattenBtn.appendChild(document.createTextNode("Failure"));
                    }
                }).catch(err => {
                    flattenBtn.classList.remove('is-loading');
                    removeChildren(flattenBtn);
                    flattenBtn.classList.add('is-danger');
                    flattenBtn.appendChild(document.createTextNode("Failure"));
                });
        });

        for (const btn of acceptBtns) {
            btn.addEventListener('click', () => {
                const row = btn.parentElement.parentElement;
                const rowBtns = btn.parentElement.querySelectorAll('.button');
                const file = row.querySelector('a').innerText;
                for (const b of rowBtns) {
                    b.disabled = true;
                }
                btn.classList.add('is-loading');
                fetch(`/api${window.location.pathname}/save`.replace('//', '/'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'select',
                        file
                    })
                })
                    .then(data => {
                        btn.classList.remove('is-loading');
                        if (data.ok) {
                            for (const b of rowBtns) {
                                b.disabled = false;
                            }
                            for (const r of document.querySelectorAll('.parkfile.selected')) {
                                r.classList.remove('selected');
                            }
                            row.classList.add('selected');
                        }
                        else {
                            btn.classList.add('is-danger');
                        }
                    }).catch(err => {
                        btn.classList.remove('is-loading');
                        btn.classList.add('is-danger');
                    });
            });
        }

        for (const btn of rmBtns) {
            btn.addEventListener('click', () => {
                const row = btn.parentElement.parentElement;
                const rowBtns = btn.parentElement.querySelectorAll('.button');
                const file = row.querySelector('a').innerText;
                for (const b of rowBtns) {
                    b.disabled = true;
                }
                btn.classList.add('is-loading');
                fetch(`/api${window.location.pathname}/save`.replace('//', '/'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'rm',
                        file
                    })
                })
                    .then(data => {
                        btn.classList.remove('is-loading');
                        if (data.ok) {
                            row.style.display = 'none';
                        }
                        else {
                            btn.classList.add('is-danger');
                        }
                    }).catch(err => {
                        btn.classList.remove('is-loading');
                        btn.classList.add('is-danger');
                    });
            });
        }
    }
});