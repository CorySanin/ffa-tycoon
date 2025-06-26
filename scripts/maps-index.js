document.addEventListener('DOMContentLoaded', function () {
    const toast = document.getElementById('toast');
    let timeout = -1;

    function showMessage(message, success) {
        if (timeout >= 0) {
            clearTimeout(timeout);
        }
        while (toast.firstChild) {
            toast.removeChild(toast.lastChild);
        }
        toast.classList.remove(...toast.classList);
        toast.classList.add('notification', success ? 'is-success' : 'is-danger');
        toast.appendChild(document.createTextNode(message));
        timeout = setTimeout(function() {
            toast.classList.add('is-hidden');
            timeout = -1;
        }, 2200);
    }

    async function copyInnerText(event) {
        try {
            await navigator.clipboard.writeText(event.target.innerText);
            showMessage('Copied to clipboard', true);
        }
        catch (err) {
            showMessage('Copy failed', false);
        }
    }

    for (let votestr of document.getElementsByClassName('votestr')) {
        votestr.style.cursor = 'pointer';
        votestr.addEventListener('click', copyInnerText);
    }
});
