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

// TODO: переписать на appendChild, выпилить работу со строками и innerHTML
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

// TODO: переписать на appendChild, выпилить работу со строками и innerHTML

var row = function ({id, firstName, lastName, email, phone}, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-index', index);
    tr.innerHTML = `<td>${id}</td><td>${firstName}</td><td>${lastName}</td><td>${email}</td><td>${phone}</td>`;
    return tr;
};

function summaryComponent({table: table$$1, el}) {
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

// TODO: переписать на appendChild, выпилить работу со строками и innerHTML

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
const _onInit = Symbol('onInit');

class SmartTable$1 extends AbstractComponent$1 {
    constructor({data}) {
        super();

        this.domElement = this.getElementFactory('section');

        initContent(this.domElement);
        this[_onInit](this.domElement, data);
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
                self.appendChildSafety(descriptionContainer, description(data[dataIndex]));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyJjb21wb25lbnRzL2Fic3RyYWN0LWNvbXBvbmVudC5qcyIsImNvbXBvbmVudHMvYXN5bmMtZGF0YS1sb2FkZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2VhcmNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy9zb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3IuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9pbmRleC5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvc2VhcmNoRm9ybS5qcyIsIi4uL2xpYi90YWJsZS5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvdGVtcGxhdGUtaGVscGVycy9pbml0LWNvbnRlbnQuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3RlbXBsYXRlLWhlbHBlcnMvcm93LmpzIiwiY29tcG9uZW50cy9zbWFydC10YWJsZS90ZW1wbGF0ZS1oZWxwZXJzL3N1bW1hcnkuanMiLCJjb21wb25lbnRzL3NtYXJ0LXRhYmxlL3RlbXBsYXRlLWhlbHBlcnMvcGFnaW5hdGlvbi5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvdGVtcGxhdGUtaGVscGVycy9kZXNjcmlwdGlvbi5qcyIsImNvbXBvbmVudHMvc21hcnQtdGFibGUvc21hcnQtdGFibGUuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqINCQ0LHRgdGC0YDQsNC60YLQvdGL0Lkg0LrQu9Cw0YHRgSDQutC+0LzQv9C+0L3QtdC90YLQsFxuICog0J7RgiDQvdC10LPQviDQvdCw0YHQu9C10LTRg9GO0YLRgdGPINCy0YHQtSDQvtGB0YLQsNC70YzQvdGL0LUg0LrQvtC80L/QvtC90LXQvdGC0Ysg0YHRgtGA0LDQvdC40YbRi1xuICovXG5cbmV4cG9ydCBkZWZhdWx0IEFic3RyYWN0Q29tcG9uZW50O1xuXG5jbGFzcyBBYnN0cmFjdENvbXBvbmVudCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZG9tRWxlbWVudCA9IG51bGw7XG4gICAgfVxuXG4gICAgc3RhdGljIGNyZWF0ZUluc3RhbmNlKHBhcmFtcykge1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0KDQtdC90LTQtdGA0LjRgiDQutC+0LzQv9C+0L3QtdC90YIg0LIg0LrQvtC90YLQtdC50L3QtdGAXG4gICAgICogQHBhcmFtIHNlbGVjdG9yXG4gICAgICogQHBhcmFtIGlzUmVwbGFjZVxuICAgICAqIHRydWUg4oCUINC30LDQvNC10YnQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGAXG4gICAgICogZmFsc2UgLSDQstGB0YLQsNCy0LvRj9C10Lwg0LLQvdGD0YLRgNGMXG4gICAgICovXG4gICAgYXBwZW5kVG8oc2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5hcHBlbmRDaGlsZFNhZmV0eShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSwgdGhpcy5kb21FbGVtZW50KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDQoNC10L3QtNC10YDQuNGCINC60L7QvNC/0L7QvdC10L3RgiDQuCDQt9Cw0LzQtdGJ0LDQtdGCINC60L7QvdGC0LXQudGA0LXRgFxuICAgICAqIEBwYXJhbSBzZWxlY3RvclxuICAgICAqL1xuICAgIHN3YXBUbyhzZWxlY3RvcklkKSB7XG4gICAgICAgIGxldCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3RvcklkKTtcbiAgICAgICAgaWYgKGNvbnRhaW5lcikge1xuICAgICAgICAgICAgY29udGFpbmVyLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKHRoaXMuZG9tRWxlbWVudCwgY29udGFpbmVyKTtcbiAgICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC5jbGFzc05hbWUgPSBzZWxlY3RvcklkO1xuICAgICAgICAgICAgdGhpcy5kb21FbGVtZW50LnNldEF0dHJpYnV0ZSgnaWQnLCBzZWxlY3RvcklkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqINCh0L7Qt9C00LDRkdGCIGRvbSDRjdC70LXQvNC10L3RgiDRgSDQsNGC0YDQuNCx0YPRgtCw0LzQuCDQuCDRgdC+0LTQtdGA0LbQuNC80YvQvCDQstC90YPRgtGA0LhcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0YWdOYW1lXG4gICAgICogQHBhcmFtIGlubmVySHRtbFxuICAgICAqIEBwYXJhbSBhdHRyc1xuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICAgIGdldEVsZW1lbnRGYWN0b3J5KHRhZ05hbWUsIGlubmVySHRtbCwgYXR0cnMpIHtcbiAgICAgICAgdmFyIF9lbGVtZW50O1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGFnTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIF9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcblxuICAgICAgICAgICAgaWYgKGlubmVySHRtbCkge1xuICAgICAgICAgICAgICAgIF9lbGVtZW50LmlubmVySFRNTCA9IGlubmVySHRtbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGF0dHJzICYmIHR5cGVvZiBhdHRycyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpbmRleCBpbiBhdHRycykge1xuICAgICAgICAgICAgICAgICAgICBfZWxlbWVudC5zZXRBdHRyaWJ1dGUoaW5kZXgsIGF0dHJzW2luZGV4XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9lbGVtZW50O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiDQntCx0LXRgNGC0LrQsCBhcHBlbmRDaGlsZCDQtNC70Y8g0LHQtdC30L7Qv9Cw0YHQvdC+0LPQviDQuNGB0L/QvtC70YzQt9C+0LLQsNC90LjRj1xuICAgICAqXG4gICAgICogQHBhcmFtIGNvbnRhaW5lclxuICAgICAqIEBwYXJhbSBlbGVtZW50XG4gICAgICovXG4gICAgYXBwZW5kQ2hpbGRTYWZldHkoY29udGFpbmVyLCBlbGVtZW50KSB7XG5cbiAgICAgICAgZnVuY3Rpb24gX2lzRWxlbWVudChvKSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gXCJvYmplY3RcIiA/IG8gaW5zdGFuY2VvZiBIVE1MRWxlbWVudCA6IC8vRE9NMlxuICAgICAgICAgICAgICAgICAgICBvICYmIHR5cGVvZiBvID09PSBcIm9iamVjdFwiICYmIG8gIT09IG51bGwgJiYgby5ub2RlVHlwZSA9PT0gMSAmJiB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gXCJzdHJpbmdcIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb250YWluZXIgJiYgX2lzRWxlbWVudChjb250YWluZXIpICYmIGVsZW1lbnQgJiYgX2lzRWxlbWVudChlbGVtZW50KSkge1xuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGhpZGUoZWxlbWVudCkge1xuICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2hvdyhlbGVtZW50KSB7XG4gICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICB9XG4gICAgfVxuXG59IiwiLyoqXG4gKiDQnNC+0LTRg9C70Ywg0LDRgdC40L3RhdGA0L7QvdC90L7QuSDQt9Cw0LPRgNGD0LfQutC4INC00LDQvdC90YvRhVxuICog0JIg0YHQu9GD0YfQsNC1INGD0YHQv9C10YjQvdC+0Lkg0LfQsNCz0YDRg9C30LrQuCDQvtGC0L/RgNCw0LLQu9GP0LXRgiDQtNCw0L3QvdGL0LUg0LIgZXZlbnRMaXN0ZW5lcnNcbiAqINCi0LDQuiDQttC1INGD0L/RgNCw0LLQu9GP0LXRgiBET00sINGB0L/QuNC90L3QtdGA0L7QvCDQt9Cw0LPRgNGD0LfQutC4INC4INC+0LHRgNCw0LHQsNGC0YvQstCw0LXRgiDQvtGI0LjQsdC60LhcbiAqL1xuaW1wb3J0IEFic3RyYWN0Q29tcG9uZW50IGZyb20gXCIuL2Fic3RyYWN0LWNvbXBvbmVudFwiO1xuXG5leHBvcnQgZGVmYXVsdCBBc3luY0RhdGFMb2FkZXI7XG5cbmNvbnN0IFNUQVRFX0xPQURJTkcgPSAnU1RBVEVfTE9BRElORyc7XG5jb25zdCBTVEFURV9FTVBUWSA9ICdTVEFURV9FTVBUWSc7XG5jb25zdCBTVEFURV9MT0FERURfU1VDQ0VTU0ZVTCA9ICdTVEFURV9MT0FERURfU1VDQ0VTU0ZVTCc7XG5cbmNvbnN0IEFGVEVSX0FDVElPTiA9ICdBRlRFUl9BQ1RJT04nO1xuY29uc3QgQkVGT1JFX0FDVElPTiA9ICdCRUZPUkVfQUNUSU9OJztcblxuY2xhc3MgQXN5bmNEYXRhTG9hZGVyIGV4dGVuZHMgQWJzdHJhY3RDb21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3Ioe2J1dHRvbnNDb25maWd9KSB7XG5cbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHNlbGYuZXZlbnRMaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgc2VsZi5kb21FbGVtZW50ID0gbnVsbDtcblxuICAgICAgICBsZXQgZWxlbWVudCA9IHNlbGYuZ2V0RWxlbWVudEZhY3RvcnkoJ3NlY3Rpb24nKTtcblxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGJ1dHRvbnNDb25maWcpIHtcblxuICAgICAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShcbiAgICAgICAgICAgICAgICBlbGVtZW50LFxuICAgICAgICAgICAgICAgIHNlbGYuZ2V0RWxlbWVudEZhY3RvcnkoXG4gICAgICAgICAgICAgICAgICAgICdidXR0b24nLFxuICAgICAgICAgICAgICAgICAgICBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdkYXRhLXVybCc6IGl0ZW0udXJsXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICAvLyDQntC00LjQvSDQvtCx0YDQsNCx0L7RgtGH0LjQuiDRgdC+0LHRi9GC0LjQuSDQvdCwINCy0YHQtSDQutC90L7Qv9C60LhcbiAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50ID0+IHtcblxuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldDtcbiAgICAgICAgICAgIGxldCBidXR0b24gPSB0YXJnZXQuY2xvc2VzdCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBpZiAoIWJ1dHRvbikgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKCFlbGVtZW50LmNvbnRhaW5zKGJ1dHRvbikpIHJldHVybjtcblxuICAgICAgICAgICAgLy8g0JfQsNGJ0LjRgtCwINC+0YIg0L/QvtCy0YLQvtGA0L3Ri9GFINC90LDQttCw0YLQuNC5INCyINC80L7QvNC10L3RgiBQZW5kaW5nXG4gICAgICAgICAgICBpZiAoc2VsZi5yZW5kZXJTdGF0ZSAhPT0gU1RBVEVfTE9BRElORykge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSBidXR0b24uZ2V0QXR0cmlidXRlKCdkYXRhLXVybCcpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfTE9BRElORztcblxuICAgICAgICAgICAgICAgICAgICBmZXRjaCh1cmwpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4ZWN1dGVFdmVudExpc3RlbmVycyhBRlRFUl9BQ1RJT04sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfTE9BREVEX1NVQ0NFU1NGVUw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5leGVjdXRlRXZlbnRMaXN0ZW5lcnMoQUZURVJfQUNUSU9OLCBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbmRlclN0YXRlID0gU1RBVEVfRU1QVFk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBzZWxmLnNwaW5uZXJFbGVtZW50ID0gc2VsZi5nZXRFbGVtZW50RmFjdG9yeShcbiAgICAgICAgICAgICdzZWN0aW9uJyxcbiAgICAgICAgICAgICc8aW1nIHNyYz1cIi4vc3Bpbm5lci5zdmdcIiB3aWR0aD1cIjEwMFwiPicsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ3N0eWxlJzogJ2Rpc3BsYXk6IG5vbmUnXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBzZWxmLmRvbUVsZW1lbnQgPSBzZWxmLmdldEVsZW1lbnRGYWN0b3J5KCdzZWN0aW9uJyk7XG4gICAgICAgIHNlbGYuYXBwZW5kQ2hpbGRTYWZldHkoc2VsZi5kb21FbGVtZW50LCBlbGVtZW50KTtcbiAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShzZWxmLmRvbUVsZW1lbnQsIHNlbGYuc3Bpbm5lckVsZW1lbnQpO1xuXG4gICAgICAgIHNlbGYucmVuZGVyU3RhdGUgPSBTVEFURV9FTVBUWTtcblxuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVJbnN0YW5jZShwYXJhbXMpIHtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgQXN5bmNEYXRhTG9hZGVyKHBhcmFtcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0JTQvtCx0LDQstC70Y/QtdGCINCy0L3QtdGI0L3QuNC1INC+0LHRgNCw0LHQvtGC0YfQuNC60LhcbiAgICAgKiBAcGFyYW0gaGFuZGxlclxuICAgICAqIEBwYXJhbSBiZWhhdmlvclxuICAgICAqL1xuICAgIGJpbmQoe2hhbmRsZXIgPSBmdW5jdGlvbigpIHt9LCBiZWhhdmlvciA9ICcnfSkge1xuICAgICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLnB1c2goe1xuICAgICAgICAgICAgaGFuZGxlcixcbiAgICAgICAgICAgIGJlaGF2aW9yXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vINCy0L7Qt9Cy0YDQsNGJ0LDQtdC8INC00LvRjyDQv9GA0LjQvNC10YDQsCDQutC+0LTQsCDRgSBjaGFpbmluZ1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBiZWhhdmlvclxuICAgICAqL1xuICAgIGV4ZWN1dGVFdmVudExpc3RlbmVycyhiZWhhdmlvciwgZGF0YSkge1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuZXZlbnRMaXN0ZW5lcnMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5iZWhhdmlvciA9PT0gYmVoYXZpb3IpKSB7XG4gICAgICAgICAgICBpdGVtLmhhbmRsZXIoZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBuZXdTdGF0ZVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdGF0ZShuZXdTdGF0ZSkge1xuXG4gICAgICAgIHN3aXRjaCAobmV3U3RhdGUpIHtcbiAgICAgICAgICAgIGNhc2UgU1RBVEVfRU1QVFk6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGUodGhpcy5zcGlubmVyRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgU1RBVEVfTE9BRElORzpcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJTdGF0ZSA9IG5ld1N0YXRlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvdyh0aGlzLnNwaW5uZXJFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXhlY3V0ZUV2ZW50TGlzdGVuZXJzKEJFRk9SRV9BQ1RJT04pO1xuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgU1RBVEVfTE9BREVEX1NVQ0NFU1NGVUw6XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGUodGhpcy5zcGlubmVyRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdGF0ZTtcbiAgICB9XG5cbn0iLCJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB7U0VBUkNIX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNlYXJjaExpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NFQVJDSF9DSEFOR0VEXTogJ29uU2VhcmNoQ2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlLCBzY29wZSA9IFtdfSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICBzZWFyY2hMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSwge1xuICAgICAgc2VhcmNoKGlucHV0KXtcbiAgICAgICAgcmV0dXJuIHRhYmxlLnNlYXJjaCh7dmFsdWU6IGlucHV0LCBzY29wZX0pO1xuICAgICAgfVxuICAgIH0pO1xufSIsImltcG9ydCB7UEFHRV9DSEFOR0VELCBTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbUEFHRV9DSEFOR0VEXTogJ29uUGFnZUNoYW5nZScsIFtTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuICBsZXQge3NsaWNlOntwYWdlOmN1cnJlbnRQYWdlLCBzaXplOmN1cnJlbnRTaXplfX0gPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gIGxldCBpdGVtTGlzdExlbmd0aCA9IHRhYmxlLmxlbmd0aDtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc2VsZWN0UGFnZShwKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogcCwgc2l6ZTogY3VycmVudFNpemV9KTtcbiAgICB9LFxuICAgIHNlbGVjdE5leHRQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICB9LFxuICAgIHNlbGVjdFByZXZpb3VzUGFnZSgpe1xuICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgfSxcbiAgICBjaGFuZ2VQYWdlU2l6ZShzaXplKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogMSwgc2l6ZX0pO1xuICAgIH0sXG4gICAgaXNQcmV2aW91c1BhZ2VFbmFibGVkKCl7XG4gICAgICByZXR1cm4gY3VycmVudFBhZ2UgPiAxO1xuICAgIH0sXG4gICAgaXNOZXh0UGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBNYXRoLmNlaWwoaXRlbUxpc3RMZW5ndGggLyBjdXJyZW50U2l6ZSkgPiBjdXJyZW50UGFnZTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oYXBpLCBzbGljZUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZTpwLCBzaXplOnMsIGZpbHRlcmVkQ291bnR9KSA9PiB7XG4gICAgY3VycmVudFBhZ2UgPSBwO1xuICAgIGN1cnJlbnRTaXplID0gcztcbiAgICBpdGVtTGlzdExlbmd0aCA9IGZpbHRlcmVkQ291bnQ7XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59XG4iLCJpbXBvcnQge1RPR0dMRV9TT1JUfSBmcm9tICcuLi9ldmVudHMnXG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNvcnRMaXN0ZW5lcnMgPSBwcm94eUxpc3RlbmVyKHtbVE9HR0xFX1NPUlRdOiAnb25Tb3J0VG9nZ2xlJ30pO1xuY29uc3QgZGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtwb2ludGVyLCB0YWJsZSwgY3ljbGUgPSBmYWxzZX0pIHtcblxuICBjb25zdCBjeWNsZURpcmVjdGlvbnMgPSBjeWNsZSA9PT0gdHJ1ZSA/IFsnbm9uZSddLmNvbmNhdChkaXJlY3Rpb25zKSA6IFsuLi5kaXJlY3Rpb25zXS5yZXZlcnNlKCk7XG5cbiAgbGV0IGhpdCA9IDA7XG5cbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbih7XG4gICAgdG9nZ2xlKCl7XG4gICAgICBoaXQrKztcbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgIHJldHVybiB0YWJsZS5zb3J0KHtwb2ludGVyLCBkaXJlY3Rpb259KTtcbiAgICB9XG5cbiAgfSwgc29ydExpc3RlbmVycyh7ZW1pdHRlcjogdGFibGV9KSk7XG5cbiAgZGlyZWN0aXZlLm9uU29ydFRvZ2dsZSgoe3BvaW50ZXI6cH0pID0+IHtcbiAgICBpZiAocG9pbnRlciAhPT0gcCkge1xuICAgICAgaGl0ID0gMDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59IiwiaW1wb3J0IHtTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB7RVhFQ19DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuXG5jb25zdCBleGVjdXRpb25MaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tFWEVDX0NIQU5HRURdOiAnb25FeGVjdXRpb25DaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvcn0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBjb21wb25lbnQgPSB3b3JraW5nSW5kaWNhdG9yKHt0YWJsZX0pO1xuICBjb21wb25lbnQub25FeGVjdXRpb25DaGFuZ2UoZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXdvcmtpbmcnKTtcbiAgICBpZiAod29ya2luZyA9PT0gdHJ1ZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc3Qtd29ya2luZycpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb21wb25lbnQ7XG59OyIsImltcG9ydCB7c29ydH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWwsIHRhYmxlLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LXNvcnQnKTtcbiAgY29uc3QgY3ljbGUgPSBjb25mLmN5Y2xlIHx8IGVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1zdC1zb3J0LWN5Y2xlJyk7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHNvcnQoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZX0pO1xuICBjb21wb25lbnQub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpjdXJyZW50UG9pbnRlciwgZGlyZWN0aW9ufSkgPT4ge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXNvcnQtYXNjJywgJ3N0LXNvcnQtZGVzYycpO1xuICAgIGlmIChwb2ludGVyID09PSBjdXJyZW50UG9pbnRlciAmJiBkaXJlY3Rpb24gIT09ICdub25lJykge1xuICAgICAgY29uc3QgY2xhc3NOYW1lID0gZGlyZWN0aW9uID09PSAnYXNjJyA/ICdzdC1zb3J0LWFzYycgOiAnc3Qtc29ydC1kZXNjJztcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9XG4gIH0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZXYgPT4gY29tcG9uZW50LnRvZ2dsZSgpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50TGlzdGVuZXIpO1xuICByZXR1cm4gY29tcG9uZW50O1xufSIsImltcG9ydCB7c2VhcmNofSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGUsIGRlbGF5ID0gNDAwLCBjb25mID0ge319KSB7XG4gICAgY29uc3Qgc2NvcGUgPSBjb25mLnNjb3BlIHx8IChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc2VhcmNoLWZvcm0nKSB8fCAnJykuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gc2VhcmNoKHt0YWJsZSwgc2NvcGV9KTtcblxuICAgIGlmIChlbCkge1xuICAgICAgICBsZXQgaW5wdXQgPSBlbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKTtcbiAgICAgICAgbGV0IGJ1dHRvbiA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdidXR0b24nKTtcblxuICAgICAgICBpZiAoaW5wdXQgJiYgaW5wdXRbMF0gJiYgYnV0dG9uICYmIGJ1dHRvblswXSkge1xuICAgICAgICAgICAgYnV0dG9uWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5zZWFyY2goaW5wdXRbMF0udmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlucHV0WzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBldmVudCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50ICYmIGV2ZW50LmtleUNvZGUgJiYgZXZlbnQua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNlYXJjaChpbnB1dFswXS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuXG4gICAgICAgIH1cbiAgICB9XG5cbn07IiwiaW1wb3J0IGxvYWRpbmcgZnJvbSAnLi9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCBzb3J0IGZyb20gJy4vc29ydCc7XG4vLyBpbXBvcnQgZmlsdGVyIGZyb20gJy4vZmlsdGVycyc7XG4vLyBpbXBvcnQgc2VhcmNoSW5wdXQgZnJvbSAnLi9zZWFyY2gnO1xuaW1wb3J0IHNlYXJjaEZvcm0gZnJvbSAnLi9zZWFyY2hGb3JtJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGV9KSB7XG4gICAgLy8gYm9vdFxuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zb3J0XScpXS5mb3JFYWNoKGVsID0+IHNvcnQoe2VsLCB0YWJsZX0pKTtcbiAgICBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3QtbG9hZGluZy1pbmRpY2F0b3JdJyldLmZvckVhY2goZWwgPT4gbG9hZGluZyh7ZWwsIHRhYmxlfSkpO1xuICAgIC8vIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1maWx0ZXJdJyldLmZvckVhY2goZWwgPT4gZmlsdGVyKHtlbCwgdGFibGV9KSk7XG4gICAgLy8gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNlYXJjaF0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hJbnB1dCh7ZWwsIHRhYmxlfSkpO1xuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zZWFyY2gtZm9ybV0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hGb3JtKHtlbCwgdGFibGV9KSk7XG5cbiAgICAvL2V4dGVuc2lvblxuICAgIGNvbnN0IHRhYmxlRGlzcGxheUNoYW5nZSA9IHRhYmxlLm9uRGlzcGxheUNoYW5nZTtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YWJsZSwge1xuICAgICAgICBvbkRpc3BsYXlDaGFuZ2U6IChsaXN0ZW5lcikgPT4ge1xuICAgICAgICAgICAgdGFibGVEaXNwbGF5Q2hhbmdlKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIHRhYmxlLmV4ZWMoKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTsiLCIvLyBUT0RPOiDQv9C10YDQtdC/0LjRgdCw0YLRjCDQvdCwIGFwcGVuZENoaWxkLCDQstGL0L/QuNC70LjRgtGMINGA0LDQsdC+0YLRgyDRgdC+INGB0YLRgNC+0LrQsNC80Lgg0LggaW5uZXJIVE1MXG5leHBvcnQgZnVuY3Rpb24gaW5pdENvbnRlbnQoZWwpIHtcbiAgICBpZiAoZWwpIHtcbiAgICAgICAgZWwuaW5uZXJIVE1MID0gYFxuICAgICAgICA8ZGl2IGRhdGEtc3QtbG9hZGluZy1pbmRpY2F0b3I9XCJcIj5cbiAgICAgICAgICAgIFByb2Nlc3NpbmcgLi4uXG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8dGFibGU+XG4gICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgPHRoIGNvbHNwYW49XCI1XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1zdC1zZWFyY2gtZm9ybT1cImlkLCBmaXJzdE5hbWUsIGxhc3ROYW1lLCBlbWFpbCwgcGhvbmVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBmb3I9XCJzZWFyY2hcIj5nbG9iYWwgc2VhcmNoPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCBpZD1cInNlYXJjaFwiIHBsYWNlaG9sZGVyPVwiQ2FzZSBzZW5zaXRpdmUgc2VhcmNoXCIgdHlwZT1cInRleHRcIi8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwic2VhcmNoQnV0dG9uXCI+U2VhcmNoPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJpZFwiIGRhdGEtc3Qtc29ydC1jeWNsZT5JZDwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImZpcnN0TmFtZVwiPmZpcnN0TmFtZTwvdGg+XG4gICAgICAgICAgICAgICAgPHRoIGRhdGEtc3Qtc29ydD1cImxhc3ROYW1lXCI+bGFzdE5hbWU8L3RoPlxuICAgICAgICAgICAgICAgIDx0aCBkYXRhLXN0LXNvcnQ9XCJlbWFpbFwiPmVtYWlsPC90aD5cbiAgICAgICAgICAgICAgICA8dGggZGF0YS1zdC1zb3J0PVwicGhvbmVcIj5waG9uZTwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICA8dGQgY29sc3Bhbj1cIjVcIj5Mb2FkaW5nIGRhdGEgLi4uPC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgPHRmb290PlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiM1wiIGRhdGEtc3Qtc3VtbWFyeT48L3RkPlxuICAgICAgICAgICAgICAgIDx0ZCBjb2xzcGFuPVwiMlwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGRhdGEtc3QtcGFnaW5hdGlvbj48L2Rpdj5cbiAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDwvdGZvb3Q+XG4gICAgICAgIDwvdGFibGU+XG5cbiAgICAgICAgPGRpdiBpZD1cImRlc2NyaXB0aW9uLWNvbnRhaW5lclwiPlxuICAgICAgICA8L2Rpdj5gXG4gICAgfVxufSIsIi8vIFRPRE86INC/0LXRgNC10L/QuNGB0LDRgtGMINC90LAgYXBwZW5kQ2hpbGQsINCy0YvQv9C40LvQuNGC0Ywg0YDQsNCx0L7RgtGDINGB0L4g0YHRgtGA0L7QutCw0LzQuCDQuCBpbm5lckhUTUxcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtpZCwgZmlyc3ROYW1lLCBsYXN0TmFtZSwgZW1haWwsIHBob25lfSwgaW5kZXgpIHtcbiAgICBjb25zdCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgdHIuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgaW5kZXgpO1xuICAgIHRyLmlubmVySFRNTCA9IGA8dGQ+JHtpZH08L3RkPjx0ZD4ke2ZpcnN0TmFtZX08L3RkPjx0ZD4ke2xhc3ROYW1lfTwvdGQ+PHRkPiR7ZW1haWx9PC90ZD48dGQ+JHtwaG9uZX08L3RkPmA7XG4gICAgcmV0dXJuIHRyO1xufSIsImltcG9ydCB7c3VtbWFyeX0gZnJvbSAnc21hcnQtdGFibGUtY29yZSdcblxuLy8gVE9ETzog0L/QtdGA0LXQv9C40YHQsNGC0Ywg0L3QsCBhcHBlbmRDaGlsZCwg0LLRi9C/0LjQu9C40YLRjCDRgNCw0LHQvtGC0YMg0YHQviDRgdGC0YDQvtC60LDQvNC4INC4IGlubmVySFRNTFxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzdW1tYXJ5Q29tcG9uZW50KHt0YWJsZSwgZWx9KSB7XG4gICAgY29uc3QgZGlyID0gc3VtbWFyeSh7dGFibGV9KTtcbiAgICBkaXIub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZSwgc2l6ZSwgZmlsdGVyZWRDb3VudH0pID0+IHtcbiAgICAgICAgZWwuaW5uZXJIVE1MID0gYHNob3dpbmcgaXRlbXMgPHN0cm9uZz4keyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtIDxzdHJvbmc+JHtNYXRoLm1pbihmaWx0ZXJlZENvdW50LCBwYWdlICogc2l6ZSl9PC9zdHJvbmc+IG9mIDxzdHJvbmc+JHtmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc2A7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRpcjtcbn0iLCJpbXBvcnQge3NsaWNlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuLy8gVE9ETzog0L/QtdGA0LXQv9C40YHQsNGC0Ywg0L3QsCBhcHBlbmRDaGlsZCwg0LLRi9C/0LjQu9C40YLRjCDRgNCw0LHQvtGC0YMg0YHQviDRgdGC0YDQvtC60LDQvNC4INC4IGlubmVySFRNTFxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYWdpbmF0aW9uQ29tcG9uZW50KHt0YWJsZSwgZWx9KSB7XG4gICAgY29uc3QgcHJldmlvdXNCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBwcmV2aW91c0J1dHRvbi5pbm5lckhUTUwgPSAnUHJldmlvdXMnO1xuICAgIGNvbnN0IG5leHRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBuZXh0QnV0dG9uLmlubmVySFRNTCA9ICdOZXh0JztcbiAgICBjb25zdCBwYWdlU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICBwYWdlU3Bhbi5pbm5lckhUTUwgPSAnLSBwYWdlIDEgLSc7XG5cbiAgICBjb25zdCBjb21wID0gc2xpY2Uoe3RhYmxlfSk7XG5cbiAgICBjb21wLm9uU3VtbWFyeUNoYW5nZSgoe3BhZ2V9KSA9PiB7XG4gICAgICAgIHByZXZpb3VzQnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNQcmV2aW91c1BhZ2VFbmFibGVkKCk7XG4gICAgICAgIG5leHRCdXR0b24uZGlzYWJsZWQgPSAhY29tcC5pc05leHRQYWdlRW5hYmxlZCgpO1xuICAgICAgICBwYWdlU3Bhbi5pbm5lckhUTUwgPSBgLSAke3BhZ2V9IC1gO1xuICAgIH0pO1xuXG4gICAgcHJldmlvdXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjb21wLnNlbGVjdFByZXZpb3VzUGFnZSgpKTtcbiAgICBuZXh0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3ROZXh0UGFnZSgpKTtcblxuICAgIGVsLmFwcGVuZENoaWxkKHByZXZpb3VzQnV0dG9uKTtcbiAgICBlbC5hcHBlbmRDaGlsZChwYWdlU3Bhbik7XG4gICAgZWwuYXBwZW5kQ2hpbGQobmV4dEJ1dHRvbik7XG5cbiAgICByZXR1cm4gY29tcDtcbn0iLCIvLyBUT0RPOiDQv9C10YDQtdC/0LjRgdCw0YLRjCDQvdCwIGFwcGVuZENoaWxkLCDQstGL0L/QuNC70LjRgtGMINGA0LDQsdC+0YLRgyDRgdC+INGB0YLRgNC+0LrQsNC80Lgg0LggaW5uZXJIVE1MXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIChpdGVtKSB7XG5cbiAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICAgIGRpdi5pbm5lckhUTUwgPSBg0JLRi9Cx0YDQsNC9INC/0L7Qu9GM0LfQvtCy0LDRgtC10LvRjCA8Yj4ke2l0ZW0uZmlyc3ROYW1lfSAke2l0ZW0ubGFzdE5hbWV9PC9iPjxicj5cbiAgICAgICAgICAgINCe0L/QuNGB0LDQvdC40LU6PGJyPlxuXG4gICAgICAgICAgICA8dGV4dGFyZWE+XG4gICAgICAgICAgICAke2l0ZW0uZGVzY3JpcHRpb259XG4gICAgICAgICAgICA8L3RleHRhcmVhPjxicj5cblxuICAgICAgICAgICAg0JDQtNGA0LXRgSDQv9GA0L7QttC40LLQsNC90LjRjzogPGI+JHtpdGVtLmFkcmVzcy5zdHJlZXRBZGRyZXNzfTwvYj48YnI+XG4gICAgICAgICAgICDQk9C+0YDQvtC0OiA8Yj4ke2l0ZW0uYWRyZXNzLmNpdHl9PC9iPjxicj5cbiAgICAgICAgICAgINCf0YDQvtCy0LjQvdGG0LjRjy/RiNGC0LDRgjogPGI+JHtpdGVtLmFkcmVzcy5zdGF0ZX08L2I+PGJyPlxuICAgICAgICAgICAg0JjQvdC00LXQutGBOiA8Yj4ke2l0ZW0uYWRyZXNzLnppcH08L2I+YDtcblxuICAgIHJldHVybiBkaXY7XG59IiwiaW1wb3J0IEFic3RyYWN0Q29tcG9uZW50IGZyb20gJy4uL2Fic3RyYWN0LWNvbXBvbmVudCc7XG5cbmltcG9ydCB7dGFibGUgYXMgdGFibGVDb21wb25lbnRGYWN0b3J5fSBmcm9tICcuLi8uLi8uLi9pbmRleCc7XG5pbXBvcnQge3RhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuaW1wb3J0IHtpbml0Q29udGVudCBhcyBpbml0Q29udGVudFNrZWxldG9ufSBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvaW5pdC1jb250ZW50JztcbmltcG9ydCByb3cgZnJvbSAnLi90ZW1wbGF0ZS1oZWxwZXJzL3Jvdyc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvc3VtbWFyeSc7XG5pbXBvcnQgcGFnaW5hdGlvbiBmcm9tICcuL3RlbXBsYXRlLWhlbHBlcnMvcGFnaW5hdGlvbic7XG5pbXBvcnQgZGVzY3JpcHRpb24gZnJvbSAnLi90ZW1wbGF0ZS1oZWxwZXJzL2Rlc2NyaXB0aW9uJztcblxuZXhwb3J0IGRlZmF1bHQgU21hcnRUYWJsZTtcblxuY29uc3QgTUFYX1JPV1NfUEVSX1BBR0UgPSA1MDtcbmNvbnN0IF9vbkluaXQgPSBTeW1ib2woJ29uSW5pdCcpO1xuXG5jbGFzcyBTbWFydFRhYmxlIGV4dGVuZHMgQWJzdHJhY3RDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKHtkYXRhfSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuZG9tRWxlbWVudCA9IHRoaXMuZ2V0RWxlbWVudEZhY3RvcnkoJ3NlY3Rpb24nKTtcblxuICAgICAgICBpbml0Q29udGVudFNrZWxldG9uKHRoaXMuZG9tRWxlbWVudCk7XG4gICAgICAgIHRoaXNbX29uSW5pdF0odGhpcy5kb21FbGVtZW50LCBkYXRhKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlSW5zdGFuY2Uoe2RhdGF9KSB7XG4gICAgICAgIGlmIChkYXRhICYmIEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgU21hcnRUYWJsZSh7ZGF0YX0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmlubmVySFRNTCA9ICcnO1xuICAgICAgICAvLyBUT0RPOiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog0J/RgNC40LLQsNGC0L3Ri9C5INC80LXRgtC+0LQgb25Jbml0XG4gICAgICog0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXRgiDQutC+0LzQv9C+0L3QtdC90YIgc21hcnQtdGFibGUg0Lgg0L3QsNCy0LXRiNC40LLQsNC10YIg0L7QsdGA0LDQsdC+0YLRh9C40LrQuFxuICAgICAqINCe0YHQvdC+0LLQsCDRgdC+0LTQtdGA0LbQuNC80L7Qs9C+INGN0YLQvtCz0L4g0LzQtdGC0L7QtNCwINCy0LfRj9GC0LAg0LjQtyBzbWFydC10YWJsZS12YW5pbGxhINC/0YDQuNC80LXRgNCwXG4gICAgICogVE9ETzog0LTQvtC00LXQu9Cw0YLRjCDQs9C10L3QtdGA0LDRhtC40Y4g0YjQsNCx0LvQvtC90LAsINC/0YDQuNCy0LXRgdGC0Lgg0LIg0LHQvtC20LXRgdC60LjQuSDQstC40LRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0YWJsZUNvbnRhaW5lckVsXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKi9cbiAgICBbX29uSW5pdF0odGFibGVDb250YWluZXJFbCwgZGF0YSkge1xuXG4gICAgICAgIGxldCBzZWxmID0gdGhpcztcblxuICAgICAgICBjb25zdCB0Ym9keSA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcigndGJvZHknKTtcblxuICAgICAgICAvLyDQodCx0L7RgNC60LAgc21hcnQtdGFibGUtY29yZVxuICAgICAgICBjb25zdCB0ID0gdGFibGUoe2RhdGEsIHRhYmxlU3RhdGU6IHtzb3J0OiB7fSwgZmlsdGVyOiB7fSwgc2xpY2U6IHtwYWdlOiAxLCBzaXplOiBNQVhfUk9XU19QRVJfUEFHRX19fSk7XG4gICAgICAgIGNvbnN0IHRhYmxlQ29tcG9uZW50ID0gdGFibGVDb21wb25lbnRGYWN0b3J5KHtlbDogdGFibGVDb250YWluZXJFbCwgdGFibGU6IHR9KTtcblxuICAgICAgICAvLyDQodCx0L7RgNC60LAg0LzQvtC00YPQu9GPIHN1bW1hcnlcbiAgICAgICAgY29uc3Qgc3VtbWFyeUVsID0gdGFibGVDb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1zdC1zdW1tYXJ5XScpO1xuICAgICAgICBzdW1tYXJ5KHt0YWJsZTogdCwgZWw6IHN1bW1hcnlFbH0pO1xuXG4gICAgICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L/QsNCz0LjQvdCw0YbQuNC4XG4gICAgICAgIGNvbnN0IHBhZ2luYXRpb25Db250YWluZXIgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXBhZ2luYXRpb25dJyk7XG4gICAgICAgIHBhZ2luYXRpb24oe3RhYmxlOiB0LCBlbDogcGFnaW5hdGlvbkNvbnRhaW5lcn0pO1xuXG4gICAgICAgIC8vINCh0LHQvtGA0LrQsCDQvNC+0LTRg9C70Y8g0L7Qv9C40YHQsNC90LjRj1xuICAgICAgICBjb25zdCBkZXNjcmlwdGlvbkNvbnRhaW5lciA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignI2Rlc2NyaXB0aW9uLWNvbnRhaW5lcicpO1xuICAgICAgICB0Ym9keS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50ID0+IHtcblxuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldDtcblxuICAgICAgICAgICAgbGV0IHRyID0gdGFyZ2V0LmNsb3Nlc3QoJ3RyJyk7XG4gICAgICAgICAgICBpZiAoIXRyKSByZXR1cm47XG4gICAgICAgICAgICBpZiAoIXRib2R5LmNvbnRhaW5zKHRyKSkgcmV0dXJuO1xuXG4gICAgICAgICAgICBsZXQgZGF0YUluZGV4ID0gdHIuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4Jyk7XG5cbiAgICAgICAgICAgIGlmIChkYXRhSW5kZXggJiYgZGF0YVtkYXRhSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuaW5uZXJIVE1MID0gJyc7XG4gICAgICAgICAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eShkZXNjcmlwdGlvbkNvbnRhaW5lciwgZGVzY3JpcHRpb24oZGF0YVtkYXRhSW5kZXhdKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8g0KHQsdC+0YDQutCwINC80L7QtNGD0LvRjyDRgNC10L3QtNC10YDQsCDRgtCw0LHQu9C40YbRi1xuICAgICAgICB0YWJsZUNvbXBvbmVudC5vbkRpc3BsYXlDaGFuZ2UoZGlzcGxheWVkID0+IHtcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgICAgICB0Ym9keS5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgICAgIGZvciAobGV0IHIgb2YgZGlzcGxheWVkKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5hcHBlbmRDaGlsZFNhZmV0eSh0Ym9keSwgcm93KHIudmFsdWUsIHIuaW5kZXgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG59XG4iLCJpbXBvcnQgQXN5bmNEYXRhTG9hZGVyIGZyb20gJy4vY29tcG9uZW50cy9hc3luYy1kYXRhLWxvYWRlcic7XG5pbXBvcnQgU21hcnRUYWJsZSBmcm9tICcuL2NvbXBvbmVudHMvc21hcnQtdGFibGUvc21hcnQtdGFibGUnO1xuXG5sZXQgdGFibGVDb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFibGUtY29udGFpbmVyJyk7XG5cbi8vICMxINCY0L3QuNGG0LjQsNC70LjQt9C40YDRg9C10Lwg0LDRgdC40L3RhdGA0L7QvdC90YvQuSDQt9Cw0LPRgNGD0LfRh9C40Log0LTQsNC90L3Ri9GFXG5sZXQgYnV0dG9uc0NvbmZpZyA9IFtcbiAgICB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly93d3cuZmlsbHRleHQuY29tLz9yb3dzPTMyJmlkPSU3Qm51bWJlciU3QzEwMDAlN0QmZmlyc3ROYW1lPSU3QmZpcnN0TmFtZSU3RCZsYXN0TmFtZT0lN0JsYXN0TmFtZSU3RCZlbWFpbD0lN0JlbWFpbCU3RCZwaG9uZT0lN0JwaG9uZSU3Qyh4eHgpeHh4LXh4LXh4JTdEJmFkcmVzcz0lN0JhZGRyZXNzT2JqZWN0JTdEJmRlc2NyaXB0aW9uPSU3QmxvcmVtJTdDMzIlN0QnLFxuICAgICAgICBuYW1lOiAn0JLQsNGA0LjQsNC90YIgIzEnXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHVybDogJ2h0dHA6Ly93d3cuZmlsbHRleHQuY29tLz9yb3dzPTEwMDAmaWQ9JTdCbnVtYmVyJTdDMTAwMCU3RCZmaXJzdE5hbWU9JTdCZmlyc3ROYW1lJTdEJmRlbGF5PTMmbGFzdE5hbWU9JTdCbGFzdE5hbWUlN0QmZW1haWw9JTdCZW1haWwlN0QmcGhvbmU9JTdCcGhvbmUlN0MoeHh4KXh4eC14eC14eCU3RCZhZHJlc3M9JTdCYWRkcmVzc09iamVjdCU3RCZkZXNjcmlwdGlvbj0lN0Jsb3JlbSU3QzMyJTdEJyxcbiAgICAgICAgbmFtZTogJ9CS0LDRgNC40LDQvdGCICMyJ1xuICAgIH0sXG4gICAge1xuICAgICAgICB1cmw6ICdodHRwOi8vZm9vYmFyNzc3Nzc3ZmFpbC5kZXYnLFxuICAgICAgICBuYW1lOiAnTG9hZGluZyB3aXRoIGZhaWwnXG4gICAgfSxcbl07XG5sZXQgYXN5bmNEYXRhTG9hZGVyID0gQXN5bmNEYXRhTG9hZGVyLmNyZWF0ZUluc3RhbmNlKHtidXR0b25zQ29uZmlnfSk7XG5hc3luY0RhdGFMb2FkZXIuc3dhcFRvKCdkYXRhLWxvYWRlci1jb250YWluZXInKTtcblxuLy8gIzIg0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCDQvNC+0LTRg9C70Ywg0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDQtNCw0L3QvdGL0YVcbmxldCBzbWFydFRhYmxlO1xuXG5mdW5jdGlvbiBkZXN0cm95U21hcnRUYWJsZSgpIHtcbiAgICBpZiAoc21hcnRUYWJsZSkge1xuICAgICAgICBzbWFydFRhYmxlLm9uRGVzdHJveSgpO1xuICAgICAgICBzbWFydFRhYmxlID0gbnVsbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNtYXJ0VGFibGUocmVzcG9uc2VEYXRhKSB7XG4gICAgaWYgKHJlc3BvbnNlRGF0YSkge1xuICAgICAgICBkZXN0cm95U21hcnRUYWJsZSgpO1xuICAgICAgICBzbWFydFRhYmxlID0gU21hcnRUYWJsZS5jcmVhdGVJbnN0YW5jZSh7ZGF0YTogcmVzcG9uc2VEYXRhfSk7XG4gICAgICAgIHNtYXJ0VGFibGUuc3dhcFRvKCd0YWJsZS1jb250YWluZXInKTtcbiAgICB9XG59XG5cbi8vICMzINCf0YDQuNCy0Y/Qt9GL0LLQsNC10Lwg0YHRg9GJ0L3QvtGB0YLQuFxuaWYgKGFzeW5jRGF0YUxvYWRlcikge1xuICAgIGFzeW5jRGF0YUxvYWRlclxuICAgICAgICAuYmluZCh7XG4gICAgICAgICAgICBoYW5kbGVyOiBjcmVhdGVTbWFydFRhYmxlLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdBRlRFUl9BQ1RJT04nXG4gICAgICAgIH0pXG4gICAgICAgIC5iaW5kKHtcbiAgICAgICAgICAgIGhhbmRsZXI6IGRlc3Ryb3lTbWFydFRhYmxlLFxuICAgICAgICAgICAgYmVoYXZpb3I6ICdCRUZPUkVfQUNUSU9OJ1xuICAgICAgICB9KTtcbn0iXSwibmFtZXMiOlsiQWJzdHJhY3RDb21wb25lbnQiLCJBc3luY0RhdGFMb2FkZXIiLCJwb2ludGVyIiwiZmlsdGVyIiwic29ydEZhY3RvcnkiLCJzb3J0Iiwic2VhcmNoIiwidGFibGUiLCJleGVjdXRpb25MaXN0ZW5lciIsIlNtYXJ0VGFibGUiLCJpbml0Q29udGVudFNrZWxldG9uIiwic3VtbWFyeSIsInBhZ2luYXRpb24iXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7OztBQUtBLEFBRUEsTUFBTUEsbUJBQWlCLENBQUM7SUFDcEIs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
