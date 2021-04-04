document.addEventListener("DOMContentLoaded", function () {
    let state = {
        page: window.archivequeryparams.page || 1,
        orderby: window.archivequeryparams.orderby || 'date',
        order: window.archivequeryparams.order
    }
    let page = window.archivequeryparams.page || 1, orderby = window.archivequeryparams.orderby || 'date', order = window.archivequeryparams.order;
    const headers = document.querySelectorAll('#parkTableHeader > th');
    const tableBody = document.getElementById('parkTableBody');
    const pagination = document.getElementById('pagination');
    const HEADEREXP = new RegExp('(.+)_header');
    function clickHeader() {
        let field = HEADEREXP.exec(this.id)[1];
        state.order = (state.orderby === field) ? !state.order : true;
        state.orderby = field;
        update();

        history.pushState(state, '', getUrl());

        headers.forEach(th => {

        });
    }
    function getUrl() {
        return `/archive/${state.page}?${new URLSearchParams({ orderby: state.orderby, order: state.order? 'ASC':'DESC' }).toString()}`;
    }
    function getParks(page = 1, orderby = 'date', order = false) {
        fetch(`/api/parks/${page}?${new URLSearchParams({ orderby, order }).toString()}`)
            .then(response => response.json())
            .then(data => {
                updateTable(data);
                updatePagination(data.pages, data.page);
            });
    }
    function clearTable() {
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.lastChild);
        }
    }
    function updateTable(data) {
        clearTable();
        data.parks.forEach(park => {
            let tr = document.createElement('tr');
            let td = document.createElement('td');
            let a = document.createElement('a');
            a.appendChild(document.createTextNode(park.name));
            a.href = `/park/${park.id}`;
            td.appendChild(a);
            tr.appendChild(td);
            td = document.createElement('td');
            td.appendChild(document.createTextNode((new Date(park.date)).toLocaleDateString() + ` (${park.date})`));
            tr.appendChild(td);
            td = document.createElement('td');
            td.appendChild(document.createTextNode(park.groupname));
            tr.appendChild(td);
            td = document.createElement('td');
            td.appendChild(document.createTextNode(park.gamemode));
            tr.appendChild(td);
            td = document.createElement('td');
            td.appendChild(document.createTextNode(park.scenario));
            tr.appendChild(td);
            tableBody.appendChild(tr);
        });
    }
    function updatePagination(pages = 1, currentPage = 1) {
        while (pagination.firstChild) {
            pagination.removeChild(pagination.lastChild);
        }
        if (pages > 1) {

        }
    }
    let update = () => {
        console.log(state.page, state.orderby, state.order)
        getParks(state.page, state.orderby, state.order);
    }


    headers.forEach(th => {
        th.addEventListener('click', clickHeader);
    });

    window.addEventListener('popstate', (event) => {
        state = event.state;
        update();
    });
    history.replaceState(state, '', getUrl());

    update();
});