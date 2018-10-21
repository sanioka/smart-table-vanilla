(function () {
'use strict';

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

var tableDirective$1 = function ({
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

const filterListener = proxyListener({[FILTER_CHANGED]: 'onFilterChange'});

var filterDirective = function ({table, pointer, operator = 'includes', type = 'string'}) {
  return Object.assign({
      filter(input){
        const filterConf = {
          [pointer]: [
            {
              value: input,
              operator,
              type
            }
          ]

        };
        return table.filter(filterConf);
      }
    },
    filterListener({emitter: table}));
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

var summaryDirective$1 = function ({table}) {
  return executionListener({emitter: table});
};

const executionListener$1 = proxyListener({[EXEC_CHANGED]: 'onExecutionChange'});

var workingIndicatorDirective = function ({table}) {
  return executionListener$1({emitter: table});
};

const search = searchDirective;
const slice = sliceDirective;
const summary = summaryDirective$1;
const sort = sortDirective;
const filter = filterDirective;
const workingIndicator = workingIndicatorDirective;
const table = tableDirective$1;

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

function debounce (fn, delay) {
  let timeoutId;
  return (ev) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(function () {
      fn(ev);
    }, delay);
  };
}

function filterInput ({table: table$$1, el, delay = 400, conf = {}}) {
  const pointer = conf.pointer || el.getAttribute('data-st-filter');
  const operator = conf.operator || el.getAttribute('data-st-filter-operator') || 'includes';
  const elType = el.hasAttribute('type') ? el.getAttribute('type') : 'string';
  let type = conf.type || el.getAttribute('data-st-filter-type');
  if (!type) {
    type = ['date', 'number'].includes(elType) ? elType : 'string';
  }
  const component = filter({table: table$$1, pointer, type, operator});
  const eventListener = debounce(ev => component.filter(el.value), delay);
  el.addEventListener('input', eventListener);
  if (el.tagName === 'SELECT') {
    el.addEventListener('change', eventListener);
  }
  return component;
}

var searchInput = function ({el, table: table$$1, delay = 400, conf = {}}) {
  const scope = conf.scope || (el.getAttribute('data-st-search') || '').split(',').map(s => s.trim());
  const component = search({table: table$$1, scope});
  const eventListener = debounce(ev => {
    component.search(el.value);
  }, delay);
  el.addEventListener('input', eventListener);
};

var tableComponentFactory = function ({el, table}) {
  // boot
  [...el.querySelectorAll('[data-st-sort]')].forEach(el => sort$1({el, table}));
  [...el.querySelectorAll('[data-st-loading-indicator]')].forEach(el => loading({el, table}));
  [...el.querySelectorAll('[data-st-search]')].forEach(el => searchInput({el, table}));
  [...el.querySelectorAll('[data-st-filter]')].forEach(el => filterInput({el, table}));

  //extension
  const tableDisplayChange = table.onDisplayChange;
  return Object.assign(table, {
    onDisplayChange: (listener) => {
      tableDisplayChange(listener);
      table.exec();
    }
  });
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

let data = [
    {
        "id": 384,
        "firstName": "May",
        "lastName": "Rutt",
        "email": "VSiegel@aliquam.org",
        "phone": "(588)512-7193",
        "adress": {"streetAddress": "9266 Adipiscing St", "city": "Kearney", "state": "MS", "zip": "64533"},
        "description": "quis lacus egestas curabitur placerat sapien aliquam morbi placerat lectus risus quis risus lacus id neque magna nullam eros nec massa consequat sed sit vel augue ante nunc dolor lectus vitae nec"
    }, {
        "id": 700,
        "firstName": "Tylene",
        "lastName": "Alpert",
        "email": "TPies@sagittis.gov",
        "phone": "(954)376-6224",
        "adress": {"streetAddress": "483 Odio St", "city": "Sunny", "state": "ND", "zip": "79320"},
        "description": "nec scelerisque tempor placerat sit placerat tortor egestas ipsum massa sit lacus aliquam sapien elementum amet sit consequat amet sagittis vestibulum lectus nunc dolor pulvinar sed velit sagittis sed lacus ipsum tortor"
    }, {
        "id": 725,
        "firstName": "Jaeho",
        "lastName": "Patel",
        "email": "MBias@augue.io",
        "phone": "(776)068-2920",
        "adress": {"streetAddress": "6351 Vel Rd", "city": "Ogden", "state": "SD", "zip": "11043"},
        "description": "vel et pretium sed lorem fringilla sed ac sed at mi turpis sed consectetur porta molestie turpis elit massa mi lacus tortor sed elit consectetur molestie elit odio hendrerit placerat vitae egestas"
    }, {
        "id": 85,
        "firstName": "Karl",
        "lastName": "Weakliem",
        "email": "VNajanick@quis.net",
        "phone": "(969)028-6854",
        "adress": {"streetAddress": "3896 Elit St", "city": "Greenville", "state": "MI", "zip": "34316"},
        "description": "mattis mattis tellus tempor elementum nec morbi adipiscing amet malesuada vestibulum placerat lacus quis sed amet vel et rutrum lacus vestibulum rutrum tincidunt ipsum curabitur dolor id molestie porta orci lacus ipsum"
    }, {
        "id": 943,
        "firstName": "Elissa",
        "lastName": "Balulis",
        "email": "ALeoon@dolor.org",
        "phone": "(229)301-7542",
        "adress": {"streetAddress": "4771 Libero St", "city": "Rawlins", "state": "KS", "zip": "85602"},
        "description": "egestas tortor lacus sed scelerisque placerat aenean tortor odio vitae elit et magna risus et massa odio sollicitudin nec dui facilisis pulvinar sit ante hendrerit sapien consequat pulvinar tortor molestie magna tortor"
    }, {
        "id": 636,
        "firstName": "Munazza",
        "lastName": "Vanderlinden",
        "email": "APark@aenean.org",
        "phone": "(886)197-0433",
        "adress": {"streetAddress": "1152 Orci St", "city": "Manchester", "state": "KS", "zip": "48886"},
        "description": "scelerisque vitae augue tellus in nullam nunc ac convallis egestas hendrerit vestibulum non quis lacus tincidunt aenean pulvinar sed morbi tortor tincidunt consectetur vestibulum porta vestibulum dolor dui eget at dolor tellus"
    }, {
        "id": 431,
        "firstName": "Fredrick",
        "lastName": "Mosher",
        "email": "RKreigler@pulvinar.com",
        "phone": "(828)471-4680",
        "adress": {"streetAddress": "6650 Nullam Dr", "city": "Northern", "state": "VA", "zip": "55385"},
        "description": "hendrerit tellus magna adipiscing risus malesuada lectus convallis sed mi at sagittis dolor mattis tortor sed neque vestibulum turpis vestibulum malesuada mi suspendisse tincidunt nec sed nec pharetra magna neque dui sapien"
    }, {
        "id": 73,
        "firstName": "Leticia",
        "lastName": "Bettencourt",
        "email": "WWhetstone@lorem.org",
        "phone": "(678)780-2420",
        "adress": {"streetAddress": "2740 Pulvinar Ln", "city": "Bradford", "state": "CO", "zip": "35921"},
        "description": "amet tortor scelerisque lectus tortor porttitor id sed consequat scelerisque molestie amet pretium at nec aenean magna eros elementum pharetra elementum elit lorem mi egestas quis amet placerat tincidunt lacus sit tincidunt"
    }, {
        "id": 250,
        "firstName": "Ishtiaq",
        "lastName": "Howell",
        "email": "KHesler@magna.org",
        "phone": "(523)261-2063",
        "adress": {"streetAddress": "9233 At Ave", "city": "Tomball", "state": "WV", "zip": "22566"},
        "description": "sollicitudin ac dolor aliquam dolor egestas neque pulvinar aliquam ipsum vitae morbi tortor dolor vel massa elementum velit lacus vitae vestibulum aenean aliquam magna eget ac vitae elementum porta massa fringilla in"
    }, {
        "id": 830,
        "firstName": "Beth",
        "lastName": "Hohmann",
        "email": "IRamati@porttitor.net",
        "phone": "(755)461-8124",
        "adress": {"streetAddress": "3344 Ante Ct", "city": "Hattiesburg", "state": "MO", "zip": "73217"},
        "description": "lacus amet curabitur adipiscing tellus nec et sed non rutrum suspendisse hendrerit magna mattis sapien porta massa nec lectus at dolor placerat vitae pretium amet sollicitudin odio lorem mattis lacus rutrum libero"
    }, {
        "id": 545,
        "firstName": "Janet",
        "lastName": "Deno",
        "email": "KLoya@vel.net",
        "phone": "(360)581-0870",
        "adress": {"streetAddress": "9134 Tortor Rd", "city": "Wahiawa", "state": "WV", "zip": "63607"},
        "description": "pulvinar hendrerit placerat et mi sapien sapien massa tempor consequat sit tortor id non lacus lacus nullam et sollicitudin amet massa dolor sit dui vestibulum consectetur mattis suspendisse sollicitudin hendrerit tincidunt velit"
    }, {
        "id": 732,
        "firstName": "Ricardo",
        "lastName": "Lohr",
        "email": "SWoodhouse@nec.org",
        "phone": "(507)087-1223",
        "adress": {"streetAddress": "2025 Vitae Ave", "city": "Paducah", "state": "AR", "zip": "99216"},
        "description": "magna vestibulum lacus tortor pulvinar non at vitae lectus hendrerit dolor nunc aenean neque sollicitudin libero sed lorem tortor lacus aliquam lectus porttitor consectetur vitae sagittis malesuada aliquam quis vestibulum augue velit"
    }, {
        "id": 449,
        "firstName": "Mellony",
        "lastName": "Sanvick",
        "email": "NLyden@porta.gov",
        "phone": "(151)809-6363",
        "adress": {"streetAddress": "7619 Placerat Dr", "city": "White Bear Lake", "state": "IL", "zip": "56759"},
        "description": "sit sagittis amet sagittis massa porttitor et suspendisse neque aenean tellus pharetra aliquam ante tempor dui curabitur elit massa lectus ante convallis amet odio orci tortor vitae morbi suspendisse sed sed sagittis"
    }, {
        "id": 239,
        "firstName": "Melissa",
        "lastName": "Cookson",
        "email": "SMorse@magna.org",
        "phone": "(366)923-9722",
        "adress": {"streetAddress": "5679 Dolor Dr", "city": "Bulverde", "state": "NE", "zip": "25535"},
        "description": "sed velit tortor rutrum ipsum vestibulum tincidunt elit malesuada placerat mi placerat massa suspendisse in tortor sed nec mi sed elementum nec egestas sed pretium ipsum in consectetur sit molestie turpis at"
    }, {
        "id": 645,
        "firstName": "Marcellin",
        "lastName": "Krebs",
        "email": "JDaniels@aliquam.net",
        "phone": "(365)998-9119",
        "adress": {"streetAddress": "8812 Tortor Ave", "city": "Zionsville", "state": "KY", "zip": "30397"},
        "description": "dolor non molestie etiam molestie lacus libero sed etiam placerat curabitur dolor consequat curabitur ac amet vitae consequat magna scelerisque mattis consequat dolor aenean massa aenean massa vitae tortor at nec adipiscing"
    }, {
        "id": 183,
        "firstName": "Husam",
        "lastName": "Howard",
        "email": "GPosen@tortor.gov",
        "phone": "(487)618-8470",
        "adress": {"streetAddress": "8722 Lectus Ln", "city": "Killeen", "state": "ME", "zip": "23201"},
        "description": "elit ipsum tellus rutrum consectetur aliquam lacus sit curabitur risus ipsum lacus odio aenean ante ipsum orci amet morbi id magna eros sed magna hendrerit facilisis sed fringilla orci tincidunt curabitur convallis"
    }, {
        "id": 657,
        "firstName": "Benika",
        "lastName": "Woods",
        "email": "PPitzel@pretium.io",
        "phone": "(918)225-3821",
        "adress": {"streetAddress": "5723 Pretium Ct", "city": "Hazel Park", "state": "MD", "zip": "41123"},
        "description": "dolor tortor libero dolor egestas et vel libero vestibulum tellus porttitor convallis tincidunt tincidunt magna placerat adipiscing tincidunt turpis turpis sapien sed aliquam amet placerat neque hendrerit tortor amet tellus convallis donec"
    }, {
        "id": 720,
        "firstName": "Elisha",
        "lastName": "Bozzalla",
        "email": "RSkublics@magna.ly",
        "phone": "(384)938-5502",
        "adress": {"streetAddress": "806 Ac St", "city": "Saint Pauls", "state": "NE", "zip": "59222"},
        "description": "sed eros dui dui pharetra massa amet pulvinar vel amet elementum amet sit sagittis odio tellus sit placerat adipiscing egestas sed mi malesuada sed ac sed pharetra facilisis dui facilisis id sollicitudin"
    }, {
        "id": 355,
        "firstName": "Valarie",
        "lastName": "Grant",
        "email": "GYarber@orci.org",
        "phone": "(713)262-7946",
        "adress": {"streetAddress": "9368 Lacus Ln", "city": "Prattville", "state": "IN", "zip": "32228"},
        "description": "velit sagittis facilisis vitae massa facilisis suspendisse sagittis sed tincidunt et nunc tempor mattis vitae libero facilisis vel sed at malesuada pharetra sagittis consequat massa sed eget pulvinar egestas odio ac nec"
    }, {
        "id": 369,
        "firstName": "LaNisha",
        "lastName": "Faurest",
        "email": "AHollis@velit.com",
        "phone": "(567)685-1563",
        "adress": {"streetAddress": "4772 Amet Dr", "city": "Waukesha", "state": "MO", "zip": "67485"},
        "description": "ac adipiscing consequat tortor adipiscing et donec odio etiam pharetra malesuada aenean risus lacus lacus convallis donec mattis aenean donec scelerisque risus nec elementum ac pulvinar sollicitudin aliquam sed nullam amet odio"
    }, {
        "id": 430,
        "firstName": "Karl",
        "lastName": "Clements",
        "email": "FOlsen@tortor.ly",
        "phone": "(301)581-1401",
        "adress": {"streetAddress": "5395 Vitae Ave", "city": "Chester", "state": "MD", "zip": "65783"},
        "description": "at nec sit placerat in adipiscing ac sapien porta velit pulvinar ipsum morbi amet scelerisque magna massa sit sed nunc sit porta dolor neque convallis placerat risus rutrum porta facilisis tortor facilisis"
    }, {
        "id": 357,
        "firstName": "Tomi",
        "lastName": "Peck",
        "email": "MWalters@sit.com",
        "phone": "(835)607-0473",
        "adress": {"streetAddress": "564 Sapien Rd", "city": "Providence", "state": "KY", "zip": "42290"},
        "description": "convallis magna risus magna porttitor aliquam odio amet tellus sit in amet at pharetra elit ac consectetur augue tortor tortor id pretium aliquam quis pulvinar neque convallis ante turpis odio sed hendrerit"
    }, {
        "id": 20,
        "firstName": "Andy",
        "lastName": "Braswell",
        "email": "CSwyers@eros.ly",
        "phone": "(337)028-0978",
        "adress": {"streetAddress": "9359 At St", "city": "Moultrie", "state": "AZ", "zip": "95906"},
        "description": "et nec lacus tempor tempor amet molestie sed amet porttitor pretium etiam lacus sed et magna dolor molestie suspendisse mattis amet tortor tincidunt magna neque tortor odio sit velit sit tincidunt tempor"
    }, {
        "id": 861,
        "firstName": "Latia",
        "lastName": "Ivanoski",
        "email": "NKinder@velit.com",
        "phone": "(264)454-4261",
        "adress": {"streetAddress": "5580 Odio Rd", "city": "Johnson County", "state": "NV", "zip": "57612"},
        "description": "tortor ac lacus tellus sed sapien elit massa sed vestibulum magna non fringilla nullam vestibulum at lorem morbi amet dolor turpis risus tincidunt tellus mattis sit eget lacus sit sapien lacus dolor"
    }, {
        "id": 209,
        "firstName": "Melinda",
        "lastName": "Denard",
        "email": "JAlua@dolor.io",
        "phone": "(179)918-2794",
        "adress": {"streetAddress": "2028 Egestas St", "city": "Arvada", "state": "FL", "zip": "87413"},
        "description": "eget elementum et molestie tincidunt sed consequat velit dolor sit facilisis magna odio et tempor ipsum vestibulum libero libero lacus morbi mattis fringilla morbi dui etiam vel nec tincidunt sollicitudin porttitor convallis"
    }, {
        "id": 768,
        "firstName": "Geraldine",
        "lastName": "Lenze",
        "email": "JPlourde@augue.com",
        "phone": "(332)327-8824",
        "adress": {"streetAddress": "8444 Aliquam Ave", "city": "Baton Rouge", "state": "DE", "zip": "17751"},
        "description": "suspendisse at vitae ipsum libero libero tempor amet consectetur porttitor sit molestie nunc at pretium placerat consectetur orci dolor morbi aliquam amet suspendisse porta sapien amet porttitor mi sed lectus neque tortor"
    }, {
        "id": 982,
        "firstName": "Sheila",
        "lastName": "Lessenberry",
        "email": "RLandrum@curabitur.ly",
        "phone": "(330)019-9831",
        "adress": {"streetAddress": "1567 Et Dr", "city": "Rapid City", "state": "VT", "zip": "76641"},
        "description": "massa orci id ante lectus libero nunc sed sagittis tincidunt ipsum tellus sed aenean elit at tellus ac sit sed donec in sagittis amet placerat dui velit in dolor egestas placerat sed"
    }, {
        "id": 30,
        "firstName": "Virgis",
        "lastName": "Ross",
        "email": "MGipple@pulvinar.gov",
        "phone": "(284)596-2312",
        "adress": {"streetAddress": "9954 Vestibulum Dr", "city": "Charleston", "state": "CO", "zip": "66505"},
        "description": "velit nullam lorem pretium nullam mattis pretium tempor sed porttitor orci nec neque placerat sit quis hendrerit sed donec sed sagittis sagittis magna nunc pulvinar at dolor aenean dolor tortor non sed"
    }, {
        "id": 513,
        "firstName": "Jim",
        "lastName": "Everly",
        "email": "TCarstens@magna.net",
        "phone": "(126)415-3419",
        "adress": {"streetAddress": "7677 Dolor St", "city": "Wauwatosa", "state": "OR", "zip": "41932"},
        "description": "dolor elit libero dui tellus tortor magna odio magna magna elementum vestibulum magna tincidunt tincidunt porta suspendisse neque vestibulum odio sit magna tempor convallis ipsum vitae morbi porttitor sagittis amet donec sed"
    }, {
        "id": 864,
        "firstName": "Jason",
        "lastName": "Kennedy",
        "email": "DFrench@sed.gov",
        "phone": "(355)684-4850",
        "adress": {"streetAddress": "1219 Dui Ave", "city": "Beltsville", "state": "RI", "zip": "18315"},
        "description": "molestie at amet at tincidunt fringilla magna hendrerit ac elementum eget vitae ac at curabitur adipiscing ac risus lorem dui libero elit placerat id augue ipsum turpis sapien risus sollicitudin sed ac"
    }, {
        "id": 821,
        "firstName": "Jeffrey",
        "lastName": "Bartlett",
        "email": "ALenz@lacus.gov",
        "phone": "(619)624-0655",
        "adress": {"streetAddress": "6791 Sapien Dr", "city": "Arlington", "state": "TN", "zip": "57583"},
        "description": "sed lacus sagittis ac risus magna convallis sollicitudin nec elit augue placerat magna pulvinar orci suspendisse amet magna molestie tincidunt odio quis donec pulvinar orci nec hendrerit nunc placerat neque in vestibulum"
    }, {
        "id": 979,
        "firstName": "Terrence",
        "lastName": "Belleque",
        "email": "GPatel@egestas.ly",
        "phone": "(593)477-8099",
        "adress": {"streetAddress": "2219 Vestibulum Rd", "city": "Somerset", "state": "DE", "zip": "63552"},
        "description": "sollicitudin fringilla nunc mattis tempor tempor quis placerat porta risus placerat odio lectus sed turpis libero egestas libero ac rutrum nunc aliquam sollicitudin ac pulvinar sit ac aenean sollicitudin vitae amet augue"
    },
    {
        "id": 979666,
        "firstName": "Terrence",
        "lastName": "Belleque",
        "email": "GPatel@egestas.ly",
        "phone": "(593)477-8099",
        "adress": {"streetAddress": "2219 Vestibulum Rd", "city": "Somerset", "state": "DE", "zip": "63552"},
        "description": "sollicitudin fringilla nunc mattis tempor tempor quis placerat porta risus placerat odio lectus sed turpis libero egestas libero ac rutrum nunc aliquam sollicitudin ac pulvinar sit ac aenean sollicitudin vitae amet augue"
    },



    {
        "id": 384,
        "firstName": "May",
        "lastName": "Rutt",
        "email": "VSiegel@aliquam.org",
        "phone": "(588)512-7193",
        "adress": {"streetAddress": "9266 Adipiscing St", "city": "Kearney", "state": "MS", "zip": "64533"},
        "description": "quis lacus egestas curabitur placerat sapien aliquam morbi placerat lectus risus quis risus lacus id neque magna nullam eros nec massa consequat sed sit vel augue ante nunc dolor lectus vitae nec"
    }, {
        "id": 700,
        "firstName": "Tylene",
        "lastName": "Alpert",
        "email": "TPies@sagittis.gov",
        "phone": "(954)376-6224",
        "adress": {"streetAddress": "483 Odio St", "city": "Sunny", "state": "ND", "zip": "79320"},
        "description": "nec scelerisque tempor placerat sit placerat tortor egestas ipsum massa sit lacus aliquam sapien elementum amet sit consequat amet sagittis vestibulum lectus nunc dolor pulvinar sed velit sagittis sed lacus ipsum tortor"
    }, {
        "id": 725,
        "firstName": "Jaeho",
        "lastName": "Patel",
        "email": "MBias@augue.io",
        "phone": "(776)068-2920",
        "adress": {"streetAddress": "6351 Vel Rd", "city": "Ogden", "state": "SD", "zip": "11043"},
        "description": "vel et pretium sed lorem fringilla sed ac sed at mi turpis sed consectetur porta molestie turpis elit massa mi lacus tortor sed elit consectetur molestie elit odio hendrerit placerat vitae egestas"
    }, {
        "id": 85,
        "firstName": "Karl",
        "lastName": "Weakliem",
        "email": "VNajanick@quis.net",
        "phone": "(969)028-6854",
        "adress": {"streetAddress": "3896 Elit St", "city": "Greenville", "state": "MI", "zip": "34316"},
        "description": "mattis mattis tellus tempor elementum nec morbi adipiscing amet malesuada vestibulum placerat lacus quis sed amet vel et rutrum lacus vestibulum rutrum tincidunt ipsum curabitur dolor id molestie porta orci lacus ipsum"
    }, {
        "id": 943,
        "firstName": "Elissa",
        "lastName": "Balulis",
        "email": "ALeoon@dolor.org",
        "phone": "(229)301-7542",
        "adress": {"streetAddress": "4771 Libero St", "city": "Rawlins", "state": "KS", "zip": "85602"},
        "description": "egestas tortor lacus sed scelerisque placerat aenean tortor odio vitae elit et magna risus et massa odio sollicitudin nec dui facilisis pulvinar sit ante hendrerit sapien consequat pulvinar tortor molestie magna tortor"
    }, {
        "id": 636,
        "firstName": "Munazza",
        "lastName": "Vanderlinden",
        "email": "APark@aenean.org",
        "phone": "(886)197-0433",
        "adress": {"streetAddress": "1152 Orci St", "city": "Manchester", "state": "KS", "zip": "48886"},
        "description": "scelerisque vitae augue tellus in nullam nunc ac convallis egestas hendrerit vestibulum non quis lacus tincidunt aenean pulvinar sed morbi tortor tincidunt consectetur vestibulum porta vestibulum dolor dui eget at dolor tellus"
    }, {
        "id": 431,
        "firstName": "Fredrick",
        "lastName": "Mosher",
        "email": "RKreigler@pulvinar.com",
        "phone": "(828)471-4680",
        "adress": {"streetAddress": "6650 Nullam Dr", "city": "Northern", "state": "VA", "zip": "55385"},
        "description": "hendrerit tellus magna adipiscing risus malesuada lectus convallis sed mi at sagittis dolor mattis tortor sed neque vestibulum turpis vestibulum malesuada mi suspendisse tincidunt nec sed nec pharetra magna neque dui sapien"
    }, {
        "id": 73,
        "firstName": "Leticia",
        "lastName": "Bettencourt",
        "email": "WWhetstone@lorem.org",
        "phone": "(678)780-2420",
        "adress": {"streetAddress": "2740 Pulvinar Ln", "city": "Bradford", "state": "CO", "zip": "35921"},
        "description": "amet tortor scelerisque lectus tortor porttitor id sed consequat scelerisque molestie amet pretium at nec aenean magna eros elementum pharetra elementum elit lorem mi egestas quis amet placerat tincidunt lacus sit tincidunt"
    }, {
        "id": 250,
        "firstName": "Ishtiaq",
        "lastName": "Howell",
        "email": "KHesler@magna.org",
        "phone": "(523)261-2063",
        "adress": {"streetAddress": "9233 At Ave", "city": "Tomball", "state": "WV", "zip": "22566"},
        "description": "sollicitudin ac dolor aliquam dolor egestas neque pulvinar aliquam ipsum vitae morbi tortor dolor vel massa elementum velit lacus vitae vestibulum aenean aliquam magna eget ac vitae elementum porta massa fringilla in"
    }, {
        "id": 830,
        "firstName": "Beth",
        "lastName": "Hohmann",
        "email": "IRamati@porttitor.net",
        "phone": "(755)461-8124",
        "adress": {"streetAddress": "3344 Ante Ct", "city": "Hattiesburg", "state": "MO", "zip": "73217"},
        "description": "lacus amet curabitur adipiscing tellus nec et sed non rutrum suspendisse hendrerit magna mattis sapien porta massa nec lectus at dolor placerat vitae pretium amet sollicitudin odio lorem mattis lacus rutrum libero"
    }, {
        "id": 545,
        "firstName": "Janet",
        "lastName": "Deno",
        "email": "KLoya@vel.net",
        "phone": "(360)581-0870",
        "adress": {"streetAddress": "9134 Tortor Rd", "city": "Wahiawa", "state": "WV", "zip": "63607"},
        "description": "pulvinar hendrerit placerat et mi sapien sapien massa tempor consequat sit tortor id non lacus lacus nullam et sollicitudin amet massa dolor sit dui vestibulum consectetur mattis suspendisse sollicitudin hendrerit tincidunt velit"
    }, {
        "id": 732,
        "firstName": "Ricardo",
        "lastName": "Lohr",
        "email": "SWoodhouse@nec.org",
        "phone": "(507)087-1223",
        "adress": {"streetAddress": "2025 Vitae Ave", "city": "Paducah", "state": "AR", "zip": "99216"},
        "description": "magna vestibulum lacus tortor pulvinar non at vitae lectus hendrerit dolor nunc aenean neque sollicitudin libero sed lorem tortor lacus aliquam lectus porttitor consectetur vitae sagittis malesuada aliquam quis vestibulum augue velit"
    }, {
        "id": 449,
        "firstName": "Mellony",
        "lastName": "Sanvick",
        "email": "NLyden@porta.gov",
        "phone": "(151)809-6363",
        "adress": {"streetAddress": "7619 Placerat Dr", "city": "White Bear Lake", "state": "IL", "zip": "56759"},
        "description": "sit sagittis amet sagittis massa porttitor et suspendisse neque aenean tellus pharetra aliquam ante tempor dui curabitur elit massa lectus ante convallis amet odio orci tortor vitae morbi suspendisse sed sed sagittis"
    }, {
        "id": 239,
        "firstName": "Melissa",
        "lastName": "Cookson",
        "email": "SMorse@magna.org",
        "phone": "(366)923-9722",
        "adress": {"streetAddress": "5679 Dolor Dr", "city": "Bulverde", "state": "NE", "zip": "25535"},
        "description": "sed velit tortor rutrum ipsum vestibulum tincidunt elit malesuada placerat mi placerat massa suspendisse in tortor sed nec mi sed elementum nec egestas sed pretium ipsum in consectetur sit molestie turpis at"
    }, {
        "id": 645,
        "firstName": "Marcellin",
        "lastName": "Krebs",
        "email": "JDaniels@aliquam.net",
        "phone": "(365)998-9119",
        "adress": {"streetAddress": "8812 Tortor Ave", "city": "Zionsville", "state": "KY", "zip": "30397"},
        "description": "dolor non molestie etiam molestie lacus libero sed etiam placerat curabitur dolor consequat curabitur ac amet vitae consequat magna scelerisque mattis consequat dolor aenean massa aenean massa vitae tortor at nec adipiscing"
    }, {
        "id": 183,
        "firstName": "Husam",
        "lastName": "Howard",
        "email": "GPosen@tortor.gov",
        "phone": "(487)618-8470",
        "adress": {"streetAddress": "8722 Lectus Ln", "city": "Killeen", "state": "ME", "zip": "23201"},
        "description": "elit ipsum tellus rutrum consectetur aliquam lacus sit curabitur risus ipsum lacus odio aenean ante ipsum orci amet morbi id magna eros sed magna hendrerit facilisis sed fringilla orci tincidunt curabitur convallis"
    }, {
        "id": 657,
        "firstName": "Benika",
        "lastName": "Woods",
        "email": "PPitzel@pretium.io",
        "phone": "(918)225-3821",
        "adress": {"streetAddress": "5723 Pretium Ct", "city": "Hazel Park", "state": "MD", "zip": "41123"},
        "description": "dolor tortor libero dolor egestas et vel libero vestibulum tellus porttitor convallis tincidunt tincidunt magna placerat adipiscing tincidunt turpis turpis sapien sed aliquam amet placerat neque hendrerit tortor amet tellus convallis donec"
    }, {
        "id": 720,
        "firstName": "Elisha",
        "lastName": "Bozzalla",
        "email": "RSkublics@magna.ly",
        "phone": "(384)938-5502",
        "adress": {"streetAddress": "806 Ac St", "city": "Saint Pauls", "state": "NE", "zip": "59222"},
        "description": "sed eros dui dui pharetra massa amet pulvinar vel amet elementum amet sit sagittis odio tellus sit placerat adipiscing egestas sed mi malesuada sed ac sed pharetra facilisis dui facilisis id sollicitudin"
    }, {
        "id": 355,
        "firstName": "Valarie",
        "lastName": "Grant",
        "email": "GYarber@orci.org",
        "phone": "(713)262-7946",
        "adress": {"streetAddress": "9368 Lacus Ln", "city": "Prattville", "state": "IN", "zip": "32228"},
        "description": "velit sagittis facilisis vitae massa facilisis suspendisse sagittis sed tincidunt et nunc tempor mattis vitae libero facilisis vel sed at malesuada pharetra sagittis consequat massa sed eget pulvinar egestas odio ac nec"
    }, {
        "id": 369,
        "firstName": "LaNisha",
        "lastName": "Faurest",
        "email": "AHollis@velit.com",
        "phone": "(567)685-1563",
        "adress": {"streetAddress": "4772 Amet Dr", "city": "Waukesha", "state": "MO", "zip": "67485"},
        "description": "ac adipiscing consequat tortor adipiscing et donec odio etiam pharetra malesuada aenean risus lacus lacus convallis donec mattis aenean donec scelerisque risus nec elementum ac pulvinar sollicitudin aliquam sed nullam amet odio"
    }, {
        "id": 430,
        "firstName": "Karl",
        "lastName": "Clements",
        "email": "FOlsen@tortor.ly",
        "phone": "(301)581-1401",
        "adress": {"streetAddress": "5395 Vitae Ave", "city": "Chester", "state": "MD", "zip": "65783"},
        "description": "at nec sit placerat in adipiscing ac sapien porta velit pulvinar ipsum morbi amet scelerisque magna massa sit sed nunc sit porta dolor neque convallis placerat risus rutrum porta facilisis tortor facilisis"
    }, {
        "id": 357,
        "firstName": "Tomi",
        "lastName": "Peck",
        "email": "MWalters@sit.com",
        "phone": "(835)607-0473",
        "adress": {"streetAddress": "564 Sapien Rd", "city": "Providence", "state": "KY", "zip": "42290"},
        "description": "convallis magna risus magna porttitor aliquam odio amet tellus sit in amet at pharetra elit ac consectetur augue tortor tortor id pretium aliquam quis pulvinar neque convallis ante turpis odio sed hendrerit"
    }, {
        "id": 20,
        "firstName": "Andy",
        "lastName": "Braswell",
        "email": "CSwyers@eros.ly",
        "phone": "(337)028-0978",
        "adress": {"streetAddress": "9359 At St", "city": "Moultrie", "state": "AZ", "zip": "95906"},
        "description": "et nec lacus tempor tempor amet molestie sed amet porttitor pretium etiam lacus sed et magna dolor molestie suspendisse mattis amet tortor tincidunt magna neque tortor odio sit velit sit tincidunt tempor"
    }, {
        "id": 861,
        "firstName": "Latia",
        "lastName": "Ivanoski",
        "email": "NKinder@velit.com",
        "phone": "(264)454-4261",
        "adress": {"streetAddress": "5580 Odio Rd", "city": "Johnson County", "state": "NV", "zip": "57612"},
        "description": "tortor ac lacus tellus sed sapien elit massa sed vestibulum magna non fringilla nullam vestibulum at lorem morbi amet dolor turpis risus tincidunt tellus mattis sit eget lacus sit sapien lacus dolor"
    }, {
        "id": 209,
        "firstName": "Melinda",
        "lastName": "Denard",
        "email": "JAlua@dolor.io",
        "phone": "(179)918-2794",
        "adress": {"streetAddress": "2028 Egestas St", "city": "Arvada", "state": "FL", "zip": "87413"},
        "description": "eget elementum et molestie tincidunt sed consequat velit dolor sit facilisis magna odio et tempor ipsum vestibulum libero libero lacus morbi mattis fringilla morbi dui etiam vel nec tincidunt sollicitudin porttitor convallis"
    }, {
        "id": 768,
        "firstName": "Geraldine",
        "lastName": "Lenze",
        "email": "JPlourde@augue.com",
        "phone": "(332)327-8824",
        "adress": {"streetAddress": "8444 Aliquam Ave", "city": "Baton Rouge", "state": "DE", "zip": "17751"},
        "description": "suspendisse at vitae ipsum libero libero tempor amet consectetur porttitor sit molestie nunc at pretium placerat consectetur orci dolor morbi aliquam amet suspendisse porta sapien amet porttitor mi sed lectus neque tortor"
    }, {
        "id": 982,
        "firstName": "Sheila",
        "lastName": "Lessenberry",
        "email": "RLandrum@curabitur.ly",
        "phone": "(330)019-9831",
        "adress": {"streetAddress": "1567 Et Dr", "city": "Rapid City", "state": "VT", "zip": "76641"},
        "description": "massa orci id ante lectus libero nunc sed sagittis tincidunt ipsum tellus sed aenean elit at tellus ac sit sed donec in sagittis amet placerat dui velit in dolor egestas placerat sed"
    }, {
        "id": 30,
        "firstName": "Virgis",
        "lastName": "Ross",
        "email": "MGipple@pulvinar.gov",
        "phone": "(284)596-2312",
        "adress": {"streetAddress": "9954 Vestibulum Dr", "city": "Charleston", "state": "CO", "zip": "66505"},
        "description": "velit nullam lorem pretium nullam mattis pretium tempor sed porttitor orci nec neque placerat sit quis hendrerit sed donec sed sagittis sagittis magna nunc pulvinar at dolor aenean dolor tortor non sed"
    }, {
        "id": 513,
        "firstName": "Jim",
        "lastName": "Everly",
        "email": "TCarstens@magna.net",
        "phone": "(126)415-3419",
        "adress": {"streetAddress": "7677 Dolor St", "city": "Wauwatosa", "state": "OR", "zip": "41932"},
        "description": "dolor elit libero dui tellus tortor magna odio magna magna elementum vestibulum magna tincidunt tincidunt porta suspendisse neque vestibulum odio sit magna tempor convallis ipsum vitae morbi porttitor sagittis amet donec sed"
    }, {
        "id": 864,
        "firstName": "Jason",
        "lastName": "Kennedy",
        "email": "DFrench@sed.gov",
        "phone": "(355)684-4850",
        "adress": {"streetAddress": "1219 Dui Ave", "city": "Beltsville", "state": "RI", "zip": "18315"},
        "description": "molestie at amet at tincidunt fringilla magna hendrerit ac elementum eget vitae ac at curabitur adipiscing ac risus lorem dui libero elit placerat id augue ipsum turpis sapien risus sollicitudin sed ac"
    }, {
        "id": 821,
        "firstName": "Jeffrey",
        "lastName": "Bartlett",
        "email": "ALenz@lacus.gov",
        "phone": "(619)624-0655",
        "adress": {"streetAddress": "6791 Sapien Dr", "city": "Arlington", "state": "TN", "zip": "57583"},
        "description": "sed lacus sagittis ac risus magna convallis sollicitudin nec elit augue placerat magna pulvinar orci suspendisse amet magna molestie tincidunt odio quis donec pulvinar orci nec hendrerit nunc placerat neque in vestibulum"
    }, {
        "id": 979,
        "firstName": "Terrence",
        "lastName": "Belleque",
        "email": "GPatel@egestas.ly",
        "phone": "(593)477-8099",
        "adress": {"streetAddress": "2219 Vestibulum Rd", "city": "Somerset", "state": "DE", "zip": "63552"},
        "description": "sollicitudin fringilla nunc mattis tempor tempor quis placerat porta risus placerat odio lectus sed turpis libero egestas libero ac rutrum nunc aliquam sollicitudin ac pulvinar sit ac aenean sollicitudin vitae amet augue"
    },
    {
        "id": 979666,
        "firstName": "Terrence",
        "lastName": "Belleque",
        "email": "GPatel@egestas.ly",
        "phone": "(593)477-8099",
        "adress": {"streetAddress": "2219 Vestibulum Rd", "city": "Somerset", "state": "DE", "zip": "63552"},
        "description": "sollicitudin fringilla nunc mattis tempor tempor quis placerat porta risus placerat odio lectus sed turpis libero egestas libero ac rutrum nunc aliquam sollicitudin ac pulvinar sit ac aenean sollicitudin vitae amet augue"
    }

];

const tableContainerEl = document.getElementById('table-container');
const tbody = tableContainerEl.querySelector('tbody');
const summaryEl = tableContainerEl.querySelector('[data-st-summary]');

const t = table({data, tableState: {sort: {}, filter: {}, slice: {page: 1, size: 50}}});
const tableComponent = tableComponentFactory({el: tableContainerEl, table: t});

summaryComponent({table: t, el: summaryEl});

const paginationContainer = tableContainerEl.querySelector('[data-st-pagination]');
paginationComponent({table: t, el: paginationContainer});


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

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvZmlsdGVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2VhcmNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy9zb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3IuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9pbmRleC5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvaGVscGVycy5qcyIsIi4uL2xpYi9maWx0ZXJzLmpzIiwiLi4vbGliL3NlYXJjaC5qcyIsIi4uL2xpYi90YWJsZS5qcyIsImNvbXBvbmVudHMvcm93LmpzIiwiY29tcG9uZW50cy9zdW1tYXJ5LmpzIiwiY29tcG9uZW50cy9wYWdpbmF0aW9uLmpzIiwiY29tcG9uZW50cy9kZXNjcmlwdGlvbi5qcyIsImRhdGFMb2FkZXIuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB7RklMVEVSX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGZpbHRlckxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W0ZJTFRFUl9DSEFOR0VEXTogJ29uRmlsdGVyQ2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlLCBwb2ludGVyLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe1xuICAgICAgZmlsdGVyKGlucHV0KXtcbiAgICAgICAgY29uc3QgZmlsdGVyQ29uZiA9IHtcbiAgICAgICAgICBbcG9pbnRlcl06IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdmFsdWU6IGlucHV0LFxuICAgICAgICAgICAgICBvcGVyYXRvcixcbiAgICAgICAgICAgICAgdHlwZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGFibGUuZmlsdGVyKGZpbHRlckNvbmYpO1xuICAgICAgfVxuICAgIH0sXG4gICAgZmlsdGVyTGlzdGVuZXIoe2VtaXR0ZXI6IHRhYmxlfSkpO1xufSIsImltcG9ydCB7U0VBUkNIX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNlYXJjaExpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NFQVJDSF9DSEFOR0VEXTogJ29uU2VhcmNoQ2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlLCBzY29wZSA9IFtdfSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICBzZWFyY2hMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSwge1xuICAgICAgc2VhcmNoKGlucHV0KXtcbiAgICAgICAgcmV0dXJuIHRhYmxlLnNlYXJjaCh7dmFsdWU6IGlucHV0LCBzY29wZX0pO1xuICAgICAgfVxuICAgIH0pO1xufSIsImltcG9ydCB7UEFHRV9DSEFOR0VELCBTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbUEFHRV9DSEFOR0VEXTogJ29uUGFnZUNoYW5nZScsIFtTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuICBsZXQge3NsaWNlOntwYWdlOmN1cnJlbnRQYWdlLCBzaXplOmN1cnJlbnRTaXplfX0gPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gIGxldCBpdGVtTGlzdExlbmd0aCA9IHRhYmxlLmxlbmd0aDtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc2VsZWN0UGFnZShwKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogcCwgc2l6ZTogY3VycmVudFNpemV9KTtcbiAgICB9LFxuICAgIHNlbGVjdE5leHRQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICB9LFxuICAgIHNlbGVjdFByZXZpb3VzUGFnZSgpe1xuICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgfSxcbiAgICBjaGFuZ2VQYWdlU2l6ZShzaXplKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogMSwgc2l6ZX0pO1xuICAgIH0sXG4gICAgaXNQcmV2aW91c1BhZ2VFbmFibGVkKCl7XG4gICAgICByZXR1cm4gY3VycmVudFBhZ2UgPiAxO1xuICAgIH0sXG4gICAgaXNOZXh0UGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBNYXRoLmNlaWwoaXRlbUxpc3RMZW5ndGggLyBjdXJyZW50U2l6ZSkgPiBjdXJyZW50UGFnZTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oYXBpLCBzbGljZUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZTpwLCBzaXplOnMsIGZpbHRlcmVkQ291bnR9KSA9PiB7XG4gICAgY3VycmVudFBhZ2UgPSBwO1xuICAgIGN1cnJlbnRTaXplID0gcztcbiAgICBpdGVtTGlzdExlbmd0aCA9IGZpbHRlcmVkQ291bnQ7XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59XG4iLCJpbXBvcnQge1RPR0dMRV9TT1JUfSBmcm9tICcuLi9ldmVudHMnXG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNvcnRMaXN0ZW5lcnMgPSBwcm94eUxpc3RlbmVyKHtbVE9HR0xFX1NPUlRdOiAnb25Tb3J0VG9nZ2xlJ30pO1xuY29uc3QgZGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtwb2ludGVyLCB0YWJsZSwgY3ljbGUgPSBmYWxzZX0pIHtcblxuICBjb25zdCBjeWNsZURpcmVjdGlvbnMgPSBjeWNsZSA9PT0gdHJ1ZSA/IFsnbm9uZSddLmNvbmNhdChkaXJlY3Rpb25zKSA6IFsuLi5kaXJlY3Rpb25zXS5yZXZlcnNlKCk7XG5cbiAgbGV0IGhpdCA9IDA7XG5cbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbih7XG4gICAgdG9nZ2xlKCl7XG4gICAgICBoaXQrKztcbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgIHJldHVybiB0YWJsZS5zb3J0KHtwb2ludGVyLCBkaXJlY3Rpb259KTtcbiAgICB9XG5cbiAgfSwgc29ydExpc3RlbmVycyh7ZW1pdHRlcjogdGFibGV9KSk7XG5cbiAgZGlyZWN0aXZlLm9uU29ydFRvZ2dsZSgoe3BvaW50ZXI6cH0pID0+IHtcbiAgICBpZiAocG9pbnRlciAhPT0gcCkge1xuICAgICAgaGl0ID0gMDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59IiwiaW1wb3J0IHtTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB7RVhFQ19DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuXG5jb25zdCBleGVjdXRpb25MaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tFWEVDX0NIQU5HRURdOiAnb25FeGVjdXRpb25DaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvcn0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBjb21wb25lbnQgPSB3b3JraW5nSW5kaWNhdG9yKHt0YWJsZX0pO1xuICBjb21wb25lbnQub25FeGVjdXRpb25DaGFuZ2UoZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXdvcmtpbmcnKTtcbiAgICBpZiAod29ya2luZyA9PT0gdHJ1ZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc3Qtd29ya2luZycpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb21wb25lbnQ7XG59OyIsImltcG9ydCB7c29ydH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWwsIHRhYmxlLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LXNvcnQnKTtcbiAgY29uc3QgY3ljbGUgPSBjb25mLmN5Y2xlIHx8IGVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1zdC1zb3J0LWN5Y2xlJyk7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHNvcnQoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZX0pO1xuICBjb21wb25lbnQub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpjdXJyZW50UG9pbnRlciwgZGlyZWN0aW9ufSkgPT4ge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXNvcnQtYXNjJywgJ3N0LXNvcnQtZGVzYycpO1xuICAgIGlmIChwb2ludGVyID09PSBjdXJyZW50UG9pbnRlciAmJiBkaXJlY3Rpb24gIT09ICdub25lJykge1xuICAgICAgY29uc3QgY2xhc3NOYW1lID0gZGlyZWN0aW9uID09PSAnYXNjJyA/ICdzdC1zb3J0LWFzYycgOiAnc3Qtc29ydC1kZXNjJztcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9XG4gIH0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZXYgPT4gY29tcG9uZW50LnRvZ2dsZSgpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50TGlzdGVuZXIpO1xuICByZXR1cm4gY29tcG9uZW50O1xufSIsImV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGRlbGF5KSB7XG4gIGxldCB0aW1lb3V0SWQ7XG4gIHJldHVybiAoZXYpID0+IHtcbiAgICBpZiAodGltZW91dElkKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgfVxuICAgIHRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGZuKGV2KTtcbiAgICB9LCBkZWxheSk7XG4gIH07XG59OyIsImltcG9ydCB7ZmlsdGVyfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCB7ZGVib3VuY2V9IGZyb20gJy4vaGVscGVycydcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVySW5wdXQgKHt0YWJsZSwgZWwsIGRlbGF5ID0gNDAwLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlcicpO1xuICBjb25zdCBvcGVyYXRvciA9IGNvbmYub3BlcmF0b3IgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlci1vcGVyYXRvcicpIHx8ICdpbmNsdWRlcyc7XG4gIGNvbnN0IGVsVHlwZSA9IGVsLmhhc0F0dHJpYnV0ZSgndHlwZScpID8gZWwuZ2V0QXR0cmlidXRlKCd0eXBlJykgOiAnc3RyaW5nJztcbiAgbGV0IHR5cGUgPSBjb25mLnR5cGUgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LWZpbHRlci10eXBlJyk7XG4gIGlmICghdHlwZSkge1xuICAgIHR5cGUgPSBbJ2RhdGUnLCAnbnVtYmVyJ10uaW5jbHVkZXMoZWxUeXBlKSA/IGVsVHlwZSA6ICdzdHJpbmcnO1xuICB9XG4gIGNvbnN0IGNvbXBvbmVudCA9IGZpbHRlcih7dGFibGUsIHBvaW50ZXIsIHR5cGUsIG9wZXJhdG9yfSk7XG4gIGNvbnN0IGV2ZW50TGlzdGVuZXIgPSBkZWJvdW5jZShldiA9PiBjb21wb25lbnQuZmlsdGVyKGVsLnZhbHVlKSwgZGVsYXkpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGV2ZW50TGlzdGVuZXIpO1xuICBpZiAoZWwudGFnTmFtZSA9PT0gJ1NFTEVDVCcpIHtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBldmVudExpc3RlbmVyKTtcbiAgfVxuICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJpbXBvcnQge3NlYXJjaH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5pbXBvcnQge2RlYm91bmNlfSBmcm9tICcuL2hlbHBlcnMnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZSwgZGVsYXkgPSA0MDAsIGNvbmYgPSB7fX0pIHtcbiAgY29uc3Qgc2NvcGUgPSBjb25mLnNjb3BlIHx8IChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc2VhcmNoJykgfHwgJycpLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpO1xuICBjb25zdCBjb21wb25lbnQgPSBzZWFyY2goe3RhYmxlLCBzY29wZX0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZGVib3VuY2UoZXYgPT4ge1xuICAgIGNvbXBvbmVudC5zZWFyY2goZWwudmFsdWUpO1xuICB9LCBkZWxheSk7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZXZlbnRMaXN0ZW5lcik7XG59OyIsImltcG9ydCBsb2FkaW5nIGZyb20gJy4vbG9hZGluZ0luZGljYXRvcic7XG5pbXBvcnQgc29ydCBmcm9tICAnLi9zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnLi9maWx0ZXJzJ1xuaW1wb3J0IHNlYXJjaElucHV0IGZyb20gJy4vc2VhcmNoJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2VsLCB0YWJsZX0pIHtcbiAgLy8gYm9vdFxuICBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3Qtc29ydF0nKV0uZm9yRWFjaChlbCA9PiBzb3J0KHtlbCwgdGFibGV9KSk7XG4gIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1sb2FkaW5nLWluZGljYXRvcl0nKV0uZm9yRWFjaChlbCA9PiBsb2FkaW5nKHtlbCwgdGFibGV9KSk7XG4gIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zZWFyY2hdJyldLmZvckVhY2goZWwgPT4gc2VhcmNoSW5wdXQoe2VsLCB0YWJsZX0pKTtcbiAgWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LWZpbHRlcl0nKV0uZm9yRWFjaChlbCA9PiBmaWx0ZXIoe2VsLCB0YWJsZX0pKTtcblxuICAvL2V4dGVuc2lvblxuICBjb25zdCB0YWJsZURpc3BsYXlDaGFuZ2UgPSB0YWJsZS5vbkRpc3BsYXlDaGFuZ2U7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKHRhYmxlLCB7XG4gICAgb25EaXNwbGF5Q2hhbmdlOiAobGlzdGVuZXIpID0+IHtcbiAgICAgIHRhYmxlRGlzcGxheUNoYW5nZShsaXN0ZW5lcik7XG4gICAgICB0YWJsZS5leGVjKCk7XG4gICAgfVxuICB9KTtcbn07IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtpZCwgZmlyc3ROYW1lLCBsYXN0TmFtZSwgZW1haWwsIHBob25lfSwgaW5kZXgpIHtcbiAgICBjb25zdCB0ciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgdHIuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgaW5kZXgpO1xuICAgIHRyLmlubmVySFRNTCA9IGA8dGQ+JHtpZH08L3RkPjx0ZD4ke2ZpcnN0TmFtZX08L3RkPjx0ZD4ke2xhc3ROYW1lfTwvdGQ+PHRkPiR7ZW1haWx9PC90ZD48dGQ+JHtwaG9uZX08L3RkPmA7XG4gICAgcmV0dXJuIHRyO1xufSIsImltcG9ydCB7c3VtbWFyeX0gIGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN1bW1hcnlDb21wb25lbnQgKHt0YWJsZSwgZWx9KSB7XG4gIGNvbnN0IGRpciA9IHN1bW1hcnkoe3RhYmxlfSk7XG4gIGRpci5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlLCBzaXplLCBmaWx0ZXJlZENvdW50fSkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGBzaG93aW5nIGl0ZW1zIDxzdHJvbmc+JHsocGFnZSAtIDEpICogc2l6ZSArIChmaWx0ZXJlZENvdW50ID4gMCA/IDEgOiAwKX08L3N0cm9uZz4gLSA8c3Ryb25nPiR7TWF0aC5taW4oZmlsdGVyZWRDb3VudCwgcGFnZSAqIHNpemUpfTwvc3Ryb25nPiBvZiA8c3Ryb25nPiR7ZmlsdGVyZWRDb3VudH08L3N0cm9uZz4gbWF0Y2hpbmcgaXRlbXNgO1xuICB9KTtcbiAgcmV0dXJuIGRpcjtcbn0iLCJpbXBvcnQge3NsaWNlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcGFnaW5hdGlvbkNvbXBvbmVudCh7dGFibGUsIGVsfSkge1xuICAgIGNvbnN0IHByZXZpb3VzQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgcHJldmlvdXNCdXR0b24uaW5uZXJIVE1MID0gJ1ByZXZpb3VzJztcbiAgICBjb25zdCBuZXh0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgbmV4dEJ1dHRvbi5pbm5lckhUTUwgPSAnTmV4dCc7XG4gICAgY29uc3QgcGFnZVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gJy0gcGFnZSAxIC0nO1xuXG4gICAgY29uc3QgY29tcCA9IHNsaWNlKHt0YWJsZX0pO1xuXG4gICAgY29tcC5vblN1bW1hcnlDaGFuZ2UoKHtwYWdlfSkgPT4ge1xuICAgICAgICBwcmV2aW91c0J1dHRvbi5kaXNhYmxlZCA9ICFjb21wLmlzUHJldmlvdXNQYWdlRW5hYmxlZCgpO1xuICAgICAgICBuZXh0QnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNOZXh0UGFnZUVuYWJsZWQoKTtcbiAgICAgICAgcGFnZVNwYW4uaW5uZXJIVE1MID0gYC0gJHtwYWdlfSAtYDtcbiAgICB9KTtcblxuICAgIHByZXZpb3VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3RQcmV2aW91c1BhZ2UoKSk7XG4gICAgbmV4dEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbXAuc2VsZWN0TmV4dFBhZ2UoKSk7XG5cbiAgICBlbC5hcHBlbmRDaGlsZChwcmV2aW91c0J1dHRvbik7XG4gICAgZWwuYXBwZW5kQ2hpbGQocGFnZVNwYW4pO1xuICAgIGVsLmFwcGVuZENoaWxkKG5leHRCdXR0b24pO1xuXG4gICAgcmV0dXJuIGNvbXA7XG59IiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGl0ZW0pIHtcblxuICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgZGl2LmlubmVySFRNTCA9IGDQktGL0LHRgNCw0L0g0L/QvtC70YzQt9C+0LLQsNGC0LXQu9GMIDxiPiR7aXRlbS5maXJzdE5hbWV9ICR7aXRlbS5sYXN0TmFtZX08L2I+PGJyPlxuICAgICAgICAgICAg0J7Qv9C40YHQsNC90LjQtTo8YnI+XG5cbiAgICAgICAgICAgIDx0ZXh0YXJlYT5cbiAgICAgICAgICAgICR7aXRlbS5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgIDwvdGV4dGFyZWE+PGJyPlxuXG4gICAgICAgICAgICDQkNC00YDQtdGBINC/0YDQvtC20LjQstCw0L3QuNGPOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0cmVldEFkZHJlc3N9PC9iPjxicj5cbiAgICAgICAgICAgINCT0L7RgNC+0LQ6IDxiPiR7aXRlbS5hZHJlc3MuY2l0eX08L2I+PGJyPlxuICAgICAgICAgICAg0J/RgNC+0LLQuNC90YbQuNGPL9GI0YLQsNGCOiA8Yj4ke2l0ZW0uYWRyZXNzLnN0YXRlfTwvYj48YnI+XG4gICAgICAgICAgICDQmNC90LTQtdC60YE6IDxiPiR7aXRlbS5hZHJlc3MuemlwfTwvYj5gO1xuXG4gICAgcmV0dXJuIGRpdjtcbn0iLCJleHBvcnQgbGV0IGRhdGEgPSBbXG4gICAge1xuICAgICAgICBcImlkXCI6IDM4NCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNYXlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlJ1dHRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlZTaWVnZWxAYWxpcXVhbS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1ODgpNTEyLTcxOTNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkyNjYgQWRpcGlzY2luZyBTdFwiLCBcImNpdHlcIjogXCJLZWFybmV5XCIsIFwic3RhdGVcIjogXCJNU1wiLCBcInppcFwiOiBcIjY0NTMzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwicXVpcyBsYWN1cyBlZ2VzdGFzIGN1cmFiaXR1ciBwbGFjZXJhdCBzYXBpZW4gYWxpcXVhbSBtb3JiaSBwbGFjZXJhdCBsZWN0dXMgcmlzdXMgcXVpcyByaXN1cyBsYWN1cyBpZCBuZXF1ZSBtYWduYSBudWxsYW0gZXJvcyBuZWMgbWFzc2EgY29uc2VxdWF0IHNlZCBzaXQgdmVsIGF1Z3VlIGFudGUgbnVuYyBkb2xvciBsZWN0dXMgdml0YWUgbmVjXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzAwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlR5bGVuZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQWxwZXJ0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJUUGllc0BzYWdpdHRpcy5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig5NTQpMzc2LTYyMjRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjQ4MyBPZGlvIFN0XCIsIFwiY2l0eVwiOiBcIlN1bm55XCIsIFwic3RhdGVcIjogXCJORFwiLCBcInppcFwiOiBcIjc5MzIwXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibmVjIHNjZWxlcmlzcXVlIHRlbXBvciBwbGFjZXJhdCBzaXQgcGxhY2VyYXQgdG9ydG9yIGVnZXN0YXMgaXBzdW0gbWFzc2Egc2l0IGxhY3VzIGFsaXF1YW0gc2FwaWVuIGVsZW1lbnR1bSBhbWV0IHNpdCBjb25zZXF1YXQgYW1ldCBzYWdpdHRpcyB2ZXN0aWJ1bHVtIGxlY3R1cyBudW5jIGRvbG9yIHB1bHZpbmFyIHNlZCB2ZWxpdCBzYWdpdHRpcyBzZWQgbGFjdXMgaXBzdW0gdG9ydG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzI1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkphZWhvXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJQYXRlbFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTUJpYXNAYXVndWUuaW9cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig3NzYpMDY4LTI5MjBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjYzNTEgVmVsIFJkXCIsIFwiY2l0eVwiOiBcIk9nZGVuXCIsIFwic3RhdGVcIjogXCJTRFwiLCBcInppcFwiOiBcIjExMDQzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwidmVsIGV0IHByZXRpdW0gc2VkIGxvcmVtIGZyaW5naWxsYSBzZWQgYWMgc2VkIGF0IG1pIHR1cnBpcyBzZWQgY29uc2VjdGV0dXIgcG9ydGEgbW9sZXN0aWUgdHVycGlzIGVsaXQgbWFzc2EgbWkgbGFjdXMgdG9ydG9yIHNlZCBlbGl0IGNvbnNlY3RldHVyIG1vbGVzdGllIGVsaXQgb2RpbyBoZW5kcmVyaXQgcGxhY2VyYXQgdml0YWUgZWdlc3Rhc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkthcmxcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIldlYWtsaWVtXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJWTmFqYW5pY2tAcXVpcy5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig5NjkpMDI4LTY4NTRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjM4OTYgRWxpdCBTdFwiLCBcImNpdHlcIjogXCJHcmVlbnZpbGxlXCIsIFwic3RhdGVcIjogXCJNSVwiLCBcInppcFwiOiBcIjM0MzE2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibWF0dGlzIG1hdHRpcyB0ZWxsdXMgdGVtcG9yIGVsZW1lbnR1bSBuZWMgbW9yYmkgYWRpcGlzY2luZyBhbWV0IG1hbGVzdWFkYSB2ZXN0aWJ1bHVtIHBsYWNlcmF0IGxhY3VzIHF1aXMgc2VkIGFtZXQgdmVsIGV0IHJ1dHJ1bSBsYWN1cyB2ZXN0aWJ1bHVtIHJ1dHJ1bSB0aW5jaWR1bnQgaXBzdW0gY3VyYWJpdHVyIGRvbG9yIGlkIG1vbGVzdGllIHBvcnRhIG9yY2kgbGFjdXMgaXBzdW1cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA5NDMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiRWxpc3NhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCYWx1bGlzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBTGVvb25AZG9sb3Iub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjI5KTMwMS03NTQyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI0NzcxIExpYmVybyBTdFwiLCBcImNpdHlcIjogXCJSYXdsaW5zXCIsIFwic3RhdGVcIjogXCJLU1wiLCBcInppcFwiOiBcIjg1NjAyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZWdlc3RhcyB0b3J0b3IgbGFjdXMgc2VkIHNjZWxlcmlzcXVlIHBsYWNlcmF0IGFlbmVhbiB0b3J0b3Igb2RpbyB2aXRhZSBlbGl0IGV0IG1hZ25hIHJpc3VzIGV0IG1hc3NhIG9kaW8gc29sbGljaXR1ZGluIG5lYyBkdWkgZmFjaWxpc2lzIHB1bHZpbmFyIHNpdCBhbnRlIGhlbmRyZXJpdCBzYXBpZW4gY29uc2VxdWF0IHB1bHZpbmFyIHRvcnRvciBtb2xlc3RpZSBtYWduYSB0b3J0b3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA2MzYsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTXVuYXp6YVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiVmFuZGVybGluZGVuXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBUGFya0BhZW5lYW4ub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoODg2KTE5Ny0wNDMzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIxMTUyIE9yY2kgU3RcIiwgXCJjaXR5XCI6IFwiTWFuY2hlc3RlclwiLCBcInN0YXRlXCI6IFwiS1NcIiwgXCJ6aXBcIjogXCI0ODg4NlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNjZWxlcmlzcXVlIHZpdGFlIGF1Z3VlIHRlbGx1cyBpbiBudWxsYW0gbnVuYyBhYyBjb252YWxsaXMgZWdlc3RhcyBoZW5kcmVyaXQgdmVzdGlidWx1bSBub24gcXVpcyBsYWN1cyB0aW5jaWR1bnQgYWVuZWFuIHB1bHZpbmFyIHNlZCBtb3JiaSB0b3J0b3IgdGluY2lkdW50IGNvbnNlY3RldHVyIHZlc3RpYnVsdW0gcG9ydGEgdmVzdGlidWx1bSBkb2xvciBkdWkgZWdldCBhdCBkb2xvciB0ZWxsdXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA0MzEsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiRnJlZHJpY2tcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIk1vc2hlclwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiUktyZWlnbGVyQHB1bHZpbmFyLmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDgyOCk0NzEtNDY4MFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNjY1MCBOdWxsYW0gRHJcIiwgXCJjaXR5XCI6IFwiTm9ydGhlcm5cIiwgXCJzdGF0ZVwiOiBcIlZBXCIsIFwiemlwXCI6IFwiNTUzODVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJoZW5kcmVyaXQgdGVsbHVzIG1hZ25hIGFkaXBpc2NpbmcgcmlzdXMgbWFsZXN1YWRhIGxlY3R1cyBjb252YWxsaXMgc2VkIG1pIGF0IHNhZ2l0dGlzIGRvbG9yIG1hdHRpcyB0b3J0b3Igc2VkIG5lcXVlIHZlc3RpYnVsdW0gdHVycGlzIHZlc3RpYnVsdW0gbWFsZXN1YWRhIG1pIHN1c3BlbmRpc3NlIHRpbmNpZHVudCBuZWMgc2VkIG5lYyBwaGFyZXRyYSBtYWduYSBuZXF1ZSBkdWkgc2FwaWVuXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTGV0aWNpYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmV0dGVuY291cnRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIldXaGV0c3RvbmVAbG9yZW0ub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNjc4KTc4MC0yNDIwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyNzQwIFB1bHZpbmFyIExuXCIsIFwiY2l0eVwiOiBcIkJyYWRmb3JkXCIsIFwic3RhdGVcIjogXCJDT1wiLCBcInppcFwiOiBcIjM1OTIxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiYW1ldCB0b3J0b3Igc2NlbGVyaXNxdWUgbGVjdHVzIHRvcnRvciBwb3J0dGl0b3IgaWQgc2VkIGNvbnNlcXVhdCBzY2VsZXJpc3F1ZSBtb2xlc3RpZSBhbWV0IHByZXRpdW0gYXQgbmVjIGFlbmVhbiBtYWduYSBlcm9zIGVsZW1lbnR1bSBwaGFyZXRyYSBlbGVtZW50dW0gZWxpdCBsb3JlbSBtaSBlZ2VzdGFzIHF1aXMgYW1ldCBwbGFjZXJhdCB0aW5jaWR1bnQgbGFjdXMgc2l0IHRpbmNpZHVudFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDI1MCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJJc2h0aWFxXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJIb3dlbGxcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIktIZXNsZXJAbWFnbmEub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTIzKTI2MS0yMDYzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MjMzIEF0IEF2ZVwiLCBcImNpdHlcIjogXCJUb21iYWxsXCIsIFwic3RhdGVcIjogXCJXVlwiLCBcInppcFwiOiBcIjIyNTY2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic29sbGljaXR1ZGluIGFjIGRvbG9yIGFsaXF1YW0gZG9sb3IgZWdlc3RhcyBuZXF1ZSBwdWx2aW5hciBhbGlxdWFtIGlwc3VtIHZpdGFlIG1vcmJpIHRvcnRvciBkb2xvciB2ZWwgbWFzc2EgZWxlbWVudHVtIHZlbGl0IGxhY3VzIHZpdGFlIHZlc3RpYnVsdW0gYWVuZWFuIGFsaXF1YW0gbWFnbmEgZWdldCBhYyB2aXRhZSBlbGVtZW50dW0gcG9ydGEgbWFzc2EgZnJpbmdpbGxhIGluXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODMwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkJldGhcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkhvaG1hbm5cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIklSYW1hdGlAcG9ydHRpdG9yLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDc1NSk0NjEtODEyNFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMzM0NCBBbnRlIEN0XCIsIFwiY2l0eVwiOiBcIkhhdHRpZXNidXJnXCIsIFwic3RhdGVcIjogXCJNT1wiLCBcInppcFwiOiBcIjczMjE3XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibGFjdXMgYW1ldCBjdXJhYml0dXIgYWRpcGlzY2luZyB0ZWxsdXMgbmVjIGV0IHNlZCBub24gcnV0cnVtIHN1c3BlbmRpc3NlIGhlbmRyZXJpdCBtYWduYSBtYXR0aXMgc2FwaWVuIHBvcnRhIG1hc3NhIG5lYyBsZWN0dXMgYXQgZG9sb3IgcGxhY2VyYXQgdml0YWUgcHJldGl1bSBhbWV0IHNvbGxpY2l0dWRpbiBvZGlvIGxvcmVtIG1hdHRpcyBsYWN1cyBydXRydW0gbGliZXJvXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNTQ1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkphbmV0XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJEZW5vXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJLTG95YUB2ZWwubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzYwKTU4MS0wODcwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MTM0IFRvcnRvciBSZFwiLCBcImNpdHlcIjogXCJXYWhpYXdhXCIsIFwic3RhdGVcIjogXCJXVlwiLCBcInppcFwiOiBcIjYzNjA3XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwicHVsdmluYXIgaGVuZHJlcml0IHBsYWNlcmF0IGV0IG1pIHNhcGllbiBzYXBpZW4gbWFzc2EgdGVtcG9yIGNvbnNlcXVhdCBzaXQgdG9ydG9yIGlkIG5vbiBsYWN1cyBsYWN1cyBudWxsYW0gZXQgc29sbGljaXR1ZGluIGFtZXQgbWFzc2EgZG9sb3Igc2l0IGR1aSB2ZXN0aWJ1bHVtIGNvbnNlY3RldHVyIG1hdHRpcyBzdXNwZW5kaXNzZSBzb2xsaWNpdHVkaW4gaGVuZHJlcml0IHRpbmNpZHVudCB2ZWxpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDczMixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJSaWNhcmRvXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJMb2hyXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJTV29vZGhvdXNlQG5lYy5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1MDcpMDg3LTEyMjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIwMjUgVml0YWUgQXZlXCIsIFwiY2l0eVwiOiBcIlBhZHVjYWhcIiwgXCJzdGF0ZVwiOiBcIkFSXCIsIFwiemlwXCI6IFwiOTkyMTZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJtYWduYSB2ZXN0aWJ1bHVtIGxhY3VzIHRvcnRvciBwdWx2aW5hciBub24gYXQgdml0YWUgbGVjdHVzIGhlbmRyZXJpdCBkb2xvciBudW5jIGFlbmVhbiBuZXF1ZSBzb2xsaWNpdHVkaW4gbGliZXJvIHNlZCBsb3JlbSB0b3J0b3IgbGFjdXMgYWxpcXVhbSBsZWN0dXMgcG9ydHRpdG9yIGNvbnNlY3RldHVyIHZpdGFlIHNhZ2l0dGlzIG1hbGVzdWFkYSBhbGlxdWFtIHF1aXMgdmVzdGlidWx1bSBhdWd1ZSB2ZWxpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDQ0OSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNZWxsb255XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJTYW52aWNrXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJOTHlkZW5AcG9ydGEuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMTUxKTgwOS02MzYzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI3NjE5IFBsYWNlcmF0IERyXCIsIFwiY2l0eVwiOiBcIldoaXRlIEJlYXIgTGFrZVwiLCBcInN0YXRlXCI6IFwiSUxcIiwgXCJ6aXBcIjogXCI1Njc1OVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNpdCBzYWdpdHRpcyBhbWV0IHNhZ2l0dGlzIG1hc3NhIHBvcnR0aXRvciBldCBzdXNwZW5kaXNzZSBuZXF1ZSBhZW5lYW4gdGVsbHVzIHBoYXJldHJhIGFsaXF1YW0gYW50ZSB0ZW1wb3IgZHVpIGN1cmFiaXR1ciBlbGl0IG1hc3NhIGxlY3R1cyBhbnRlIGNvbnZhbGxpcyBhbWV0IG9kaW8gb3JjaSB0b3J0b3Igdml0YWUgbW9yYmkgc3VzcGVuZGlzc2Ugc2VkIHNlZCBzYWdpdHRpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDIzOSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNZWxpc3NhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJDb29rc29uXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJTTW9yc2VAbWFnbmEub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzY2KTkyMy05NzIyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1Njc5IERvbG9yIERyXCIsIFwiY2l0eVwiOiBcIkJ1bHZlcmRlXCIsIFwic3RhdGVcIjogXCJORVwiLCBcInppcFwiOiBcIjI1NTM1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2VkIHZlbGl0IHRvcnRvciBydXRydW0gaXBzdW0gdmVzdGlidWx1bSB0aW5jaWR1bnQgZWxpdCBtYWxlc3VhZGEgcGxhY2VyYXQgbWkgcGxhY2VyYXQgbWFzc2Egc3VzcGVuZGlzc2UgaW4gdG9ydG9yIHNlZCBuZWMgbWkgc2VkIGVsZW1lbnR1bSBuZWMgZWdlc3RhcyBzZWQgcHJldGl1bSBpcHN1bSBpbiBjb25zZWN0ZXR1ciBzaXQgbW9sZXN0aWUgdHVycGlzIGF0XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNjQ1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1hcmNlbGxpblwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiS3JlYnNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkpEYW5pZWxzQGFsaXF1YW0ubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzY1KTk5OC05MTE5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI4ODEyIFRvcnRvciBBdmVcIiwgXCJjaXR5XCI6IFwiWmlvbnN2aWxsZVwiLCBcInN0YXRlXCI6IFwiS1lcIiwgXCJ6aXBcIjogXCIzMDM5N1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImRvbG9yIG5vbiBtb2xlc3RpZSBldGlhbSBtb2xlc3RpZSBsYWN1cyBsaWJlcm8gc2VkIGV0aWFtIHBsYWNlcmF0IGN1cmFiaXR1ciBkb2xvciBjb25zZXF1YXQgY3VyYWJpdHVyIGFjIGFtZXQgdml0YWUgY29uc2VxdWF0IG1hZ25hIHNjZWxlcmlzcXVlIG1hdHRpcyBjb25zZXF1YXQgZG9sb3IgYWVuZWFuIG1hc3NhIGFlbmVhbiBtYXNzYSB2aXRhZSB0b3J0b3IgYXQgbmVjIGFkaXBpc2NpbmdcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAxODMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSHVzYW1cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkhvd2FyZFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1Bvc2VuQHRvcnRvci5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig0ODcpNjE4LTg0NzBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjg3MjIgTGVjdHVzIExuXCIsIFwiY2l0eVwiOiBcIktpbGxlZW5cIiwgXCJzdGF0ZVwiOiBcIk1FXCIsIFwiemlwXCI6IFwiMjMyMDFcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJlbGl0IGlwc3VtIHRlbGx1cyBydXRydW0gY29uc2VjdGV0dXIgYWxpcXVhbSBsYWN1cyBzaXQgY3VyYWJpdHVyIHJpc3VzIGlwc3VtIGxhY3VzIG9kaW8gYWVuZWFuIGFudGUgaXBzdW0gb3JjaSBhbWV0IG1vcmJpIGlkIG1hZ25hIGVyb3Mgc2VkIG1hZ25hIGhlbmRyZXJpdCBmYWNpbGlzaXMgc2VkIGZyaW5naWxsYSBvcmNpIHRpbmNpZHVudCBjdXJhYml0dXIgY29udmFsbGlzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNjU3LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkJlbmlrYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiV29vZHNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlBQaXR6ZWxAcHJldGl1bS5pb1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDkxOCkyMjUtMzgyMVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTcyMyBQcmV0aXVtIEN0XCIsIFwiY2l0eVwiOiBcIkhhemVsIFBhcmtcIiwgXCJzdGF0ZVwiOiBcIk1EXCIsIFwiemlwXCI6IFwiNDExMjNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJkb2xvciB0b3J0b3IgbGliZXJvIGRvbG9yIGVnZXN0YXMgZXQgdmVsIGxpYmVybyB2ZXN0aWJ1bHVtIHRlbGx1cyBwb3J0dGl0b3IgY29udmFsbGlzIHRpbmNpZHVudCB0aW5jaWR1bnQgbWFnbmEgcGxhY2VyYXQgYWRpcGlzY2luZyB0aW5jaWR1bnQgdHVycGlzIHR1cnBpcyBzYXBpZW4gc2VkIGFsaXF1YW0gYW1ldCBwbGFjZXJhdCBuZXF1ZSBoZW5kcmVyaXQgdG9ydG9yIGFtZXQgdGVsbHVzIGNvbnZhbGxpcyBkb25lY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDcyMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJFbGlzaGFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJvenphbGxhXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJSU2t1YmxpY3NAbWFnbmEubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzODQpOTM4LTU1MDJcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjgwNiBBYyBTdFwiLCBcImNpdHlcIjogXCJTYWludCBQYXVsc1wiLCBcInN0YXRlXCI6IFwiTkVcIiwgXCJ6aXBcIjogXCI1OTIyMlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNlZCBlcm9zIGR1aSBkdWkgcGhhcmV0cmEgbWFzc2EgYW1ldCBwdWx2aW5hciB2ZWwgYW1ldCBlbGVtZW50dW0gYW1ldCBzaXQgc2FnaXR0aXMgb2RpbyB0ZWxsdXMgc2l0IHBsYWNlcmF0IGFkaXBpc2NpbmcgZWdlc3RhcyBzZWQgbWkgbWFsZXN1YWRhIHNlZCBhYyBzZWQgcGhhcmV0cmEgZmFjaWxpc2lzIGR1aSBmYWNpbGlzaXMgaWQgc29sbGljaXR1ZGluXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMzU1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlZhbGFyaWVcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkdyYW50XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJHWWFyYmVyQG9yY2kub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNzEzKTI2Mi03OTQ2XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MzY4IExhY3VzIExuXCIsIFwiY2l0eVwiOiBcIlByYXR0dmlsbGVcIiwgXCJzdGF0ZVwiOiBcIklOXCIsIFwiemlwXCI6IFwiMzIyMjhcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ2ZWxpdCBzYWdpdHRpcyBmYWNpbGlzaXMgdml0YWUgbWFzc2EgZmFjaWxpc2lzIHN1c3BlbmRpc3NlIHNhZ2l0dGlzIHNlZCB0aW5jaWR1bnQgZXQgbnVuYyB0ZW1wb3IgbWF0dGlzIHZpdGFlIGxpYmVybyBmYWNpbGlzaXMgdmVsIHNlZCBhdCBtYWxlc3VhZGEgcGhhcmV0cmEgc2FnaXR0aXMgY29uc2VxdWF0IG1hc3NhIHNlZCBlZ2V0IHB1bHZpbmFyIGVnZXN0YXMgb2RpbyBhYyBuZWNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzNjksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTGFOaXNoYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRmF1cmVzdFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQUhvbGxpc0B2ZWxpdC5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1NjcpNjg1LTE1NjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjQ3NzIgQW1ldCBEclwiLCBcImNpdHlcIjogXCJXYXVrZXNoYVwiLCBcInN0YXRlXCI6IFwiTU9cIiwgXCJ6aXBcIjogXCI2NzQ4NVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImFjIGFkaXBpc2NpbmcgY29uc2VxdWF0IHRvcnRvciBhZGlwaXNjaW5nIGV0IGRvbmVjIG9kaW8gZXRpYW0gcGhhcmV0cmEgbWFsZXN1YWRhIGFlbmVhbiByaXN1cyBsYWN1cyBsYWN1cyBjb252YWxsaXMgZG9uZWMgbWF0dGlzIGFlbmVhbiBkb25lYyBzY2VsZXJpc3F1ZSByaXN1cyBuZWMgZWxlbWVudHVtIGFjIHB1bHZpbmFyIHNvbGxpY2l0dWRpbiBhbGlxdWFtIHNlZCBudWxsYW0gYW1ldCBvZGlvXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNDMwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkthcmxcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkNsZW1lbnRzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJGT2xzZW5AdG9ydG9yLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzAxKTU4MS0xNDAxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1Mzk1IFZpdGFlIEF2ZVwiLCBcImNpdHlcIjogXCJDaGVzdGVyXCIsIFwic3RhdGVcIjogXCJNRFwiLCBcInppcFwiOiBcIjY1NzgzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiYXQgbmVjIHNpdCBwbGFjZXJhdCBpbiBhZGlwaXNjaW5nIGFjIHNhcGllbiBwb3J0YSB2ZWxpdCBwdWx2aW5hciBpcHN1bSBtb3JiaSBhbWV0IHNjZWxlcmlzcXVlIG1hZ25hIG1hc3NhIHNpdCBzZWQgbnVuYyBzaXQgcG9ydGEgZG9sb3IgbmVxdWUgY29udmFsbGlzIHBsYWNlcmF0IHJpc3VzIHJ1dHJ1bSBwb3J0YSBmYWNpbGlzaXMgdG9ydG9yIGZhY2lsaXNpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDM1NyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUb21pXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJQZWNrXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJNV2FsdGVyc0BzaXQuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoODM1KTYwNy0wNDczXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1NjQgU2FwaWVuIFJkXCIsIFwiY2l0eVwiOiBcIlByb3ZpZGVuY2VcIiwgXCJzdGF0ZVwiOiBcIktZXCIsIFwiemlwXCI6IFwiNDIyOTBcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJjb252YWxsaXMgbWFnbmEgcmlzdXMgbWFnbmEgcG9ydHRpdG9yIGFsaXF1YW0gb2RpbyBhbWV0IHRlbGx1cyBzaXQgaW4gYW1ldCBhdCBwaGFyZXRyYSBlbGl0IGFjIGNvbnNlY3RldHVyIGF1Z3VlIHRvcnRvciB0b3J0b3IgaWQgcHJldGl1bSBhbGlxdWFtIHF1aXMgcHVsdmluYXIgbmVxdWUgY29udmFsbGlzIGFudGUgdHVycGlzIG9kaW8gc2VkIGhlbmRyZXJpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDIwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkFuZHlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJyYXN3ZWxsXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJDU3d5ZXJzQGVyb3MubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzMzcpMDI4LTA5NzhcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkzNTkgQXQgU3RcIiwgXCJjaXR5XCI6IFwiTW91bHRyaWVcIiwgXCJzdGF0ZVwiOiBcIkFaXCIsIFwiemlwXCI6IFwiOTU5MDZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJldCBuZWMgbGFjdXMgdGVtcG9yIHRlbXBvciBhbWV0IG1vbGVzdGllIHNlZCBhbWV0IHBvcnR0aXRvciBwcmV0aXVtIGV0aWFtIGxhY3VzIHNlZCBldCBtYWduYSBkb2xvciBtb2xlc3RpZSBzdXNwZW5kaXNzZSBtYXR0aXMgYW1ldCB0b3J0b3IgdGluY2lkdW50IG1hZ25hIG5lcXVlIHRvcnRvciBvZGlvIHNpdCB2ZWxpdCBzaXQgdGluY2lkdW50IHRlbXBvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg2MSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJMYXRpYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiSXZhbm9za2lcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk5LaW5kZXJAdmVsaXQuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjY0KTQ1NC00MjYxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1NTgwIE9kaW8gUmRcIiwgXCJjaXR5XCI6IFwiSm9obnNvbiBDb3VudHlcIiwgXCJzdGF0ZVwiOiBcIk5WXCIsIFwiemlwXCI6IFwiNTc2MTJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ0b3J0b3IgYWMgbGFjdXMgdGVsbHVzIHNlZCBzYXBpZW4gZWxpdCBtYXNzYSBzZWQgdmVzdGlidWx1bSBtYWduYSBub24gZnJpbmdpbGxhIG51bGxhbSB2ZXN0aWJ1bHVtIGF0IGxvcmVtIG1vcmJpIGFtZXQgZG9sb3IgdHVycGlzIHJpc3VzIHRpbmNpZHVudCB0ZWxsdXMgbWF0dGlzIHNpdCBlZ2V0IGxhY3VzIHNpdCBzYXBpZW4gbGFjdXMgZG9sb3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAyMDksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWVsaW5kYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRGVuYXJkXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJKQWx1YUBkb2xvci5pb1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDE3OSk5MTgtMjc5NFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjAyOCBFZ2VzdGFzIFN0XCIsIFwiY2l0eVwiOiBcIkFydmFkYVwiLCBcInN0YXRlXCI6IFwiRkxcIiwgXCJ6aXBcIjogXCI4NzQxM1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImVnZXQgZWxlbWVudHVtIGV0IG1vbGVzdGllIHRpbmNpZHVudCBzZWQgY29uc2VxdWF0IHZlbGl0IGRvbG9yIHNpdCBmYWNpbGlzaXMgbWFnbmEgb2RpbyBldCB0ZW1wb3IgaXBzdW0gdmVzdGlidWx1bSBsaWJlcm8gbGliZXJvIGxhY3VzIG1vcmJpIG1hdHRpcyBmcmluZ2lsbGEgbW9yYmkgZHVpIGV0aWFtIHZlbCBuZWMgdGluY2lkdW50IHNvbGxpY2l0dWRpbiBwb3J0dGl0b3IgY29udmFsbGlzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzY4LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkdlcmFsZGluZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTGVuemVcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkpQbG91cmRlQGF1Z3VlLmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMzMikzMjctODgyNFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiODQ0NCBBbGlxdWFtIEF2ZVwiLCBcImNpdHlcIjogXCJCYXRvbiBSb3VnZVwiLCBcInN0YXRlXCI6IFwiREVcIiwgXCJ6aXBcIjogXCIxNzc1MVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInN1c3BlbmRpc3NlIGF0IHZpdGFlIGlwc3VtIGxpYmVybyBsaWJlcm8gdGVtcG9yIGFtZXQgY29uc2VjdGV0dXIgcG9ydHRpdG9yIHNpdCBtb2xlc3RpZSBudW5jIGF0IHByZXRpdW0gcGxhY2VyYXQgY29uc2VjdGV0dXIgb3JjaSBkb2xvciBtb3JiaSBhbGlxdWFtIGFtZXQgc3VzcGVuZGlzc2UgcG9ydGEgc2FwaWVuIGFtZXQgcG9ydHRpdG9yIG1pIHNlZCBsZWN0dXMgbmVxdWUgdG9ydG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogOTgyLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlNoZWlsYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTGVzc2VuYmVycnlcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlJMYW5kcnVtQGN1cmFiaXR1ci5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMzMCkwMTktOTgzMVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMTU2NyBFdCBEclwiLCBcImNpdHlcIjogXCJSYXBpZCBDaXR5XCIsIFwic3RhdGVcIjogXCJWVFwiLCBcInppcFwiOiBcIjc2NjQxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibWFzc2Egb3JjaSBpZCBhbnRlIGxlY3R1cyBsaWJlcm8gbnVuYyBzZWQgc2FnaXR0aXMgdGluY2lkdW50IGlwc3VtIHRlbGx1cyBzZWQgYWVuZWFuIGVsaXQgYXQgdGVsbHVzIGFjIHNpdCBzZWQgZG9uZWMgaW4gc2FnaXR0aXMgYW1ldCBwbGFjZXJhdCBkdWkgdmVsaXQgaW4gZG9sb3IgZWdlc3RhcyBwbGFjZXJhdCBzZWRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJWaXJnaXNcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlJvc3NcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk1HaXBwbGVAcHVsdmluYXIuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjg0KTU5Ni0yMzEyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5OTU0IFZlc3RpYnVsdW0gRHJcIiwgXCJjaXR5XCI6IFwiQ2hhcmxlc3RvblwiLCBcInN0YXRlXCI6IFwiQ09cIiwgXCJ6aXBcIjogXCI2NjUwNVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInZlbGl0IG51bGxhbSBsb3JlbSBwcmV0aXVtIG51bGxhbSBtYXR0aXMgcHJldGl1bSB0ZW1wb3Igc2VkIHBvcnR0aXRvciBvcmNpIG5lYyBuZXF1ZSBwbGFjZXJhdCBzaXQgcXVpcyBoZW5kcmVyaXQgc2VkIGRvbmVjIHNlZCBzYWdpdHRpcyBzYWdpdHRpcyBtYWduYSBudW5jIHB1bHZpbmFyIGF0IGRvbG9yIGFlbmVhbiBkb2xvciB0b3J0b3Igbm9uIHNlZFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDUxMyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKaW1cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkV2ZXJseVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiVENhcnN0ZW5zQG1hZ25hLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDEyNik0MTUtMzQxOVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNzY3NyBEb2xvciBTdFwiLCBcImNpdHlcIjogXCJXYXV3YXRvc2FcIiwgXCJzdGF0ZVwiOiBcIk9SXCIsIFwiemlwXCI6IFwiNDE5MzJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJkb2xvciBlbGl0IGxpYmVybyBkdWkgdGVsbHVzIHRvcnRvciBtYWduYSBvZGlvIG1hZ25hIG1hZ25hIGVsZW1lbnR1bSB2ZXN0aWJ1bHVtIG1hZ25hIHRpbmNpZHVudCB0aW5jaWR1bnQgcG9ydGEgc3VzcGVuZGlzc2UgbmVxdWUgdmVzdGlidWx1bSBvZGlvIHNpdCBtYWduYSB0ZW1wb3IgY29udmFsbGlzIGlwc3VtIHZpdGFlIG1vcmJpIHBvcnR0aXRvciBzYWdpdHRpcyBhbWV0IGRvbmVjIHNlZFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg2NCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKYXNvblwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiS2VubmVkeVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiREZyZW5jaEBzZWQuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzU1KTY4NC00ODUwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIxMjE5IER1aSBBdmVcIiwgXCJjaXR5XCI6IFwiQmVsdHN2aWxsZVwiLCBcInN0YXRlXCI6IFwiUklcIiwgXCJ6aXBcIjogXCIxODMxNVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm1vbGVzdGllIGF0IGFtZXQgYXQgdGluY2lkdW50IGZyaW5naWxsYSBtYWduYSBoZW5kcmVyaXQgYWMgZWxlbWVudHVtIGVnZXQgdml0YWUgYWMgYXQgY3VyYWJpdHVyIGFkaXBpc2NpbmcgYWMgcmlzdXMgbG9yZW0gZHVpIGxpYmVybyBlbGl0IHBsYWNlcmF0IGlkIGF1Z3VlIGlwc3VtIHR1cnBpcyBzYXBpZW4gcmlzdXMgc29sbGljaXR1ZGluIHNlZCBhY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDgyMSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKZWZmcmV5XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCYXJ0bGV0dFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQUxlbnpAbGFjdXMuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNjE5KTYyNC0wNjU1XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI2NzkxIFNhcGllbiBEclwiLCBcImNpdHlcIjogXCJBcmxpbmd0b25cIiwgXCJzdGF0ZVwiOiBcIlROXCIsIFwiemlwXCI6IFwiNTc1ODNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzZWQgbGFjdXMgc2FnaXR0aXMgYWMgcmlzdXMgbWFnbmEgY29udmFsbGlzIHNvbGxpY2l0dWRpbiBuZWMgZWxpdCBhdWd1ZSBwbGFjZXJhdCBtYWduYSBwdWx2aW5hciBvcmNpIHN1c3BlbmRpc3NlIGFtZXQgbWFnbmEgbW9sZXN0aWUgdGluY2lkdW50IG9kaW8gcXVpcyBkb25lYyBwdWx2aW5hciBvcmNpIG5lYyBoZW5kcmVyaXQgbnVuYyBwbGFjZXJhdCBuZXF1ZSBpbiB2ZXN0aWJ1bHVtXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogOTc5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlRlcnJlbmNlXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCZWxsZXF1ZVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1BhdGVsQGVnZXN0YXMubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1OTMpNDc3LTgwOTlcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIyMTkgVmVzdGlidWx1bSBSZFwiLCBcImNpdHlcIjogXCJTb21lcnNldFwiLCBcInN0YXRlXCI6IFwiREVcIiwgXCJ6aXBcIjogXCI2MzU1MlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNvbGxpY2l0dWRpbiBmcmluZ2lsbGEgbnVuYyBtYXR0aXMgdGVtcG9yIHRlbXBvciBxdWlzIHBsYWNlcmF0IHBvcnRhIHJpc3VzIHBsYWNlcmF0IG9kaW8gbGVjdHVzIHNlZCB0dXJwaXMgbGliZXJvIGVnZXN0YXMgbGliZXJvIGFjIHJ1dHJ1bSBudW5jIGFsaXF1YW0gc29sbGljaXR1ZGluIGFjIHB1bHZpbmFyIHNpdCBhYyBhZW5lYW4gc29sbGljaXR1ZGluIHZpdGFlIGFtZXQgYXVndWVcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IDk3OTY2NixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUZXJyZW5jZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmVsbGVxdWVcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkdQYXRlbEBlZ2VzdGFzLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTkzKTQ3Ny04MDk5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyMjE5IFZlc3RpYnVsdW0gUmRcIiwgXCJjaXR5XCI6IFwiU29tZXJzZXRcIiwgXCJzdGF0ZVwiOiBcIkRFXCIsIFwiemlwXCI6IFwiNjM1NTJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzb2xsaWNpdHVkaW4gZnJpbmdpbGxhIG51bmMgbWF0dGlzIHRlbXBvciB0ZW1wb3IgcXVpcyBwbGFjZXJhdCBwb3J0YSByaXN1cyBwbGFjZXJhdCBvZGlvIGxlY3R1cyBzZWQgdHVycGlzIGxpYmVybyBlZ2VzdGFzIGxpYmVybyBhYyBydXRydW0gbnVuYyBhbGlxdWFtIHNvbGxpY2l0dWRpbiBhYyBwdWx2aW5hciBzaXQgYWMgYWVuZWFuIHNvbGxpY2l0dWRpbiB2aXRhZSBhbWV0IGF1Z3VlXCJcbiAgICB9LFxuXG5cblxuICAgIHtcbiAgICAgICAgXCJpZFwiOiAzODQsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWF5XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJSdXR0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJWU2llZ2VsQGFsaXF1YW0ub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTg4KTUxMi03MTkzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MjY2IEFkaXBpc2NpbmcgU3RcIiwgXCJjaXR5XCI6IFwiS2Vhcm5leVwiLCBcInN0YXRlXCI6IFwiTVNcIiwgXCJ6aXBcIjogXCI2NDUzM1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInF1aXMgbGFjdXMgZWdlc3RhcyBjdXJhYml0dXIgcGxhY2VyYXQgc2FwaWVuIGFsaXF1YW0gbW9yYmkgcGxhY2VyYXQgbGVjdHVzIHJpc3VzIHF1aXMgcmlzdXMgbGFjdXMgaWQgbmVxdWUgbWFnbmEgbnVsbGFtIGVyb3MgbmVjIG1hc3NhIGNvbnNlcXVhdCBzZWQgc2l0IHZlbCBhdWd1ZSBhbnRlIG51bmMgZG9sb3IgbGVjdHVzIHZpdGFlIG5lY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDcwMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUeWxlbmVcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkFscGVydFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiVFBpZXNAc2FnaXR0aXMuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoOTU0KTM3Ni02MjI0XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI0ODMgT2RpbyBTdFwiLCBcImNpdHlcIjogXCJTdW5ueVwiLCBcInN0YXRlXCI6IFwiTkRcIiwgXCJ6aXBcIjogXCI3OTMyMFwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm5lYyBzY2VsZXJpc3F1ZSB0ZW1wb3IgcGxhY2VyYXQgc2l0IHBsYWNlcmF0IHRvcnRvciBlZ2VzdGFzIGlwc3VtIG1hc3NhIHNpdCBsYWN1cyBhbGlxdWFtIHNhcGllbiBlbGVtZW50dW0gYW1ldCBzaXQgY29uc2VxdWF0IGFtZXQgc2FnaXR0aXMgdmVzdGlidWx1bSBsZWN0dXMgbnVuYyBkb2xvciBwdWx2aW5hciBzZWQgdmVsaXQgc2FnaXR0aXMgc2VkIGxhY3VzIGlwc3VtIHRvcnRvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDcyNSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKYWVob1wiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiUGF0ZWxcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk1CaWFzQGF1Z3VlLmlvXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNzc2KTA2OC0yOTIwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI2MzUxIFZlbCBSZFwiLCBcImNpdHlcIjogXCJPZ2RlblwiLCBcInN0YXRlXCI6IFwiU0RcIiwgXCJ6aXBcIjogXCIxMTA0M1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInZlbCBldCBwcmV0aXVtIHNlZCBsb3JlbSBmcmluZ2lsbGEgc2VkIGFjIHNlZCBhdCBtaSB0dXJwaXMgc2VkIGNvbnNlY3RldHVyIHBvcnRhIG1vbGVzdGllIHR1cnBpcyBlbGl0IG1hc3NhIG1pIGxhY3VzIHRvcnRvciBzZWQgZWxpdCBjb25zZWN0ZXR1ciBtb2xlc3RpZSBlbGl0IG9kaW8gaGVuZHJlcml0IHBsYWNlcmF0IHZpdGFlIGVnZXN0YXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA4NSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJLYXJsXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJXZWFrbGllbVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiVk5hamFuaWNrQHF1aXMubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoOTY5KTAyOC02ODU0XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIzODk2IEVsaXQgU3RcIiwgXCJjaXR5XCI6IFwiR3JlZW52aWxsZVwiLCBcInN0YXRlXCI6IFwiTUlcIiwgXCJ6aXBcIjogXCIzNDMxNlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm1hdHRpcyBtYXR0aXMgdGVsbHVzIHRlbXBvciBlbGVtZW50dW0gbmVjIG1vcmJpIGFkaXBpc2NpbmcgYW1ldCBtYWxlc3VhZGEgdmVzdGlidWx1bSBwbGFjZXJhdCBsYWN1cyBxdWlzIHNlZCBhbWV0IHZlbCBldCBydXRydW0gbGFjdXMgdmVzdGlidWx1bSBydXRydW0gdGluY2lkdW50IGlwc3VtIGN1cmFiaXR1ciBkb2xvciBpZCBtb2xlc3RpZSBwb3J0YSBvcmNpIGxhY3VzIGlwc3VtXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogOTQzLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkVsaXNzYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmFsdWxpc1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQUxlb29uQGRvbG9yLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDIyOSkzMDEtNzU0MlwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNDc3MSBMaWJlcm8gU3RcIiwgXCJjaXR5XCI6IFwiUmF3bGluc1wiLCBcInN0YXRlXCI6IFwiS1NcIiwgXCJ6aXBcIjogXCI4NTYwMlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImVnZXN0YXMgdG9ydG9yIGxhY3VzIHNlZCBzY2VsZXJpc3F1ZSBwbGFjZXJhdCBhZW5lYW4gdG9ydG9yIG9kaW8gdml0YWUgZWxpdCBldCBtYWduYSByaXN1cyBldCBtYXNzYSBvZGlvIHNvbGxpY2l0dWRpbiBuZWMgZHVpIGZhY2lsaXNpcyBwdWx2aW5hciBzaXQgYW50ZSBoZW5kcmVyaXQgc2FwaWVuIGNvbnNlcXVhdCBwdWx2aW5hciB0b3J0b3IgbW9sZXN0aWUgbWFnbmEgdG9ydG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNjM2LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk11bmF6emFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlZhbmRlcmxpbmRlblwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQVBhcmtAYWVuZWFuLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDg4NikxOTctMDQzM1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMTE1MiBPcmNpIFN0XCIsIFwiY2l0eVwiOiBcIk1hbmNoZXN0ZXJcIiwgXCJzdGF0ZVwiOiBcIktTXCIsIFwiemlwXCI6IFwiNDg4ODZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzY2VsZXJpc3F1ZSB2aXRhZSBhdWd1ZSB0ZWxsdXMgaW4gbnVsbGFtIG51bmMgYWMgY29udmFsbGlzIGVnZXN0YXMgaGVuZHJlcml0IHZlc3RpYnVsdW0gbm9uIHF1aXMgbGFjdXMgdGluY2lkdW50IGFlbmVhbiBwdWx2aW5hciBzZWQgbW9yYmkgdG9ydG9yIHRpbmNpZHVudCBjb25zZWN0ZXR1ciB2ZXN0aWJ1bHVtIHBvcnRhIHZlc3RpYnVsdW0gZG9sb3IgZHVpIGVnZXQgYXQgZG9sb3IgdGVsbHVzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNDMxLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkZyZWRyaWNrXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJNb3NoZXJcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlJLcmVpZ2xlckBwdWx2aW5hci5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig4MjgpNDcxLTQ2ODBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjY2NTAgTnVsbGFtIERyXCIsIFwiY2l0eVwiOiBcIk5vcnRoZXJuXCIsIFwic3RhdGVcIjogXCJWQVwiLCBcInppcFwiOiBcIjU1Mzg1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiaGVuZHJlcml0IHRlbGx1cyBtYWduYSBhZGlwaXNjaW5nIHJpc3VzIG1hbGVzdWFkYSBsZWN0dXMgY29udmFsbGlzIHNlZCBtaSBhdCBzYWdpdHRpcyBkb2xvciBtYXR0aXMgdG9ydG9yIHNlZCBuZXF1ZSB2ZXN0aWJ1bHVtIHR1cnBpcyB2ZXN0aWJ1bHVtIG1hbGVzdWFkYSBtaSBzdXNwZW5kaXNzZSB0aW5jaWR1bnQgbmVjIHNlZCBuZWMgcGhhcmV0cmEgbWFnbmEgbmVxdWUgZHVpIHNhcGllblwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDczLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkxldGljaWFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJldHRlbmNvdXJ0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJXV2hldHN0b25lQGxvcmVtLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDY3OCk3ODAtMjQyMFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjc0MCBQdWx2aW5hciBMblwiLCBcImNpdHlcIjogXCJCcmFkZm9yZFwiLCBcInN0YXRlXCI6IFwiQ09cIiwgXCJ6aXBcIjogXCIzNTkyMVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImFtZXQgdG9ydG9yIHNjZWxlcmlzcXVlIGxlY3R1cyB0b3J0b3IgcG9ydHRpdG9yIGlkIHNlZCBjb25zZXF1YXQgc2NlbGVyaXNxdWUgbW9sZXN0aWUgYW1ldCBwcmV0aXVtIGF0IG5lYyBhZW5lYW4gbWFnbmEgZXJvcyBlbGVtZW50dW0gcGhhcmV0cmEgZWxlbWVudHVtIGVsaXQgbG9yZW0gbWkgZWdlc3RhcyBxdWlzIGFtZXQgcGxhY2VyYXQgdGluY2lkdW50IGxhY3VzIHNpdCB0aW5jaWR1bnRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAyNTAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSXNodGlhcVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiSG93ZWxsXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJLSGVzbGVyQG1hZ25hLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDUyMykyNjEtMjA2M1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTIzMyBBdCBBdmVcIiwgXCJjaXR5XCI6IFwiVG9tYmFsbFwiLCBcInN0YXRlXCI6IFwiV1ZcIiwgXCJ6aXBcIjogXCIyMjU2NlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNvbGxpY2l0dWRpbiBhYyBkb2xvciBhbGlxdWFtIGRvbG9yIGVnZXN0YXMgbmVxdWUgcHVsdmluYXIgYWxpcXVhbSBpcHN1bSB2aXRhZSBtb3JiaSB0b3J0b3IgZG9sb3IgdmVsIG1hc3NhIGVsZW1lbnR1bSB2ZWxpdCBsYWN1cyB2aXRhZSB2ZXN0aWJ1bHVtIGFlbmVhbiBhbGlxdWFtIG1hZ25hIGVnZXQgYWMgdml0YWUgZWxlbWVudHVtIHBvcnRhIG1hc3NhIGZyaW5naWxsYSBpblwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDgzMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJCZXRoXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJIb2htYW5uXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJJUmFtYXRpQHBvcnR0aXRvci5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig3NTUpNDYxLTgxMjRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjMzNDQgQW50ZSBDdFwiLCBcImNpdHlcIjogXCJIYXR0aWVzYnVyZ1wiLCBcInN0YXRlXCI6IFwiTU9cIiwgXCJ6aXBcIjogXCI3MzIxN1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImxhY3VzIGFtZXQgY3VyYWJpdHVyIGFkaXBpc2NpbmcgdGVsbHVzIG5lYyBldCBzZWQgbm9uIHJ1dHJ1bSBzdXNwZW5kaXNzZSBoZW5kcmVyaXQgbWFnbmEgbWF0dGlzIHNhcGllbiBwb3J0YSBtYXNzYSBuZWMgbGVjdHVzIGF0IGRvbG9yIHBsYWNlcmF0IHZpdGFlIHByZXRpdW0gYW1ldCBzb2xsaWNpdHVkaW4gb2RpbyBsb3JlbSBtYXR0aXMgbGFjdXMgcnV0cnVtIGxpYmVyb1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDU0NSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKYW5ldFwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRGVub1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiS0xveWFAdmVsLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDM2MCk1ODEtMDg3MFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTEzNCBUb3J0b3IgUmRcIiwgXCJjaXR5XCI6IFwiV2FoaWF3YVwiLCBcInN0YXRlXCI6IFwiV1ZcIiwgXCJ6aXBcIjogXCI2MzYwN1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInB1bHZpbmFyIGhlbmRyZXJpdCBwbGFjZXJhdCBldCBtaSBzYXBpZW4gc2FwaWVuIG1hc3NhIHRlbXBvciBjb25zZXF1YXQgc2l0IHRvcnRvciBpZCBub24gbGFjdXMgbGFjdXMgbnVsbGFtIGV0IHNvbGxpY2l0dWRpbiBhbWV0IG1hc3NhIGRvbG9yIHNpdCBkdWkgdmVzdGlidWx1bSBjb25zZWN0ZXR1ciBtYXR0aXMgc3VzcGVuZGlzc2Ugc29sbGljaXR1ZGluIGhlbmRyZXJpdCB0aW5jaWR1bnQgdmVsaXRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3MzIsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiUmljYXJkb1wiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTG9oclwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiU1dvb2Rob3VzZUBuZWMub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTA3KTA4Ny0xMjIzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyMDI1IFZpdGFlIEF2ZVwiLCBcImNpdHlcIjogXCJQYWR1Y2FoXCIsIFwic3RhdGVcIjogXCJBUlwiLCBcInppcFwiOiBcIjk5MjE2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibWFnbmEgdmVzdGlidWx1bSBsYWN1cyB0b3J0b3IgcHVsdmluYXIgbm9uIGF0IHZpdGFlIGxlY3R1cyBoZW5kcmVyaXQgZG9sb3IgbnVuYyBhZW5lYW4gbmVxdWUgc29sbGljaXR1ZGluIGxpYmVybyBzZWQgbG9yZW0gdG9ydG9yIGxhY3VzIGFsaXF1YW0gbGVjdHVzIHBvcnR0aXRvciBjb25zZWN0ZXR1ciB2aXRhZSBzYWdpdHRpcyBtYWxlc3VhZGEgYWxpcXVhbSBxdWlzIHZlc3RpYnVsdW0gYXVndWUgdmVsaXRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA0NDksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWVsbG9ueVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiU2Fudmlja1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTkx5ZGVuQHBvcnRhLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDE1MSk4MDktNjM2M1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNzYxOSBQbGFjZXJhdCBEclwiLCBcImNpdHlcIjogXCJXaGl0ZSBCZWFyIExha2VcIiwgXCJzdGF0ZVwiOiBcIklMXCIsIFwiemlwXCI6IFwiNTY3NTlcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzaXQgc2FnaXR0aXMgYW1ldCBzYWdpdHRpcyBtYXNzYSBwb3J0dGl0b3IgZXQgc3VzcGVuZGlzc2UgbmVxdWUgYWVuZWFuIHRlbGx1cyBwaGFyZXRyYSBhbGlxdWFtIGFudGUgdGVtcG9yIGR1aSBjdXJhYml0dXIgZWxpdCBtYXNzYSBsZWN0dXMgYW50ZSBjb252YWxsaXMgYW1ldCBvZGlvIG9yY2kgdG9ydG9yIHZpdGFlIG1vcmJpIHN1c3BlbmRpc3NlIHNlZCBzZWQgc2FnaXR0aXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAyMzksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWVsaXNzYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQ29va3NvblwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiU01vcnNlQG1hZ25hLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDM2Nik5MjMtOTcyMlwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTY3OSBEb2xvciBEclwiLCBcImNpdHlcIjogXCJCdWx2ZXJkZVwiLCBcInN0YXRlXCI6IFwiTkVcIiwgXCJ6aXBcIjogXCIyNTUzNVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNlZCB2ZWxpdCB0b3J0b3IgcnV0cnVtIGlwc3VtIHZlc3RpYnVsdW0gdGluY2lkdW50IGVsaXQgbWFsZXN1YWRhIHBsYWNlcmF0IG1pIHBsYWNlcmF0IG1hc3NhIHN1c3BlbmRpc3NlIGluIHRvcnRvciBzZWQgbmVjIG1pIHNlZCBlbGVtZW50dW0gbmVjIGVnZXN0YXMgc2VkIHByZXRpdW0gaXBzdW0gaW4gY29uc2VjdGV0dXIgc2l0IG1vbGVzdGllIHR1cnBpcyBhdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDY0NSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNYXJjZWxsaW5cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIktyZWJzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJKRGFuaWVsc0BhbGlxdWFtLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDM2NSk5OTgtOTExOVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiODgxMiBUb3J0b3IgQXZlXCIsIFwiY2l0eVwiOiBcIlppb25zdmlsbGVcIiwgXCJzdGF0ZVwiOiBcIktZXCIsIFwiemlwXCI6IFwiMzAzOTdcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJkb2xvciBub24gbW9sZXN0aWUgZXRpYW0gbW9sZXN0aWUgbGFjdXMgbGliZXJvIHNlZCBldGlhbSBwbGFjZXJhdCBjdXJhYml0dXIgZG9sb3IgY29uc2VxdWF0IGN1cmFiaXR1ciBhYyBhbWV0IHZpdGFlIGNvbnNlcXVhdCBtYWduYSBzY2VsZXJpc3F1ZSBtYXR0aXMgY29uc2VxdWF0IGRvbG9yIGFlbmVhbiBtYXNzYSBhZW5lYW4gbWFzc2Egdml0YWUgdG9ydG9yIGF0IG5lYyBhZGlwaXNjaW5nXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMTgzLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkh1c2FtXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJIb3dhcmRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkdQb3NlbkB0b3J0b3IuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNDg3KTYxOC04NDcwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI4NzIyIExlY3R1cyBMblwiLCBcImNpdHlcIjogXCJLaWxsZWVuXCIsIFwic3RhdGVcIjogXCJNRVwiLCBcInppcFwiOiBcIjIzMjAxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZWxpdCBpcHN1bSB0ZWxsdXMgcnV0cnVtIGNvbnNlY3RldHVyIGFsaXF1YW0gbGFjdXMgc2l0IGN1cmFiaXR1ciByaXN1cyBpcHN1bSBsYWN1cyBvZGlvIGFlbmVhbiBhbnRlIGlwc3VtIG9yY2kgYW1ldCBtb3JiaSBpZCBtYWduYSBlcm9zIHNlZCBtYWduYSBoZW5kcmVyaXQgZmFjaWxpc2lzIHNlZCBmcmluZ2lsbGEgb3JjaSB0aW5jaWR1bnQgY3VyYWJpdHVyIGNvbnZhbGxpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDY1NyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJCZW5pa2FcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIldvb2RzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJQUGl0emVsQHByZXRpdW0uaW9cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig5MTgpMjI1LTM4MjFcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjU3MjMgUHJldGl1bSBDdFwiLCBcImNpdHlcIjogXCJIYXplbCBQYXJrXCIsIFwic3RhdGVcIjogXCJNRFwiLCBcInppcFwiOiBcIjQxMTIzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZG9sb3IgdG9ydG9yIGxpYmVybyBkb2xvciBlZ2VzdGFzIGV0IHZlbCBsaWJlcm8gdmVzdGlidWx1bSB0ZWxsdXMgcG9ydHRpdG9yIGNvbnZhbGxpcyB0aW5jaWR1bnQgdGluY2lkdW50IG1hZ25hIHBsYWNlcmF0IGFkaXBpc2NpbmcgdGluY2lkdW50IHR1cnBpcyB0dXJwaXMgc2FwaWVuIHNlZCBhbGlxdWFtIGFtZXQgcGxhY2VyYXQgbmVxdWUgaGVuZHJlcml0IHRvcnRvciBhbWV0IHRlbGx1cyBjb252YWxsaXMgZG9uZWNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3MjAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiRWxpc2hhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCb3p6YWxsYVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiUlNrdWJsaWNzQG1hZ25hLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzg0KTkzOC01NTAyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI4MDYgQWMgU3RcIiwgXCJjaXR5XCI6IFwiU2FpbnQgUGF1bHNcIiwgXCJzdGF0ZVwiOiBcIk5FXCIsIFwiemlwXCI6IFwiNTkyMjJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzZWQgZXJvcyBkdWkgZHVpIHBoYXJldHJhIG1hc3NhIGFtZXQgcHVsdmluYXIgdmVsIGFtZXQgZWxlbWVudHVtIGFtZXQgc2l0IHNhZ2l0dGlzIG9kaW8gdGVsbHVzIHNpdCBwbGFjZXJhdCBhZGlwaXNjaW5nIGVnZXN0YXMgc2VkIG1pIG1hbGVzdWFkYSBzZWQgYWMgc2VkIHBoYXJldHJhIGZhY2lsaXNpcyBkdWkgZmFjaWxpc2lzIGlkIHNvbGxpY2l0dWRpblwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDM1NSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJWYWxhcmllXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJHcmFudFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1lhcmJlckBvcmNpLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDcxMykyNjItNzk0NlwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTM2OCBMYWN1cyBMblwiLCBcImNpdHlcIjogXCJQcmF0dHZpbGxlXCIsIFwic3RhdGVcIjogXCJJTlwiLCBcInppcFwiOiBcIjMyMjI4XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwidmVsaXQgc2FnaXR0aXMgZmFjaWxpc2lzIHZpdGFlIG1hc3NhIGZhY2lsaXNpcyBzdXNwZW5kaXNzZSBzYWdpdHRpcyBzZWQgdGluY2lkdW50IGV0IG51bmMgdGVtcG9yIG1hdHRpcyB2aXRhZSBsaWJlcm8gZmFjaWxpc2lzIHZlbCBzZWQgYXQgbWFsZXN1YWRhIHBoYXJldHJhIHNhZ2l0dGlzIGNvbnNlcXVhdCBtYXNzYSBzZWQgZWdldCBwdWx2aW5hciBlZ2VzdGFzIG9kaW8gYWMgbmVjXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMzY5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkxhTmlzaGFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkZhdXJlc3RcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkFIb2xsaXNAdmVsaXQuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTY3KTY4NS0xNTYzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI0NzcyIEFtZXQgRHJcIiwgXCJjaXR5XCI6IFwiV2F1a2VzaGFcIiwgXCJzdGF0ZVwiOiBcIk1PXCIsIFwiemlwXCI6IFwiNjc0ODVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJhYyBhZGlwaXNjaW5nIGNvbnNlcXVhdCB0b3J0b3IgYWRpcGlzY2luZyBldCBkb25lYyBvZGlvIGV0aWFtIHBoYXJldHJhIG1hbGVzdWFkYSBhZW5lYW4gcmlzdXMgbGFjdXMgbGFjdXMgY29udmFsbGlzIGRvbmVjIG1hdHRpcyBhZW5lYW4gZG9uZWMgc2NlbGVyaXNxdWUgcmlzdXMgbmVjIGVsZW1lbnR1bSBhYyBwdWx2aW5hciBzb2xsaWNpdHVkaW4gYWxpcXVhbSBzZWQgbnVsbGFtIGFtZXQgb2Rpb1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDQzMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJLYXJsXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJDbGVtZW50c1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiRk9sc2VuQHRvcnRvci5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMwMSk1ODEtMTQwMVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTM5NSBWaXRhZSBBdmVcIiwgXCJjaXR5XCI6IFwiQ2hlc3RlclwiLCBcInN0YXRlXCI6IFwiTURcIiwgXCJ6aXBcIjogXCI2NTc4M1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImF0IG5lYyBzaXQgcGxhY2VyYXQgaW4gYWRpcGlzY2luZyBhYyBzYXBpZW4gcG9ydGEgdmVsaXQgcHVsdmluYXIgaXBzdW0gbW9yYmkgYW1ldCBzY2VsZXJpc3F1ZSBtYWduYSBtYXNzYSBzaXQgc2VkIG51bmMgc2l0IHBvcnRhIGRvbG9yIG5lcXVlIGNvbnZhbGxpcyBwbGFjZXJhdCByaXN1cyBydXRydW0gcG9ydGEgZmFjaWxpc2lzIHRvcnRvciBmYWNpbGlzaXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzNTcsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVG9taVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiUGVja1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTVdhbHRlcnNAc2l0LmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDgzNSk2MDctMDQ3M1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTY0IFNhcGllbiBSZFwiLCBcImNpdHlcIjogXCJQcm92aWRlbmNlXCIsIFwic3RhdGVcIjogXCJLWVwiLCBcInppcFwiOiBcIjQyMjkwXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiY29udmFsbGlzIG1hZ25hIHJpc3VzIG1hZ25hIHBvcnR0aXRvciBhbGlxdWFtIG9kaW8gYW1ldCB0ZWxsdXMgc2l0IGluIGFtZXQgYXQgcGhhcmV0cmEgZWxpdCBhYyBjb25zZWN0ZXR1ciBhdWd1ZSB0b3J0b3IgdG9ydG9yIGlkIHByZXRpdW0gYWxpcXVhbSBxdWlzIHB1bHZpbmFyIG5lcXVlIGNvbnZhbGxpcyBhbnRlIHR1cnBpcyBvZGlvIHNlZCBoZW5kcmVyaXRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAyMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJBbmR5XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCcmFzd2VsbFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQ1N3eWVyc0Blcm9zLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzM3KTAyOC0wOTc4XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MzU5IEF0IFN0XCIsIFwiY2l0eVwiOiBcIk1vdWx0cmllXCIsIFwic3RhdGVcIjogXCJBWlwiLCBcInppcFwiOiBcIjk1OTA2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZXQgbmVjIGxhY3VzIHRlbXBvciB0ZW1wb3IgYW1ldCBtb2xlc3RpZSBzZWQgYW1ldCBwb3J0dGl0b3IgcHJldGl1bSBldGlhbSBsYWN1cyBzZWQgZXQgbWFnbmEgZG9sb3IgbW9sZXN0aWUgc3VzcGVuZGlzc2UgbWF0dGlzIGFtZXQgdG9ydG9yIHRpbmNpZHVudCBtYWduYSBuZXF1ZSB0b3J0b3Igb2RpbyBzaXQgdmVsaXQgc2l0IHRpbmNpZHVudCB0ZW1wb3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA4NjEsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTGF0aWFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkl2YW5vc2tpXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJOS2luZGVyQHZlbGl0LmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDI2NCk0NTQtNDI2MVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTU4MCBPZGlvIFJkXCIsIFwiY2l0eVwiOiBcIkpvaG5zb24gQ291bnR5XCIsIFwic3RhdGVcIjogXCJOVlwiLCBcInppcFwiOiBcIjU3NjEyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwidG9ydG9yIGFjIGxhY3VzIHRlbGx1cyBzZWQgc2FwaWVuIGVsaXQgbWFzc2Egc2VkIHZlc3RpYnVsdW0gbWFnbmEgbm9uIGZyaW5naWxsYSBudWxsYW0gdmVzdGlidWx1bSBhdCBsb3JlbSBtb3JiaSBhbWV0IGRvbG9yIHR1cnBpcyByaXN1cyB0aW5jaWR1bnQgdGVsbHVzIG1hdHRpcyBzaXQgZWdldCBsYWN1cyBzaXQgc2FwaWVuIGxhY3VzIGRvbG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMjA5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1lbGluZGFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkRlbmFyZFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiSkFsdWFAZG9sb3IuaW9cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigxNzkpOTE4LTI3OTRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIwMjggRWdlc3RhcyBTdFwiLCBcImNpdHlcIjogXCJBcnZhZGFcIiwgXCJzdGF0ZVwiOiBcIkZMXCIsIFwiemlwXCI6IFwiODc0MTNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJlZ2V0IGVsZW1lbnR1bSBldCBtb2xlc3RpZSB0aW5jaWR1bnQgc2VkIGNvbnNlcXVhdCB2ZWxpdCBkb2xvciBzaXQgZmFjaWxpc2lzIG1hZ25hIG9kaW8gZXQgdGVtcG9yIGlwc3VtIHZlc3RpYnVsdW0gbGliZXJvIGxpYmVybyBsYWN1cyBtb3JiaSBtYXR0aXMgZnJpbmdpbGxhIG1vcmJpIGR1aSBldGlhbSB2ZWwgbmVjIHRpbmNpZHVudCBzb2xsaWNpdHVkaW4gcG9ydHRpdG9yIGNvbnZhbGxpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDc2OCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJHZXJhbGRpbmVcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkxlbnplXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJKUGxvdXJkZUBhdWd1ZS5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzMzIpMzI3LTg4MjRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjg0NDQgQWxpcXVhbSBBdmVcIiwgXCJjaXR5XCI6IFwiQmF0b24gUm91Z2VcIiwgXCJzdGF0ZVwiOiBcIkRFXCIsIFwiemlwXCI6IFwiMTc3NTFcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzdXNwZW5kaXNzZSBhdCB2aXRhZSBpcHN1bSBsaWJlcm8gbGliZXJvIHRlbXBvciBhbWV0IGNvbnNlY3RldHVyIHBvcnR0aXRvciBzaXQgbW9sZXN0aWUgbnVuYyBhdCBwcmV0aXVtIHBsYWNlcmF0IGNvbnNlY3RldHVyIG9yY2kgZG9sb3IgbW9yYmkgYWxpcXVhbSBhbWV0IHN1c3BlbmRpc3NlIHBvcnRhIHNhcGllbiBhbWV0IHBvcnR0aXRvciBtaSBzZWQgbGVjdHVzIG5lcXVlIHRvcnRvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDk4MixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJTaGVpbGFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkxlc3NlbmJlcnJ5XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJSTGFuZHJ1bUBjdXJhYml0dXIubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzMzApMDE5LTk4MzFcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjE1NjcgRXQgRHJcIiwgXCJjaXR5XCI6IFwiUmFwaWQgQ2l0eVwiLCBcInN0YXRlXCI6IFwiVlRcIiwgXCJ6aXBcIjogXCI3NjY0MVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm1hc3NhIG9yY2kgaWQgYW50ZSBsZWN0dXMgbGliZXJvIG51bmMgc2VkIHNhZ2l0dGlzIHRpbmNpZHVudCBpcHN1bSB0ZWxsdXMgc2VkIGFlbmVhbiBlbGl0IGF0IHRlbGx1cyBhYyBzaXQgc2VkIGRvbmVjIGluIHNhZ2l0dGlzIGFtZXQgcGxhY2VyYXQgZHVpIHZlbGl0IGluIGRvbG9yIGVnZXN0YXMgcGxhY2VyYXQgc2VkXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMzAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVmlyZ2lzXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJSb3NzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJNR2lwcGxlQHB1bHZpbmFyLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDI4NCk1OTYtMjMxMlwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTk1NCBWZXN0aWJ1bHVtIERyXCIsIFwiY2l0eVwiOiBcIkNoYXJsZXN0b25cIiwgXCJzdGF0ZVwiOiBcIkNPXCIsIFwiemlwXCI6IFwiNjY1MDVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ2ZWxpdCBudWxsYW0gbG9yZW0gcHJldGl1bSBudWxsYW0gbWF0dGlzIHByZXRpdW0gdGVtcG9yIHNlZCBwb3J0dGl0b3Igb3JjaSBuZWMgbmVxdWUgcGxhY2VyYXQgc2l0IHF1aXMgaGVuZHJlcml0IHNlZCBkb25lYyBzZWQgc2FnaXR0aXMgc2FnaXR0aXMgbWFnbmEgbnVuYyBwdWx2aW5hciBhdCBkb2xvciBhZW5lYW4gZG9sb3IgdG9ydG9yIG5vbiBzZWRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA1MTMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSmltXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJFdmVybHlcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlRDYXJzdGVuc0BtYWduYS5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigxMjYpNDE1LTM0MTlcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjc2NzcgRG9sb3IgU3RcIiwgXCJjaXR5XCI6IFwiV2F1d2F0b3NhXCIsIFwic3RhdGVcIjogXCJPUlwiLCBcInppcFwiOiBcIjQxOTMyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZG9sb3IgZWxpdCBsaWJlcm8gZHVpIHRlbGx1cyB0b3J0b3IgbWFnbmEgb2RpbyBtYWduYSBtYWduYSBlbGVtZW50dW0gdmVzdGlidWx1bSBtYWduYSB0aW5jaWR1bnQgdGluY2lkdW50IHBvcnRhIHN1c3BlbmRpc3NlIG5lcXVlIHZlc3RpYnVsdW0gb2RpbyBzaXQgbWFnbmEgdGVtcG9yIGNvbnZhbGxpcyBpcHN1bSB2aXRhZSBtb3JiaSBwb3J0dGl0b3Igc2FnaXR0aXMgYW1ldCBkb25lYyBzZWRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA4NjQsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSmFzb25cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIktlbm5lZHlcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkRGcmVuY2hAc2VkLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDM1NSk2ODQtNDg1MFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMTIxOSBEdWkgQXZlXCIsIFwiY2l0eVwiOiBcIkJlbHRzdmlsbGVcIiwgXCJzdGF0ZVwiOiBcIlJJXCIsIFwiemlwXCI6IFwiMTgzMTVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJtb2xlc3RpZSBhdCBhbWV0IGF0IHRpbmNpZHVudCBmcmluZ2lsbGEgbWFnbmEgaGVuZHJlcml0IGFjIGVsZW1lbnR1bSBlZ2V0IHZpdGFlIGFjIGF0IGN1cmFiaXR1ciBhZGlwaXNjaW5nIGFjIHJpc3VzIGxvcmVtIGR1aSBsaWJlcm8gZWxpdCBwbGFjZXJhdCBpZCBhdWd1ZSBpcHN1bSB0dXJwaXMgc2FwaWVuIHJpc3VzIHNvbGxpY2l0dWRpbiBzZWQgYWNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA4MjEsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSmVmZnJleVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmFydGxldHRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkFMZW56QGxhY3VzLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDYxOSk2MjQtMDY1NVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNjc5MSBTYXBpZW4gRHJcIiwgXCJjaXR5XCI6IFwiQXJsaW5ndG9uXCIsIFwic3RhdGVcIjogXCJUTlwiLCBcInppcFwiOiBcIjU3NTgzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2VkIGxhY3VzIHNhZ2l0dGlzIGFjIHJpc3VzIG1hZ25hIGNvbnZhbGxpcyBzb2xsaWNpdHVkaW4gbmVjIGVsaXQgYXVndWUgcGxhY2VyYXQgbWFnbmEgcHVsdmluYXIgb3JjaSBzdXNwZW5kaXNzZSBhbWV0IG1hZ25hIG1vbGVzdGllIHRpbmNpZHVudCBvZGlvIHF1aXMgZG9uZWMgcHVsdmluYXIgb3JjaSBuZWMgaGVuZHJlcml0IG51bmMgcGxhY2VyYXQgbmVxdWUgaW4gdmVzdGlidWx1bVwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDk3OSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUZXJyZW5jZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmVsbGVxdWVcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkdQYXRlbEBlZ2VzdGFzLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTkzKTQ3Ny04MDk5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyMjE5IFZlc3RpYnVsdW0gUmRcIiwgXCJjaXR5XCI6IFwiU29tZXJzZXRcIiwgXCJzdGF0ZVwiOiBcIkRFXCIsIFwiemlwXCI6IFwiNjM1NTJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzb2xsaWNpdHVkaW4gZnJpbmdpbGxhIG51bmMgbWF0dGlzIHRlbXBvciB0ZW1wb3IgcXVpcyBwbGFjZXJhdCBwb3J0YSByaXN1cyBwbGFjZXJhdCBvZGlvIGxlY3R1cyBzZWQgdHVycGlzIGxpYmVybyBlZ2VzdGFzIGxpYmVybyBhYyBydXRydW0gbnVuYyBhbGlxdWFtIHNvbGxpY2l0dWRpbiBhYyBwdWx2aW5hciBzaXQgYWMgYWVuZWFuIHNvbGxpY2l0dWRpbiB2aXRhZSBhbWV0IGF1Z3VlXCJcbiAgICB9LFxuICAgIHtcbiAgICAgICAgXCJpZFwiOiA5Nzk2NjYsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVGVycmVuY2VcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJlbGxlcXVlXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJHUGF0ZWxAZWdlc3Rhcy5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDU5Myk0NzctODA5OVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjIxOSBWZXN0aWJ1bHVtIFJkXCIsIFwiY2l0eVwiOiBcIlNvbWVyc2V0XCIsIFwic3RhdGVcIjogXCJERVwiLCBcInppcFwiOiBcIjYzNTUyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic29sbGljaXR1ZGluIGZyaW5naWxsYSBudW5jIG1hdHRpcyB0ZW1wb3IgdGVtcG9yIHF1aXMgcGxhY2VyYXQgcG9ydGEgcmlzdXMgcGxhY2VyYXQgb2RpbyBsZWN0dXMgc2VkIHR1cnBpcyBsaWJlcm8gZWdlc3RhcyBsaWJlcm8gYWMgcnV0cnVtIG51bmMgYWxpcXVhbSBzb2xsaWNpdHVkaW4gYWMgcHVsdmluYXIgc2l0IGFjIGFlbmVhbiBzb2xsaWNpdHVkaW4gdml0YWUgYW1ldCBhdWd1ZVwiXG4gICAgfVxuXG5dOyIsImltcG9ydCB7dGFibGUgYXMgdGFibGVDb21wb25lbnRGYWN0b3J5fSBmcm9tICcuLi9pbmRleCc7XG5pbXBvcnQge3RhYmxlfSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcbmltcG9ydCByb3cgZnJvbSAnLi9jb21wb25lbnRzL3Jvdyc7XG5pbXBvcnQgc3VtbWFyeSBmcm9tICcuL2NvbXBvbmVudHMvc3VtbWFyeSc7XG5pbXBvcnQgcGFnaW5hdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvcGFnaW5hdGlvbic7XG5pbXBvcnQgZGVzY3JpcHRpb24gZnJvbSAnLi9jb21wb25lbnRzL2Rlc2NyaXB0aW9uJztcblxuaW1wb3J0IHtkYXRhfSBmcm9tICcuL2RhdGFMb2FkZXInO1xuXG5jb25zdCB0YWJsZUNvbnRhaW5lckVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RhYmxlLWNvbnRhaW5lcicpO1xuY29uc3QgdGJvZHkgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ3Rib2R5Jyk7XG5jb25zdCBzdW1tYXJ5RWwgPSB0YWJsZUNvbnRhaW5lckVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXN0LXN1bW1hcnldJyk7XG5cbmNvbnN0IHQgPSB0YWJsZSh7ZGF0YSwgdGFibGVTdGF0ZToge3NvcnQ6IHt9LCBmaWx0ZXI6IHt9LCBzbGljZToge3BhZ2U6IDEsIHNpemU6IDUwfX19KTtcbmNvbnN0IHRhYmxlQ29tcG9uZW50ID0gdGFibGVDb21wb25lbnRGYWN0b3J5KHtlbDogdGFibGVDb250YWluZXJFbCwgdGFibGU6IHR9KTtcblxuc3VtbWFyeSh7dGFibGU6IHQsIGVsOiBzdW1tYXJ5RWx9KTtcblxuY29uc3QgcGFnaW5hdGlvbkNvbnRhaW5lciA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignW2RhdGEtc3QtcGFnaW5hdGlvbl0nKTtcbnBhZ2luYXRpb24oe3RhYmxlOiB0LCBlbDogcGFnaW5hdGlvbkNvbnRhaW5lcn0pO1xuXG5cbmNvbnN0IGRlc2NyaXB0aW9uQ29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Rlc2NyaXB0aW9uLWNvbnRhaW5lcicpO1xudGJvZHkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudCA9PiB7XG5cbiAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0O1xuXG4gICAgbGV0IHRyID0gdGFyZ2V0LmNsb3Nlc3QoJ3RyJyk7XG4gICAgaWYgKCF0cikgcmV0dXJuO1xuICAgIGlmICghdGJvZHkuY29udGFpbnModHIpKSByZXR1cm47XG5cbiAgICBsZXQgZGF0YUluZGV4ID0gdHIuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4Jyk7XG5cbiAgICBpZiAoZGF0YUluZGV4ICYmIGRhdGFbZGF0YUluZGV4XSkge1xuICAgICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgZGVzY3JpcHRpb25Db250YWluZXIuYXBwZW5kQ2hpbGQoZGVzY3JpcHRpb24oZGF0YVtkYXRhSW5kZXhdKSk7XG4gICAgfVxufSk7XG5cblxudGFibGVDb21wb25lbnQub25EaXNwbGF5Q2hhbmdlKGRpc3BsYXllZCA9PiB7XG5cbiAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcblxuICAgIHRib2R5LmlubmVySFRNTCA9ICcnO1xuICAgIGZvciAobGV0IHIgb2YgZGlzcGxheWVkKSB7XG4gICAgICAgIGNvbnN0IG5ld0NoaWxkID0gcm93KHIudmFsdWUsIHIuaW5kZXgsIHQpO1xuICAgICAgICB0Ym9keS5hcHBlbmRDaGlsZChuZXdDaGlsZCk7XG4gICAgfVxufSk7Il0sIm5hbWVzIjpbInBvaW50ZXIiLCJmaWx0ZXIiLCJzb3J0RmFjdG9yeSIsInNvcnQiLCJzZWFyY2giLCJ0YWJsZSIsImV4ZWN1dGlvbkxpc3RlbmVyIiwic3VtbWFyeURpcmVjdGl2ZSIsInRhYmxlRGlyZWN0aXZlIiwic3VtbWFyeSIsInBhZ2luYXRpb24iXSwibWFwcGluZ3MiOiI7OztBQUFPLFNBQVMsSUFBSSxFQUFFLENBQUMsRUFBRTtFQUN2QixPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQzFCOztBQUVELEFBQU8sU0FBUyxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxFQUFFO0VBQ3RDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztDQUMxRjs7QUFFRCxBQUFPLFNBQVMsS0FBSyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUU7RUFDcEMsTUFBTSxLQUFLLEdBQUcsU0FBUyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUM7RUFDckMsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLO0lBQ2xCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO0lBQ25DLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtNQUN2QixPQUFPLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0tBQ3BCLE1BQU07TUFDTCxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsUUFBUSxLQUFLLEVBQUUsQ0FBQyxHQUFHLElBQUks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
