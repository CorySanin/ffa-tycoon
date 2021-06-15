document.addEventListener('DOMContentLoaded', function () {
    const fileInputs = document.querySelectorAll('.fileupload .fileinput');

    function removeChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.lastChild);
        }
    }

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
            if(files.length > 0) {
                const file = files[0];
                const formData = new FormData();
                formData.append('park', file);
                uploadbtn.disabled = true;

                fetch(form.action, {
                    method: 'PUT',
                    body: formData
                }).then(data => {
                    if(data.ok){
                        resetForm();
                    }
                }).catch(err => {
                    console.log(err);
                })
            }
        });
    }
});