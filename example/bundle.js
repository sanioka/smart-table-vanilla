(function () {
'use strict';

/**
 * Модуль асинхронной загрузки данных
 * В случае успешной загрузки отправляет данные в eventListeners
 * Так же управляет DOM, спиннером загрузки и обрабатывает ошибки
 */

const STATE_LOADING = 'STATE_LOADING';
const STATE_EMPTY = 'STATE_EMPTY';
const STATE_LOADED_SUCCESSFUL = 'STATE_LOADED_SUCCESSFUL';

class AsyncDataLoader$1 {

    constructor(container, spinnerContainer, tableContainer) {
        if (container && spinnerContainer && tableContainer) {
            this.container = container;
            this.spinnerContainer = spinnerContainer;
            this.tableContainer = tableContainer;
            this.subscribeEvents();

            this.renderState = STATE_EMPTY;
        }

        this.eventListeners = [];
    }

    subscribeEvents() {
        let dataLoaderContainer = this.container;

        const dataLoaderButtons = dataLoaderContainer.getElementsByTagName('button');
        if (dataLoaderButtons) {
            for (let el of dataLoaderButtons) {
                el.addEventListener('click', ev => {

                    // Защита от повторных нажатий в момент Pending
                    if (this.renderState !== STATE_LOADING) {
                        let url = el.getAttribute('data-src');
                        if (url) {
                            this.renderState = STATE_LOADING;

                            fetch(url)
                                .then(response => {
                                    return response.json()
                                })
                                .then(response => {
                                    for (let handler of this.eventListeners) {
                                        handler(response);
                                    }
                                    this.renderState = STATE_LOADED_SUCCESSFUL;
                                })
                                .catch(err => {
                                    this.renderState = STATE_EMPTY;
                                    console.error(err);
                                });
                        }
                    }

                });
            }
        }
    }

    bind(handler) {
        this.eventListeners.push(handler);
    }

    set renderState(newState) {
        switch (newState) {
            case STATE_EMPTY:
                this._renderState = newState;
                this.spinnerContainer.style.display = 'none';
                this.tableContainer.style.display = 'none';
                break;

            case STATE_LOADING:
                this._renderState = newState;
                this.spinnerContainer.style.display = 'block';
                this.tableContainer.style.display = 'none';
                break;

            case STATE_LOADED_SUCCESSFUL:
                this._renderState = newState;
                this.spinnerContainer.style.display = 'none';
                this.tableContainer.style.display = 'block';
                break;
        }
    }

    get renderState() {
        return this._renderState;
    }

}

function swap (f) {
  return (a, b) => f(b, a);
}

function compose (first, ...fns) {
  return (...args) => fns.reduce((previous, current) => current(previous), first(...args));
}

function curry (fn, arityLeft) {
  const arity = arityLeft || fn.length;
  return (...args) => {
    const argLength = args.length || 1;
    if (arity === argLength) {
      return fn(...args);
    } else {
      const func = (...moreArgs) => fn(...args, ...moreArgs);
      return curry(func, arity - args.length);
    }
  };
}



function tap (fn) {
  return arg => {
    fn(arg);
    return arg;
  }
}

function pointer (path) {

  const parts = path.split('.');

  function partial (obj = {}, parts = []) {
    const p = parts.shift();
    const current = obj[p];
    return (current === undefined || parts.length === 0) ?
      current : partial(current, parts);
  }

  function set (target, newTree) {
    let current = target;
    const [leaf, ...intermediate] = parts.reverse();
    for (let key of intermediate.reverse()) {
      if (current[key] === undefined) {
        current[key] = {};
        current = current[key];
      }
    }
    current[leaf] = Object.assign(current[leaf] || {}, newTree);
    return target;
  }

  return {
    get(target){
      return partial(target, [...parts])
    },
    set
  }
}

function sortByProperty (prop) {
  const propGetter = pointer(prop).get;
  return (a, b) => {
    const aVal = propGetter(a);
    const bVal = propGetter(b);

    if (aVal === bVal) {
      return 0;
    }

    if (bVal === undefined) {
      return -1;
    }

    if (aVal === undefined) {
      return 1;
    }

    return aVal < bVal ? -1 : 1;
  }
}

function sortFactory ({pointer: pointer$$1, direction} = {}) {
  if (!pointer$$1 || direction === 'none') {
    return array => [...array];
  }

  const orderFunc = sortByProperty(pointer$$1);
  const compareFunc = direction === 'desc' ? swap(orderFunc) : orderFunc;

  return (array) => [...array].sort(compareFunc);
}

function typeExpression (type) {
  switch (type) {
    case 'boolean':
      return Boolean;
    case 'number':
      return Number;
    case 'date':
      return (val) => new Date(val);
    default:
      return compose(String, (val) => val.toLowerCase());
  }
}

const operators = {
  includes(value){
    return (input) => input.includes(value);
  },
  is(value){
    return (input) => Object.is(value, input);
  },
  isNot(value){
    return (input) => !Object.is(value, input);
  },
  lt(value){
    return (input) => input < value;
  },
  gt(value){
    return (input) => input > value;
  },
  lte(value){
    return (input) => input <= value;
  },
  gte(value){
    return (input) => input >= value;
  },
  equals(value){
    return (input) => value == input;
  },
  notEquals(value){
    return (input) => value != input;
  }
};

const every = fns => (...args) => fns.every(fn => fn(...args));

function predicate ({value = '', operator = 'includes', type = 'string'}) {
  const typeIt = typeExpression(type);
  const operateOnTyped = compose(typeIt, operators[operator]);
  const predicateFunc = operateOnTyped(value);
  return compose(typeIt, predicateFunc);
}

//avoid useless filter lookup (improve perf)
function normalizeClauses (conf) {
  const output = {};
  const validPath = Object.keys(conf).filter(path => Array.isArray(conf[path]));
  validPath.forEach(path => {
    const validClauses = conf[path].filter(c => c.value !== '');
    if (validClauses.length) {
      output[path] = validClauses;
    }
  });
  return output;
}

function filter$1 (filter) {
  const normalizedClauses = normalizeClauses(filter);
  const funcList = Object.keys(normalizedClauses).map(path => {
    const getter = pointer(path).get;
    const clauses = normalizedClauses[path].map(predicate);
    return compose(getter, every(clauses));
  });
  const filterPredicate = every(funcList);

  return (array) => array.filter(filterPredicate);
}

var search$1 = function (searchConf = {}) {
  const {value, scope = []} = searchConf;
  const searchPointers = scope.map(field => pointer(field).get);
  if (!scope.length || !value) {
    return array => array;
  } else {
    return array => array.filter(item => searchPointers.some(p => String(p(item)).includes(String(value))))
  }
};

function sliceFactory ({page = 1, size} = {}) {
  return function sliceFunction (array = []) {
    const actualSize = size || array.length;
    const offset = (page - 1) * actualSize;
    return array.slice(offset, offset + actualSize);
  };
}

function emitter () {

  const listenersLists = {};
  const instance = {
    on(event, ...listeners){
      listenersLists[event] = (listenersLists[event] || []).concat(listeners);
      return instance;
    },
    dispatch(event, ...args){
      const listeners = listenersLists[event] || [];
      for (let listener of listeners) {
        listener(...args);
      }
      return instance;
    },
    off(event, ...listeners){
      if (!event) {
        Object.keys(listenersLists).forEach(ev => instance.off(ev));
      } else {
        const list = listenersLists[event] || [];
        listenersLists[event] = listeners.length ? list.filter(listener => !listeners.includes(listener)) : [];
      }
      return instance;
    }
  };
  return instance;
}

function proxyListener (eventMap) {
  return function ({emitter}) {

    const proxy = {};
    let eventListeners = {};

    for (let ev of Object.keys(eventMap)) {
      const method = eventMap[ev];
      eventListeners[ev] = [];
      proxy[method] = function (...listeners) {
        eventListeners[ev] = eventListeners[ev].concat(listeners);
        emitter.on(ev, ...listeners);
        return proxy;
      };
    }

    return Object.assign(proxy, {
      off(ev){
        if (!ev) {
          Object.keys(eventListeners).forEach(eventName => proxy.off(eventName));
        }
        if (eventListeners[ev]) {
          emitter.off(ev, ...eventListeners[ev]);
        }
        return proxy;
      }
    });
  }
}

const TOGGLE_SORT = 'TOGGLE_SORT';
const DISPLAY_CHANGED = 'DISPLAY_CHANGED';
const PAGE_CHANGED = 'CHANGE_PAGE';
const EXEC_CHANGED = 'EXEC_CHANGED';
const FILTER_CHANGED = 'FILTER_CHANGED';
const SUMMARY_CHANGED = 'SUMMARY_CHANGED';
const SEARCH_CHANGED = 'SEARCH_CHANGED';
const EXEC_ERROR = 'EXEC_ERROR';

function curriedPointer (path) {
  const {get, set} = pointer(path);
  return {get, set: curry(set)};
}

var table$2 = function ({
  sortFactory,
  tableState,
  data,
  filterFactory,
  searchFactory
}) {
  const table = emitter();
  const sortPointer = curriedPointer('sort');
  const slicePointer = curriedPointer('slice');
  const filterPointer = curriedPointer('filter');
  const searchPointer = curriedPointer('search');

  const safeAssign = curry((base, extension) => Object.assign({}, base, extension));
  const dispatch = curry(table.dispatch.bind(table), 2);

  const dispatchSummary = (filtered) => {
    dispatch(SUMMARY_CHANGED, {
      page: tableState.slice.page,
      size: tableState.slice.size,
      filteredCount: filtered.length
    });
  };

  const exec = ({processingDelay = 20} = {}) => {
    table.dispatch(EXEC_CHANGED, {working: true});
    setTimeout(function () {
      try {
        const filterFunc = filterFactory(filterPointer.get(tableState));
        const searchFunc = searchFactory(searchPointer.get(tableState));
        const sortFunc = sortFactory(sortPointer.get(tableState));
        const sliceFunc = sliceFactory(slicePointer.get(tableState));
        const execFunc = compose(filterFunc, searchFunc, tap(dispatchSummary), sortFunc, sliceFunc);
        const displayed = execFunc(data);
        table.dispatch(DISPLAY_CHANGED, displayed.map(d => {
          return {index: data.indexOf(d), value: d};
        }));
      } catch (e) {
        table.dispatch(EXEC_ERROR, e);
      } finally {
        table.dispatch(EXEC_CHANGED, {working: false});
      }
    }, processingDelay);
  };

  const updateTableState = curry((pter, ev, newPartialState) => compose(
    safeAssign(pter.get(tableState)),
    tap(dispatch(ev)),
    pter.set(tableState)
  )(newPartialState));

  const resetToFirstPage = () => updateTableState(slicePointer, PAGE_CHANGED, {page: 1});

  const tableOperation = (pter, ev) => compose(
    updateTableState(pter, ev),
    resetToFirstPage,
    () => table.exec() // we wrap within a function so table.exec can be overwritten (when using with a server for example)
  );

  const api = {
    sort: tableOperation(sortPointer, TOGGLE_SORT),
    filter: tableOperation(filterPointer, FILTER_CHANGED),
    search: tableOperation(searchPointer, SEARCH_CHANGED),
    slice: compose(updateTableState(slicePointer, PAGE_CHANGED), () => table.exec()),
    exec,
    eval(state = tableState){
      return Promise.resolve()
        .then(function () {
          const sortFunc = sortFactory(sortPointer.get(state));
          const searchFunc = searchFactory(searchPointer.get(state));
          const filterFunc = filterFactory(filterPointer.get(state));
          const sliceFunc = sliceFactory(slicePointer.get(state));
          const execFunc = compose(filterFunc, searchFunc, sortFunc, sliceFunc);
          return execFunc(data).map(d => {
            return {index: data.indexOf(d), value: d}
          });
        });
    },
    onDisplayChange(fn){
      table.on(DISPLAY_CHANGED, fn);
    },
    getTableState(){
      const sort = Object.assign({}, tableState.sort);
      const search = Object.assign({}, tableState.search);
      const slice = Object.assign({}, tableState.slice);
      const filter = {};
      for (let prop in tableState.filter) {
        filter[prop] = tableState.filter[prop].map(v => Object.assign({}, v));
      }
      return {sort, search, slice, filter};
    }
  };

  const instance = Object.assign(table, api);

  Object.defineProperty(instance, 'length', {
    get(){
      return data.length;
    }
  });

  return instance;
};

var tableDirective = function ({
  sortFactory$$1 = sortFactory,
  filterFactory = filter$1,
  searchFactory = search$1,
  tableState = {sort: {}, slice: {page: 1}, filter: {}, search: {}},
  data = []
}, ...tableDirectives) {

  const coreTable = table$2({sortFactory: sortFactory$$1, filterFactory, tableState, data, searchFactory});

  return tableDirectives.reduce((accumulator, newdir) => {
    return Object.assign(accumulator, newdir({
      sortFactory: sortFactory$$1,
      filterFactory,
      searchFactory,
      tableState,
      data,
      table: coreTable
    }));
  }, coreTable);
};

const searchListener = proxyListener({[SEARCH_CHANGED]: 'onSearchChange'});

var searchDirective = function ({table, scope = []}) {
  return Object.assign(
    searchListener({emitter: table}), {
      search(input){
        return table.search({value: input, scope});
      }
    });
};

const sliceListener = proxyListener({[PAGE_CHANGED]: 'onPageChange', [SUMMARY_CHANGED]: 'onSummaryChange'});

var sliceDirective = function ({table}) {
  let {slice:{page:currentPage, size:currentSize}} = table.getTableState();
  let itemListLength = table.length;

  const api = {
    selectPage(p){
      return table.slice({page: p, size: currentSize});
    },
    selectNextPage(){
      return api.selectPage(currentPage + 1);
    },
    selectPreviousPage(){
      return api.selectPage(currentPage - 1);
    },
    changePageSize(size){
      return table.slice({page: 1, size});
    },
    isPreviousPageEnabled(){
      return currentPage > 1;
    },
    isNextPageEnabled(){
      return Math.ceil(itemListLength / currentSize) > currentPage;
    }
  };
  const directive = Object.assign(api, sliceListener({emitter: table}));

  directive.onSummaryChange(({page:p, size:s, filteredCount}) => {
    currentPage = p;
    currentSize = s;
    itemListLength = filteredCount;
  });

  return directive;
};

const sortListeners = proxyListener({[TOGGLE_SORT]: 'onSortToggle'});
const directions = ['asc', 'desc'];

var sortDirective = function ({pointer, table, cycle = false}) {

  const cycleDirections = cycle === true ? ['none'].concat(directions) : [...directions].reverse();

  let hit = 0;

  const directive = Object.assign({
    toggle(){
      hit++;
      const direction = cycleDirections[hit % cycleDirections.length];
      return table.sort({pointer, direction});
    }

  }, sortListeners({emitter: table}));

  directive.onSortToggle(({pointer:p}) => {
    if (pointer !== p) {
      hit = 0;
    }
  });

  return directive;
};

const executionListener = proxyListener({[SUMMARY_CHANGED]: 'onSummaryChange'});

var summaryDirective = function ({table}) {
  return executionListener({emitter: table});
};

const executionListener$1 = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

var workingIndicatorDirective = function ({table}) {
  return executionListener$1({emitter: table});
};

const search = searchDirective;
const slice = sliceDirective;
const summary = summaryDirective;
const sort = sortDirective;

const workingIndicator = workingIndicatorDirective;
const table = tableDirective;

var loading = function ({table: table$$1, el}) {
  const component = workingIndicator({table: table$$1});
  component.onExecutionChange(function ({working}) {
    el.classList.remove('st-working');
    if (working === true) {
      el.classList.add('st-working');
    }
  });
  return component;
};

var sort$1 = function ({el, table: table$$1, conf = {}}) {
  const pointer = conf.pointer || el.getAttribute('data-st-sort');
  const cycle = conf.cycle || el.hasAttribute('data-st-sort-cycle');
  const component = sort({pointer, table: table$$1, cycle});
  component.onSortToggle(({pointer:currentPointer, direction}) => {
    el.classList.remove('st-sort-asc', 'st-sort-desc');
    if (pointer === currentPointer && direction !== 'none') {
      const className = direction === 'asc' ? 'st-sort-asc' : 'st-sort-desc';
      el.classList.add(className);
    }
  });
  const eventListener = ev => component.toggle();
  el.addEventListener('click', eventListener);
  return component;
};

var searchForm = function ({el, table: table$$1, delay = 400, conf = {}}) {
    const scope = conf.scope || (el.getAttribute('data-st-search-form') || '').split(',').map(s => s.trim());
    const component = search({table: table$$1, scope});

    if (el) {
        let input = el.getElementsByTagName('input');
        let button = el.getElementsByTagName('button');

        if (input && input[0] && button && button[0]) {
            button[0].addEventListener('click', event => {
                component.search(input[0].value);
            });

            input[0].addEventListener('keydown', event => {
                if (event && event.keyCode && event.keyCode === 13) {
                    component.search(input[0].value);
                }
            });


        }
    }

};

var tableComponentFactory = function ({el, table}) {
    // boot
    [...el.querySelectorAll('[data-st-sort]')].forEach(el => sort$1({el, table}));
    [...el.querySelectorAll('[data-st-loading-indicator]')].forEach(el => loading({el, table}));
    // [...el.querySelectorAll('[data-st-filter]')].forEach(el => filter({el, table}));
    // [...el.querySelectorAll('[data-st-search]')].forEach(el => searchInput({el, table}));
    [...el.querySelectorAll('[data-st-search-form]')].forEach(el => searchForm({el, table}));

    //extension
    const tableDisplayChange = table.onDisplayChange;
    return Object.assign(table, {
        onDisplayChange: (listener) => {
            tableDisplayChange(listener);
            table.exec();
        }
    });
};

var initContent = function (el) {
    if (el) {
        el.innerHTML = `
        <div data-st-loading-indicator="">
            Processing ...
        </div>
        <table>
            <thead>
            <tr>
                <th colspan="5">
                    <div data-st-search-form="id, firstName, lastName, email, phone">
                        <label for="search">global search</label>
                        <input id="search" placeholder="Case sensitive search" type="text"/>
                        <button id="searchButton">Search</button>
                    </div>
                </th>
            </tr>
            <tr>
                <th data-st-sort="id" data-st-sort-cycle>Id</th>
                <th data-st-sort="firstName">firstName</th>
                <th data-st-sort="lastName">lastName</th>
                <th data-st-sort="email">email</th>
                <th data-st-sort="phone">phone</th>
            </tr>
            </thead>
            <tbody>
            <tr>
                <td colspan="5">Loading data ...</td>
            </tr>
            </tbody>
            <tfoot>
            <tr>
                <td colspan="3" data-st-summary></td>
                <td colspan="2">
                    <div data-st-pagination></div>
                </td>
            </tr>
            </tfoot>
        </table>

        <div id="description-container">
        </div>`;
    }
};

var row = function ({id, firstName, lastName, email, phone}, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-index', index);
    tr.innerHTML = `<td>${id}</td><td>${firstName}</td><td>${lastName}</td><td>${email}</td><td>${phone}</td>`;
    return tr;
};

function summaryComponent ({table: table$$1, el}) {
  const dir = summary({table: table$$1});
  dir.onSummaryChange(({page, size, filteredCount}) => {
    el.innerHTML = `showing items <strong>${(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> - <strong>${Math.min(filteredCount, page * size)}</strong> of <strong>${filteredCount}</strong> matching items`;
  });
  return dir;
}

function paginationComponent({table: table$$1, el}) {
    const previousButton = document.createElement('button');
    previousButton.innerHTML = 'Previous';
    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Next';
    const pageSpan = document.createElement('span');
    pageSpan.innerHTML = '- page 1 -';

    const comp = slice({table: table$$1});

    comp.onSummaryChange(({page}) => {
        previousButton.disabled = !comp.isPreviousPageEnabled();
        nextButton.disabled = !comp.isNextPageEnabled();
        pageSpan.innerHTML = `- ${page} -`;
    });

    previousButton.addEventListener('click', () => comp.selectPreviousPage());
    nextButton.addEventListener('click', () => comp.selectNextPage());

    el.appendChild(previousButton);
    el.appendChild(pageSpan);
    el.appendChild(nextButton);

    return comp;
}

var description = function (item) {

    const div = document.createElement('div');

    div.innerHTML = `Выбран пользователь <b>${item.firstName} ${item.lastName}</b><br>
            Описание:<br>

            <textarea>
            ${item.description}
            </textarea><br>

            Адрес проживания: <b>${item.adress.streetAddress}</b><br>
            Город: <b>${item.adress.city}</b><br>
            Провинция/штат: <b>${item.adress.state}</b><br>
            Индекс: <b>${item.adress.zip}</b>`;

    return div;
};

const MAX_ROWS_PER_PAGE = 50;

class SmartTable$1 {
    constructor(tableContainerEl, data) {
        if (tableContainerEl) {
            this.tableContainerEl = tableContainerEl;
            this.onInit();
            this.activateTable(data);
        }
    }

    onInit() {
        initContent(this.tableContainerEl);
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
        summaryComponent({table: t, el: summaryEl});

        // Сборка модуля пагинации
        const paginationContainer = tableContainerEl.querySelector('[data-st-pagination]');
        paginationComponent({table: t, el: paginationContainer});

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

let tableContainer = document.getElementById('table-container');

// #1 Инициализируем асинхронный загрузчик данных
let dataLoader = new AsyncDataLoader$1(
    document.getElementById('data-loader-container'),
    document.getElementById('loading-spinner'),
    tableContainer
);

// #2 Инициализируем модуль отображения данных
let smartTable;

function onLoadedData(responseData) {
    if (smartTable) {
        smartTable.onDestroy();
        smartTable = null;
    }

    smartTable = new SmartTable$1(tableContainer, responseData);
}

// #3 Привязываем сущности
dataLoader.bind(onLoadedData);

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJjb21wb25lbnRzL2FzeW5jLWRhdGEtbG9hZGVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLW9wZXJhdG9ycy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1qc29uLXBvaW50ZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc29ydC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1maWx0ZXIvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtc2VhcmNoL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3NsaWNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWV2ZW50cy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9ldmVudHMuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy90YWJsZS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NlYXJjaC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3NsaWNlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc29ydC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3N1bW1hcnkuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy93b3JraW5nSW5kaWNhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvaW5kZXguanMiLCIuLi9saWIvbG9hZGluZ0luZGljYXRvci5qcyIsIi4uL2xpYi9zb3J0LmpzIiwiLi4vbGliL3NlYXJjaEZvcm0uanMiLCIuLi9saWIvdGFibGUuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL2luaXQtY29udGVudC5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvcm93LmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS9zdW1tYXJ5LmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS9wYWdpbmF0aW9uLmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS9kZXNjcmlwdGlvbi5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvc21hcnQtdGFibGUuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqINCc0L7QtNGD0LvRjCDQsNGB0LjQvdGF0YDQvtC90L3QvtC5INC30LDQs9GA0YPQt9C60Lgg0LTQsNC90L3Ri9GFXG4gKiDQkiDRgdC70YPRh9Cw0LUg0YPRgdC/0LXRiNC90L7QuSDQt9Cw0LPRgNGD0LfQutC4INC+0YLQv9GA0LDQstC70Y/QtdGCINC00LDQvdC90YvQtSDQsiBldmVudExpc3RlbmVyc1xuICog0KLQsNC6INC20LUg0YPQv9GA0LDQstC70Y/QtdGCIERPTSwg0YHQv9C40L3QvdC10YDQvtC8INC30LDQs9GA0YPQt9C60Lgg0Lgg0L7QsdGA0LDQsdCw0YLRi9Cy0LDQtdGCINC+0YjQuNCx0LrQuFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IEFzeW5jRGF0YUxvYWRlcjtcblxuY29uc3QgU1RBVEVfTE9BRElORyA9ICdTVEFURV9MT0FESU5HJztcbmNvbnN0IFNUQVRFX0VNUFRZID0gJ1NUQVRFX0VNUFRZJztcbmNvbnN0IFNUQVRFX0xPQURFRF9TVUNDRVNTRlVMID0gJ1NUQVRFX0xPQURFRF9TVUNDRVNTRlVMJztcblxuY2xhc3MgQXN5bmNEYXRhTG9hZGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGNvbnRhaW5lciwgc3Bpbm5lckNvbnRhaW5lciwgdGFibGVDb250YWluZXIpIHtcbiAgICAgICAgaWYgKGNvbnRhaW5lciAmJiBzcGlubmVyQ29udGFpbmVyICYmIHRhYmxlQ29udGFpbmVyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgICAgIHRoaXMuc3Bpbm5lckNvbnRhaW5lciA9IHNwaW5uZXJDb250YWluZXI7XG4gICAgICAgICAgICB0aGlzLnRhYmxlQ29udGFpbmVyID0gdGFibGVDb250YWluZXI7XG4gICAgICAgICAgICB0aGlzLnN1YnNjcmliZUV2ZW50cygpO1xuXG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gU1RBVEVfRU1QVFk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzID0gW107XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlRXZlbnRzKCkge1xuICAgICAgICBsZXQgZGF0YUxvYWRlckNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyO1xuXG4gICAgICAgIGNvbnN0IGRhdGFMb2FkZXJCdXR0b25zID0gZGF0YUxvYWRlckNvbnRhaW5lci5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYnV0dG9uJyk7XG4gICAgICAgIGlmIChkYXRhTG9hZGVyQnV0dG9ucykge1xuICAgICAgICAgICAgZm9yIChsZXQgZWwgb2YgZGF0YUxvYWRlckJ1dHRvbnMpIHtcbiAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyDQl9Cw0YnQuNGC0LAg0L7RgiDQv9C+0LLRgtC+0YDQvdGL0YUg0L3QsNC20LDRgtC40Lkg0LIg0LzQvtC80LXQvdGCIFBlbmRpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyU3RhdGUgIT09IFNUQVRFX0xPQURJTkcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB1cmwgPSBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IFNUQVRFX0xPQURJTkc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmZXRjaCh1cmwpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlciBvZiB0aGlzLmV2ZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlcihyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclN0YXRlID0gU1RBVEVfTE9BREVEX1NVQ0NFU1NGVUw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJTdGF0ZSA9IFNUQVRFX0VNUFRZO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBiaW5kKGhhbmRsZXIpIHtcbiAgICAgICAgdGhpcy5ldmVudExpc3RlbmVycy5wdXNoKGhhbmRsZXIpO1xuICAgIH1cblxuICAgIHNldCByZW5kZXJTdGF0ZShuZXdTdGF0ZSkge1xuICAgICAgICBzd2l0Y2ggKG5ld1N0YXRlKSB7XG4gICAgICAgICAgICBjYXNlIFNUQVRFX0VNUFRZOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlclN0YXRlID0gbmV3U3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGlubmVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFNUQVRFX0xPQURJTkc6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNwaW5uZXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFNUQVRFX0xPQURFRF9TVUNDRVNTRlVMOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlclN0YXRlID0gbmV3U3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGlubmVyQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZW5kZXJTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0YXRlO1xuICAgIH1cblxufSIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuICB9O1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gcHJveHkub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGRpc3BhdGNoU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICBjb25zdCBzb3J0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zb3J0KTtcbiAgICAgIGNvbnN0IHNlYXJjaCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2VhcmNoKTtcbiAgICAgIGNvbnN0IHNsaWNlID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zbGljZSk7XG4gICAgICBjb25zdCBmaWx0ZXIgPSB7fTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gdGFibGVTdGF0ZS5maWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtzb3J0LCBzZWFyY2gsIHNsaWNlLCBmaWx0ZXJ9O1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBpbnN0YW5jZSA9IE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGEubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHtTRUFSQ0hfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2VhcmNoTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU0VBUkNIX0NIQU5HRURdOiAnb25TZWFyY2hDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIHNjb3BlID0gW119KSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKFxuICAgIHNlYXJjaExpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pLCB7XG4gICAgICBzZWFyY2goaW5wdXQpe1xuICAgICAgICByZXR1cm4gdGFibGUuc2VhcmNoKHt2YWx1ZTogaW5wdXQsIHNjb3BlfSk7XG4gICAgICB9XG4gICAgfSk7XG59IiwiaW1wb3J0IHtQQUdFX0NIQU5HRUQsIFNVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2xpY2VMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tQQUdFX0NIQU5HRURdOiAnb25QYWdlQ2hhbmdlJywgW1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIGxldCB7c2xpY2U6e3BhZ2U6Y3VycmVudFBhZ2UsIHNpemU6Y3VycmVudFNpemV9fSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgbGV0IGl0ZW1MaXN0TGVuZ3RoID0gdGFibGUubGVuZ3RoO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzZWxlY3RQYWdlKHApe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiBwLCBzaXplOiBjdXJyZW50U2l6ZX0pO1xuICAgIH0sXG4gICAgc2VsZWN0TmV4dFBhZ2UoKXtcbiAgICAgIHJldHVybiBhcGkuc2VsZWN0UGFnZShjdXJyZW50UGFnZSArIDEpO1xuICAgIH0sXG4gICAgc2VsZWN0UHJldmlvdXNQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgLSAxKTtcbiAgICB9LFxuICAgIGNoYW5nZVBhZ2VTaXplKHNpemUpe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiAxLCBzaXplfSk7XG4gICAgfSxcbiAgICBpc1ByZXZpb3VzUGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG4gICAgfSxcbiAgICBpc05leHRQYWdlRW5hYmxlZCgpe1xuICAgICAgcmV0dXJuIE1hdGguY2VpbChpdGVtTGlzdExlbmd0aCAvIGN1cnJlbnRTaXplKSA+IGN1cnJlbnRQYWdlO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbihhcGksIHNsaWNlTGlzdGVuZXIoe2VtaXR0ZXI6IHRhYmxlfSkpO1xuXG4gIGRpcmVjdGl2ZS5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlOnAsIHNpemU6cywgZmlsdGVyZWRDb3VudH0pID0+IHtcbiAgICBjdXJyZW50UGFnZSA9IHA7XG4gICAgY3VycmVudFNpemUgPSBzO1xuICAgIGl0ZW1MaXN0TGVuZ3RoID0gZmlsdGVyZWRDb3VudDtcbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn1cbiIsImltcG9ydCB7VE9HR0xFX1NPUlR9IGZyb20gJy4uL2V2ZW50cydcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc29ydExpc3RlbmVycyA9IHByb3h5TGlzdGVuZXIoe1tUT0dHTEVfU09SVF06ICdvblNvcnRUb2dnbGUnfSk7XG5jb25zdCBkaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZSA9IGZhbHNlfSkge1xuXG4gIGNvbnN0IGN5Y2xlRGlyZWN0aW9ucyA9IGN5Y2xlID09PSB0cnVlID8gWydub25lJ10uY29uY2F0KGRpcmVjdGlvbnMpIDogWy4uLmRpcmVjdGlvbnNdLnJldmVyc2UoKTtcblxuICBsZXQgaGl0ID0gMDtcblxuICBjb25zdCBkaXJlY3RpdmUgPSBPYmplY3QuYXNzaWduKHtcbiAgICB0b2dnbGUoKXtcbiAgICAgIGhpdCsrO1xuICAgICAgY29uc3QgZGlyZWN0aW9uID0gY3ljbGVEaXJlY3Rpb25zW2hpdCAlIGN5Y2xlRGlyZWN0aW9ucy5sZW5ndGhdO1xuICAgICAgcmV0dXJuIHRhYmxlLnNvcnQoe3BvaW50ZXIsIGRpcmVjdGlvbn0pO1xuICAgIH1cblxuICB9LCBzb3J0TGlzdGVuZXJzKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpwfSkgPT4ge1xuICAgIGlmIChwb2ludGVyICE9PSBwKSB7XG4gICAgICBoaXQgPSAwO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn0iLCJpbXBvcnQge1NVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3QgZXhlY3V0aW9uTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU1VNTUFSWV9DSEFOR0VEXTogJ29uU3VtbWFyeUNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHtFWEVDX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W0VYRUNfQ0hBTkdFRF06ICdvbkV4ZWN1dGlvbkNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHRhYmxlRGlyZWN0aXZlIGZyb20gJy4vc3JjL3RhYmxlJztcbmltcG9ydCBmaWx0ZXJEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9maWx0ZXInO1xuaW1wb3J0IHNlYXJjaERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NlYXJjaCc7XG5pbXBvcnQgc2xpY2VEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zbGljZSc7XG5pbXBvcnQgc29ydERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NvcnQnO1xuaW1wb3J0IHN1bW1hcnlEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zdW1tYXJ5JztcbmltcG9ydCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvd29ya2luZ0luZGljYXRvcic7XG5cbmV4cG9ydCBjb25zdCBzZWFyY2ggPSBzZWFyY2hEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc2xpY2UgPSBzbGljZURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzdW1tYXJ5ID0gc3VtbWFyeURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzb3J0ID0gc29ydERpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBmaWx0ZXIgPSBmaWx0ZXJEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgd29ya2luZ0luZGljYXRvciA9IHdvcmtpbmdJbmRpY2F0b3JEaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgdGFibGUgPSB0YWJsZURpcmVjdGl2ZTtcbmV4cG9ydCBkZWZhdWx0IHRhYmxlO1xuIiwiaW1wb3J0IHt3b3JraW5nSW5kaWNhdG9yfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHdvcmtpbmdJbmRpY2F0b3Ioe3RhYmxlfSk7XG4gIGNvbXBvbmVudC5vbkV4ZWN1dGlvbkNoYW5nZShmdW5jdGlvbiAoe3dvcmtpbmd9KSB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnc3Qtd29ya2luZycpO1xuICAgIGlmICh3b3JraW5nID09PSB0cnVlKSB7XG4gICAgICBlbC5jbGFzc0xpc3QuYWRkKCdzdC13b3JraW5nJyk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGNvbXBvbmVudDtcbn07IiwiaW1wb3J0IHtzb3J0fSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGUsIGNvbmYgPSB7fX0pIHtcbiAgY29uc3QgcG9pbnRlciA9IGNvbmYucG9pbnRlciB8fCBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc29ydCcpO1xuICBjb25zdCBjeWNsZSA9IGNvbmYuY3ljbGUgfHwgZWwuaGFzQXR0cmlidXRlKCdkYXRhLXN0LXNvcnQtY3ljbGUnKTtcbiAgY29uc3QgY29tcG9uZW50ID0gc29ydCh7cG9pbnRlciwgdGFibGUsIGN5Y2xlfSk7XG4gIGNvbXBvbmVudC5vblNvcnRUb2dnbGUoKHtwb2ludGVyOmN1cnJlbnRQb2ludGVyLCBkaXJlY3Rpb259KSA9PiB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnc3Qtc29ydC1hc2MnLCAnc3Qtc29ydC1kZXNjJyk7XG4gICAgaWYgKHBvaW50ZXIgPT09IGN1cnJlbnRQb2ludGVyICYmIGRpcmVjdGlvbiAhPT0gJ25vbmUnKSB7XG4gICAgICBjb25zdCBjbGFzc05hbWUgPSBkaXJlY3Rpb24gPT09ICdhc2MnID8gJ3N0LXNvcnQtYXNjJyA6ICdzdC1zb3J0LWRlc2MnO1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgIH1cbiAgfSk7XG4gIGNvbnN0IGV2ZW50TGlzdGVuZXIgPSBldiA9PiBjb21wb25lbnQudG9nZ2xlKCk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnRMaXN0ZW5lcik7XG4gIHJldHVybiBjb21wb25lbnQ7XG59IiwiaW1wb3J0IHtzZWFyY2h9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZSwgZGVsYXkgPSA0MDAsIGNvbmYgPSB7fX0pIHtcbiAgICBjb25zdCBzY29wZSA9IGNvbmYuc2NvcGUgfHwgKGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1zdC1zZWFyY2gtZm9ybScpIHx8ICcnKS5zcGxpdCgnLCcpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBzZWFyY2goe3RhYmxlLCBzY29wZX0pO1xuXG4gICAgaWYgKGVsKSB7XG4gICAgICAgIGxldCBpbnB1dCA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbnB1dCcpO1xuICAgICAgICBsZXQgYnV0dG9uID0gZWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2J1dHRvbicpO1xuXG4gICAgICAgIGlmIChpbnB1dCAmJiBpbnB1dFswXSAmJiBidXR0b24gJiYgYnV0dG9uWzBdKSB7XG4gICAgICAgICAgICBidXR0b25bMF0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudCA9PiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnNlYXJjaChpbnB1dFswXS52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaW5wdXRbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGV2ZW50ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgJiYgZXZlbnQua2V5Q29kZSAmJiBldmVudC5rZXlDb2RlID09PSAxMykge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc2VhcmNoKGlucHV0WzBdLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG5cbiAgICAgICAgfVxuICAgIH1cblxufTsiLCJpbXBvcnQgbG9hZGluZyBmcm9tICcuL2xvYWRpbmdJbmRpY2F0b3InO1xuaW1wb3J0IHNvcnQgZnJvbSAnLi9zb3J0Jztcbi8vIGltcG9ydCBmaWx0ZXIgZnJvbSAnLi9maWx0ZXJzJztcbi8vIGltcG9ydCBzZWFyY2hJbnB1dCBmcm9tICcuL3NlYXJjaCc7XG5pbXBvcnQgc2VhcmNoRm9ybSBmcm9tICcuL3NlYXJjaEZvcm0nO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZX0pIHtcbiAgICAvLyBib290XG4gICAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNvcnRdJyldLmZvckVhY2goZWwgPT4gc29ydCh7ZWwsIHRhYmxlfSkpO1xuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcl0nKV0uZm9yRWFjaChlbCA9PiBsb2FkaW5nKHtlbCwgdGFibGV9KSk7XG4gICAgLy8gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LWZpbHRlcl0nKV0uZm9yRWFjaChlbCA9PiBmaWx0ZXIoe2VsLCB0YWJsZX0pKTtcbiAgICAvLyBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3Qtc2VhcmNoXScpXS5mb3JFYWNoKGVsID0+IHNlYXJjaElucHV0KHtlbCwgdGFibGV9KSk7XG4gICAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNlYXJjaC1mb3JtXScpXS5mb3JFYWNoKGVsID0+IHNlYXJjaEZvcm0oe2VsLCB0YWJsZX0pKTtcblxuICAgIC8vZXh0ZW5zaW9uXG4gICAgY29uc3QgdGFibGVEaXNwbGF5Q2hhbmdlID0gdGFibGUub25EaXNwbGF5Q2hhbmdlO1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLCB7XG4gICAgICAgIG9uRGlzcGxheUNoYW5nZTogKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICB0YWJsZURpc3BsYXlDaGFuZ2UobGlzdGVuZXIpO1xuICAgICAgICAgICAgdGFibGUuZXhlYygpO1xuICAgICAgICB9XG4gICAgfSk7XG59OyIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChlbCkge1xuICAgIGlmIChlbCkge1xuICAgICAgICBlbC5pbm5lckhUTUwgPSBgXG4gICAgICAgIDxkaXYgZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcj1cIlwiPlxuICAgICAgICAgICAgUHJvY2Vzc2luZyAuLi5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDx0YWJsZT5cbiAgICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICA8dGggY29sc3Bhbj1cIjVcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBkYXRhLXN0LXNlYXJjaC1mb3JtPVwiaWQsIGZpcnN0TmFtZSwgbGFzdE5hbWUsIGVtYWlsLCBwaG9uZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGZvcj1cInNlYXJjaFwiPmdsb2JhbCBzZWFyY2g8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IGlkPVwic2VhcmNoXCIgcGxhY2Vob2xkZXI9XCJDYXNlIHNlbnNpdGl2ZSBzZWFyY2hcIiB0eXBlPVwidGV4dFwiLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzZWFyY2hCdXR0b25cIj5TZWFyY2g8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImlkXCIgZGF0YS1zdC1zb3J0LWN5Y2xlPklkPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwiZmlyc3ROYW1lXCI+Zmlyc3ROYW1lPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwibGFzdE5hbWVcIj5sYXN0TmFtZTwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImVtYWlsXCI+ZW1haWw8L3RoPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJwaG9uZVwiPnBob25lPC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiNVwiPkxvYWRpbmcgZGF0YSAuLi48L3RkPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICA8dGZvb3Q+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCIzXCIgZGF0YS1zdC1zdW1tYXJ5PjwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCIyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1zdC1wYWdpbmF0aW9uPjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90Zm9vdD5cbiAgICAgICAgPC90YWJsZT5cblxuICAgICAgICA8ZGl2IGlkPVwiZGVzY3JpcHRpb24tY29udGFpbmVyXCI+XG4gICAgICAgIDwvZGl2PmBcbiAgICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtpZCwgZmlyc3ROYW1lLCBsYXN0TmFtZSwgZW1haWwsIHBob25lfSwgaW5kZXgpIHtcbiAgICBjb25zdCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgdHIuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgaW5kZXgpO1xuICAgIHRyLmlubmVySFRNTCA9IGA8dGQ+JHtpZH08L3RkPjx0ZD4ke2ZpcnN0TmFtZX08L3RkPjx0ZD4ke2xhc3ROYW1lfTwvdGQ+PHRkPiR7ZW1haWx9PC90ZD48dGQ+JHtwaG9uZX08L3RkPmA7XG4gICAgcmV0dXJuIHRyO1xufSIsImltcG9ydCB7c3VtbWFyeX0gIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN1bW1hcnlDb21wb25lbnQgKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGRpciA9IHN1bW1hcnkoe3RhYmxlfSk7XG4gIGRpci5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+JHsocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKX08L3N0cm9uZz4gLSA8c3Ryb25nPiR7TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPiR7ZmlsdGVyZWRDb3VudH08L3N0cm9uZz4gbWF0Y2hpbmcgaXRlbXNgO1xuICB9KTtcbiAgcmV0dXJuIGRpcjtcbn0iLCJpbXBvcnQge3NsaWNlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFnaW5hdGlvbkNvbXBvbmVudCh7dGFibGUsIGVsfSkge1xuICAgIGNvbnN0IHByZXZpb3VzQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgcHJldmlvdXNCdXR0b24uaW5uZXJIVE1MID0gJ1ByZXZpb3VzJztcbiAgICBjb25zdCBuZXh0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgbmV4dEJ1dHRvbi5pbm5lckhUTUwgPSAnTmV4dCc7XG4gICAgY29uc3QgcGFnZVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gJy0gcGFnZSAxIC0nO1xuXG4gICAgY29uc3QgY29tcCA9IHNsaWNlKHt0YWJsZX0pO1xuXG4gICAgY29tcC5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlfSkgPT4ge1xuICAgICAgICBwcmV2aW91c0J1dHRvbi5kaXNhYmxlZCA9ICFjb21wLmlzUHJldmlvdXNQYWdlRW5hYmxlZCgpO1xuICAgICAgICBuZXh0QnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNOZXh0UGFnZUVuYWJsZWQoKTtcbiAgICAgICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gYC0gJHtwYWdlfSAtYDtcbiAgICB9KTtcblxuICAgIHByZXZpb3VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3RQcmV2aW91c1BhZ2UoKSk7XG4gICAgbmV4dEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbXAuc2VsZWN0TmV4dFBhZ2UoKSk7XG5cbiAgICBlbC5hcHBlbmRDaGlsZChwcmV2aW91c0J1dHRvbik7XG4gICAgZWwuYXBwZW5kQ2hpbGQocGFnZVNwYW4pO1xuICAgIGVsLmFwcGVuZENoaWxkKG5leHRCdXR0b24pO1xuXG4gICAgcmV0dXJuIGNvbXA7XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGl0ZW0pIHtcblxuICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgZGl2LmlubmVySFRNTCA9IGDQktGL0LHRgNCw0L0g0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GMIDxiPiR7aXRlbS5maXJzdE5hbWV9ICR7aXRlbS5sYXN0TmFtZX08L2I+PGJyPlxuICAgICAgICAgICAg0J7Qv9C40YHQsNC90LjQtTo8YnI+XG5cbiAgICAgICAgICAgIDx0ZXh0YXJlYT5cbiAgICAgICAgICAgICR7aXRlbS5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgIDwvdGV4dGFyZWE+PGJyPlxuXG4gICAgICAgICAgICDQkNC00YDQtdGBINC/0YDQvtC20LjQstCw0L3QuNGPOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0cmVldEFkZHJlc3N9PC9iPjxicj5cbiAgICAgICAgICAgINCT0L7RgNC+0LQ6IDxiPiR7aXRlbS5hZHJlc3MuY2l0eX08L2I+PGJyPlxuICAgICAgICAgICAg0J/RgNC+0LLQuNC90YbQuNGPL9GI0YLQsNGCOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0YXRlfTwvYj48YnI+XG4gICAgICAgICAgICDQmNC90LTQtdC60YE6IDxiPiR7aXRlbS5hZHJlc3MuemlwfTwvYj5gO1xuXG4gICAgcmV0dXJuIGRpdjtcbn0iLCJpbXBvcnQge3RhYmxlIGFzIHRhYmxlQ29tcG9uZW50RmFjdG9yeX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt0YWJsZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmltcG9ydCBpbml0Q29udGVudCBmcm9tICcuL2luaXQtY29udGVudCc7XG5pbXBvcnQgcm93IGZyb20gJy4vcm93JztcbmltcG9ydCBzdW1tYXJ5IGZyb20gJy4vc3VtbWFyeSc7XG5pbXBvcnQgcGFnaW5hdGlvbiBmcm9tICcuL3BhZ2luYXRpb24nO1xuaW1wb3J0IGRlc2NyaXB0aW9uIGZyb20gJy4vZGVzY3JpcHRpb24nO1xuXG5leHBvcnQgZGVmYXVsdCBTbWFydFRhYmxlO1xuXG5jb25zdCBNQVhfUk9XU19QRVJfUEFHRSA9IDUwO1xuXG5jbGFzcyBTbWFydFRhYmxlIHtcbiAgICBjb25zdHJ1Y3Rvcih0YWJsZUNvbnRhaW5lckVsLCBkYXRhKSB7XG4gICAgICAgIGlmICh0YWJsZUNvbnRhaW5lckVsKSB7XG4gICAgICAgICAgICB0aGlzLnRhYmxlQ29udGFpbmVyRWwgPSB0YWJsZUNvbnRhaW5lckVsO1xuICAgICAgICAgICAgdGhpcy5vbkluaXQoKTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZhdGVUYWJsZShkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uSW5pdCgpIHtcbiAgICAgICAgaW5pdENvbnRlbnQodGhpcy50YWJsZUNvbnRhaW5lckVsKVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy50YWJsZUNvbnRhaW5lckVsLmlubmVySFRNTCA9ICcnO1xuICAgIH1cblxuICAgIGFjdGl2YXRlVGFibGUoZGF0YSkge1xuXG4gICAgICAgIGxldCB0YWJsZUNvbnRhaW5lckVsID0gdGhpcy50YWJsZUNvbnRhaW5lckVsO1xuXG4gICAgICAgIGNvbnN0IHRib2R5ID0gdGFibGVDb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKCd0Ym9keScpO1xuXG4gICAgICAgIC8vINCh0LHQvtGA0LrQsCBzbWFydC10YWJsZS1jb3JlXG4gICAgICAgIGNvbnN0IHQgPSB0YWJsZSh7ZGF0YSwgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IE1BWF9ST1dTX1BFUl9QQUdFfX19KTtcbiAgICAgICAgY29uc3QgdGFibGVDb21wb25lbnQgPSB0YWJsZUNvbXBvbmVudEZhY3Rvcnkoe2VsOiB0YWJsZUNvbnRhaW5lckVsLCB0YWJsZTogdH0pO1xuXG4gICAgICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8gc3VtbWFyeVxuICAgICAgICBjb25zdCBzdW1tYXJ5RWwgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXN1bW1hcnldJyk7XG4gICAgICAgIHN1bW1hcnkoe3RhYmxlOiB0LCBlbDogc3VtbWFyeUVsfSk7XG5cbiAgICAgICAgLy8g0KHQsdC+0YDQutCwINC80L7QtNGD0LvRjyDQv9Cw0LPQuNC90LDRhtC40LhcbiAgICAgICAgY29uc3QgcGFnaW5hdGlvbkNvbnRhaW5lciA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignW2RhdGEtc3QtcGFnaW5hdGlvbl0nKTtcbiAgICAgICAgcGFnaW5hdGlvbih7dGFibGU6IHQsIGVsOiBwYWdpbmF0aW9uQ29udGFpbmVyfSk7XG5cbiAgICAgICAgLy8g0KHQsdC+0YDQutCwINC80L7QtNGD0LvRjyDQvtC/0LjRgdCw0L3QuNGPXG4gICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2NyaXB0aW9uLWNvbnRhaW5lcicpO1xuICAgICAgICB0Ym9keS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50ID0+IHtcblxuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldDtcblxuICAgICAgICAgICAgbGV0IHRyID0gdGFyZ2V0LmNsb3Nlc3QoJ3RyJyk7XG4gICAgICAgICAgICBpZiAoIXRyKSByZXR1cm47XG4gICAgICAgICAgICBpZiAoIXRib2R5LmNvbnRhaW5zKHRyKSkgcmV0dXJuO1xuXG4gICAgICAgICAgICBsZXQgZGF0YUluZGV4ID0gdHIuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4Jyk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhSW5kZXggJiYgZGF0YVtkYXRhSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuYXBwZW5kQ2hpbGQoZGVzY3JpcHRpb24oZGF0YVtkYXRhSW5kZXhdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0YDQtdC90LTQtdGA0LBcbiAgICAgICAgdGFibGVDb21wb25lbnQub25EaXNwbGF5Q2hhbmdlKGRpc3BsYXllZCA9PiB7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICAgICAgdGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICBmb3IgKGxldCByIG9mIGRpc3BsYXllZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0NoaWxkID0gcm93KHIudmFsdWUsIHIuaW5kZXgsIHQpO1xuICAgICAgICAgICAgICAgIHRib2R5LmFwcGVuZENoaWxkKG5ld0NoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufSIsImltcG9ydCBBc3luY0RhdGFMb2FkZXIgZnJvbSAnLi9jb21wb25lbnRzL2FzeW5jLWRhdGEtbG9hZGVyJztcbmltcG9ydCBTbWFydFRhYmxlIGZyb20gJy4vY29tcG9uZW50cy9zbWFydC10YWJsZS9zbWFydC10YWJsZSc7XG5cbmxldCB0YWJsZUNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YWJsZS1jb250YWluZXInKTtcblxuLy8gIzEg0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCDQsNGB0LjQvdGF0YDQvtC90L3Ri9C5INC30LDQs9GA0YPQt9GH0LjQuiDQtNCw0L3QvdGL0YVcbmxldCBkYXRhTG9hZGVyID0gbmV3IEFzeW5jRGF0YUxvYWRlcihcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGF0YS1sb2FkZXItY29udGFpbmVyJyksXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvYWRpbmctc3Bpbm5lcicpLFxuICAgIHRhYmxlQ29udGFpbmVyXG4pO1xuXG4vLyAjMiDQmNC90LjRhtC40LDQu9C40LfQuNGA0YPQtdC8INC80L7QtNGD0LvRjCDQvtGC0L7QsdGA0LDQttC10L3QuNGPINC00LDQvdC90YvRhVxubGV0IHNtYXJ0VGFibGU7XG5cbmZ1bmN0aW9uIG9uTG9hZGVkRGF0YShyZXNwb25zZURhdGEpIHtcbiAgICBpZiAoc21hcnRUYWJsZSkge1xuICAgICAgICBzbWFydFRhYmxlLm9uRGVzdHJveSgpO1xuICAgICAgICBzbWFydFRhYmxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzbWFydFRhYmxlID0gbmV3IFNtYXJ0VGFibGUodGFibGVDb250YWluZXIsIHJlc3BvbnNlRGF0YSk7XG59XG5cbi8vICMzINCf0YDQuNCy0Y/Qt9GL0LLQsNC10Lwg0YHRg9GJ0L3QvtGB0YLQuFxuZGF0YUxvYWRlci5iaW5kKG9uTG9hZGVkRGF0YSk7Il0sIm5hbWVzIjpbIkFzeW5jRGF0YUxvYWRlciIsInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImV4ZWN1dGlvbkxpc3RlbmVyIiwiU21hcnRUYWJsZSIsInN1bW1hcnkiLCJwYWdpbmF0aW9uIl0sIm1hcHBpbmdzIjoiOzs7QUFBQTs7Ozs7O0FBTUEsQUFFQSxNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUM7QUFDdEMsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDO0FBQ2xDLE1BQU0sdUJBQXVCLEdBQUcseUJBQXlCLENBQUM7O0FBRTFELE1BQU1BLGlCQUFlLENBQUM7O0lBRWxCLFdBQVcsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFO1FBQ3JELElBQUksU0FBUyxJQUFJLGdCQUFnQixJQUFJLGNBQWMsRUFBRTtZQUNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztZQUMzQixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUM7WUFDekMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7WUFDckMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDOztZQUV2QixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztTQUNsQzs7UUFF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
