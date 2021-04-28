document.addEventListener("DOMContentLoaded", function () {
    function getServerID() {
        let s = window.location.href.split('?')[0].split('/');
        return s[s.length - 1];
    }

    let serverid = getServerID();

    function changePlayerGroup() {
        let hash = this.id.split('-', 2)[1];
        let group = parseInt(this.value);
        this.disabled = true;
        fetch(`/api/server/${serverid}/player/${hash}`, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'update',
                properties: {
                    group
                }
            })
        }).then(response => response.json())
        .then(data => {
            if('status' in data && data.status === 'ok'){
                this.disabled = false;
            }
            else{
                this.parentElement.classList.add('is-danger');
            }
        }).catch(e => {
            this.parentElement.classList.add('is-danger');
        });
    }

    function kickPlayer() {
        let hash = this.id.split('-', 2)[1];
        this.disabled = true;
        fetch(`/api/server/${serverid}/player/${hash}`, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'kick'
            })
        }).then(response => response.json())
        .then(data => {
            if('status' in data && data.status === 'ok'){
                let row = document.getElementById(`row-${hash}`);
                row.parentElement.removeChild(row);
            }
        }).catch(e => {
            console.log(e);
        });
    }

    for (const select of document.getElementsByClassName('groupselect')) {
        select.addEventListener('change', changePlayerGroup);
    }
    
    for (const select of document.getElementsByClassName('kickbtn')) {
        select.addEventListener('click', kickPlayer);
    }
});