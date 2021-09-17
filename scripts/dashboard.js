document.addEventListener("DOMContentLoaded", function () {
    const serverlistings = document.getElementById('serverlistings');
    const isAdmin = !!document.getElementById('admin-index');

    function updateDashboard() {
        fetch('/api/server/')
            .then(response => response.json())
            .then(data => {
                if ('servers' in data) {
                    clearDashboard();
                    data.servers.forEach(createElement);
                }
            });
    }

    function clearDashboard() {
        while (serverlistings.firstChild) {
            serverlistings.removeChild(serverlistings.lastChild);
        }
    }

    function createElement(server, index) {
        let block, stats, child, subtitle;
        block = document.createElement('div');
        block.classList.add('block');
        child = document.createElement('span');
        child.classList.add('subtitle');
        subtitle = document.createTextNode(server.server.name);
        if(isAdmin) {
            let anchor = document.createElement('a');
            anchor.href = `/server/${index}`;
            anchor.appendChild(subtitle);
            subtitle = anchor;
        }
        child.appendChild(subtitle);
        block.appendChild(child);
        serverlistings.appendChild(block);
        stats = document.createElement('div');
        stats.classList.add('parkstats');

        stats.appendChild(createStat('Group', server.server.group));
        stats.appendChild(createStat('Mode', server.server.mode));
        stats.appendChild(createStat('Scenario', server.park.name));
        stats.appendChild(createStat('Guests', server.park.guests));
        stats.appendChild(createStat('Rating', server.park.rating, true));
        stats.appendChild(createStat('Online', server.network.players.length - 1));

        block.appendChild(stats);
    }

    function createStat(title, value, rating = false) {
        let statdiv = document.createElement('div');
        let property = document.createElement('span');
        let valuetext = document.createElement('span');
        property.classList.add('property');
        property.appendChild(document.createTextNode(`${title}:`));
        statdiv.appendChild(property);
        statdiv.appendChild(document.createTextNode(' '));
        valuetext.appendChild(document.createTextNode(value));
        if (rating) {
            if(value >= 550){
                valuetext.classList.add('is-success');
            }
            else if (value > 350){
                valuetext.classList.add('is-warning');
            }
            else{
                valuetext.classList.add('is-danger');
            }
        }

        statdiv.appendChild(valuetext);
        return statdiv;
    }

    setInterval(updateDashboard, 15000);
});