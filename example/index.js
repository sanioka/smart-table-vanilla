import {table as tableComponentFactory} from '../index';
import {table} from 'smart-table-core';
import row from './components/row';
import summary from './components/summary';
import pagination from './components/pagination';
import description from './components/description';

import DataLoader from './asyncDataLoader';

let dataLoader = new DataLoader(
    document.getElementById('data-loader-container'),
    document.getElementById('loading-spinner'),
    document.getElementById('table-container')
);
dataLoader.bind(activateTable);


function activateTable(data) {

    const tableContainerEl = document.getElementById('table-container');
    const tbody = tableContainerEl.querySelector('tbody');
    const summaryEl = tableContainerEl.querySelector('[data-st-summary]');

    const t = table({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 50}}});
    const tableComponent = tableComponentFactory({el: tableContainerEl, table: t});

    summary({table: t, el: summaryEl});

    const paginationContainer = tableContainerEl.querySelector('[data-st-pagination]');
    pagination({table: t, el: paginationContainer});


    const descriptionContainer = document.getElementById('description-container');
    tbody.addEventListener('click', event => {

        let target = event.target;

        let tr = target.closest('tr');
        if (!tr) return;
        if (!tbody.contains(tr)) return;

        let dataIndex = tr.getAttribute('data-index');

        if (dataIndex && data[dataIndex]) {
            descriptionContainer.innerHTML = '';
            descriptionContainer.appendChild(description(data[dataIndex]));
        }
    });


    tableComponent.onDisplayChange(displayed => {

        descriptionContainer.innerHTML = '';

        tbody.innerHTML = '';
        for (let r of displayed) {
            const newChild = row(r.value, r.index, t);
            tbody.appendChild(newChild);
        }
    });
}


