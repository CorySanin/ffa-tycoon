document.addEventListener("DOMContentLoaded", function () {
    function getServerID() {
        let s = window.location.href.split('?')[0].split('/');
        return s[s.length - 1];
    }

    const serverid = getServerID();
    
    const sendbtn = document.getElementById('sendbtn');
    const broadcastmsg = document.getElementById('broadcastmsg');

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

    function sendMessage() {
        broadcastmsg.disabled = sendbtn.disabled = true;
        fetch(`/api/server/${serverid}/send`, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: broadcastmsg.value
            })
        }).then(response => response.json())
        .then(data => {
            if(!(broadcastmsg.disabled = sendbtn.disabled = !('status' in data && data.status === 'ok'))){
                broadcastmsg.value = '';
            }
            else{
                broadcastmsg.classList.add('is-danger');
            }
        }).catch(e => {
            console.log(e);
            broadcastmsg.classList.add('is-danger');
        });
    }

    for (const select of document.getElementsByClassName('groupselect')) {
        select.addEventListener('change', changePlayerGroup);
    }
    
    for (const select of document.getElementsByClassName('kickbtn')) {
        select.addEventListener('click', kickPlayer);
    }

    sendbtn.addEventListener('click', sendMessage);
});