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
const _onInit = Symbol('onInit');

class SmartTable extends AbstractComponent {
    constructor({data}) {
        super();

        this.domElement = this.getElementFactory('section');

        initContentSkeleton(this.domElement);
        this[_onInit](this.domElement, data);
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

    /**
     * Приватный метод onInit
     * Инициализирует компонент smart-table и навешивает обработчики
     * Основа содержимого этого метода взята из smart-table-vanilla примера
     * TODO: доделать генерацию шаблона, привести в божеский вид
     *
     * @param tableContainerEl
     * @param data
     */
    [_onInit](tableContainerEl, data) {

        let self = this;

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
                self.appendChildSafety(descriptionContainer, description(data[dataIndex]))
            }
        });

        // Сборка модуля рендера таблицы
        tableComponent.onDisplayChange(displayed => {
            descriptionContainer.innerHTML = '';

            tbody.innerHTML = '';
            for (let r of displayed) {
                self.appendChildSafety(tbody, row(r.value, r.index));
            }
        });
    }

}
