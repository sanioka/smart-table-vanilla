import {table as tableComponentFactory} from '../../../index';
import {table} from 'smart-table-core';

import initContent from './init-content';
import row from './row';
import summary from './summary';
import pagination from './pagination';
import description from './description';

export default SmartTable;

const MAX_ROWS_PER_PAGE = 50;

class SmartTable {
    constructor(tableContainerEl, data) {
        if (tableContainerEl) {
            this.tableContainerEl = tableContainerEl;
            this.onInit();
            this.activateTable(data);
        }
    }

    onInit() {
        initContent(this.tableContainerEl)
    }

    onDestroy() {
        this.tableContainerEl.innerHTML = '';
    }

    activateTable(data) {

        let tableContainerEl = this.tableContainerEl;

        const tbody = tableContainerEl.querySelector('tbody');

        // Сборка smart-table-core
        const t = table({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: MAX_ROWS_PER_PAGE}}});
        const tableComponent = tableComponentFactory({el: tableContainerEl, table: t});

        // Сборка модуля summary
        const summaryEl = tableContainerEl.querySelector('[data-st-summary]');
        summary({table: t, el: summaryEl});

        // Сборка модуля пагинации
        const paginationContainer = tableContainerEl.querySelector('[data-st-pagination]');
        pagination({table: t, el: paginationContainer});

        // Сборка модуля описания
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

        // Сборка модуля рендера
        tableComponent.onDisplayChange(displayed => {
            descriptionContainer.innerHTML = '';

            tbody.innerHTML = '';
            for (let r of displayed) {
                const newChild = row(r.value, r.index, t);
                tbody.appendChild(newChild);
            }
        });
    }
}