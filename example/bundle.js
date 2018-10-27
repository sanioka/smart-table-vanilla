(function () {
'use strict';

/**
 * Абстрактный класс компонента
 * От него наследуются все остальные компоненты страницы
 */

class AbstractComponent$1 {
    constructor() {
        this.domElement = null;
    }

    static createInstance(params) {

    }

    /**
     * Рендерит компонент в контейнер
     * @param selector
     * @param isReplace
     * true — замещаем контейнер
     * false - вставляем внутрь
     */
    appendTo(selector, isReplace = true) {
        if (isReplace) {
            let container = document.getElementById(selector);
            if (container) {
                container.parentNode.replaceChild(this.domElement, container);
                this.domElement.className = selector;
                this.domElement.setAttribute('id', selector);
            }
        } else {

            this.appendChildSafety(document.querySelector(selector), this.domElement);
        }
    }

    /**
     * Создаёт dom элемент с атрибутами и содержимым внутри
     *
     * @param tagName
     * @param innerHtml
     * @param attrs
     * @returns {*}
     */
    getElementFactory(tagName, innerHtml, attrs) {
        var _element;

        if (typeof tagName === 'string') {
            _element = document.createElement(tagName);

            if (innerHtml) {
                _element.innerHTML = innerHtml;
            }

            if (attrs && typeof attrs === 'object') {
                for (var index in attrs) {
                    _element.setAttribute(index, attrs[index]);
                }
            }
        }

        return _element;
    };

    /**
     * Обертка appendChild для безопасного использования
     *
     * @param container
     * @param element
     */
    appendChildSafety(container, element) {

        function _isElement(o) {
            return (
                typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
                    o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
            );
        }

        if (container && _isElement(container) && element && _isElement(element)) {
            container.appendChild(element);
        }
    };

    hide(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    show(element) {
        if (element) {
            element.style.display = 'block';
        }
    }

}

/**
 * Модуль асинхронной загрузки данных
 * В случае успешной загрузки отправляет данные в eventListeners
 * Так же управляет DOM, спиннером загрузки и обрабатывает ошибки
 */
const STATE_LOADING = 'STATE_LOADING';
const STATE_EMPTY = 'STATE_EMPTY';
const STATE_LOADED_SUCCESSFUL = 'STATE_LOADED_SUCCESSFUL';

const AFTER_ACTION = 'AFTER_ACTION';
const BEFORE_ACTION = 'BEFORE_ACTION';

class AsyncDataLoader$1 extends AbstractComponent$1 {

    constructor({buttonsConfig}) {

        super();
        let self = this;

        self.eventListeners = [];
        self.domElement = null;

        let element = self.getElementFactory('section');

        for (let item of buttonsConfig) {

            self.appendChildSafety(
                element,
                self.getElementFactory(
                    'button',
                    item.name,
                    {
                        'data-url': item.url
                    }
                )
            );
        }

        // Один обработчик событий на все кнопки
        element.addEventListener('click', event => {

            let target = event.target;
            let button = target.closest('button');
            if (!button) return;
            if (!element.contains(button)) return;

            // Защита от повторных нажатий в момент Pending
            if (self.renderState !== STATE_LOADING) {
                let url = button.getAttribute('data-url');

                if (url) {
                    self.renderState = STATE_LOADING;

                    fetch(url)
                        .then(response => {
                            return response.json()
                        })
                        .then(response => {
                            this.executeEventListeners(AFTER_ACTION, response);
                            self.renderState = STATE_LOADED_SUCCESSFUL;
                        })
                        .catch(err => {
                            this.executeEventListeners(AFTER_ACTION, null);
                            self.renderState = STATE_EMPTY;
                            console.error(err);
                        });
                }
            }

        });

        self.spinnerElement = self.getElementFactory(
            'section',
            '<img src="./spinner.svg" width="100">',
            {
                'style': 'display: none'
            });

        self.domElement = self.getElementFactory('section');
        self.appendChildSafety(self.domElement, element);
        self.appendChildSafety(self.domElement, self.spinnerElement);

        self.renderState = STATE_EMPTY;

    }

    static createInstance(params) {
        let instance = null;

        try {
            instance = new AsyncDataLoader$1(params);
        } catch (e) {
            console.error(e);
        }

        return instance;
    }

    /**
     * Добавляет внешние обработчики
     * @param handler
     * @param behavior
     */
    bind({handler = function() {}, behavior = ''}) {
        this.eventListeners.push({
            handler,
            behavior
        });

        // возвращаем для примера кода с chaining
        return this;
    }

    /**
     *
     * @param behavior
     */
    executeEventListeners(behavior, data) {
        for (let item of this.eventListeners.filter(item => item.behavior === behavior)) {
            item.handler(data);
        }
    }

    /**
     *
     * @param newState
     */
    set renderState(newState) {

        switch (newState) {
            case STATE_EMPTY:
                this._renderState = newState;
                this.hide(this.spinnerElement);
                break;

            case STATE_LOADING:
                this._renderState = newState;
                this.show(this.spinnerElement);

                this.executeEventListeners(BEFORE_ACTION);

                break;

            case STATE_LOADED_SUCCESSFUL:
                this._renderState = newState;
                this.hide(this.spinnerElement);
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

function initContent(el) {
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
}

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
    constructor({tableContainer, data}) {
        this.tableContainerEl = tableContainer;
        initContent(tableContainer);
        onInit(tableContainer, data);
    }

    static createInstance({tableContainer, data}) {
        if (tableContainer && data && Array.isArray(data)) {
            return new SmartTable$1({tableContainer, data})
        } else {
            return null;
        }
    }

    onDestroy() {
        this.tableContainerEl.innerHTML = '';
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

let tableContainer = document.getElementById('table-container');

// #1 Инициализируем асинхронный загрузчик данных
let buttonsConfig = [
    {
        url: 'http://www.filltext.com/?rows=32&id=%7Bnumber%7C1000%7D&firstName=%7BfirstName%7D&lastName=%7BlastName%7D&email=%7Bemail%7D&phone=%7Bphone%7C(xxx)xxx-xx-xx%7D&adress=%7BaddressObject%7D&description=%7Blorem%7C32%7D',
        name: 'Вариант #1'
    },
    {
        url: 'http://www.filltext.com/?rows=1000&id=%7Bnumber%7C1000%7D&firstName=%7BfirstName%7D&delay=3&lastName=%7BlastName%7D&email=%7Bemail%7D&phone=%7Bphone%7C(xxx)xxx-xx-xx%7D&adress=%7BaddressObject%7D&description=%7Blorem%7C32%7D',
        name: 'Вариант #2'
    },
    {
        url: 'http://foobar777777fail.dev',
        name: 'Loading with fail'
    },
];
let asyncDataLoader = AsyncDataLoader$1.createInstance({buttonsConfig});
asyncDataLoader.appendTo('data-loader-container');

// #2 Инициализируем модуль отображения данных
let smartTable;

function destroySmartTable() {
    if (smartTable) {
        smartTable.onDestroy();
        smartTable = null;
    }
}

function createSmartTable(responseData) {
    if (responseData) {
        destroySmartTable();
        smartTable = SmartTable$1.createInstance({tableContainer, data: responseData});
    }
}

// #3 Привязываем сущности
if (asyncDataLoader) {
    asyncDataLoader
        .bind({
            handler: createSmartTable,
            behavior: 'AFTER_ACTION'
        })
        .bind({
            handler: destroySmartTable,
            behavior: 'BEFORE_ACTION'
        });
}

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJjb21wb25lbnRzL2Fic3RyYWN0LWNvbXBvbmVudC5qcyIsImNvbXBvbmVudHMvYXN5bmMtZGF0YS1sb2FkZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2VhcmNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy9zb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3IuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9pbmRleC5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvc2VhcmNoRm9ybS5qcyIsIi4uL2xpYi90YWJsZS5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvaW5pdC1jb250ZW50LmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS9yb3cuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3N1bW1hcnkuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3BhZ2luYXRpb24uanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL2Rlc2NyaXB0aW9uLmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS9zbWFydC10YWJsZS5qcyIsImluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog0JDQsdGB0YLRgNCw0LrRgtC90YvQuSDQutC70LDRgdGBINC60L7QvNC/0L7QvdC10L3RgtCwXG4gKiDQntGCINC90LXQs9C+INC90LDRgdC70LXQtNGD0Y7RgtGB0Y8g0LLRgdC1INC+0YHRgtCw0LvRjNC90YvQtSDQutC+0LzQv9C+0L3QtdC90YLRiyDRgdGC0YDQsNC90LjRhtGLXG4gKi9cblxuZXhwb3J0IGRlZmF1bHQgQWJzdHJhY3RDb21wb25lbnQ7XG5cbmNsYXNzIEFic3RyYWN0Q29tcG9uZW50IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5kb21FbGVtZW50ID0gbnVsbDtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlSW5zdGFuY2UocGFyYW1zKSB7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDQoNC10L3QtNC10YDQuNGCINC60L7QvNC/0L7QvdC10L3RgiDQsiDQutC+0L3RgtC10LnQvdC10YBcbiAgICAgKiBAcGFyYW0gc2VsZWN0b3JcbiAgICAgKiBAcGFyYW0gaXNSZXBsYWNlXG4gICAgICogdHJ1ZSDigJQg0LfQsNC80LXRidCw0LXQvCDQutC+0L3RgtC10LnQvdC10YBcbiAgICAgKiBmYWxzZSAtINCy0YHRgtCw0LLQu9GP0LXQvCDQstC90YPRgtGA0YxcbiAgICAgKi9cbiAgICBhcHBlbmRUbyhzZWxlY3RvciwgaXNSZXBsYWNlID0gdHJ1ZSkge1xuICAgICAgICBpZiAoaXNSZXBsYWNlKSB7XG4gICAgICAgICAgICBsZXQgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgICAgICAgICAgaWYgKGNvbnRhaW5lcikge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZCh0aGlzLmRvbUVsZW1lbnQsIGNvbnRhaW5lcik7XG4gICAgICAgICAgICAgICAgdGhpcy5kb21FbGVtZW50LmNsYXNzTmFtZSA9IHNlbGVjdG9yO1xuICAgICAgICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2lkJywgc2VsZWN0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICB0aGlzLmFwcGVuZENoaWxkU2FmZXR5KGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpLCB0aGlzLmRvbUVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0KHQvtC30LTQsNGR0YIgZG9tINGN0LvQtdC80LXQvdGCINGBINCw0YLRgNC40LHRg9GC0LDQvNC4INC4INGB0L7QtNC10YDQttC40LzRi9C8INCy0L3Rg9GC0YDQuFxuICAgICAqXG4gICAgICogQHBhcmFtIHRhZ05hbWVcbiAgICAgKiBAcGFyYW0gaW5uZXJIdG1sXG4gICAgICogQHBhcmFtIGF0dHJzXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICovXG4gICAgZ2V0RWxlbWVudEZhY3RvcnkodGFnTmFtZSwgaW5uZXJIdG1sLCBhdHRycykge1xuICAgICAgICB2YXIgX2VsZW1lbnQ7XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0YWdOYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgX2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuXG4gICAgICAgICAgICBpZiAoaW5uZXJIdG1sKSB7XG4gICAgICAgICAgICAgICAgX2VsZW1lbnQuaW5uZXJIVE1MID0gaW5uZXJIdG1sO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXR0cnMgJiYgdHlwZW9mIGF0dHJzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGluZGV4IGluIGF0dHJzKSB7XG4gICAgICAgICAgICAgICAgICAgIF9lbGVtZW50LnNldEF0dHJpYnV0ZShpbmRleCwgYXR0cnNbaW5kZXhdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2VsZW1lbnQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqINCe0LHQtdGA0YLQutCwIGFwcGVuZENoaWxkINC00LvRjyDQsdC10LfQvtC/0LDRgdC90L7Qs9C+INC40YHQv9C+0LvRjNC30L7QstCw0L3QuNGPXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY29udGFpbmVyXG4gICAgICogQHBhcmFtIGVsZW1lbnRcbiAgICAgKi9cbiAgICBhcHBlbmRDaGlsZFNhZmV0eShjb250YWluZXIsIGVsZW1lbnQpIHtcblxuICAgICAgICBmdW5jdGlvbiBfaXNFbGVtZW50KG8pIHtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgdHlwZW9mIEhUTUxFbGVtZW50ID09PSBcIm9iamVjdFwiID8gbyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50IDogLy9ET00yXG4gICAgICAgICAgICAgICAgICAgIG8gJiYgdHlwZW9mIG8gPT09IFwib2JqZWN0XCIgJiYgbyAhPT0gbnVsbCAmJiBvLm5vZGVUeXBlID09PSAxICYmIHR5cGVvZiBvLm5vZGVOYW1lID09PSBcInN0cmluZ1wiXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbnRhaW5lciAmJiBfaXNFbGVtZW50KGNvbnRhaW5lcikgJiYgZWxlbWVudCAmJiBfaXNFbGVtZW50KGVsZW1lbnQpKSB7XG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaGlkZShlbGVtZW50KSB7XG4gICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzaG93KGVsZW1lbnQpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgIH1cbiAgICB9XG5cbn0iLCIvKipcbiAqINCc0L7QtNGD0LvRjCDQsNGB0LjQvdGF0YDQvtC90L3QvtC5INC30LDQs9GA0YPQt9C60Lgg0LTQsNC90L3Ri9GFXG4gKiDQkiDRgdC70YPRh9Cw0LUg0YPRgdC/0LXRiNC90L7QuSDQt9Cw0LPRgNGD0LfQutC4INC+0YLQv9GA0LDQstC70Y/QtdGCINC00LDQvdC90YvQtSDQsiBldmVudExpc3RlbmVyc1xuICog0KLQsNC6INC20LUg0YPQv9GA0LDQstC70Y/QtdGCIERPTSwg0YHQv9C40L3QvdC10YDQvtC8INC30LDQs9GA0YPQt9C60Lgg0Lgg0L7QsdGA0LDQsdCw0YLRi9Cy0LDQtdGCINC+0YjQuNCx0LrQuFxuICovXG5pbXBvcnQgQWJzdHJhY3RDb21wb25lbnQgZnJvbSBcIi4vYWJzdHJhY3QtY29tcG9uZW50XCI7XG5cbmV4cG9ydCBkZWZhdWx0IEFzeW5jRGF0YUxvYWRlcjtcblxuY29uc3QgU1RBVEVfTE9BRElORyA9ICdTVEFURV9MT0FESU5HJztcbmNvbnN0IFNUQVRFX0VNUFRZID0gJ1NUQVRFX0VNUFRZJztcbmNvbnN0IFNUQVRFX0xPQURFRF9TVUNDRVNTRlVMID0gJ1NUQVRFX0xPQURFRF9TVUNDRVNTRlVMJztcblxuY29uc3QgQUZURVJfQUNUSU9OID0gJ0FGVEVSX0FDVElPTic7XG5jb25zdCBCRUZPUkVfQUNUSU9OID0gJ0JFRk9SRV9BQ1RJT04nO1xuXG5jbGFzcyBBc3luY0RhdGFMb2FkZXIgZXh0ZW5kcyBBYnN0cmFjdENvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcih7YnV0dG9uc0NvbmZpZ30pIHtcblxuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgc2VsZi5ldmVudExpc3RlbmVycyA9IFtdO1xuICAgICAgICBzZWxmLmRvbUVsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgIGxldCBlbGVtZW50ID0gc2VsZi5nZXRFbGVtZW50RmFjdG9yeSgnc2VjdGlvbicpO1xuXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgYnV0dG9uc0NvbmZpZykge1xuXG4gICAgICAgICAgICBzZWxmLmFwcGVuZENoaWxkU2FmZXR5KFxuICAgICAgICAgICAgICAgIGVsZW1lbnQsXG4gICAgICAgICAgICAgICAgc2VsZi5nZXRFbGVtZW50RmFjdG9yeShcbiAgICAgICAgICAgICAgICAgICAgJ2J1dHRvbicsXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ2RhdGEtdXJsJzogaXRlbS51cmxcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vINCe0LTQuNC9INC+0LHRgNCw0LHQvtGC0YfQuNC6INGB0L7QsdGL0YLQuNC5INC90LAg0LLRgdC1INC60L3QvtC/0LrQuFxuICAgICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuXG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgbGV0IGJ1dHRvbiA9IHRhcmdldC5jbG9zZXN0KCdidXR0b24nKTtcbiAgICAgICAgICAgIGlmICghYnV0dG9uKSByZXR1cm47XG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQuY29udGFpbnMoYnV0dG9uKSkgcmV0dXJuO1xuXG4gICAgICAgICAgICAvLyDQl9Cw0YnQuNGC0LAg0L7RgiDQv9C+0LLRgtC+0YDQvdGL0YUg0L3QsNC20LDRgtC40Lkg0LIg0LzQvtC80LXQvdGCIFBlbmRpbmdcbiAgICAgICAgICAgIGlmIChzZWxmLnJlbmRlclN0YXRlICE9PSBTVEFURV9MT0FESU5HKSB7XG4gICAgICAgICAgICAgICAgbGV0IHVybCA9IGJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2RhdGEtdXJsJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVuZGVyU3RhdGUgPSBTVEFURV9MT0FESU5HO1xuXG4gICAgICAgICAgICAgICAgICAgIGZldGNoKHVybClcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhlY3V0ZUV2ZW50TGlzdGVuZXJzKEFGVEVSX0FDVElPTiwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVuZGVyU3RhdGUgPSBTVEFURV9MT0FERURfU1VDQ0VTU0ZVTDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4ZWN1dGVFdmVudExpc3RlbmVycyhBRlRFUl9BQ1RJT04sIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVuZGVyU3RhdGUgPSBTVEFURV9FTVBUWTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYuc3Bpbm5lckVsZW1lbnQgPSBzZWxmLmdldEVsZW1lbnRGYWN0b3J5KFxuICAgICAgICAgICAgJ3NlY3Rpb24nLFxuICAgICAgICAgICAgJzxpbWcgc3JjPVwiLi9zcGlubmVyLnN2Z1wiIHdpZHRoPVwiMTAwXCI+JyxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnc3R5bGUnOiAnZGlzcGxheTogbm9uZSdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYuZG9tRWxlbWVudCA9IHNlbGYuZ2V0RWxlbWVudEZhY3RvcnkoJ3NlY3Rpb24nKTtcbiAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShzZWxmLmRvbUVsZW1lbnQsIGVsZW1lbnQpO1xuICAgICAgICBzZWxmLmFwcGVuZENoaWxkU2FmZXR5KHNlbGYuZG9tRWxlbWVudCwgc2VsZi5zcGlubmVyRWxlbWVudCk7XG5cbiAgICAgICAgc2VsZi5yZW5kZXJTdGF0ZSA9IFNUQVRFX0VNUFRZO1xuXG4gICAgfVxuXG4gICAgc3RhdGljIGNyZWF0ZUluc3RhbmNlKHBhcmFtcykge1xuICAgICAgICBsZXQgaW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBBc3luY0RhdGFMb2FkZXIocGFyYW1zKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDQlNC+0LHQsNCy0LvRj9C10YIg0LLQvdC10YjQvdC40LUg0L7QsdGA0LDQsdC+0YLRh9C40LrQuFxuICAgICAqIEBwYXJhbSBoYW5kbGVyXG4gICAgICogQHBhcmFtIGJlaGF2aW9yXG4gICAgICovXG4gICAgYmluZCh7aGFuZGxlciA9IGZ1bmN0aW9uKCkge30sIGJlaGF2aW9yID0gJyd9KSB7XG4gICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMucHVzaCh7XG4gICAgICAgICAgICBoYW5kbGVyLFxuICAgICAgICAgICAgYmVoYXZpb3JcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8g0LLQvtC30LLRgNCw0YnQsNC10Lwg0LTQu9GPINC/0YDQuNC80LXRgNCwINC60L7QtNCwINGBIGNoYWluaW5nXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIGJlaGF2aW9yXG4gICAgICovXG4gICAgZXhlY3V0ZUV2ZW50TGlzdGVuZXJzKGJlaGF2aW9yLCBkYXRhKSB7XG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgdGhpcy5ldmVudExpc3RlbmVycy5maWx0ZXIoaXRlbSA9PiBpdGVtLmJlaGF2aW9yID09PSBiZWhhdmlvcikpIHtcbiAgICAgICAgICAgIGl0ZW0uaGFuZGxlcihkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIG5ld1N0YXRlXG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0YXRlKG5ld1N0YXRlKSB7XG5cbiAgICAgICAgc3dpdGNoIChuZXdTdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSBTVEFURV9FTVBUWTpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJTdGF0ZSA9IG5ld1N0YXRlO1xuICAgICAgICAgICAgICAgIHRoaXMuaGlkZSh0aGlzLnNwaW5uZXJFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBTVEFURV9MT0FESU5HOlxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlclN0YXRlID0gbmV3U3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93KHRoaXMuc3Bpbm5lckVsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlRXZlbnRMaXN0ZW5lcnMoQkVGT1JFX0FDVElPTik7XG5cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBTVEFURV9MT0FERURfU1VDQ0VTU0ZVTDpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJTdGF0ZSA9IG5ld1N0YXRlO1xuICAgICAgICAgICAgICAgIHRoaXMuaGlkZSh0aGlzLnNwaW5uZXJFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZW5kZXJTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0YXRlO1xuICAgIH1cblxufSIsImV4cG9ydCBmdW5jdGlvbiBzd2FwIChmKSB7XG4gIHJldHVybiAoYSwgYikgPT4gZihiLCBhKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBvc2UgKGZpcnN0LCAuLi5mbnMpIHtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiBmbnMucmVkdWNlKChwcmV2aW91cywgY3VycmVudCkgPT4gY3VycmVudChwcmV2aW91cyksIGZpcnN0KC4uLmFyZ3MpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGN1cnJ5IChmbiwgYXJpdHlMZWZ0KSB7XG4gIGNvbnN0IGFyaXR5ID0gYXJpdHlMZWZ0IHx8IGZuLmxlbmd0aDtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgYXJnTGVuZ3RoID0gYXJncy5sZW5ndGggfHwgMTtcbiAgICBpZiAoYXJpdHkgPT09IGFyZ0xlbmd0aCkge1xuICAgICAgcmV0dXJuIGZuKC4uLmFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmdW5jID0gKC4uLm1vcmVBcmdzKSA9PiBmbiguLi5hcmdzLCAuLi5tb3JlQXJncyk7XG4gICAgICByZXR1cm4gY3VycnkoZnVuYywgYXJpdHkgLSBhcmdzLmxlbmd0aCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHkgKGZuKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXAgKGZuKSB7XG4gIHJldHVybiBhcmcgPT4ge1xuICAgIGZuKGFyZyk7XG4gICAgcmV0dXJuIGFyZztcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBvaW50ZXIgKHBhdGgpIHtcblxuICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblxuICBmdW5jdGlvbiBwYXJ0aWFsIChvYmogPSB7fSwgcGFydHMgPSBbXSkge1xuICAgIGNvbnN0IHAgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IGN1cnJlbnQgPSBvYmpbcF07XG4gICAgcmV0dXJuIChjdXJyZW50ID09PSB1bmRlZmluZWQgfHwgcGFydHMubGVuZ3RoID09PSAwKSA/XG4gICAgICBjdXJyZW50IDogcGFydGlhbChjdXJyZW50LCBwYXJ0cyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXQgKHRhcmdldCwgbmV3VHJlZSkge1xuICAgIGxldCBjdXJyZW50ID0gdGFyZ2V0O1xuICAgIGNvbnN0IFtsZWFmLCAuLi5pbnRlcm1lZGlhdGVdID0gcGFydHMucmV2ZXJzZSgpO1xuICAgIGZvciAobGV0IGtleSBvZiBpbnRlcm1lZGlhdGUucmV2ZXJzZSgpKSB7XG4gICAgICBpZiAoY3VycmVudFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3VycmVudFtrZXldID0ge307XG4gICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIGN1cnJlbnRbbGVhZl0gPSBPYmplY3QuYXNzaWduKGN1cnJlbnRbbGVhZl0gfHwge30sIG5ld1RyZWUpO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldCh0YXJnZXQpe1xuICAgICAgcmV0dXJuIHBhcnRpYWwodGFyZ2V0LCBbLi4ucGFydHNdKVxuICAgIH0sXG4gICAgc2V0XG4gIH1cbn07XG4iLCJpbXBvcnQge3N3YXB9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5cbmZ1bmN0aW9uIHNvcnRCeVByb3BlcnR5IChwcm9wKSB7XG4gIGNvbnN0IHByb3BHZXR0ZXIgPSBwb2ludGVyKHByb3ApLmdldDtcbiAgcmV0dXJuIChhLCBiKSA9PiB7XG4gICAgY29uc3QgYVZhbCA9IHByb3BHZXR0ZXIoYSk7XG4gICAgY29uc3QgYlZhbCA9IHByb3BHZXR0ZXIoYik7XG5cbiAgICBpZiAoYVZhbCA9PT0gYlZhbCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgaWYgKGJWYWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIGlmIChhVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHJldHVybiBhVmFsIDwgYlZhbCA/IC0xIDogMTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzb3J0RmFjdG9yeSAoe3BvaW50ZXIsIGRpcmVjdGlvbn0gPSB7fSkge1xuICBpZiAoIXBvaW50ZXIgfHwgZGlyZWN0aW9uID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gWy4uLmFycmF5XTtcbiAgfVxuXG4gIGNvbnN0IG9yZGVyRnVuYyA9IHNvcnRCeVByb3BlcnR5KHBvaW50ZXIpO1xuICBjb25zdCBjb21wYXJlRnVuYyA9IGRpcmVjdGlvbiA9PT0gJ2Rlc2MnID8gc3dhcChvcmRlckZ1bmMpIDogb3JkZXJGdW5jO1xuXG4gIHJldHVybiAoYXJyYXkpID0+IFsuLi5hcnJheV0uc29ydChjb21wYXJlRnVuYyk7XG59IiwiaW1wb3J0IHtjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZnVuY3Rpb24gdHlwZUV4cHJlc3Npb24gKHR5cGUpIHtcbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gQm9vbGVhbjtcbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIE51bWJlcjtcbiAgICBjYXNlICdkYXRlJzpcbiAgICAgIHJldHVybiAodmFsKSA9PiBuZXcgRGF0ZSh2YWwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY29tcG9zZShTdHJpbmcsICh2YWwpID0+IHZhbC50b0xvd2VyQ2FzZSgpKTtcbiAgfVxufVxuXG5jb25zdCBvcGVyYXRvcnMgPSB7XG4gIGluY2x1ZGVzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dC5pbmNsdWRlcyh2YWx1ZSk7XG4gIH0sXG4gIGlzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgaXNOb3QodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+ICFPYmplY3QuaXModmFsdWUsIGlucHV0KTtcbiAgfSxcbiAgbHQodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDwgdmFsdWU7XG4gIH0sXG4gIGd0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+IHZhbHVlO1xuICB9LFxuICBsdGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0IDw9IHZhbHVlO1xuICB9LFxuICBndGUodmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IGlucHV0ID49IHZhbHVlO1xuICB9LFxuICBlcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlID09IGlucHV0O1xuICB9LFxuICBub3RFcXVhbHModmFsdWUpe1xuICAgIHJldHVybiAoaW5wdXQpID0+IHZhbHVlICE9IGlucHV0O1xuICB9XG59O1xuXG5jb25zdCBldmVyeSA9IGZucyA9PiAoLi4uYXJncykgPT4gZm5zLmV2ZXJ5KGZuID0+IGZuKC4uLmFyZ3MpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByZWRpY2F0ZSAoe3ZhbHVlID0gJycsIG9wZXJhdG9yID0gJ2luY2x1ZGVzJywgdHlwZSA9ICdzdHJpbmcnfSkge1xuICBjb25zdCB0eXBlSXQgPSB0eXBlRXhwcmVzc2lvbih0eXBlKTtcbiAgY29uc3Qgb3BlcmF0ZU9uVHlwZWQgPSBjb21wb3NlKHR5cGVJdCwgb3BlcmF0b3JzW29wZXJhdG9yXSk7XG4gIGNvbnN0IHByZWRpY2F0ZUZ1bmMgPSBvcGVyYXRlT25UeXBlZCh2YWx1ZSk7XG4gIHJldHVybiBjb21wb3NlKHR5cGVJdCwgcHJlZGljYXRlRnVuYyk7XG59XG5cbi8vYXZvaWQgdXNlbGVzcyBmaWx0ZXIgbG9va3VwIChpbXByb3ZlIHBlcmYpXG5mdW5jdGlvbiBub3JtYWxpemVDbGF1c2VzIChjb25mKSB7XG4gIGNvbnN0IG91dHB1dCA9IHt9O1xuICBjb25zdCB2YWxpZFBhdGggPSBPYmplY3Qua2V5cyhjb25mKS5maWx0ZXIocGF0aCA9PiBBcnJheS5pc0FycmF5KGNvbmZbcGF0aF0pKTtcbiAgdmFsaWRQYXRoLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgdmFsaWRDbGF1c2VzID0gY29uZltwYXRoXS5maWx0ZXIoYyA9PiBjLnZhbHVlICE9PSAnJyk7XG4gICAgaWYgKHZhbGlkQ2xhdXNlcy5sZW5ndGgpIHtcbiAgICAgIG91dHB1dFtwYXRoXSA9IHZhbGlkQ2xhdXNlcztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaWx0ZXIgKGZpbHRlcikge1xuICBjb25zdCBub3JtYWxpemVkQ2xhdXNlcyA9IG5vcm1hbGl6ZUNsYXVzZXMoZmlsdGVyKTtcbiAgY29uc3QgZnVuY0xpc3QgPSBPYmplY3Qua2V5cyhub3JtYWxpemVkQ2xhdXNlcykubWFwKHBhdGggPT4ge1xuICAgIGNvbnN0IGdldHRlciA9IHBvaW50ZXIocGF0aCkuZ2V0O1xuICAgIGNvbnN0IGNsYXVzZXMgPSBub3JtYWxpemVkQ2xhdXNlc1twYXRoXS5tYXAocHJlZGljYXRlKTtcbiAgICByZXR1cm4gY29tcG9zZShnZXR0ZXIsIGV2ZXJ5KGNsYXVzZXMpKTtcbiAgfSk7XG4gIGNvbnN0IGZpbHRlclByZWRpY2F0ZSA9IGV2ZXJ5KGZ1bmNMaXN0KTtcblxuICByZXR1cm4gKGFycmF5KSA9PiBhcnJheS5maWx0ZXIoZmlsdGVyUHJlZGljYXRlKTtcbn0iLCJpbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoc2VhcmNoQ29uZiA9IHt9KSB7XG4gIGNvbnN0IHt2YWx1ZSwgc2NvcGUgPSBbXX0gPSBzZWFyY2hDb25mO1xuICBjb25zdCBzZWFyY2hQb2ludGVycyA9IHNjb3BlLm1hcChmaWVsZCA9PiBwb2ludGVyKGZpZWxkKS5nZXQpO1xuICBpZiAoIXNjb3BlLmxlbmd0aCB8fCAhdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXkgPT4gYXJyYXk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5LmZpbHRlcihpdGVtID0+IHNlYXJjaFBvaW50ZXJzLnNvbWUocCA9PiBTdHJpbmcocChpdGVtKSkuaW5jbHVkZXMoU3RyaW5nKHZhbHVlKSkpKVxuICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2xpY2VGYWN0b3J5ICh7cGFnZSA9IDEsIHNpemV9ID0ge30pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHNsaWNlRnVuY3Rpb24gKGFycmF5ID0gW10pIHtcbiAgICBjb25zdCBhY3R1YWxTaXplID0gc2l6ZSB8fCBhcnJheS5sZW5ndGg7XG4gICAgY29uc3Qgb2Zmc2V0ID0gKHBhZ2UgLSAxKSAqIGFjdHVhbFNpemU7XG4gICAgcmV0dXJuIGFycmF5LnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgYWN0dWFsU2l6ZSk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gZW1pdHRlciAoKSB7XG5cbiAgY29uc3QgbGlzdGVuZXJzTGlzdHMgPSB7fTtcbiAgY29uc3QgaW5zdGFuY2UgPSB7XG4gICAgb24oZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSAobGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdKS5jb25jYXQobGlzdGVuZXJzKTtcbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIGRpc3BhdGNoKGV2ZW50LCAuLi5hcmdzKXtcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIGxpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lciguLi5hcmdzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9LFxuICAgIG9mZihldmVudCwgLi4ubGlzdGVuZXJzKXtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgT2JqZWN0LmtleXMobGlzdGVuZXJzTGlzdHMpLmZvckVhY2goZXYgPT4gaW5zdGFuY2Uub2ZmKGV2KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBsaXN0ID0gbGlzdGVuZXJzTGlzdHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNMaXN0c1tldmVudF0gPSBsaXN0ZW5lcnMubGVuZ3RoID8gbGlzdC5maWx0ZXIobGlzdGVuZXIgPT4gIWxpc3RlbmVycy5pbmNsdWRlcyhsaXN0ZW5lcikpIDogW107XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuICB9O1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm94eUxpc3RlbmVyIChldmVudE1hcCkge1xuICByZXR1cm4gZnVuY3Rpb24gKHtlbWl0dGVyfSkge1xuXG4gICAgY29uc3QgcHJveHkgPSB7fTtcbiAgICBsZXQgZXZlbnRMaXN0ZW5lcnMgPSB7fTtcblxuICAgIGZvciAobGV0IGV2IG9mIE9iamVjdC5rZXlzKGV2ZW50TWFwKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gZXZlbnRNYXBbZXZdO1xuICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gW107XG4gICAgICBwcm94eVttZXRob2RdID0gZnVuY3Rpb24gKC4uLmxpc3RlbmVycykge1xuICAgICAgICBldmVudExpc3RlbmVyc1tldl0gPSBldmVudExpc3RlbmVyc1tldl0uY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICAgIGVtaXR0ZXIub24oZXYsIC4uLmxpc3RlbmVycyk7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJveHksIHtcbiAgICAgIG9mZihldil7XG4gICAgICAgIGlmICghZXYpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhldmVudExpc3RlbmVycykuZm9yRWFjaChldmVudE5hbWUgPT4gcHJveHkub2ZmKGV2ZW50TmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudExpc3RlbmVyc1tldl0pIHtcbiAgICAgICAgICBlbWl0dGVyLm9mZihldiwgLi4uZXZlbnRMaXN0ZW5lcnNbZXZdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0iLCJleHBvcnQgY29uc3QgVE9HR0xFX1NPUlQgPSAnVE9HR0xFX1NPUlQnO1xuZXhwb3J0IGNvbnN0IERJU1BMQVlfQ0hBTkdFRCA9ICdESVNQTEFZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFBBR0VfQ0hBTkdFRCA9ICdDSEFOR0VfUEFHRSc7XG5leHBvcnQgY29uc3QgRVhFQ19DSEFOR0VEID0gJ0VYRUNfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRklMVEVSX0NIQU5HRUQgPSAnRklMVEVSX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNVTU1BUllfQ0hBTkdFRCA9ICdTVU1NQVJZX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IFNFQVJDSF9DSEFOR0VEID0gJ1NFQVJDSF9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBFWEVDX0VSUk9SID0gJ0VYRUNfRVJST1InOyIsImltcG9ydCBzbGljZSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge2N1cnJ5LCB0YXAsIGNvbXBvc2V9IGZyb20gJ3NtYXJ0LXRhYmxlLW9wZXJhdG9ycyc7XG5pbXBvcnQgcG9pbnRlciBmcm9tICdzbWFydC10YWJsZS1qc29uLXBvaW50ZXInO1xuaW1wb3J0IHtlbWl0dGVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuaW1wb3J0IHNsaWNlRmFjdG9yeSBmcm9tICcuLi9zbGljZSc7XG5pbXBvcnQge1xuICBTVU1NQVJZX0NIQU5HRUQsXG4gIFRPR0dMRV9TT1JULFxuICBESVNQTEFZX0NIQU5HRUQsXG4gIFBBR0VfQ0hBTkdFRCxcbiAgRVhFQ19DSEFOR0VELFxuICBGSUxURVJfQ0hBTkdFRCxcbiAgU0VBUkNIX0NIQU5HRUQsXG4gIEVYRUNfRVJST1Jcbn0gZnJvbSAnLi4vZXZlbnRzJztcblxuZnVuY3Rpb24gY3VycmllZFBvaW50ZXIgKHBhdGgpIHtcbiAgY29uc3Qge2dldCwgc2V0fSA9IHBvaW50ZXIocGF0aCk7XG4gIHJldHVybiB7Z2V0LCBzZXQ6IGN1cnJ5KHNldCl9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSxcbiAgdGFibGVTdGF0ZSxcbiAgZGF0YSxcbiAgZmlsdGVyRmFjdG9yeSxcbiAgc2VhcmNoRmFjdG9yeVxufSkge1xuICBjb25zdCB0YWJsZSA9IGVtaXR0ZXIoKTtcbiAgY29uc3Qgc29ydFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc29ydCcpO1xuICBjb25zdCBzbGljZVBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2xpY2UnKTtcbiAgY29uc3QgZmlsdGVyUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdmaWx0ZXInKTtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlciA9IGN1cnJpZWRQb2ludGVyKCdzZWFyY2gnKTtcblxuICBjb25zdCBzYWZlQXNzaWduID0gY3VycnkoKGJhc2UsIGV4dGVuc2lvbikgPT4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwgZXh0ZW5zaW9uKSk7XG4gIGNvbnN0IGRpc3BhdGNoID0gY3VycnkodGFibGUuZGlzcGF0Y2guYmluZCh0YWJsZSksIDIpO1xuXG4gIGNvbnN0IGRpc3BhdGNoU3VtbWFyeSA9IChmaWx0ZXJlZCkgPT4ge1xuICAgIGRpc3BhdGNoKFNVTU1BUllfQ0hBTkdFRCwge1xuICAgICAgcGFnZTogdGFibGVTdGF0ZS5zbGljZS5wYWdlLFxuICAgICAgc2l6ZTogdGFibGVTdGF0ZS5zbGljZS5zaXplLFxuICAgICAgZmlsdGVyZWRDb3VudDogZmlsdGVyZWQubGVuZ3RoXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgZXhlYyA9ICh7cHJvY2Vzc2luZ0RlbGF5ID0gMjB9ID0ge30pID0+IHtcbiAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiB0cnVlfSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBmaWx0ZXJGdW5jID0gZmlsdGVyRmFjdG9yeShmaWx0ZXJQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCB0YXAoZGlzcGF0Y2hTdW1tYXJ5KSwgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXllZCA9IGV4ZWNGdW5jKGRhdGEpO1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChESVNQTEFZX0NIQU5HRUQsIGRpc3BsYXllZC5tYXAoZCA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH07XG4gICAgICAgIH0pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19FUlJPUiwgZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICB0YWJsZS5kaXNwYXRjaChFWEVDX0NIQU5HRUQsIHt3b3JraW5nOiBmYWxzZX0pO1xuICAgICAgfVxuICAgIH0sIHByb2Nlc3NpbmdEZWxheSk7XG4gIH07XG5cbiAgY29uc3QgdXBkYXRlVGFibGVTdGF0ZSA9IGN1cnJ5KChwdGVyLCBldiwgbmV3UGFydGlhbFN0YXRlKSA9PiBjb21wb3NlKFxuICAgIHNhZmVBc3NpZ24ocHRlci5nZXQodGFibGVTdGF0ZSkpLFxuICAgIHRhcChkaXNwYXRjaChldikpLFxuICAgIHB0ZXIuc2V0KHRhYmxlU3RhdGUpXG4gICkobmV3UGFydGlhbFN0YXRlKSk7XG5cbiAgY29uc3QgcmVzZXRUb0ZpcnN0UGFnZSA9ICgpID0+IHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQsIHtwYWdlOiAxfSk7XG5cbiAgY29uc3QgdGFibGVPcGVyYXRpb24gPSAocHRlciwgZXYpID0+IGNvbXBvc2UoXG4gICAgdXBkYXRlVGFibGVTdGF0ZShwdGVyLCBldiksXG4gICAgcmVzZXRUb0ZpcnN0UGFnZSxcbiAgICAoKSA9PiB0YWJsZS5leGVjKCkgLy8gd2Ugd3JhcCB3aXRoaW4gYSBmdW5jdGlvbiBzbyB0YWJsZS5leGVjIGNhbiBiZSBvdmVyd3JpdHRlbiAod2hlbiB1c2luZyB3aXRoIGEgc2VydmVyIGZvciBleGFtcGxlKVxuICApO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzb3J0OiB0YWJsZU9wZXJhdGlvbihzb3J0UG9pbnRlciwgVE9HR0xFX1NPUlQpLFxuICAgIGZpbHRlcjogdGFibGVPcGVyYXRpb24oZmlsdGVyUG9pbnRlciwgRklMVEVSX0NIQU5HRUQpLFxuICAgIHNlYXJjaDogdGFibGVPcGVyYXRpb24oc2VhcmNoUG9pbnRlciwgU0VBUkNIX0NIQU5HRUQpLFxuICAgIHNsaWNlOiBjb21wb3NlKHVwZGF0ZVRhYmxlU3RhdGUoc2xpY2VQb2ludGVyLCBQQUdFX0NIQU5HRUQpLCAoKSA9PiB0YWJsZS5leGVjKCkpLFxuICAgIGV4ZWMsXG4gICAgZXZhbChzdGF0ZSA9IHRhYmxlU3RhdGUpe1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjb25zdCBzb3J0RnVuYyA9IHNvcnRGYWN0b3J5KHNvcnRQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IHNlYXJjaEZ1bmMgPSBzZWFyY2hGYWN0b3J5KHNlYXJjaFBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzbGljZUZ1bmMgPSBzbGljZUZhY3Rvcnkoc2xpY2VQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGV4ZWNGdW5jID0gY29tcG9zZShmaWx0ZXJGdW5jLCBzZWFyY2hGdW5jLCBzb3J0RnVuYywgc2xpY2VGdW5jKTtcbiAgICAgICAgICByZXR1cm4gZXhlY0Z1bmMoZGF0YSkubWFwKGQgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtpbmRleDogZGF0YS5pbmRleE9mKGQpLCB2YWx1ZTogZH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBvbkRpc3BsYXlDaGFuZ2UoZm4pe1xuICAgICAgdGFibGUub24oRElTUExBWV9DSEFOR0VELCBmbik7XG4gICAgfSxcbiAgICBnZXRUYWJsZVN0YXRlKCl7XG4gICAgICBjb25zdCBzb3J0ID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zb3J0KTtcbiAgICAgIGNvbnN0IHNlYXJjaCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2VhcmNoKTtcbiAgICAgIGNvbnN0IHNsaWNlID0gT2JqZWN0LmFzc2lnbih7fSwgdGFibGVTdGF0ZS5zbGljZSk7XG4gICAgICBjb25zdCBmaWx0ZXIgPSB7fTtcbiAgICAgIGZvciAobGV0IHByb3AgaW4gdGFibGVTdGF0ZS5maWx0ZXIpIHtcbiAgICAgICAgZmlsdGVyW3Byb3BdID0gdGFibGVTdGF0ZS5maWx0ZXJbcHJvcF0ubWFwKHYgPT4gT2JqZWN0LmFzc2lnbih7fSwgdikpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtzb3J0LCBzZWFyY2gsIHNsaWNlLCBmaWx0ZXJ9O1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBpbnN0YW5jZSA9IE9iamVjdC5hc3NpZ24odGFibGUsIGFwaSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGluc3RhbmNlLCAnbGVuZ3RoJywge1xuICAgIGdldCgpe1xuICAgICAgcmV0dXJuIGRhdGEubGVuZ3RoO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufSIsImltcG9ydCBzb3J0IGZyb20gJ3NtYXJ0LXRhYmxlLXNvcnQnO1xuaW1wb3J0IGZpbHRlciBmcm9tICdzbWFydC10YWJsZS1maWx0ZXInO1xuaW1wb3J0IHNlYXJjaCBmcm9tICdzbWFydC10YWJsZS1zZWFyY2gnO1xuaW1wb3J0IHRhYmxlIGZyb20gJy4vZGlyZWN0aXZlcy90YWJsZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7XG4gIHNvcnRGYWN0b3J5ID0gc29ydCxcbiAgZmlsdGVyRmFjdG9yeSA9IGZpbHRlcixcbiAgc2VhcmNoRmFjdG9yeSA9IHNlYXJjaCxcbiAgdGFibGVTdGF0ZSA9IHtzb3J0OiB7fSwgc2xpY2U6IHtwYWdlOiAxfSwgZmlsdGVyOiB7fSwgc2VhcmNoOiB7fX0sXG4gIGRhdGEgPSBbXVxufSwgLi4udGFibGVEaXJlY3RpdmVzKSB7XG5cbiAgY29uc3QgY29yZVRhYmxlID0gdGFibGUoe3NvcnRGYWN0b3J5LCBmaWx0ZXJGYWN0b3J5LCB0YWJsZVN0YXRlLCBkYXRhLCBzZWFyY2hGYWN0b3J5fSk7XG5cbiAgcmV0dXJuIHRhYmxlRGlyZWN0aXZlcy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBuZXdkaXIpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihhY2N1bXVsYXRvciwgbmV3ZGlyKHtcbiAgICAgIHNvcnRGYWN0b3J5LFxuICAgICAgZmlsdGVyRmFjdG9yeSxcbiAgICAgIHNlYXJjaEZhY3RvcnksXG4gICAgICB0YWJsZVN0YXRlLFxuICAgICAgZGF0YSxcbiAgICAgIHRhYmxlOiBjb3JlVGFibGVcbiAgICB9KSk7XG4gIH0sIGNvcmVUYWJsZSk7XG59IiwiaW1wb3J0IHtTRUFSQ0hfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2VhcmNoTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU0VBUkNIX0NIQU5HRURdOiAnb25TZWFyY2hDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIHNjb3BlID0gW119KSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKFxuICAgIHNlYXJjaExpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pLCB7XG4gICAgICBzZWFyY2goaW5wdXQpe1xuICAgICAgICByZXR1cm4gdGFibGUuc2VhcmNoKHt2YWx1ZTogaW5wdXQsIHNjb3BlfSk7XG4gICAgICB9XG4gICAgfSk7XG59IiwiaW1wb3J0IHtQQUdFX0NIQU5HRUQsIFNVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc2xpY2VMaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tQQUdFX0NIQU5HRURdOiAnb25QYWdlQ2hhbmdlJywgW1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIGxldCB7c2xpY2U6e3BhZ2U6Y3VycmVudFBhZ2UsIHNpemU6Y3VycmVudFNpemV9fSA9IHRhYmxlLmdldFRhYmxlU3RhdGUoKTtcbiAgbGV0IGl0ZW1MaXN0TGVuZ3RoID0gdGFibGUubGVuZ3RoO1xuXG4gIGNvbnN0IGFwaSA9IHtcbiAgICBzZWxlY3RQYWdlKHApe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiBwLCBzaXplOiBjdXJyZW50U2l6ZX0pO1xuICAgIH0sXG4gICAgc2VsZWN0TmV4dFBhZ2UoKXtcbiAgICAgIHJldHVybiBhcGkuc2VsZWN0UGFnZShjdXJyZW50UGFnZSArIDEpO1xuICAgIH0sXG4gICAgc2VsZWN0UHJldmlvdXNQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgLSAxKTtcbiAgICB9LFxuICAgIGNoYW5nZVBhZ2VTaXplKHNpemUpe1xuICAgICAgcmV0dXJuIHRhYmxlLnNsaWNlKHtwYWdlOiAxLCBzaXplfSk7XG4gICAgfSxcbiAgICBpc1ByZXZpb3VzUGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBjdXJyZW50UGFnZSA+IDE7XG4gICAgfSxcbiAgICBpc05leHRQYWdlRW5hYmxlZCgpe1xuICAgICAgcmV0dXJuIE1hdGguY2VpbChpdGVtTGlzdExlbmd0aCAvIGN1cnJlbnRTaXplKSA+IGN1cnJlbnRQYWdlO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbihhcGksIHNsaWNlTGlzdGVuZXIoe2VtaXR0ZXI6IHRhYmxlfSkpO1xuXG4gIGRpcmVjdGl2ZS5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlOnAsIHNpemU6cywgZmlsdGVyZWRDb3VudH0pID0+IHtcbiAgICBjdXJyZW50UGFnZSA9IHA7XG4gICAgY3VycmVudFNpemUgPSBzO1xuICAgIGl0ZW1MaXN0TGVuZ3RoID0gZmlsdGVyZWRDb3VudDtcbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn1cbiIsImltcG9ydCB7VE9HR0xFX1NPUlR9IGZyb20gJy4uL2V2ZW50cydcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3Qgc29ydExpc3RlbmVycyA9IHByb3h5TGlzdGVuZXIoe1tUT0dHTEVfU09SVF06ICdvblNvcnRUb2dnbGUnfSk7XG5jb25zdCBkaXJlY3Rpb25zID0gWydhc2MnLCAnZGVzYyddO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZSA9IGZhbHNlfSkge1xuXG4gIGNvbnN0IGN5Y2xlRGlyZWN0aW9ucyA9IGN5Y2xlID09PSB0cnVlID8gWydub25lJ10uY29uY2F0KGRpcmVjdGlvbnMpIDogWy4uLmRpcmVjdGlvbnNdLnJldmVyc2UoKTtcblxuICBsZXQgaGl0ID0gMDtcblxuICBjb25zdCBkaXJlY3RpdmUgPSBPYmplY3QuYXNzaWduKHtcbiAgICB0b2dnbGUoKXtcbiAgICAgIGhpdCsrO1xuICAgICAgY29uc3QgZGlyZWN0aW9uID0gY3ljbGVEaXJlY3Rpb25zW2hpdCAlIGN5Y2xlRGlyZWN0aW9ucy5sZW5ndGhdO1xuICAgICAgcmV0dXJuIHRhYmxlLnNvcnQoe3BvaW50ZXIsIGRpcmVjdGlvbn0pO1xuICAgIH1cblxuICB9LCBzb3J0TGlzdGVuZXJzKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpwfSkgPT4ge1xuICAgIGlmIChwb2ludGVyICE9PSBwKSB7XG4gICAgICBoaXQgPSAwO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZTtcbn0iLCJpbXBvcnQge1NVTU1BUllfQ0hBTkdFRH0gZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7cHJveHlMaXN0ZW5lcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcblxuY29uc3QgZXhlY3V0aW9uTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbU1VNTUFSWV9DSEFOR0VEXTogJ29uU3VtbWFyeUNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHtFWEVDX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W0VYRUNfQ0hBTkdFRF06ICdvbkV4ZWN1dGlvbkNoYW5nZSd9KTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZX0pIHtcbiAgcmV0dXJuIGV4ZWN1dGlvbkxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pO1xufVxuIiwiaW1wb3J0IHRhYmxlRGlyZWN0aXZlIGZyb20gJy4vc3JjL3RhYmxlJztcbmltcG9ydCBmaWx0ZXJEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9maWx0ZXInO1xuaW1wb3J0IHNlYXJjaERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NlYXJjaCc7XG5pbXBvcnQgc2xpY2VEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zbGljZSc7XG5pbXBvcnQgc29ydERpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3NvcnQnO1xuaW1wb3J0IHN1bW1hcnlEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zdW1tYXJ5JztcbmltcG9ydCB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvd29ya2luZ0luZGljYXRvcic7XG5cbmV4cG9ydCBjb25zdCBzZWFyY2ggPSBzZWFyY2hEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc2xpY2UgPSBzbGljZURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzdW1tYXJ5ID0gc3VtbWFyeURpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBzb3J0ID0gc29ydERpcmVjdGl2ZTtcbmV4cG9ydCBjb25zdCBmaWx0ZXIgPSBmaWx0ZXJEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgd29ya2luZ0luZGljYXRvciA9IHdvcmtpbmdJbmRpY2F0b3JEaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgdGFibGUgPSB0YWJsZURpcmVjdGl2ZTtcbmV4cG9ydCBkZWZhdWx0IHRhYmxlO1xuIiwiaW1wb3J0IHt3b3JraW5nSW5kaWNhdG9yfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHdvcmtpbmdJbmRpY2F0b3Ioe3RhYmxlfSk7XG4gIGNvbXBvbmVudC5vbkV4ZWN1dGlvbkNoYW5nZShmdW5jdGlvbiAoe3dvcmtpbmd9KSB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnc3Qtd29ya2luZycpO1xuICAgIGlmICh3b3JraW5nID09PSB0cnVlKSB7XG4gICAgICBlbC5jbGFzc0xpc3QuYWRkKCdzdC13b3JraW5nJyk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGNvbXBvbmVudDtcbn07IiwiaW1wb3J0IHtzb3J0fSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGUsIGNvbmYgPSB7fX0pIHtcbiAgY29uc3QgcG9pbnRlciA9IGNvbmYucG9pbnRlciB8fCBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc29ydCcpO1xuICBjb25zdCBjeWNsZSA9IGNvbmYuY3ljbGUgfHwgZWwuaGFzQXR0cmlidXRlKCdkYXRhLXN0LXNvcnQtY3ljbGUnKTtcbiAgY29uc3QgY29tcG9uZW50ID0gc29ydCh7cG9pbnRlciwgdGFibGUsIGN5Y2xlfSk7XG4gIGNvbXBvbmVudC5vblNvcnRUb2dnbGUoKHtwb2ludGVyOmN1cnJlbnRQb2ludGVyLCBkaXJlY3Rpb259KSA9PiB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnc3Qtc29ydC1hc2MnLCAnc3Qtc29ydC1kZXNjJyk7XG4gICAgaWYgKHBvaW50ZXIgPT09IGN1cnJlbnRQb2ludGVyICYmIGRpcmVjdGlvbiAhPT0gJ25vbmUnKSB7XG4gICAgICBjb25zdCBjbGFzc05hbWUgPSBkaXJlY3Rpb24gPT09ICdhc2MnID8gJ3N0LXNvcnQtYXNjJyA6ICdzdC1zb3J0LWRlc2MnO1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgIH1cbiAgfSk7XG4gIGNvbnN0IGV2ZW50TGlzdGVuZXIgPSBldiA9PiBjb21wb25lbnQudG9nZ2xlKCk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnRMaXN0ZW5lcik7XG4gIHJldHVybiBjb21wb25lbnQ7XG59IiwiaW1wb3J0IHtzZWFyY2h9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZSwgZGVsYXkgPSA0MDAsIGNvbmYgPSB7fX0pIHtcbiAgICBjb25zdCBzY29wZSA9IGNvbmYuc2NvcGUgfHwgKGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1zdC1zZWFyY2gtZm9ybScpIHx8ICcnKS5zcGxpdCgnLCcpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBzZWFyY2goe3RhYmxlLCBzY29wZX0pO1xuXG4gICAgaWYgKGVsKSB7XG4gICAgICAgIGxldCBpbnB1dCA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbnB1dCcpO1xuICAgICAgICBsZXQgYnV0dG9uID0gZWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2J1dHRvbicpO1xuXG4gICAgICAgIGlmIChpbnB1dCAmJiBpbnB1dFswXSAmJiBidXR0b24gJiYgYnV0dG9uWzBdKSB7XG4gICAgICAgICAgICBidXR0b25bMF0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudCA9PiB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnNlYXJjaChpbnB1dFswXS52YWx1ZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaW5wdXRbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGV2ZW50ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgJiYgZXZlbnQua2V5Q29kZSAmJiBldmVudC5rZXlDb2RlID09PSAxMykge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc2VhcmNoKGlucHV0WzBdLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG5cbiAgICAgICAgfVxuICAgIH1cblxufTsiLCJpbXBvcnQgbG9hZGluZyBmcm9tICcuL2xvYWRpbmdJbmRpY2F0b3InO1xuaW1wb3J0IHNvcnQgZnJvbSAnLi9zb3J0Jztcbi8vIGltcG9ydCBmaWx0ZXIgZnJvbSAnLi9maWx0ZXJzJztcbi8vIGltcG9ydCBzZWFyY2hJbnB1dCBmcm9tICcuL3NlYXJjaCc7XG5pbXBvcnQgc2VhcmNoRm9ybSBmcm9tICcuL3NlYXJjaEZvcm0nO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZX0pIHtcbiAgICAvLyBib290XG4gICAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNvcnRdJyldLmZvckVhY2goZWwgPT4gc29ydCh7ZWwsIHRhYmxlfSkpO1xuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcl0nKV0uZm9yRWFjaChlbCA9PiBsb2FkaW5nKHtlbCwgdGFibGV9KSk7XG4gICAgLy8gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LWZpbHRlcl0nKV0uZm9yRWFjaChlbCA9PiBmaWx0ZXIoe2VsLCB0YWJsZX0pKTtcbiAgICAvLyBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3Qtc2VhcmNoXScpXS5mb3JFYWNoKGVsID0+IHNlYXJjaElucHV0KHtlbCwgdGFibGV9KSk7XG4gICAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNlYXJjaC1mb3JtXScpXS5mb3JFYWNoKGVsID0+IHNlYXJjaEZvcm0oe2VsLCB0YWJsZX0pKTtcblxuICAgIC8vZXh0ZW5zaW9uXG4gICAgY29uc3QgdGFibGVEaXNwbGF5Q2hhbmdlID0gdGFibGUub25EaXNwbGF5Q2hhbmdlO1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLCB7XG4gICAgICAgIG9uRGlzcGxheUNoYW5nZTogKGxpc3RlbmVyKSA9PiB7XG4gICAgICAgICAgICB0YWJsZURpc3BsYXlDaGFuZ2UobGlzdGVuZXIpO1xuICAgICAgICAgICAgdGFibGUuZXhlYygpO1xuICAgICAgICB9XG4gICAgfSk7XG59OyIsImV4cG9ydCBmdW5jdGlvbiBpbml0Q29udGVudChlbCkge1xuICAgIGlmIChlbCkge1xuICAgICAgICBlbC5pbm5lckhUTUwgPSBgXG4gICAgICAgIDxkaXYgZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcj1cIlwiPlxuICAgICAgICAgICAgUHJvY2Vzc2luZyAuLi5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDx0YWJsZT5cbiAgICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICA8dGggY29sc3Bhbj1cIjVcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBkYXRhLXN0LXNlYXJjaC1mb3JtPVwiaWQsIGZpcnN0TmFtZSwgbGFzdE5hbWUsIGVtYWlsLCBwaG9uZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGZvcj1cInNlYXJjaFwiPmdsb2JhbCBzZWFyY2g8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IGlkPVwic2VhcmNoXCIgcGxhY2Vob2xkZXI9XCJDYXNlIHNlbnNpdGl2ZSBzZWFyY2hcIiB0eXBlPVwidGV4dFwiLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzZWFyY2hCdXR0b25cIj5TZWFyY2g8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImlkXCIgZGF0YS1zdC1zb3J0LWN5Y2xlPklkPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwiZmlyc3ROYW1lXCI+Zmlyc3ROYW1lPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwibGFzdE5hbWVcIj5sYXN0TmFtZTwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImVtYWlsXCI+ZW1haWw8L3RoPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJwaG9uZVwiPnBob25lPC90aD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiNVwiPkxvYWRpbmcgZGF0YSAuLi48L3RkPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICA8dGZvb3Q+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCIzXCIgZGF0YS1zdC1zdW1tYXJ5PjwvdGQ+XG4gICAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCIyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1zdC1wYWdpbmF0aW9uPjwvZGl2PlxuICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90Zm9vdD5cbiAgICAgICAgPC90YWJsZT5cblxuICAgICAgICA8ZGl2IGlkPVwiZGVzY3JpcHRpb24tY29udGFpbmVyXCI+XG4gICAgICAgIDwvZGl2PmBcbiAgICB9XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtpZCwgZmlyc3ROYW1lLCBsYXN0TmFtZSwgZW1haWwsIHBob25lfSwgaW5kZXgpIHtcbiAgICBjb25zdCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgdHIuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgaW5kZXgpO1xuICAgIHRyLmlubmVySFRNTCA9IGA8dGQ+JHtpZH08L3RkPjx0ZD4ke2ZpcnN0TmFtZX08L3RkPjx0ZD4ke2xhc3ROYW1lfTwvdGQ+PHRkPiR7ZW1haWx9PC90ZD48dGQ+JHtwaG9uZX08L3RkPmA7XG4gICAgcmV0dXJuIHRyO1xufSIsImltcG9ydCB7c3VtbWFyeX0gIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN1bW1hcnlDb21wb25lbnQgKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGRpciA9IHN1bW1hcnkoe3RhYmxlfSk7XG4gIGRpci5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+JHsocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKX08L3N0cm9uZz4gLSA8c3Ryb25nPiR7TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPiR7ZmlsdGVyZWRDb3VudH08L3N0cm9uZz4gbWF0Y2hpbmcgaXRlbXNgO1xuICB9KTtcbiAgcmV0dXJuIGRpcjtcbn0iLCJpbXBvcnQge3NsaWNlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFnaW5hdGlvbkNvbXBvbmVudCh7dGFibGUsIGVsfSkge1xuICAgIGNvbnN0IHByZXZpb3VzQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgcHJldmlvdXNCdXR0b24uaW5uZXJIVE1MID0gJ1ByZXZpb3VzJztcbiAgICBjb25zdCBuZXh0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgbmV4dEJ1dHRvbi5pbm5lckhUTUwgPSAnTmV4dCc7XG4gICAgY29uc3QgcGFnZVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gJy0gcGFnZSAxIC0nO1xuXG4gICAgY29uc3QgY29tcCA9IHNsaWNlKHt0YWJsZX0pO1xuXG4gICAgY29tcC5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlfSkgPT4ge1xuICAgICAgICBwcmV2aW91c0J1dHRvbi5kaXNhYmxlZCA9ICFjb21wLmlzUHJldmlvdXNQYWdlRW5hYmxlZCgpO1xuICAgICAgICBuZXh0QnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNOZXh0UGFnZUVuYWJsZWQoKTtcbiAgICAgICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gYC0gJHtwYWdlfSAtYDtcbiAgICB9KTtcblxuICAgIHByZXZpb3VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3RQcmV2aW91c1BhZ2UoKSk7XG4gICAgbmV4dEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbXAuc2VsZWN0TmV4dFBhZ2UoKSk7XG5cbiAgICBlbC5hcHBlbmRDaGlsZChwcmV2aW91c0J1dHRvbik7XG4gICAgZWwuYXBwZW5kQ2hpbGQocGFnZVNwYW4pO1xuICAgIGVsLmFwcGVuZENoaWxkKG5leHRCdXR0b24pO1xuXG4gICAgcmV0dXJuIGNvbXA7XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGl0ZW0pIHtcblxuICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgZGl2LmlubmVySFRNTCA9IGDQktGL0LHRgNCw0L0g0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GMIDxiPiR7aXRlbS5maXJzdE5hbWV9ICR7aXRlbS5sYXN0TmFtZX08L2I+PGJyPlxuICAgICAgICAgICAg0J7Qv9C40YHQsNC90LjQtTo8YnI+XG5cbiAgICAgICAgICAgIDx0ZXh0YXJlYT5cbiAgICAgICAgICAgICR7aXRlbS5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgIDwvdGV4dGFyZWE+PGJyPlxuXG4gICAgICAgICAgICDQkNC00YDQtdGBINC/0YDQvtC20LjQstCw0L3QuNGPOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0cmVldEFkZHJlc3N9PC9iPjxicj5cbiAgICAgICAgICAgINCT0L7RgNC+0LQ6IDxiPiR7aXRlbS5hZHJlc3MuY2l0eX08L2I+PGJyPlxuICAgICAgICAgICAg0J/RgNC+0LLQuNC90YbQuNGPL9GI0YLQsNGCOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0YXRlfTwvYj48YnI+XG4gICAgICAgICAgICDQmNC90LTQtdC60YE6IDxiPiR7aXRlbS5hZHJlc3MuemlwfTwvYj5gO1xuXG4gICAgcmV0dXJuIGRpdjtcbn0iLCJpbXBvcnQge3RhYmxlIGFzIHRhYmxlQ29tcG9uZW50RmFjdG9yeX0gZnJvbSAnLi4vLi4vLi4vaW5kZXgnO1xuaW1wb3J0IHt0YWJsZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmltcG9ydCB7aW5pdENvbnRlbnQgYXMgaW5pdENvbnRlbnRTa2VsZXRvbn0gZnJvbSAnLi9pbml0LWNvbnRlbnQnO1xuaW1wb3J0IHJvdyBmcm9tICcuL3Jvdyc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL3N1bW1hcnknO1xuaW1wb3J0IHBhZ2luYXRpb24gZnJvbSAnLi9wYWdpbmF0aW9uJztcbmltcG9ydCBkZXNjcmlwdGlvbiBmcm9tICcuL2Rlc2NyaXB0aW9uJztcblxuZXhwb3J0IGRlZmF1bHQgU21hcnRUYWJsZTtcblxuY29uc3QgTUFYX1JPV1NfUEVSX1BBR0UgPSA1MDtcblxuY2xhc3MgU21hcnRUYWJsZSB7XG4gICAgY29uc3RydWN0b3Ioe3RhYmxlQ29udGFpbmVyLCBkYXRhfSkge1xuICAgICAgICB0aGlzLnRhYmxlQ29udGFpbmVyRWwgPSB0YWJsZUNvbnRhaW5lcjtcbiAgICAgICAgaW5pdENvbnRlbnRTa2VsZXRvbih0YWJsZUNvbnRhaW5lcik7XG4gICAgICAgIG9uSW5pdCh0YWJsZUNvbnRhaW5lciwgZGF0YSk7XG4gICAgfVxuXG4gICAgc3RhdGljIGNyZWF0ZUluc3RhbmNlKHt0YWJsZUNvbnRhaW5lciwgZGF0YX0pIHtcbiAgICAgICAgaWYgKHRhYmxlQ29udGFpbmVyICYmIGRhdGEgJiYgQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBTbWFydFRhYmxlKHt0YWJsZUNvbnRhaW5lciwgZGF0YX0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy50YWJsZUNvbnRhaW5lckVsLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAvLyBUT0RPOiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyXG4gICAgfVxuXG59XG5cbi8vIHByaXZhdGUgbWV0aG9kXG5mdW5jdGlvbiBvbkluaXQodGFibGVDb250YWluZXJFbCwgZGF0YSkge1xuXG4gICAgY29uc3QgdGJvZHkgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ3Rib2R5Jyk7XG5cbiAgICAvLyDQodCx0L7RgNC60LAgc21hcnQtdGFibGUtY29yZVxuICAgIGNvbnN0IHQgPSB0YWJsZSh7ZGF0YSwgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IE1BWF9ST1dTX1BFUl9QQUdFfX19KTtcbiAgICBjb25zdCB0YWJsZUNvbXBvbmVudCA9IHRhYmxlQ29tcG9uZW50RmFjdG9yeSh7ZWw6IHRhYmxlQ29udGFpbmVyRWwsIHRhYmxlOiB0fSk7XG5cbiAgICAvLyDQodCx0L7RgNC60LAg0LzQvtC00YPQu9GPIHN1bW1hcnlcbiAgICBjb25zdCBzdW1tYXJ5RWwgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXN1bW1hcnldJyk7XG4gICAgc3VtbWFyeSh7dGFibGU6IHQsIGVsOiBzdW1tYXJ5RWx9KTtcblxuICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L/QsNCz0LjQvdCw0YbQuNC4XG4gICAgY29uc3QgcGFnaW5hdGlvbkNvbnRhaW5lciA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignW2RhdGEtc3QtcGFnaW5hdGlvbl0nKTtcbiAgICBwYWdpbmF0aW9uKHt0YWJsZTogdCwgZWw6IHBhZ2luYXRpb25Db250YWluZXJ9KTtcblxuICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L7Qv9C40YHQsNC90LjRj1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2NyaXB0aW9uLWNvbnRhaW5lcicpO1xuICAgIHRib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuXG4gICAgICAgIGxldCB0YXJnZXQgPSBldmVudC50YXJnZXQ7XG5cbiAgICAgICAgbGV0IHRyID0gdGFyZ2V0LmNsb3Nlc3QoJ3RyJyk7XG4gICAgICAgIGlmICghdHIpIHJldHVybjtcbiAgICAgICAgaWYgKCF0Ym9keS5jb250YWlucyh0cikpIHJldHVybjtcblxuICAgICAgICBsZXQgZGF0YUluZGV4ID0gdHIuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4Jyk7XG5cbiAgICAgICAgaWYgKGRhdGFJbmRleCAmJiBkYXRhW2RhdGFJbmRleF0pIHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuYXBwZW5kQ2hpbGQoZGVzY3JpcHRpb24oZGF0YVtkYXRhSW5kZXhdKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0YDQtdC90LTQtdGA0LAg0YLQsNCx0LvQuNGG0YtcbiAgICB0YWJsZUNvbXBvbmVudC5vbkRpc3BsYXlDaGFuZ2UoZGlzcGxheWVkID0+IHtcbiAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgdGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgIGZvciAobGV0IHIgb2YgZGlzcGxheWVkKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdDaGlsZCA9IHJvdyhyLnZhbHVlLCByLmluZGV4KTtcbiAgICAgICAgICAgIHRib2R5LmFwcGVuZENoaWxkKG5ld0NoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSIsImltcG9ydCBBc3luY0RhdGFMb2FkZXIgZnJvbSAnLi9jb21wb25lbnRzL2FzeW5jLWRhdGEtbG9hZGVyJztcbmltcG9ydCBTbWFydFRhYmxlIGZyb20gJy4vY29tcG9uZW50cy9zbWFydC10YWJsZS9zbWFydC10YWJsZSc7XG5cbmxldCB0YWJsZUNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0YWJsZS1jb250YWluZXInKTtcblxuLy8gIzEg0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCDQsNGB0LjQvdGF0YDQvtC90L3Ri9C5INC30LDQs9GA0YPQt9GH0LjQuiDQtNCw0L3QvdGL0YVcbmxldCBidXR0b25zQ29uZmlnID0gW1xuICAgIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3d3dy5maWxsdGV4dC5jb20vP3Jvd3M9MzImaWQ9JTdCbnVtYmVyJTdDMTAwMCU3RCZmaXJzdE5hbWU9JTdCZmlyc3ROYW1lJTdEJmxhc3ROYW1lPSU3Qmxhc3ROYW1lJTdEJmVtYWlsPSU3QmVtYWlsJTdEJnBob25lPSU3QnBob25lJTdDKHh4eCl4eHgteHgteHglN0QmYWRyZXNzPSU3QmFkZHJlc3NPYmplY3QlN0QmZGVzY3JpcHRpb249JTdCbG9yZW0lN0MzMiU3RCcsXG4gICAgICAgIG5hbWU6ICfQktCw0YDQuNCw0L3RgiAjMSdcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL3d3dy5maWxsdGV4dC5jb20vP3Jvd3M9MTAwMCZpZD0lN0JudW1iZXIlN0MxMDAwJTdEJmZpcnN0TmFtZT0lN0JmaXJzdE5hbWUlN0QmZGVsYXk9MyZsYXN0TmFtZT0lN0JsYXN0TmFtZSU3RCZlbWFpbD0lN0JlbWFpbCU3RCZwaG9uZT0lN0JwaG9uZSU3Qyh4eHgpeHh4LXh4LXh4JTdEJmFkcmVzcz0lN0JhZGRyZXNzT2JqZWN0JTdEJmRlc2NyaXB0aW9uPSU3QmxvcmVtJTdDMzIlN0QnLFxuICAgICAgICBuYW1lOiAn0JLQsNGA0LjQsNC90YIgIzInXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly9mb29iYXI3Nzc3NzdmYWlsLmRldicsXG4gICAgICAgIG5hbWU6ICdMb2FkaW5nIHdpdGggZmFpbCdcbiAgICB9LFxuXTtcbmxldCBhc3luY0RhdGFMb2FkZXIgPSBBc3luY0RhdGFMb2FkZXIuY3JlYXRlSW5zdGFuY2Uoe2J1dHRvbnNDb25maWd9KTtcbmFzeW5jRGF0YUxvYWRlci5hcHBlbmRUbygnZGF0YS1sb2FkZXItY29udGFpbmVyJyk7XG5cbi8vICMyINCY0L3QuNGG0LjQsNC70LjQt9C40YDRg9C10Lwg0LzQvtC00YPQu9GMINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0LTQsNC90L3Ri9GFXG5sZXQgc21hcnRUYWJsZTtcblxuZnVuY3Rpb24gZGVzdHJveVNtYXJ0VGFibGUoKSB7XG4gICAgaWYgKHNtYXJ0VGFibGUpIHtcbiAgICAgICAgc21hcnRUYWJsZS5vbkRlc3Ryb3koKTtcbiAgICAgICAgc21hcnRUYWJsZSA9IG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTbWFydFRhYmxlKHJlc3BvbnNlRGF0YSkge1xuICAgIGlmIChyZXNwb25zZURhdGEpIHtcbiAgICAgICAgZGVzdHJveVNtYXJ0VGFibGUoKTtcbiAgICAgICAgc21hcnRUYWJsZSA9IFNtYXJ0VGFibGUuY3JlYXRlSW5zdGFuY2Uoe3RhYmxlQ29udGFpbmVyLCBkYXRhOiByZXNwb25zZURhdGF9KTtcbiAgICB9XG59XG5cbi8vICMzINCf0YDQuNCy0Y/Qt9GL0LLQsNC10Lwg0YHRg9GJ0L3QvtGB0YLQuFxuaWYgKGFzeW5jRGF0YUxvYWRlcikge1xuICAgIGFzeW5jRGF0YUxvYWRlclxuICAgICAgICAuYmluZCh7XG4gICAgICAgICAgICBoYW5kbGVyOiBjcmVhdGVTbWFydFRhYmxlLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdBRlRFUl9BQ1RJT04nXG4gICAgICAgIH0pXG4gICAgICAgIC5iaW5kKHtcbiAgICAgICAgICAgIGhhbmRsZXI6IGRlc3Ryb3lTbWFydFRhYmxlLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdCRUZPUkVfQUNUSU9OJ1xuICAgICAgICB9KTtcbn0iXSwibmFtZXMiOlsiQWJzdHJhY3RDb21wb25lbnQiLCJBc3luY0RhdGFMb2FkZXIiLCJwb2ludGVyIiwiZmlsdGVyIiwic29ydEZhY3RvcnkiLCJzb3J0Iiwic2VhcmNoIiwidGFibGUiLCJleGVjdXRpb25MaXN0ZW5lciIsIlNtYXJ0VGFibGUiLCJpbml0Q29udGVudFNrZWxldG9uIiwic3VtbWFyeSIsInBhZ2luYXRpb24iXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7OztBQUtBLEFBRUEsTUFBTUEsbUJBQWlCLENBQUM7SUFDcEIsV0FBVyxHQUFHO1FBQ1YsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7S0FDMUI7O0lBRUQsT0FBTyxjQUFjLENBQUMsTUFBTSxFQUFFOztLQUU3Qjs7Ozs7Ozs7O0lBU0QsUUFBUSxDQUFDLFFBQVEsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFO1FBQ2pDLElBQUksU0FBUyxFQUFFO1lBQ1gsSUFBSSxTQUFTLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRCxJQUFJLFNBQVMsRUFBRTtnQkFDWCxTQUFTLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUM5RCxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7Z0JBQ3JDLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQzthQUNoRDtTQUNKLE1BQU07O1lBRUgsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQzdFO0tBQ0o7Ozs7Ozs7Ozs7SUFVRCxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRTtRQUN6QyxJQUFJLFFBQVEsQ0FBQzs7UUFFYixJQUFJLE9BQU8sT0FBTyxLQUFL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
