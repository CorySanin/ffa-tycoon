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
    const saveidtxt = document.getElementById('saveidtxt');
    const fetchsavesbtn = document.getElementById('fetchsavesbtn');
    const parkfilesdiv = document.getElementById('parkfiles');

    document.querySelectorAll('#cheats > button').forEach(e => e.addEventListener('click', doCheat));
    document.querySelectorAll('.ipbtn').forEach(e => e.addEventListener('click', inspectIp));

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
                    this.parentElement.classList.add('is-danger', 'is-outlined');
                }
            }).catch(e => {
                this.parentElement.classList.add('is-danger', 'is-outlined');
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

    function inspectIp(event) {
        let div = event.currentTarget.parentElement.querySelector('div');
        if (!div.classList.toggle('displaynone') && !div.classList.contains('fetchedval')) {
            let ip = event.currentTarget.firstChild.nodeValue.trim();

            getIpInfo(ip).then((info) => {
                if ('message' in info) {
                    div.appendChild(createTextWrapper('div', info.message));
                }
                if ('security' in info) {
                    for (const proxyType in info.security) {
                        if (info.security[proxyType]) {
                            div.appendChild(createTextWrapper('div', `${proxyType} detected`));
                        }
                    }
                }
                if ('location' in info) {
                    div.appendChild(createTextWrapper('div', `Continent: ${info.location.continent}`));
                    div.appendChild(createTextWrapper('div', `Country: ${info.location.country}`));
                    div.appendChild(createTextWrapper('div', `Region: ${info.location.region}`));
                    div.appendChild(createTextWrapper('div', `City: ${info.location.city}`));
                }
                div.classList.add('fetchedval');
            }).catch(() => {
                div.classList.add('displaynone');
            });
        }
    }

    function createTextWrapper(element, text) {
        let e = document.createElement(element);
        e.appendChild(document.createTextNode(text));
        return e;
    }

    function getIpInfo(ip) {
        return new Promise((resolve, reject) => {
            fetch('/api/ip', {
                method: 'POST',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip })
            }).then(response => response.json())
                .then(data => {
                    if (data.status === 'ok') {
                        resolve(data);
                    }
                    else {
                        reject(data);
                    }
                });
        });
    }

    function sendMessage() {
        if (!broadcastmsg.value) {
            return;
        }
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

    function load(body) {
        return new Promise((resolve, reject) => {
            fetch(`/api/server/${serverid}/load`, {
                method: 'POST',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }).then(response => response.json())
                .then(data => {
                    resolve('status' in data && data.status === 'ok');
                }).catch(e => {
                    console.log(e);
                    reject(e);
                });
        });
    }

    function removeAllChildren(node) {
        while (node.firstChild) {
            node.removeChild(node.lastChild);
        }
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
        archivebtn.classList.remove('is-primary', 'is-outlined', 'is-danger');
        fetch(`/api/server/${serverid}/save`, {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => response.json())
            .then(data => {
                if ((archivebtn.disabled = !('status' in data && data.status === 'ok'))) {
                    archivebtn.classList.add('is-danger', 'is-outlined');
                }
                else {
                    archivebtn.classList.add('is-primary', 'is-outlined');
                }
            }).catch(e => {
                console.log(e);
                archivebtn.classList.add('is-danger', 'is-outlined');
            });
    });
    stopbtn.addEventListener('click', () => {
        stopbtn.disabled = true;
        stopbtn.classList.remove('is-primary', 'is-outlined', 'is-danger');
        fetch(`/api/server/${serverid}/stop`, {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => response.json())
            .then(data => {
                if ((stopbtn.disabled = !('status' in data && data.status === 'ok'))) {
                    stopbtn.classList.add('is-danger', 'is-outlined');
                }
                else {
                    stopbtn.classList.add('is-primary', 'is-outlined');
                }
            }).catch(e => {
                console.log(e);
                stopbtn.classList.add('is-danger', 'is-outlined');
            });
    });
    staffhirebtn.addEventListener('click', () => {
        hire(stafftype.value, staffnumtxt.value);
    });
    fetchsavesbtn.addEventListener('click', () => {
        fetchsavesbtn.disabled = true;
        fetchsavesbtn.classList.remove('is-primary', 'is-outlined', 'is-danger');
        let saveid = saveidtxt.value;
        fetch(`/api/park/${saveid}/`, {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => response.json())
            .then(data => {
                function createLoadBtn(body) {
                    let btn = document.createElement('button');
                    btn.classList.add('button');
                    btn.appendChild(document.createTextNode('Load'));
                    btn.value
                    btn.addEventListener('click', () => {
                        btn.disabled = true;
                        load(body)
                            .then(success => {
                                btn.disabled = !success
                                btn.classList.add(success ? 'is-success' : 'is-danger');
                            });
                    });
                    return btn;
                }

                if ((fetchsavesbtn.disabled = !('status' in data && data.status === 'ok'))) {
                    fetchsavesbtn.classList.add('is-danger', 'is-outlined');
                }
                else {
                    fetchsavesbtn.classList.add('is-primary', 'is-outlined');
                    const publicurl = document.getElementById('publicurltxt').value;
                    data.files.forEach(file => {
                        file = file.name;
                        let div = document.createElement('div');
                        let element = document.createElement('a');
                        div.classList.add('parkfile');
                        element.href = `${publicurl}/archive/${data.park.dir}/${file}`;
                        element.appendChild(document.createTextNode(file));
                        div.appendChild(element);
                        element = document.createElement('div');
                        element.classList.add('is-pulled-right');
                        element.appendChild(createLoadBtn({
                            file: `${data.park.dir}/${file}`,
                            id: saveid
                        }));
                        div.appendChild(element);
                        parkfilesdiv.insertBefore(div, parkfilesdiv.firstChild);
                    });
                }
            }).catch(e => {
                console.log(e);
                fetchsavesbtn.classList.add('is-danger', 'is-outlined');
            });
        removeAllChildren(parkfilesdiv);
    });
});
