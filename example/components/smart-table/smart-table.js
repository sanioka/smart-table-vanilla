import AbstractComponent from '../abstract-component';

import {table as tableComponentFactory} from '../../../index';
import {table} from 'smart-table-core';

import {initContent as initContentSkeleton} from './template-helpers/init-content';
import row from './template-helpers/row';
import summary from './template-helpers/summary';
import pagination from './template-helpers/pagination';
import description from './template-helpers/description';

export default SmartTable;

const MAX_ROWS_PER_PAGE = 50;

class SmartTable extends AbstractComponent {
    constructor({data}) {
        super();

        this.domElement = this.getElementFactory('section');

        initContentSkeleton(this.domElement);
        onInit(this.domElement, data);
    }

    static createInstance({data}) {
        if (data && Array.isArray(data)) {
            return new SmartTable({data})
        } else {
            return null;
        }
    }

    onDestroy() {
        this.domElement.innerHTML = '';
        // TODO: document.removeEventListener
    }

}

// private method
function onInit(tableContainerEl, data) {

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
    const descriptionContainer = tableContainerEl.querySelector('#description-container');
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

    // Сборка модуля рендера таблицы
    tableComponent.onDisplayChange(displayed => {
        descriptionContainer.innerHTML = '';

        tbody.innerHTML = '';
        for (let r of displayed) {
            const newChild = row(r.value, r.index);
            tbody.appendChild(newChild);
        }
    });
}