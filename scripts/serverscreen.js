document.addEventListener("DOMContentLoaded", function () {
    function getServerID() {
        let s = window.location.href.split('?')[0].split('/');
        return s[s.length - 1];
    }

    const serverid = getServerID();

    const sendbtn = document.getElementById('sendbtn');
    const broadcastmsg = document.getElementById('broadcastmsg');
    const archivebtn = document.getElementById('archivebtn');
    const stopbtn = document.getElementById('stopbtn');
    const staffnumtxt = document.getElementById('staffnumtxt');
    const stafftype = document.getElementById('stafftype');
    const staffhirebtn = document.getElementById('staffhirebtn');
    
    document.querySelectorAll('#cheats > button').forEach(e => e.addEventListener('click', doCheat));

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
                if ('status' in data && data.status === 'ok') {
                    this.disabled = false;
                }
                else {
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
                if ('status' in data && data.status === 'ok') {
                    let row = document.getElementById(`row-${hash}`);
                    row.parentElement.removeChild(row);
                }
            }).catch(e => {
                console.log(e);
            });
    }

    function hire(type, amount) {
        amount = parseInt(amount);
        if (isNaN(amount) || amount <= 0) {
            return;
        }
        fetch(`/api/server/${serverid}/staff`, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'hire',
                type,
                amount
            })
        }).then(response => response.json())
            .then(data => {
                if ('status' in data && data.status !== 'ok') {
                    console.log(data);
                }
            }).catch(e => {
                console.log(e);
            });
    }

    function doCheat(event) {
        fetch(`/api/server/${serverid}/cheat`, {
            method: 'POST',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'cheat',
                params: event.currentTarget.value 
            })
        }).then(response => response.json())
            .then(data => {
                if ('status' in data && data.status !== 'ok') {
                    console.log(data);
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
                if (!(broadcastmsg.disabled = sendbtn.disabled = !('status' in data && data.status === 'ok'))) {
                    broadcastmsg.value = '';
                }
                else {
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
    broadcastmsg.addEventListener('keyup', (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
    archivebtn.addEventListener('click', () => {
        archivebtn.disabled = true;
        archivebtn.classList.remove('is-primary', 'is-danger');
        fetch(`/api/server/${serverid}/save`, {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => response.json())
            .then(data => {
                if ((archivebtn.disabled = !('status' in data && data.status === 'ok'))) {
                    archivebtn.classList.add('is-danger');
                }
                else {
                    archivebtn.classList.add('is-primary');
                }
            }).catch(e => {
                console.log(e);
                archivebtn.classList.add('is-danger');
            });
    });
    stopbtn.addEventListener('click', () => {
        stopbtn.disabled = true;
        stopbtn.classList.remove('is-primary', 'is-danger');
        fetch(`/api/server/${serverid}/stop`, {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => response.json())
            .then(data => {
                if ((stopbtn.disabled = !('status' in data && data.status === 'ok'))) {
                    stopbtn.classList.add('is-danger');
                }
                else {
                    stopbtn.classList.add('is-primary');
                }
            }).catch(e => {
                console.log(e);
                stopbtn.classList.add('is-danger');
            });
    });
    staffhirebtn.addEventListener('click', () => {
        hire(stafftype.value, staffnumtxt.value);
    });
});