document.addEventListener("DOMContentLoaded", function () {
    let state = {
        page: window.archivequeryparams.page || 1,
        orderby: window.archivequeryparams.orderby || 'date',
        order: window.archivequeryparams.order
    }
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

        // headers.forEach(th => {
        // });
    }
    function getUrl(s = state) {
        return `/archive/${s.page}?${new URLSearchParams({ orderby: s.orderby, order: s.order ? 'ASC' : 'DESC' }).toString()}`;
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
            td.appendChild(document.createTextNode((new Date(park.date)).toLocaleDateString()));
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
    function createPaginationLink(pagenum, text, classlist = [], current = false) {
        let child;
        if (text == null && pagenum != null) {
            text = pagenum;
        }
        if (pagenum != null) {
            child = document.createElement('a');
            child.appendChild(document.createTextNode(text));
            child.href = getUrl({
                page: pagenum,
                orderby: state.orderby,
                order: state.order
            });
            if (current) {
                child.classList.add('is-current');
            }
        }
        else {
            child = document.createElement('span');
            child.appendChild(document.createTextNode(text));

        }
        child.classList.add(classlist);
        return child;
    }
    function createPaginationNode(pagenum, text, classlist = [], current = false) {
        let li;
        li = document.createElement('li');
        li.appendChild(createPaginationLink(pagenum, text, classlist, current));
        return li;
    }
    function updatePagination(pages = 1, currentPage = 1) {
        while (pagination.firstChild) {
            pagination.removeChild(pagination.lastChild);
        }
        if (pages > 1) {
            const first = 1;
            const minpage = Math.max(1, currentPage - 4);
            const maxpage = Math.min(pages, currentPage + 4);
            let a, ul = document.createElement('ul');
            ul.classList.add('pagination-list');

            if (currentPage > first) {
                pagination.appendChild(createPaginationLink(state.page - 1, 'Previous', 'pagination-previous'));
                if (minpage > first) {
                    ul.appendChild(createPaginationNode(first, null, 'pagination-link'));
                    if (minpage > first + 1) {
                        ul.appendChild(createPaginationNode(null, '\u2026', 'pagination-ellipsis'));
                    }
                }
            }
            for (let i = minpage; i <= maxpage; i++) {
                ul.appendChild(createPaginationNode(i, null, 'pagination-link', i === currentPage));
            }
            if (currentPage < pages) {
                if (maxpage < pages) {
                    if (maxpage < pages - 1) {
                        ul.appendChild(createPaginationNode(null, '\u2026', 'pagination-ellipsis'));
                    }
                    ul.appendChild(createPaginationNode(pages, null, 'pagination-link'));
                }
                pagination.appendChild(createPaginationLink(state.page + 1, 'Next', 'pagination-next'));
            }
            pagination.appendChild(ul);
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