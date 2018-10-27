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
    appendTo(selector) {
        this.appendChildSafety(document.querySelector(selector), this.domElement);
    }

    /**
     * Рендерит компонент и замещает контейрер
     * @param selector
     */
    swapTo(selectorId) {
        let container = document.getElementById(selectorId);
        if (container) {
            container.parentNode.replaceChild(this.domElement, container);
            this.domElement.className = selectorId;
            this.domElement.setAttribute('id', selectorId);
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

class SmartTable$1 extends AbstractComponent$1 {
    constructor({data}) {
        super();

        this.domElement = this.getElementFactory('section');

        initContent(this.domElement);
        onInit(this.domElement, data);
    }

    static createInstance({data}) {
        if (data && Array.isArray(data)) {
            return new SmartTable$1({data})
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
    summaryComponent({table: t, el: summaryEl});

    // Сборка модуля пагинации
    const paginationContainer = tableContainerEl.querySelector('[data-st-pagination]');
    paginationComponent({table: t, el: paginationContainer});

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
asyncDataLoader.swapTo('data-loader-container');

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
        smartTable = SmartTable$1.createInstance({data: responseData});
        smartTable.swapTo('table-container');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJjb21wb25lbnRzL2Fic3RyYWN0LWNvbXBvbmVudC5qcyIsImNvbXBvbmVudHMvYXN5bmMtZGF0YS1sb2FkZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2VhcmNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy9zb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3IuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9pbmRleC5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvc2VhcmNoRm9ybS5qcyIsIi4uL2xpYi90YWJsZS5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvdGVtcGxhdGUtaGVscGVycy9pbml0LWNvbnRlbnQuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3RlbXBsYXRlLWhlbHBlcnMvcm93LmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS90ZW1wbGF0ZS1oZWxwZXJzL3N1bW1hcnkuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3RlbXBsYXRlLWhlbHBlcnMvcGFnaW5hdGlvbi5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvdGVtcGxhdGUtaGVscGVycy9kZXNjcmlwdGlvbi5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvc21hcnQtdGFibGUuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqINCQ0LHRgdGC0YDQsNC60YLQvdGL0Lkg0LrQu9Cw0YHRgSDQutC+0LzQv9C+0L3QtdC90YLQsFxuICog0J7RgiDQvdC10LPQviDQvdCw0YHQu9C10LTRg9GO0YLRgdGPINCy0YHQtSDQvtGB0YLQsNC70YzQvdGL0LUg0LrQvtC80L/QvtC90LXQvdGC0Ysg0YHRgtGA0LDQvdC40YbRi1xuICovXG5cbmV4cG9ydCBkZWZhdWx0IEFic3RyYWN0Q29tcG9uZW50O1xuXG5jbGFzcyBBYnN0cmFjdENvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZG9tRWxlbWVudCA9IG51bGw7XG4gICAgfVxuXG4gICAgc3RhdGljIGNyZWF0ZUluc3RhbmNlKHBhcmFtcykge1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0KDQtdC90LTQtdGA0LjRgiDQutC+0LzQv9C+0L3QtdC90YIg0LIg0LrQvtC90YLQtdC50L3QtdGAXG4gICAgICogQHBhcmFtIHNlbGVjdG9yXG4gICAgICogQHBhcmFtIGlzUmVwbGFjZVxuICAgICAqIHRydWUg4oCUINC30LDQvNC10YnQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGAXG4gICAgICogZmFsc2UgLSDQstGB0YLQsNCy0LvRj9C10Lwg0LLQvdGD0YLRgNGMXG4gICAgICovXG4gICAgYXBwZW5kVG8oc2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5hcHBlbmRDaGlsZFNhZmV0eShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSwgdGhpcy5kb21FbGVtZW50KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDQoNC10L3QtNC10YDQuNGCINC60L7QvNC/0L7QvdC10L3RgiDQuCDQt9Cw0LzQtdGJ0LDQtdGCINC60L7QvdGC0LXQudGA0LXRgFxuICAgICAqIEBwYXJhbSBzZWxlY3RvclxuICAgICAqL1xuICAgIHN3YXBUbyhzZWxlY3RvcklkKSB7XG4gICAgICAgIGxldCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3RvcklkKTtcbiAgICAgICAgaWYgKGNvbnRhaW5lcikge1xuICAgICAgICAgICAgY29udGFpbmVyLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHRoaXMuZG9tRWxlbWVudCwgY29udGFpbmVyKTtcbiAgICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC5jbGFzc05hbWUgPSBzZWxlY3RvcklkO1xuICAgICAgICAgICAgdGhpcy5kb21FbGVtZW50LnNldEF0dHJpYnV0ZSgnaWQnLCBzZWxlY3RvcklkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqINCh0L7Qt9C00LDRkdGCIGRvbSDRjdC70LXQvNC10L3RgiDRgSDQsNGC0YDQuNCx0YPRgtCw0LzQuCDQuCDRgdC+0LTQtdGA0LbQuNC80YvQvCDQstC90YPRgtGA0LhcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0YWdOYW1lXG4gICAgICogQHBhcmFtIGlubmVySHRtbFxuICAgICAqIEBwYXJhbSBhdHRyc1xuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGdldEVsZW1lbnRGYWN0b3J5KHRhZ05hbWUsIGlubmVySHRtbCwgYXR0cnMpIHtcbiAgICAgICAgdmFyIF9lbGVtZW50O1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGFnTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIF9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcblxuICAgICAgICAgICAgaWYgKGlubmVySHRtbCkge1xuICAgICAgICAgICAgICAgIF9lbGVtZW50LmlubmVySFRNTCA9IGlubmVySHRtbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGF0dHJzICYmIHR5cGVvZiBhdHRycyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpbmRleCBpbiBhdHRycykge1xuICAgICAgICAgICAgICAgICAgICBfZWxlbWVudC5zZXRBdHRyaWJ1dGUoaW5kZXgsIGF0dHJzW2luZGV4XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9lbGVtZW50O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiDQntCx0LXRgNGC0LrQsCBhcHBlbmRDaGlsZCDQtNC70Y8g0LHQtdC30L7Qv9Cw0YHQvdC+0LPQviDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRj1xuICAgICAqXG4gICAgICogQHBhcmFtIGNvbnRhaW5lclxuICAgICAqIEBwYXJhbSBlbGVtZW50XG4gICAgICovXG4gICAgYXBwZW5kQ2hpbGRTYWZldHkoY29udGFpbmVyLCBlbGVtZW50KSB7XG5cbiAgICAgICAgZnVuY3Rpb24gX2lzRWxlbWVudChvKSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gXCJvYmplY3RcIiA/IG8gaW5zdGFuY2VvZiBIVE1MRWxlbWVudCA6IC8vRE9NMlxuICAgICAgICAgICAgICAgICAgICBvICYmIHR5cGVvZiBvID09PSBcIm9iamVjdFwiICYmIG8gIT09IG51bGwgJiYgby5ub2RlVHlwZSA9PT0gMSAmJiB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gXCJzdHJpbmdcIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb250YWluZXIgJiYgX2lzRWxlbWVudChjb250YWluZXIpICYmIGVsZW1lbnQgJiYgX2lzRWxlbWVudChlbGVtZW50KSkge1xuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGhpZGUoZWxlbWVudCkge1xuICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2hvdyhlbGVtZW50KSB7XG4gICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICB9XG4gICAgfVxuXG59IiwiLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LDRgdC40L3RhdGA0L7QvdC90L7QuSDQt9Cw0LPRgNGD0LfQutC4INC00LDQvdC90YvRhVxuICog0JIg0YHQu9GD0YfQsNC1INGD0YHQv9C10YjQvdC+0Lkg0LfQsNCz0YDRg9C30LrQuCDQvtGC0L/RgNCw0LLQu9GP0LXRgiDQtNCw0L3QvdGL0LUg0LIgZXZlbnRMaXN0ZW5lcnNcbiAqINCi0LDQuiDQttC1INGD0L/RgNCw0LLQu9GP0LXRgiBET00sINGB0L/QuNC90L3QtdGA0L7QvCDQt9Cw0LPRgNGD0LfQutC4INC4INC+0LHRgNCw0LHQsNGC0YvQstCw0LXRgiDQvtGI0LjQsdC60LhcbiAqL1xuaW1wb3J0IEFic3RyYWN0Q29tcG9uZW50IGZyb20gXCIuL2Fic3RyYWN0LWNvbXBvbmVudFwiO1xuXG5leHBvcnQgZGVmYXVsdCBBc3luY0RhdGFMb2FkZXI7XG5cbmNvbnN0IFNUQVRFX0xPQURJTkcgPSAnU1RBVEVfTE9BRElORyc7XG5jb25zdCBTVEFURV9FTVBUWSA9ICdTVEFURV9FTVBUWSc7XG5jb25zdCBTVEFURV9MT0FERURfU1VDQ0VTU0ZVTCA9ICdTVEFURV9MT0FERURfU1VDQ0VTU0ZVTCc7XG5cbmNvbnN0IEFGVEVSX0FDVElPTiA9ICdBRlRFUl9BQ1RJT04nO1xuY29uc3QgQkVGT1JFX0FDVElPTiA9ICdCRUZPUkVfQUNUSU9OJztcblxuY2xhc3MgQXN5bmNEYXRhTG9hZGVyIGV4dGVuZHMgQWJzdHJhY3RDb21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3Ioe2J1dHRvbnNDb25maWd9KSB7XG5cbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHNlbGYuZXZlbnRMaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgc2VsZi5kb21FbGVtZW50ID0gbnVsbDtcblxuICAgICAgICBsZXQgZWxlbWVudCA9IHNlbGYuZ2V0RWxlbWVudEZhY3RvcnkoJ3NlY3Rpb24nKTtcblxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGJ1dHRvbnNDb25maWcpIHtcblxuICAgICAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShcbiAgICAgICAgICAgICAgICBlbGVtZW50LFxuICAgICAgICAgICAgICAgIHNlbGYuZ2V0RWxlbWVudEZhY3RvcnkoXG4gICAgICAgICAgICAgICAgICAgICdidXR0b24nLFxuICAgICAgICAgICAgICAgICAgICBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXRhLXVybCc6IGl0ZW0udXJsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICAvLyDQntC00LjQvSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSDQvdCwINCy0YHQtSDQutC90L7Qv9C60LhcbiAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50ID0+IHtcblxuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldDtcbiAgICAgICAgICAgIGxldCBidXR0b24gPSB0YXJnZXQuY2xvc2VzdCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBpZiAoIWJ1dHRvbikgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKCFlbGVtZW50LmNvbnRhaW5zKGJ1dHRvbikpIHJldHVybjtcblxuICAgICAgICAgICAgLy8g0JfQsNGJ0LjRgtCwINC+0YIg0L/QvtCy0YLQvtGA0L3Ri9GFINC90LDQttCw0YLQuNC5INCyINC80L7QvNC10L3RgiBQZW5kaW5nXG4gICAgICAgICAgICBpZiAoc2VsZi5yZW5kZXJTdGF0ZSAhPT0gU1RBVEVfTE9BRElORykge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSBidXR0b24uZ2V0QXR0cmlidXRlKCdkYXRhLXVybCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfTE9BRElORztcblxuICAgICAgICAgICAgICAgICAgICBmZXRjaCh1cmwpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4ZWN1dGVFdmVudExpc3RlbmVycyhBRlRFUl9BQ1RJT04sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfTE9BREVEX1NVQ0NFU1NGVUw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlRXZlbnRMaXN0ZW5lcnMoQUZURVJfQUNUSU9OLCBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfRU1QVFk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBzZWxmLnNwaW5uZXJFbGVtZW50ID0gc2VsZi5nZXRFbGVtZW50RmFjdG9yeShcbiAgICAgICAgICAgICdzZWN0aW9uJyxcbiAgICAgICAgICAgICc8aW1nIHNyYz1cIi4vc3Bpbm5lci5zdmdcIiB3aWR0aD1cIjEwMFwiPicsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ3N0eWxlJzogJ2Rpc3BsYXk6IG5vbmUnXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBzZWxmLmRvbUVsZW1lbnQgPSBzZWxmLmdldEVsZW1lbnRGYWN0b3J5KCdzZWN0aW9uJyk7XG4gICAgICAgIHNlbGYuYXBwZW5kQ2hpbGRTYWZldHkoc2VsZi5kb21FbGVtZW50LCBlbGVtZW50KTtcbiAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShzZWxmLmRvbUVsZW1lbnQsIHNlbGYuc3Bpbm5lckVsZW1lbnQpO1xuXG4gICAgICAgIHNlbGYucmVuZGVyU3RhdGUgPSBTVEFURV9FTVBUWTtcblxuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVJbnN0YW5jZShwYXJhbXMpIHtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgQXN5bmNEYXRhTG9hZGVyKHBhcmFtcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0JTQvtCx0LDQstC70Y/QtdGCINCy0L3QtdGI0L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60LhcbiAgICAgKiBAcGFyYW0gaGFuZGxlclxuICAgICAqIEBwYXJhbSBiZWhhdmlvclxuICAgICAqL1xuICAgIGJpbmQoe2hhbmRsZXIgPSBmdW5jdGlvbigpIHt9LCBiZWhhdmlvciA9ICcnfSkge1xuICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnB1c2goe1xuICAgICAgICAgICAgaGFuZGxlcixcbiAgICAgICAgICAgIGJlaGF2aW9yXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vINCy0L7Qt9Cy0YDQsNGJ0LDQtdC8INC00LvRjyDQv9GA0LjQvNC10YDQsCDQutC+0LTQsCDRgSBjaGFpbmluZ1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBiZWhhdmlvclxuICAgICAqL1xuICAgIGV4ZWN1dGVFdmVudExpc3RlbmVycyhiZWhhdmlvciwgZGF0YSkge1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuZXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5iZWhhdmlvciA9PT0gYmVoYXZpb3IpKSB7XG4gICAgICAgICAgICBpdGVtLmhhbmRsZXIoZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBuZXdTdGF0ZVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdGF0ZShuZXdTdGF0ZSkge1xuXG4gICAgICAgIHN3aXRjaCAobmV3U3RhdGUpIHtcbiAgICAgICAgICAgIGNhc2UgU1RBVEVfRU1QVFk6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGUodGhpcy5zcGlubmVyRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgU1RBVEVfTE9BRElORzpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJTdGF0ZSA9IG5ld1N0YXRlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvdyh0aGlzLnNwaW5uZXJFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXhlY3V0ZUV2ZW50TGlzdGVuZXJzKEJFRk9SRV9BQ1RJT04pO1xuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgU1RBVEVfTE9BREVEX1NVQ0NFU1NGVUw6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGUodGhpcy5zcGlubmVyRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdGF0ZTtcbiAgICB9XG5cbn0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB7U0VBUkNIX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNlYXJjaExpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NFQVJDSF9DSEFOR0VEXTogJ29uU2VhcmNoQ2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlLCBzY29wZSA9IFtdfSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICBzZWFyY2hMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSwge1xuICAgICAgc2VhcmNoKGlucHV0KXtcbiAgICAgICAgcmV0dXJuIHRhYmxlLnNlYXJjaCh7dmFsdWU6IGlucHV0LCBzY29wZX0pO1xuICAgICAgfVxuICAgIH0pO1xufSIsImltcG9ydCB7UEFHRV9DSEFOR0VELCBTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbUEFHRV9DSEFOR0VEXTogJ29uUGFnZUNoYW5nZScsIFtTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuICBsZXQge3NsaWNlOntwYWdlOmN1cnJlbnRQYWdlLCBzaXplOmN1cnJlbnRTaXplfX0gPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gIGxldCBpdGVtTGlzdExlbmd0aCA9IHRhYmxlLmxlbmd0aDtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc2VsZWN0UGFnZShwKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogcCwgc2l6ZTogY3VycmVudFNpemV9KTtcbiAgICB9LFxuICAgIHNlbGVjdE5leHRQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICB9LFxuICAgIHNlbGVjdFByZXZpb3VzUGFnZSgpe1xuICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgfSxcbiAgICBjaGFuZ2VQYWdlU2l6ZShzaXplKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogMSwgc2l6ZX0pO1xuICAgIH0sXG4gICAgaXNQcmV2aW91c1BhZ2VFbmFibGVkKCl7XG4gICAgICByZXR1cm4gY3VycmVudFBhZ2UgPiAxO1xuICAgIH0sXG4gICAgaXNOZXh0UGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBNYXRoLmNlaWwoaXRlbUxpc3RMZW5ndGggLyBjdXJyZW50U2l6ZSkgPiBjdXJyZW50UGFnZTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oYXBpLCBzbGljZUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZTpwLCBzaXplOnMsIGZpbHRlcmVkQ291bnR9KSA9PiB7XG4gICAgY3VycmVudFBhZ2UgPSBwO1xuICAgIGN1cnJlbnRTaXplID0gcztcbiAgICBpdGVtTGlzdExlbmd0aCA9IGZpbHRlcmVkQ291bnQ7XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59XG4iLCJpbXBvcnQge1RPR0dMRV9TT1JUfSBmcm9tICcuLi9ldmVudHMnXG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNvcnRMaXN0ZW5lcnMgPSBwcm94eUxpc3RlbmVyKHtbVE9HR0xFX1NPUlRdOiAnb25Tb3J0VG9nZ2xlJ30pO1xuY29uc3QgZGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtwb2ludGVyLCB0YWJsZSwgY3ljbGUgPSBmYWxzZX0pIHtcblxuICBjb25zdCBjeWNsZURpcmVjdGlvbnMgPSBjeWNsZSA9PT0gdHJ1ZSA/IFsnbm9uZSddLmNvbmNhdChkaXJlY3Rpb25zKSA6IFsuLi5kaXJlY3Rpb25zXS5yZXZlcnNlKCk7XG5cbiAgbGV0IGhpdCA9IDA7XG5cbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbih7XG4gICAgdG9nZ2xlKCl7XG4gICAgICBoaXQrKztcbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgIHJldHVybiB0YWJsZS5zb3J0KHtwb2ludGVyLCBkaXJlY3Rpb259KTtcbiAgICB9XG5cbiAgfSwgc29ydExpc3RlbmVycyh7ZW1pdHRlcjogdGFibGV9KSk7XG5cbiAgZGlyZWN0aXZlLm9uU29ydFRvZ2dsZSgoe3BvaW50ZXI6cH0pID0+IHtcbiAgICBpZiAocG9pbnRlciAhPT0gcCkge1xuICAgICAgaGl0ID0gMDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59IiwiaW1wb3J0IHtTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB7RVhFQ19DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuXG5jb25zdCBleGVjdXRpb25MaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tFWEVDX0NIQU5HRURdOiAnb25FeGVjdXRpb25DaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvcn0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBjb21wb25lbnQgPSB3b3JraW5nSW5kaWNhdG9yKHt0YWJsZX0pO1xuICBjb21wb25lbnQub25FeGVjdXRpb25DaGFuZ2UoZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXdvcmtpbmcnKTtcbiAgICBpZiAod29ya2luZyA9PT0gdHJ1ZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc3Qtd29ya2luZycpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb21wb25lbnQ7XG59OyIsImltcG9ydCB7c29ydH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWwsIHRhYmxlLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LXNvcnQnKTtcbiAgY29uc3QgY3ljbGUgPSBjb25mLmN5Y2xlIHx8IGVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1zdC1zb3J0LWN5Y2xlJyk7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHNvcnQoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZX0pO1xuICBjb21wb25lbnQub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpjdXJyZW50UG9pbnRlciwgZGlyZWN0aW9ufSkgPT4ge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXNvcnQtYXNjJywgJ3N0LXNvcnQtZGVzYycpO1xuICAgIGlmIChwb2ludGVyID09PSBjdXJyZW50UG9pbnRlciAmJiBkaXJlY3Rpb24gIT09ICdub25lJykge1xuICAgICAgY29uc3QgY2xhc3NOYW1lID0gZGlyZWN0aW9uID09PSAnYXNjJyA/ICdzdC1zb3J0LWFzYycgOiAnc3Qtc29ydC1kZXNjJztcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9XG4gIH0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZXYgPT4gY29tcG9uZW50LnRvZ2dsZSgpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50TGlzdGVuZXIpO1xuICByZXR1cm4gY29tcG9uZW50O1xufSIsImltcG9ydCB7c2VhcmNofSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGUsIGRlbGF5ID0gNDAwLCBjb25mID0ge319KSB7XG4gICAgY29uc3Qgc2NvcGUgPSBjb25mLnNjb3BlIHx8IChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc2VhcmNoLWZvcm0nKSB8fCAnJykuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gc2VhcmNoKHt0YWJsZSwgc2NvcGV9KTtcblxuICAgIGlmIChlbCkge1xuICAgICAgICBsZXQgaW5wdXQgPSBlbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKTtcbiAgICAgICAgbGV0IGJ1dHRvbiA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdidXR0b24nKTtcblxuICAgICAgICBpZiAoaW5wdXQgJiYgaW5wdXRbMF0gJiYgYnV0dG9uICYmIGJ1dHRvblswXSkge1xuICAgICAgICAgICAgYnV0dG9uWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5zZWFyY2goaW5wdXRbMF0udmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlucHV0WzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBldmVudCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50ICYmIGV2ZW50LmtleUNvZGUgJiYgZXZlbnQua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNlYXJjaChpbnB1dFswXS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuXG4gICAgICAgIH1cbiAgICB9XG5cbn07IiwiaW1wb3J0IGxvYWRpbmcgZnJvbSAnLi9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCBzb3J0IGZyb20gJy4vc29ydCc7XG4vLyBpbXBvcnQgZmlsdGVyIGZyb20gJy4vZmlsdGVycyc7XG4vLyBpbXBvcnQgc2VhcmNoSW5wdXQgZnJvbSAnLi9zZWFyY2gnO1xuaW1wb3J0IHNlYXJjaEZvcm0gZnJvbSAnLi9zZWFyY2hGb3JtJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGV9KSB7XG4gICAgLy8gYm9vdFxuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zb3J0XScpXS5mb3JFYWNoKGVsID0+IHNvcnQoe2VsLCB0YWJsZX0pKTtcbiAgICBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3QtbG9hZGluZy1pbmRpY2F0b3JdJyldLmZvckVhY2goZWwgPT4gbG9hZGluZyh7ZWwsIHRhYmxlfSkpO1xuICAgIC8vIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1maWx0ZXJdJyldLmZvckVhY2goZWwgPT4gZmlsdGVyKHtlbCwgdGFibGV9KSk7XG4gICAgLy8gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNlYXJjaF0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hJbnB1dCh7ZWwsIHRhYmxlfSkpO1xuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zZWFyY2gtZm9ybV0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hGb3JtKHtlbCwgdGFibGV9KSk7XG5cbiAgICAvL2V4dGVuc2lvblxuICAgIGNvbnN0IHRhYmxlRGlzcGxheUNoYW5nZSA9IHRhYmxlLm9uRGlzcGxheUNoYW5nZTtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YWJsZSwge1xuICAgICAgICBvbkRpc3BsYXlDaGFuZ2U6IChsaXN0ZW5lcikgPT4ge1xuICAgICAgICAgICAgdGFibGVEaXNwbGF5Q2hhbmdlKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIHRhYmxlLmV4ZWMoKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTsiLCJleHBvcnQgZnVuY3Rpb24gaW5pdENvbnRlbnQoZWwpIHtcbiAgICBpZiAoZWwpIHtcbiAgICAgICAgZWwuaW5uZXJIVE1MID0gYFxuICAgICAgICA8ZGl2IGRhdGEtc3QtbG9hZGluZy1pbmRpY2F0b3I9XCJcIj5cbiAgICAgICAgICAgIFByb2Nlc3NpbmcgLi4uXG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8dGFibGU+XG4gICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRoIGNvbHNwYW49XCI1XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1zdC1zZWFyY2gtZm9ybT1cImlkLCBmaXJzdE5hbWUsIGxhc3ROYW1lLCBlbWFpbCwgcGhvbmVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBmb3I9XCJzZWFyY2hcIj5nbG9iYWwgc2VhcmNoPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCBpZD1cInNlYXJjaFwiIHBsYWNlaG9sZGVyPVwiQ2FzZSBzZW5zaXRpdmUgc2VhcmNoXCIgdHlwZT1cInRleHRcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwic2VhcmNoQnV0dG9uXCI+U2VhcmNoPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJpZFwiIGRhdGEtc3Qtc29ydC1jeWNsZT5JZDwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImZpcnN0TmFtZVwiPmZpcnN0TmFtZTwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImxhc3ROYW1lXCI+bGFzdE5hbWU8L3RoPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJlbWFpbFwiPmVtYWlsPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwicGhvbmVcIj5waG9uZTwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICA8dGQgY29sc3Bhbj1cIjVcIj5Mb2FkaW5nIGRhdGEgLi4uPC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPHRmb290PlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiM1wiIGRhdGEtc3Qtc3VtbWFyeT48L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiMlwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGRhdGEtc3QtcGFnaW5hdGlvbj48L2Rpdj5cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGZvb3Q+XG4gICAgICAgIDwvdGFibGU+XG5cbiAgICAgICAgPGRpdiBpZD1cImRlc2NyaXB0aW9uLWNvbnRhaW5lclwiPlxuICAgICAgICA8L2Rpdj5gXG4gICAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7aWQsIGZpcnN0TmFtZSwgbGFzdE5hbWUsIGVtYWlsLCBwaG9uZX0sIGluZGV4KSB7XG4gICAgY29uc3QgdHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpO1xuICAgIHRyLnNldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcsIGluZGV4KTtcbiAgICB0ci5pbm5lckhUTUwgPSBgPHRkPiR7aWR9PC90ZD48dGQ+JHtmaXJzdE5hbWV9PC90ZD48dGQ+JHtsYXN0TmFtZX08L3RkPjx0ZD4ke2VtYWlsfTwvdGQ+PHRkPiR7cGhvbmV9PC90ZD5gO1xuICAgIHJldHVybiB0cjtcbn0iLCJpbXBvcnQge3N1bW1hcnl9ICBmcm9tICdzbWFydC10YWJsZS1jb3JlJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzdW1tYXJ5Q29tcG9uZW50ICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBkaXIgPSBzdW1tYXJ5KHt0YWJsZX0pO1xuICBkaXIub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudH0pID0+IHtcbiAgICBlbC5pbm5lckhUTUwgPSBgc2hvd2luZyBpdGVtcyA8c3Ryb25nPiR7KHBhZ2UgLSAxKSAqIHNpemUgKyAoZmlsdGVyZWRDb3VudCA+IDAgPyAxIDogMCl9PC9zdHJvbmc+IC0gPHN0cm9uZz4ke01hdGgubWluKGZpbHRlcmVkQ291bnQsIHBhZ2UgKiBzaXplKX08L3N0cm9uZz4gb2YgPHN0cm9uZz4ke2ZpbHRlcmVkQ291bnR9PC9zdHJvbmc+IG1hdGNoaW5nIGl0ZW1zYDtcbiAgfSk7XG4gIHJldHVybiBkaXI7XG59IiwiaW1wb3J0IHtzbGljZX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBhZ2luYXRpb25Db21wb25lbnQoe3RhYmxlLCBlbH0pIHtcbiAgICBjb25zdCBwcmV2aW91c0J1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIHByZXZpb3VzQnV0dG9uLmlubmVySFRNTCA9ICdQcmV2aW91cyc7XG4gICAgY29uc3QgbmV4dEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIG5leHRCdXR0b24uaW5uZXJIVE1MID0gJ05leHQnO1xuICAgIGNvbnN0IHBhZ2VTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHBhZ2VTcGFuLmlubmVySFRNTCA9ICctIHBhZ2UgMSAtJztcblxuICAgIGNvbnN0IGNvbXAgPSBzbGljZSh7dGFibGV9KTtcblxuICAgIGNvbXAub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZX0pID0+IHtcbiAgICAgICAgcHJldmlvdXNCdXR0b24uZGlzYWJsZWQgPSAhY29tcC5pc1ByZXZpb3VzUGFnZUVuYWJsZWQoKTtcbiAgICAgICAgbmV4dEJ1dHRvbi5kaXNhYmxlZCA9ICFjb21wLmlzTmV4dFBhZ2VFbmFibGVkKCk7XG4gICAgICAgIHBhZ2VTcGFuLmlubmVySFRNTCA9IGAtICR7cGFnZX0gLWA7XG4gICAgfSk7XG5cbiAgICBwcmV2aW91c0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbXAuc2VsZWN0UHJldmlvdXNQYWdlKCkpO1xuICAgIG5leHRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjb21wLnNlbGVjdE5leHRQYWdlKCkpO1xuXG4gICAgZWwuYXBwZW5kQ2hpbGQocHJldmlvdXNCdXR0b24pO1xuICAgIGVsLmFwcGVuZENoaWxkKHBhZ2VTcGFuKTtcbiAgICBlbC5hcHBlbmRDaGlsZChuZXh0QnV0dG9uKTtcblxuICAgIHJldHVybiBjb21wO1xufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChpdGVtKSB7XG5cbiAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICAgIGRpdi5pbm5lckhUTUwgPSBg0JLRi9Cx0YDQsNC9INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjCA8Yj4ke2l0ZW0uZmlyc3ROYW1lfSAke2l0ZW0ubGFzdE5hbWV9PC9iPjxicj5cbiAgICAgICAgICAgINCe0L/QuNGB0LDQvdC40LU6PGJyPlxuXG4gICAgICAgICAgICA8dGV4dGFyZWE+XG4gICAgICAgICAgICAke2l0ZW0uZGVzY3JpcHRpb259XG4gICAgICAgICAgICA8L3RleHRhcmVhPjxicj5cblxuICAgICAgICAgICAg0JDQtNGA0LXRgSDQv9GA0L7QttC40LLQsNC90LjRjzogPGI+JHtpdGVtLmFkcmVzcy5zdHJlZXRBZGRyZXNzfTwvYj48YnI+XG4gICAgICAgICAgICDQk9C+0YDQvtC0OiA8Yj4ke2l0ZW0uYWRyZXNzLmNpdHl9PC9iPjxicj5cbiAgICAgICAgICAgINCf0YDQvtCy0LjQvdGG0LjRjy/RiNGC0LDRgjogPGI+JHtpdGVtLmFkcmVzcy5zdGF0ZX08L2I+PGJyPlxuICAgICAgICAgICAg0JjQvdC00LXQutGBOiA8Yj4ke2l0ZW0uYWRyZXNzLnppcH08L2I+YDtcblxuICAgIHJldHVybiBkaXY7XG59IiwiaW1wb3J0IEFic3RyYWN0Q29tcG9uZW50IGZyb20gJy4uL2Fic3RyYWN0LWNvbXBvbmVudCc7XG5cbmltcG9ydCB7dGFibGUgYXMgdGFibGVDb21wb25lbnRGYWN0b3J5fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQge3RhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuaW1wb3J0IHtpbml0Q29udGVudCBhcyBpbml0Q29udGVudFNrZWxldG9ufSBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvaW5pdC1jb250ZW50JztcbmltcG9ydCByb3cgZnJvbSAnLi90ZW1wbGF0ZS1oZWxwZXJzL3Jvdyc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvc3VtbWFyeSc7XG5pbXBvcnQgcGFnaW5hdGlvbiBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvcGFnaW5hdGlvbic7XG5pbXBvcnQgZGVzY3JpcHRpb24gZnJvbSAnLi90ZW1wbGF0ZS1oZWxwZXJzL2Rlc2NyaXB0aW9uJztcblxuZXhwb3J0IGRlZmF1bHQgU21hcnRUYWJsZTtcblxuY29uc3QgTUFYX1JPV1NfUEVSX1BBR0UgPSA1MDtcblxuY2xhc3MgU21hcnRUYWJsZSBleHRlbmRzIEFic3RyYWN0Q29tcG9uZW50IHtcbiAgICBjb25zdHJ1Y3Rvcih7ZGF0YX0pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmRvbUVsZW1lbnQgPSB0aGlzLmdldEVsZW1lbnRGYWN0b3J5KCdzZWN0aW9uJyk7XG5cbiAgICAgICAgaW5pdENvbnRlbnRTa2VsZXRvbih0aGlzLmRvbUVsZW1lbnQpO1xuICAgICAgICBvbkluaXQodGhpcy5kb21FbGVtZW50LCBkYXRhKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlSW5zdGFuY2Uoe2RhdGF9KSB7XG4gICAgICAgIGlmIChkYXRhICYmIEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgU21hcnRUYWJsZSh7ZGF0YX0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmlubmVySFRNTCA9ICcnO1xuICAgICAgICAvLyBUT0RPOiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyXG4gICAgfVxuXG59XG5cbi8vIHByaXZhdGUgbWV0aG9kXG5mdW5jdGlvbiBvbkluaXQodGFibGVDb250YWluZXJFbCwgZGF0YSkge1xuXG4gICAgY29uc3QgdGJvZHkgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ3Rib2R5Jyk7XG5cbiAgICAvLyDQodCx0L7RgNC60LAgc21hcnQtdGFibGUtY29yZVxuICAgIGNvbnN0IHQgPSB0YWJsZSh7ZGF0YSwgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IE1BWF9ST1dTX1BFUl9QQUdFfX19KTtcbiAgICBjb25zdCB0YWJsZUNvbXBvbmVudCA9IHRhYmxlQ29tcG9uZW50RmFjdG9yeSh7ZWw6IHRhYmxlQ29udGFpbmVyRWwsIHRhYmxlOiB0fSk7XG5cbiAgICAvLyDQodCx0L7RgNC60LAg0LzQvtC00YPQu9GPIHN1bW1hcnlcbiAgICBjb25zdCBzdW1tYXJ5RWwgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXN1bW1hcnldJyk7XG4gICAgc3VtbWFyeSh7dGFibGU6IHQsIGVsOiBzdW1tYXJ5RWx9KTtcblxuICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L/QsNCz0LjQvdCw0YbQuNC4XG4gICAgY29uc3QgcGFnaW5hdGlvbkNvbnRhaW5lciA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignW2RhdGEtc3QtcGFnaW5hdGlvbl0nKTtcbiAgICBwYWdpbmF0aW9uKHt0YWJsZTogdCwgZWw6IHBhZ2luYXRpb25Db250YWluZXJ9KTtcblxuICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L7Qv9C40YHQsNC90LjRj1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uQ29udGFpbmVyID0gdGFibGVDb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKCcjZGVzY3JpcHRpb24tY29udGFpbmVyJyk7XG4gICAgdGJvZHkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudCA9PiB7XG5cbiAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldDtcblxuICAgICAgICBsZXQgdHIgPSB0YXJnZXQuY2xvc2VzdCgndHInKTtcbiAgICAgICAgaWYgKCF0cikgcmV0dXJuO1xuICAgICAgICBpZiAoIXRib2R5LmNvbnRhaW5zKHRyKSkgcmV0dXJuO1xuXG4gICAgICAgIGxldCBkYXRhSW5kZXggPSB0ci5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKTtcblxuICAgICAgICBpZiAoZGF0YUluZGV4ICYmIGRhdGFbZGF0YUluZGV4XSkge1xuICAgICAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5hcHBlbmRDaGlsZChkZXNjcmlwdGlvbihkYXRhW2RhdGFJbmRleF0pKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g0KHQsdC+0YDQutCwINC80L7QtNGD0LvRjyDRgNC10L3QtNC10YDQsCDRgtCw0LHQu9C40YbRi1xuICAgIHRhYmxlQ29tcG9uZW50Lm9uRGlzcGxheUNoYW5nZShkaXNwbGF5ZWQgPT4ge1xuICAgICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICB0Ym9keS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgZm9yIChsZXQgciBvZiBkaXNwbGF5ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0NoaWxkID0gcm93KHIudmFsdWUsIHIuaW5kZXgpO1xuICAgICAgICAgICAgdGJvZHkuYXBwZW5kQ2hpbGQobmV3Q2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59IiwiaW1wb3J0IEFzeW5jRGF0YUxvYWRlciBmcm9tICcuL2NvbXBvbmVudHMvYXN5bmMtZGF0YS1sb2FkZXInO1xuaW1wb3J0IFNtYXJ0VGFibGUgZnJvbSAnLi9jb21wb25lbnRzL3NtYXJ0LXRhYmxlL3NtYXJ0LXRhYmxlJztcblxubGV0IHRhYmxlQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhYmxlLWNvbnRhaW5lcicpO1xuXG4vLyAjMSDQmNC90LjRhtC40LDQu9C40LfQuNGA0YPQtdC8INCw0YHQuNC90YXRgNC+0L3QvdGL0Lkg0LfQsNCz0YDRg9C30YfQuNC6INC00LDQvdC90YvRhVxubGV0IGJ1dHRvbnNDb25maWcgPSBbXG4gICAge1xuICAgICAgICB1cmw6ICdodHRwOi8vd3d3LmZpbGx0ZXh0LmNvbS8/cm93cz0zMiZpZD0lN0JudW1iZXIlN0MxMDAwJTdEJmZpcnN0TmFtZT0lN0JmaXJzdE5hbWUlN0QmbGFzdE5hbWU9JTdCbGFzdE5hbWUlN0QmZW1haWw9JTdCZW1haWwlN0QmcGhvbmU9JTdCcGhvbmUlN0MoeHh4KXh4eC14eC14eCU3RCZhZHJlc3M9JTdCYWRkcmVzc09iamVjdCU3RCZkZXNjcmlwdGlvbj0lN0Jsb3JlbSU3QzMyJTdEJyxcbiAgICAgICAgbmFtZTogJ9CS0LDRgNC40LDQvdGCICMxJ1xuICAgIH0sXG4gICAge1xuICAgICAgICB1cmw6ICdodHRwOi8vd3d3LmZpbGx0ZXh0LmNvbS8/cm93cz0xMDAwJmlkPSU3Qm51bWJlciU3QzEwMDAlN0QmZmlyc3ROYW1lPSU3QmZpcnN0TmFtZSU3RCZkZWxheT0zJmxhc3ROYW1lPSU3Qmxhc3ROYW1lJTdEJmVtYWlsPSU3QmVtYWlsJTdEJnBob25lPSU3QnBob25lJTdDKHh4eCl4eHgteHgteHglN0QmYWRyZXNzPSU3QmFkZHJlc3NPYmplY3QlN0QmZGVzY3JpcHRpb249JTdCbG9yZW0lN0MzMiU3RCcsXG4gICAgICAgIG5hbWU6ICfQktCw0YDQuNCw0L3RgiAjMidcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdXJsOiAnaHR0cDovL2Zvb2Jhcjc3Nzc3N2ZhaWwuZGV2JyxcbiAgICAgICAgbmFtZTogJ0xvYWRpbmcgd2l0aCBmYWlsJ1xuICAgIH0sXG5dO1xubGV0IGFzeW5jRGF0YUxvYWRlciA9IEFzeW5jRGF0YUxvYWRlci5jcmVhdGVJbnN0YW5jZSh7YnV0dG9uc0NvbmZpZ30pO1xuYXN5bmNEYXRhTG9hZGVyLnN3YXBUbygnZGF0YS1sb2FkZXItY29udGFpbmVyJyk7XG5cbi8vICMyINCY0L3QuNGG0LjQsNC70LjQt9C40YDRg9C10Lwg0LzQvtC00YPQu9GMINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0LTQsNC90L3Ri9GFXG5sZXQgc21hcnRUYWJsZTtcblxuZnVuY3Rpb24gZGVzdHJveVNtYXJ0VGFibGUoKSB7XG4gICAgaWYgKHNtYXJ0VGFibGUpIHtcbiAgICAgICAgc21hcnRUYWJsZS5vbkRlc3Ryb3koKTtcbiAgICAgICAgc21hcnRUYWJsZSA9IG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTbWFydFRhYmxlKHJlc3BvbnNlRGF0YSkge1xuICAgIGlmIChyZXNwb25zZURhdGEpIHtcbiAgICAgICAgZGVzdHJveVNtYXJ0VGFibGUoKTtcbiAgICAgICAgc21hcnRUYWJsZSA9IFNtYXJ0VGFibGUuY3JlYXRlSW5zdGFuY2Uoe2RhdGE6IHJlc3BvbnNlRGF0YX0pO1xuICAgICAgICBzbWFydFRhYmxlLnN3YXBUbygndGFibGUtY29udGFpbmVyJyk7XG4gICAgfVxufVxuXG4vLyAjMyDQn9GA0LjQstGP0LfRi9Cy0LDQtdC8INGB0YPRidC90L7RgdGC0LhcbmlmIChhc3luY0RhdGFMb2FkZXIpIHtcbiAgICBhc3luY0RhdGFMb2FkZXJcbiAgICAgICAgLmJpbmQoe1xuICAgICAgICAgICAgaGFuZGxlcjogY3JlYXRlU21hcnRUYWJsZSxcbiAgICAgICAgICAgIGJlaGF2aW9yOiAnQUZURVJfQUNUSU9OJ1xuICAgICAgICB9KVxuICAgICAgICAuYmluZCh7XG4gICAgICAgICAgICBoYW5kbGVyOiBkZXN0cm95U21hcnRUYWJsZSxcbiAgICAgICAgICAgIGJlaGF2aW9yOiAnQkVGT1JFX0FDVElPTidcbiAgICAgICAgfSk7XG59Il0sIm5hbWVzIjpbIkFic3RyYWN0Q29tcG9uZW50IiwiQXN5bmNEYXRhTG9hZGVyIiwicG9pbnRlciIsImZpbHRlciIsInNvcnRGYWN0b3J5Iiwic29ydCIsInNlYXJjaCIsInRhYmxlIiwiZXhlY3V0aW9uTGlzdGVuZXIiLCJTbWFydFRhYmxlIiwiaW5pdENvbnRlbnRTa2VsZXRvbiIsInN1bW1hcnkiLCJwYWdpbmF0aW9uIl0sIm1hcHBpbmdzIjoiOzs7QUFBQTs7Ozs7QUFLQSxBQUVBLE1BQU1BLG1CQUFpQixDQUFDO0lBQ3BCLFdBQVcsR0FBRztRQUNWLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0tBQzFCOztJQUVELE9BQU8sY0FBYyxDQUFDLE1BQU0sRUFBRTs7S0FFN0I7Ozs7Ozs7OztJQVNELFFBQVEsQ0FBQyxRQUFRLEVBQUU7UUFDZixJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDN0U7Ozs7OztJQU1ELE1BQU0sQ0FBQyxVQUFVLEVBQUU7UUFDZixJQUFJLFNBQVMsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELElBQUksU0FBUyxF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
