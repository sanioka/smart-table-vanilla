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

// import filter from './filters';
// import searchInput from './search';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtb3BlcmF0b3JzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zb3J0L2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWZpbHRlci9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1zZWFyY2gvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtZXZlbnRzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2V2ZW50cy5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL3RhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2VhcmNoLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc2xpY2UuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9zcmMvZGlyZWN0aXZlcy9zb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtYXJ0LXRhYmxlLWNvcmUvc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zbWFydC10YWJsZS1jb3JlL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3IuanMiLCIuLi9ub2RlX21vZHVsZXMvc21hcnQtdGFibGUtY29yZS9pbmRleC5qcyIsIi4uL2xpYi9sb2FkaW5nSW5kaWNhdG9yLmpzIiwiLi4vbGliL3NvcnQuanMiLCIuLi9saWIvc2VhcmNoRm9ybS5qcyIsIi4uL2xpYi90YWJsZS5qcyIsImNvbXBvbmVudHMvcm93LmpzIiwiY29tcG9uZW50cy9zdW1tYXJ5LmpzIiwiY29tcG9uZW50cy9wYWdpbmF0aW9uLmpzIiwiY29tcG9uZW50cy9kZXNjcmlwdGlvbi5qcyIsImRhdGFMb2FkZXIuanMiLCJpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gc3dhcCAoZikge1xuICByZXR1cm4gKGEsIGIpID0+IGYoYiwgYSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb3NlIChmaXJzdCwgLi4uZm5zKSB7XG4gIHJldHVybiAoLi4uYXJncykgPT4gZm5zLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQocHJldmlvdXMpLCBmaXJzdCguLi5hcmdzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeSAoZm4sIGFyaXR5TGVmdCkge1xuICBjb25zdCBhcml0eSA9IGFyaXR5TGVmdCB8fCBmbi5sZW5ndGg7XG4gIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgIGNvbnN0IGFyZ0xlbmd0aCA9IGFyZ3MubGVuZ3RoIHx8IDE7XG4gICAgaWYgKGFyaXR5ID09PSBhcmdMZW5ndGgpIHtcbiAgICAgIHJldHVybiBmbiguLi5hcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZnVuYyA9ICguLi5tb3JlQXJncykgPT4gZm4oLi4uYXJncywgLi4ubW9yZUFyZ3MpO1xuICAgICAgcmV0dXJuIGN1cnJ5KGZ1bmMsIGFyaXR5IC0gYXJncy5sZW5ndGgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5IChmbikge1xuICByZXR1cm4gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGFwIChmbikge1xuICByZXR1cm4gYXJnID0+IHtcbiAgICBmbihhcmcpO1xuICAgIHJldHVybiBhcmc7XG4gIH1cbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwb2ludGVyIChwYXRoKSB7XG5cbiAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cbiAgZnVuY3Rpb24gcGFydGlhbCAob2JqID0ge30sIHBhcnRzID0gW10pIHtcbiAgICBjb25zdCBwID0gcGFydHMuc2hpZnQoKTtcbiAgICBjb25zdCBjdXJyZW50ID0gb2JqW3BdO1xuICAgIHJldHVybiAoY3VycmVudCA9PT0gdW5kZWZpbmVkIHx8IHBhcnRzLmxlbmd0aCA9PT0gMCkgP1xuICAgICAgY3VycmVudCA6IHBhcnRpYWwoY3VycmVudCwgcGFydHMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0ICh0YXJnZXQsIG5ld1RyZWUpIHtcbiAgICBsZXQgY3VycmVudCA9IHRhcmdldDtcbiAgICBjb25zdCBbbGVhZiwgLi4uaW50ZXJtZWRpYXRlXSA9IHBhcnRzLnJldmVyc2UoKTtcbiAgICBmb3IgKGxldCBrZXkgb2YgaW50ZXJtZWRpYXRlLnJldmVyc2UoKSkge1xuICAgICAgaWYgKGN1cnJlbnRba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN1cnJlbnRba2V5XSA9IHt9O1xuICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICBjdXJyZW50W2xlYWZdID0gT2JqZWN0LmFzc2lnbihjdXJyZW50W2xlYWZdIHx8IHt9LCBuZXdUcmVlKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXQodGFyZ2V0KXtcbiAgICAgIHJldHVybiBwYXJ0aWFsKHRhcmdldCwgWy4uLnBhcnRzXSlcbiAgICB9LFxuICAgIHNldFxuICB9XG59O1xuIiwiaW1wb3J0IHtzd2FwfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuXG5mdW5jdGlvbiBzb3J0QnlQcm9wZXJ0eSAocHJvcCkge1xuICBjb25zdCBwcm9wR2V0dGVyID0gcG9pbnRlcihwcm9wKS5nZXQ7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGNvbnN0IGFWYWwgPSBwcm9wR2V0dGVyKGEpO1xuICAgIGNvbnN0IGJWYWwgPSBwcm9wR2V0dGVyKGIpO1xuXG4gICAgaWYgKGFWYWwgPT09IGJWYWwpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmIChiVmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICBpZiAoYVZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAtMSA6IDE7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEZhY3RvcnkgKHtwb2ludGVyLCBkaXJlY3Rpb259ID0ge30pIHtcbiAgaWYgKCFwb2ludGVyIHx8IGRpcmVjdGlvbiA9PT0gJ25vbmUnKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IFsuLi5hcnJheV07XG4gIH1cblxuICBjb25zdCBvcmRlckZ1bmMgPSBzb3J0QnlQcm9wZXJ0eShwb2ludGVyKTtcbiAgY29uc3QgY29tcGFyZUZ1bmMgPSBkaXJlY3Rpb24gPT09ICdkZXNjJyA/IHN3YXAob3JkZXJGdW5jKSA6IG9yZGVyRnVuYztcblxuICByZXR1cm4gKGFycmF5KSA9PiBbLi4uYXJyYXldLnNvcnQoY29tcGFyZUZ1bmMpO1xufSIsImltcG9ydCB7Y29tcG9zZX0gZnJvbSAnc21hcnQtdGFibGUtb3BlcmF0b3JzJztcbmltcG9ydCBwb2ludGVyIGZyb20gJ3NtYXJ0LXRhYmxlLWpzb24tcG9pbnRlcic7XG5cbmZ1bmN0aW9uIHR5cGVFeHByZXNzaW9uICh0eXBlKSB7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIEJvb2xlYW47XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBOdW1iZXI7XG4gICAgY2FzZSAnZGF0ZSc6XG4gICAgICByZXR1cm4gKHZhbCkgPT4gbmV3IERhdGUodmFsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGNvbXBvc2UoU3RyaW5nLCAodmFsKSA9PiB2YWwudG9Mb3dlckNhc2UoKSk7XG4gIH1cbn1cblxuY29uc3Qgb3BlcmF0b3JzID0ge1xuICBpbmNsdWRlcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQuaW5jbHVkZXModmFsdWUpO1xuICB9LFxuICBpcyh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGlzTm90KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiAhT2JqZWN0LmlzKHZhbHVlLCBpbnB1dCk7XG4gIH0sXG4gIGx0KHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8IHZhbHVlO1xuICB9LFxuICBndCh2YWx1ZSl7XG4gICAgcmV0dXJuIChpbnB1dCkgPT4gaW5wdXQgPiB2YWx1ZTtcbiAgfSxcbiAgbHRlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA8PSB2YWx1ZTtcbiAgfSxcbiAgZ3RlKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiBpbnB1dCA+PSB2YWx1ZTtcbiAgfSxcbiAgZXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSA9PSBpbnB1dDtcbiAgfSxcbiAgbm90RXF1YWxzKHZhbHVlKXtcbiAgICByZXR1cm4gKGlucHV0KSA9PiB2YWx1ZSAhPSBpbnB1dDtcbiAgfVxufTtcblxuY29uc3QgZXZlcnkgPSBmbnMgPT4gKC4uLmFyZ3MpID0+IGZucy5ldmVyeShmbiA9PiBmbiguLi5hcmdzKSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVkaWNhdGUgKHt2YWx1ZSA9ICcnLCBvcGVyYXRvciA9ICdpbmNsdWRlcycsIHR5cGUgPSAnc3RyaW5nJ30pIHtcbiAgY29uc3QgdHlwZUl0ID0gdHlwZUV4cHJlc3Npb24odHlwZSk7XG4gIGNvbnN0IG9wZXJhdGVPblR5cGVkID0gY29tcG9zZSh0eXBlSXQsIG9wZXJhdG9yc1tvcGVyYXRvcl0pO1xuICBjb25zdCBwcmVkaWNhdGVGdW5jID0gb3BlcmF0ZU9uVHlwZWQodmFsdWUpO1xuICByZXR1cm4gY29tcG9zZSh0eXBlSXQsIHByZWRpY2F0ZUZ1bmMpO1xufVxuXG4vL2F2b2lkIHVzZWxlc3MgZmlsdGVyIGxvb2t1cCAoaW1wcm92ZSBwZXJmKVxuZnVuY3Rpb24gbm9ybWFsaXplQ2xhdXNlcyAoY29uZikge1xuICBjb25zdCBvdXRwdXQgPSB7fTtcbiAgY29uc3QgdmFsaWRQYXRoID0gT2JqZWN0LmtleXMoY29uZikuZmlsdGVyKHBhdGggPT4gQXJyYXkuaXNBcnJheShjb25mW3BhdGhdKSk7XG4gIHZhbGlkUGF0aC5mb3JFYWNoKHBhdGggPT4ge1xuICAgIGNvbnN0IHZhbGlkQ2xhdXNlcyA9IGNvbmZbcGF0aF0uZmlsdGVyKGMgPT4gYy52YWx1ZSAhPT0gJycpO1xuICAgIGlmICh2YWxpZENsYXVzZXMubGVuZ3RoKSB7XG4gICAgICBvdXRwdXRbcGF0aF0gPSB2YWxpZENsYXVzZXM7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmlsdGVyIChmaWx0ZXIpIHtcbiAgY29uc3Qgbm9ybWFsaXplZENsYXVzZXMgPSBub3JtYWxpemVDbGF1c2VzKGZpbHRlcik7XG4gIGNvbnN0IGZ1bmNMaXN0ID0gT2JqZWN0LmtleXMobm9ybWFsaXplZENsYXVzZXMpLm1hcChwYXRoID0+IHtcbiAgICBjb25zdCBnZXR0ZXIgPSBwb2ludGVyKHBhdGgpLmdldDtcbiAgICBjb25zdCBjbGF1c2VzID0gbm9ybWFsaXplZENsYXVzZXNbcGF0aF0ubWFwKHByZWRpY2F0ZSk7XG4gICAgcmV0dXJuIGNvbXBvc2UoZ2V0dGVyLCBldmVyeShjbGF1c2VzKSk7XG4gIH0pO1xuICBjb25zdCBmaWx0ZXJQcmVkaWNhdGUgPSBldmVyeShmdW5jTGlzdCk7XG5cbiAgcmV0dXJuIChhcnJheSkgPT4gYXJyYXkuZmlsdGVyKGZpbHRlclByZWRpY2F0ZSk7XG59IiwiaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHNlYXJjaENvbmYgPSB7fSkge1xuICBjb25zdCB7dmFsdWUsIHNjb3BlID0gW119ID0gc2VhcmNoQ29uZjtcbiAgY29uc3Qgc2VhcmNoUG9pbnRlcnMgPSBzY29wZS5tYXAoZmllbGQgPT4gcG9pbnRlcihmaWVsZCkuZ2V0KTtcbiAgaWYgKCFzY29wZS5sZW5ndGggfHwgIXZhbHVlKSB7XG4gICAgcmV0dXJuIGFycmF5ID0+IGFycmF5O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBhcnJheSA9PiBhcnJheS5maWx0ZXIoaXRlbSA9PiBzZWFyY2hQb2ludGVycy5zb21lKHAgPT4gU3RyaW5nKHAoaXRlbSkpLmluY2x1ZGVzKFN0cmluZyh2YWx1ZSkpKSlcbiAgfVxufSIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNsaWNlRmFjdG9yeSAoe3BhZ2UgPSAxLCBzaXplfSA9IHt9KSB7XG4gIHJldHVybiBmdW5jdGlvbiBzbGljZUZ1bmN0aW9uIChhcnJheSA9IFtdKSB7XG4gICAgY29uc3QgYWN0dWFsU2l6ZSA9IHNpemUgfHwgYXJyYXkubGVuZ3RoO1xuICAgIGNvbnN0IG9mZnNldCA9IChwYWdlIC0gMSkgKiBhY3R1YWxTaXplO1xuICAgIHJldHVybiBhcnJheS5zbGljZShvZmZzZXQsIG9mZnNldCArIGFjdHVhbFNpemUpO1xuICB9O1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGVtaXR0ZXIgKCkge1xuXG4gIGNvbnN0IGxpc3RlbmVyc0xpc3RzID0ge307XG4gIGNvbnN0IGluc3RhbmNlID0ge1xuICAgIG9uKGV2ZW50LCAuLi5saXN0ZW5lcnMpe1xuICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gKGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXSkuY29uY2F0KGxpc3RlbmVycyk7XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBkaXNwYXRjaChldmVudCwgLi4uYXJncyl7XG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNMaXN0c1tldmVudF0gfHwgW107XG4gICAgICBmb3IgKGxldCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgbGlzdGVuZXIoLi4uYXJncyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSxcbiAgICBvZmYoZXZlbnQsIC4uLmxpc3RlbmVycyl7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGxpc3RlbmVyc0xpc3RzKS5mb3JFYWNoKGV2ID0+IGluc3RhbmNlLm9mZihldikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IGxpc3RlbmVyc0xpc3RzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzTGlzdHNbZXZlbnRdID0gbGlzdGVuZXJzLmxlbmd0aCA/IGxpc3QuZmlsdGVyKGxpc3RlbmVyID0+ICFsaXN0ZW5lcnMuaW5jbHVkZXMobGlzdGVuZXIpKSA6IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJveHlMaXN0ZW5lciAoZXZlbnRNYXApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh7ZW1pdHRlcn0pIHtcblxuICAgIGNvbnN0IHByb3h5ID0ge307XG4gICAgbGV0IGV2ZW50TGlzdGVuZXJzID0ge307XG5cbiAgICBmb3IgKGxldCBldiBvZiBPYmplY3Qua2V5cyhldmVudE1hcCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50TWFwW2V2XTtcbiAgICAgIGV2ZW50TGlzdGVuZXJzW2V2XSA9IFtdO1xuICAgICAgcHJveHlbbWV0aG9kXSA9IGZ1bmN0aW9uICguLi5saXN0ZW5lcnMpIHtcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZdID0gZXZlbnRMaXN0ZW5lcnNbZXZdLmNvbmNhdChsaXN0ZW5lcnMpO1xuICAgICAgICBlbWl0dGVyLm9uKGV2LCAuLi5saXN0ZW5lcnMpO1xuICAgICAgICByZXR1cm4gcHJveHk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHByb3h5LCB7XG4gICAgICBvZmYoZXYpe1xuICAgICAgICBpZiAoIWV2KSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpLmZvckVhY2goZXZlbnROYW1lID0+IHByb3h5Lm9mZihldmVudE5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZdKSB7XG4gICAgICAgICAgZW1pdHRlci5vZmYoZXYsIC4uLmV2ZW50TGlzdGVuZXJzW2V2XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3h5O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59IiwiZXhwb3J0IGNvbnN0IFRPR0dMRV9TT1JUID0gJ1RPR0dMRV9TT1JUJztcbmV4cG9ydCBjb25zdCBESVNQTEFZX0NIQU5HRUQgPSAnRElTUExBWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBQQUdFX0NIQU5HRUQgPSAnQ0hBTkdFX1BBR0UnO1xuZXhwb3J0IGNvbnN0IEVYRUNfQ0hBTkdFRCA9ICdFWEVDX0NIQU5HRUQnO1xuZXhwb3J0IGNvbnN0IEZJTFRFUl9DSEFOR0VEID0gJ0ZJTFRFUl9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTVU1NQVJZX0NIQU5HRUQgPSAnU1VNTUFSWV9DSEFOR0VEJztcbmV4cG9ydCBjb25zdCBTRUFSQ0hfQ0hBTkdFRCA9ICdTRUFSQ0hfQ0hBTkdFRCc7XG5leHBvcnQgY29uc3QgRVhFQ19FUlJPUiA9ICdFWEVDX0VSUk9SJzsiLCJpbXBvcnQgc2xpY2UgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtjdXJyeSwgdGFwLCBjb21wb3NlfSBmcm9tICdzbWFydC10YWJsZS1vcGVyYXRvcnMnO1xuaW1wb3J0IHBvaW50ZXIgZnJvbSAnc21hcnQtdGFibGUtanNvbi1wb2ludGVyJztcbmltcG9ydCB7ZW1pdHRlcn0gZnJvbSAnc21hcnQtdGFibGUtZXZlbnRzJztcbmltcG9ydCBzbGljZUZhY3RvcnkgZnJvbSAnLi4vc2xpY2UnO1xuaW1wb3J0IHtcbiAgU1VNTUFSWV9DSEFOR0VELFxuICBUT0dHTEVfU09SVCxcbiAgRElTUExBWV9DSEFOR0VELFxuICBQQUdFX0NIQU5HRUQsXG4gIEVYRUNfQ0hBTkdFRCxcbiAgRklMVEVSX0NIQU5HRUQsXG4gIFNFQVJDSF9DSEFOR0VELFxuICBFWEVDX0VSUk9SXG59IGZyb20gJy4uL2V2ZW50cyc7XG5cbmZ1bmN0aW9uIGN1cnJpZWRQb2ludGVyIChwYXRoKSB7XG4gIGNvbnN0IHtnZXQsIHNldH0gPSBwb2ludGVyKHBhdGgpO1xuICByZXR1cm4ge2dldCwgc2V0OiBjdXJyeShzZXQpfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtcbiAgc29ydEZhY3RvcnksXG4gIHRhYmxlU3RhdGUsXG4gIGRhdGEsXG4gIGZpbHRlckZhY3RvcnksXG4gIHNlYXJjaEZhY3Rvcnlcbn0pIHtcbiAgY29uc3QgdGFibGUgPSBlbWl0dGVyKCk7XG4gIGNvbnN0IHNvcnRQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NvcnQnKTtcbiAgY29uc3Qgc2xpY2VQb2ludGVyID0gY3VycmllZFBvaW50ZXIoJ3NsaWNlJyk7XG4gIGNvbnN0IGZpbHRlclBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignZmlsdGVyJyk7XG4gIGNvbnN0IHNlYXJjaFBvaW50ZXIgPSBjdXJyaWVkUG9pbnRlcignc2VhcmNoJyk7XG5cbiAgY29uc3Qgc2FmZUFzc2lnbiA9IGN1cnJ5KChiYXNlLCBleHRlbnNpb24pID0+IE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIGV4dGVuc2lvbikpO1xuICBjb25zdCBkaXNwYXRjaCA9IGN1cnJ5KHRhYmxlLmRpc3BhdGNoLmJpbmQodGFibGUpLCAyKTtcblxuICBjb25zdCBkaXNwYXRjaFN1bW1hcnkgPSAoZmlsdGVyZWQpID0+IHtcbiAgICBkaXNwYXRjaChTVU1NQVJZX0NIQU5HRUQsIHtcbiAgICAgIHBhZ2U6IHRhYmxlU3RhdGUuc2xpY2UucGFnZSxcbiAgICAgIHNpemU6IHRhYmxlU3RhdGUuc2xpY2Uuc2l6ZSxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IGZpbHRlcmVkLmxlbmd0aFxuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGV4ZWMgPSAoe3Byb2Nlc3NpbmdEZWxheSA9IDIwfSA9IHt9KSA9PiB7XG4gICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogdHJ1ZX0pO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsdGVyRnVuYyA9IGZpbHRlckZhY3RvcnkoZmlsdGVyUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldCh0YWJsZVN0YXRlKSk7XG4gICAgICAgIGNvbnN0IHNvcnRGdW5jID0gc29ydEZhY3Rvcnkoc29ydFBvaW50ZXIuZ2V0KHRhYmxlU3RhdGUpKTtcbiAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQodGFibGVTdGF0ZSkpO1xuICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgdGFwKGRpc3BhdGNoU3VtbWFyeSksIHNvcnRGdW5jLCBzbGljZUZ1bmMpO1xuICAgICAgICBjb25zdCBkaXNwbGF5ZWQgPSBleGVjRnVuYyhkYXRhKTtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRElTUExBWV9DSEFOR0VELCBkaXNwbGF5ZWQubWFwKGQgPT4ge1xuICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9O1xuICAgICAgICB9KSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRhYmxlLmRpc3BhdGNoKEVYRUNfRVJST1IsIGUpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgdGFibGUuZGlzcGF0Y2goRVhFQ19DSEFOR0VELCB7d29ya2luZzogZmFsc2V9KTtcbiAgICAgIH1cbiAgICB9LCBwcm9jZXNzaW5nRGVsYXkpO1xuICB9O1xuXG4gIGNvbnN0IHVwZGF0ZVRhYmxlU3RhdGUgPSBjdXJyeSgocHRlciwgZXYsIG5ld1BhcnRpYWxTdGF0ZSkgPT4gY29tcG9zZShcbiAgICBzYWZlQXNzaWduKHB0ZXIuZ2V0KHRhYmxlU3RhdGUpKSxcbiAgICB0YXAoZGlzcGF0Y2goZXYpKSxcbiAgICBwdGVyLnNldCh0YWJsZVN0YXRlKVxuICApKG5ld1BhcnRpYWxTdGF0ZSkpO1xuXG4gIGNvbnN0IHJlc2V0VG9GaXJzdFBhZ2UgPSAoKSA9PiB1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VELCB7cGFnZTogMX0pO1xuXG4gIGNvbnN0IHRhYmxlT3BlcmF0aW9uID0gKHB0ZXIsIGV2KSA9PiBjb21wb3NlKFxuICAgIHVwZGF0ZVRhYmxlU3RhdGUocHRlciwgZXYpLFxuICAgIHJlc2V0VG9GaXJzdFBhZ2UsXG4gICAgKCkgPT4gdGFibGUuZXhlYygpIC8vIHdlIHdyYXAgd2l0aGluIGEgZnVuY3Rpb24gc28gdGFibGUuZXhlYyBjYW4gYmUgb3ZlcndyaXR0ZW4gKHdoZW4gdXNpbmcgd2l0aCBhIHNlcnZlciBmb3IgZXhhbXBsZSlcbiAgKTtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc29ydDogdGFibGVPcGVyYXRpb24oc29ydFBvaW50ZXIsIFRPR0dMRV9TT1JUKSxcbiAgICBmaWx0ZXI6IHRhYmxlT3BlcmF0aW9uKGZpbHRlclBvaW50ZXIsIEZJTFRFUl9DSEFOR0VEKSxcbiAgICBzZWFyY2g6IHRhYmxlT3BlcmF0aW9uKHNlYXJjaFBvaW50ZXIsIFNFQVJDSF9DSEFOR0VEKSxcbiAgICBzbGljZTogY29tcG9zZSh1cGRhdGVUYWJsZVN0YXRlKHNsaWNlUG9pbnRlciwgUEFHRV9DSEFOR0VEKSwgKCkgPT4gdGFibGUuZXhlYygpKSxcbiAgICBleGVjLFxuICAgIGV2YWwoc3RhdGUgPSB0YWJsZVN0YXRlKXtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY29uc3Qgc29ydEZ1bmMgPSBzb3J0RmFjdG9yeShzb3J0UG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBzZWFyY2hGdW5jID0gc2VhcmNoRmFjdG9yeShzZWFyY2hQb2ludGVyLmdldChzdGF0ZSkpO1xuICAgICAgICAgIGNvbnN0IGZpbHRlckZ1bmMgPSBmaWx0ZXJGYWN0b3J5KGZpbHRlclBvaW50ZXIuZ2V0KHN0YXRlKSk7XG4gICAgICAgICAgY29uc3Qgc2xpY2VGdW5jID0gc2xpY2VGYWN0b3J5KHNsaWNlUG9pbnRlci5nZXQoc3RhdGUpKTtcbiAgICAgICAgICBjb25zdCBleGVjRnVuYyA9IGNvbXBvc2UoZmlsdGVyRnVuYywgc2VhcmNoRnVuYywgc29ydEZ1bmMsIHNsaWNlRnVuYyk7XG4gICAgICAgICAgcmV0dXJuIGV4ZWNGdW5jKGRhdGEpLm1hcChkID0+IHtcbiAgICAgICAgICAgIHJldHVybiB7aW5kZXg6IGRhdGEuaW5kZXhPZihkKSwgdmFsdWU6IGR9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgb25EaXNwbGF5Q2hhbmdlKGZuKXtcbiAgICAgIHRhYmxlLm9uKERJU1BMQVlfQ0hBTkdFRCwgZm4pO1xuICAgIH0sXG4gICAgZ2V0VGFibGVTdGF0ZSgpe1xuICAgICAgY29uc3Qgc29ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc29ydCk7XG4gICAgICBjb25zdCBzZWFyY2ggPSBPYmplY3QuYXNzaWduKHt9LCB0YWJsZVN0YXRlLnNlYXJjaCk7XG4gICAgICBjb25zdCBzbGljZSA9IE9iamVjdC5hc3NpZ24oe30sIHRhYmxlU3RhdGUuc2xpY2UpO1xuICAgICAgY29uc3QgZmlsdGVyID0ge307XG4gICAgICBmb3IgKGxldCBwcm9wIGluIHRhYmxlU3RhdGUuZmlsdGVyKSB7XG4gICAgICAgIGZpbHRlcltwcm9wXSA9IHRhYmxlU3RhdGUuZmlsdGVyW3Byb3BdLm1hcCh2ID0+IE9iamVjdC5hc3NpZ24oe30sIHYpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7c29ydCwgc2VhcmNoLCBzbGljZSwgZmlsdGVyfTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaW5zdGFuY2UgPSBPYmplY3QuYXNzaWduKHRhYmxlLCBhcGkpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbnN0YW5jZSwgJ2xlbmd0aCcsIHtcbiAgICBnZXQoKXtcbiAgICAgIHJldHVybiBkYXRhLmxlbmd0aDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn0iLCJpbXBvcnQgc29ydCBmcm9tICdzbWFydC10YWJsZS1zb3J0JztcbmltcG9ydCBmaWx0ZXIgZnJvbSAnc21hcnQtdGFibGUtZmlsdGVyJztcbmltcG9ydCBzZWFyY2ggZnJvbSAnc21hcnQtdGFibGUtc2VhcmNoJztcbmltcG9ydCB0YWJsZSBmcm9tICcuL2RpcmVjdGl2ZXMvdGFibGUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe1xuICBzb3J0RmFjdG9yeSA9IHNvcnQsXG4gIGZpbHRlckZhY3RvcnkgPSBmaWx0ZXIsXG4gIHNlYXJjaEZhY3RvcnkgPSBzZWFyY2gsXG4gIHRhYmxlU3RhdGUgPSB7c29ydDoge30sIHNsaWNlOiB7cGFnZTogMX0sIGZpbHRlcjoge30sIHNlYXJjaDoge319LFxuICBkYXRhID0gW11cbn0sIC4uLnRhYmxlRGlyZWN0aXZlcykge1xuXG4gIGNvbnN0IGNvcmVUYWJsZSA9IHRhYmxlKHtzb3J0RmFjdG9yeSwgZmlsdGVyRmFjdG9yeSwgdGFibGVTdGF0ZSwgZGF0YSwgc2VhcmNoRmFjdG9yeX0pO1xuXG4gIHJldHVybiB0YWJsZURpcmVjdGl2ZXMucmVkdWNlKChhY2N1bXVsYXRvciwgbmV3ZGlyKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oYWNjdW11bGF0b3IsIG5ld2Rpcih7XG4gICAgICBzb3J0RmFjdG9yeSxcbiAgICAgIGZpbHRlckZhY3RvcnksXG4gICAgICBzZWFyY2hGYWN0b3J5LFxuICAgICAgdGFibGVTdGF0ZSxcbiAgICAgIGRhdGEsXG4gICAgICB0YWJsZTogY29yZVRhYmxlXG4gICAgfSkpO1xuICB9LCBjb3JlVGFibGUpO1xufSIsImltcG9ydCB7U0VBUkNIX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNlYXJjaExpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NFQVJDSF9DSEFOR0VEXTogJ29uU2VhcmNoQ2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlLCBzY29wZSA9IFtdfSkge1xuICByZXR1cm4gT2JqZWN0LmFzc2lnbihcbiAgICBzZWFyY2hMaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KSwge1xuICAgICAgc2VhcmNoKGlucHV0KXtcbiAgICAgICAgcmV0dXJuIHRhYmxlLnNlYXJjaCh7dmFsdWU6IGlucHV0LCBzY29wZX0pO1xuICAgICAgfVxuICAgIH0pO1xufSIsImltcG9ydCB7UEFHRV9DSEFOR0VELCBTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNsaWNlTGlzdGVuZXIgPSBwcm94eUxpc3RlbmVyKHtbUEFHRV9DSEFOR0VEXTogJ29uUGFnZUNoYW5nZScsIFtTVU1NQVJZX0NIQU5HRURdOiAnb25TdW1tYXJ5Q2hhbmdlJ30pO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe3RhYmxlfSkge1xuICBsZXQge3NsaWNlOntwYWdlOmN1cnJlbnRQYWdlLCBzaXplOmN1cnJlbnRTaXplfX0gPSB0YWJsZS5nZXRUYWJsZVN0YXRlKCk7XG4gIGxldCBpdGVtTGlzdExlbmd0aCA9IHRhYmxlLmxlbmd0aDtcblxuICBjb25zdCBhcGkgPSB7XG4gICAgc2VsZWN0UGFnZShwKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogcCwgc2l6ZTogY3VycmVudFNpemV9KTtcbiAgICB9LFxuICAgIHNlbGVjdE5leHRQYWdlKCl7XG4gICAgICByZXR1cm4gYXBpLnNlbGVjdFBhZ2UoY3VycmVudFBhZ2UgKyAxKTtcbiAgICB9LFxuICAgIHNlbGVjdFByZXZpb3VzUGFnZSgpe1xuICAgICAgcmV0dXJuIGFwaS5zZWxlY3RQYWdlKGN1cnJlbnRQYWdlIC0gMSk7XG4gICAgfSxcbiAgICBjaGFuZ2VQYWdlU2l6ZShzaXplKXtcbiAgICAgIHJldHVybiB0YWJsZS5zbGljZSh7cGFnZTogMSwgc2l6ZX0pO1xuICAgIH0sXG4gICAgaXNQcmV2aW91c1BhZ2VFbmFibGVkKCl7XG4gICAgICByZXR1cm4gY3VycmVudFBhZ2UgPiAxO1xuICAgIH0sXG4gICAgaXNOZXh0UGFnZUVuYWJsZWQoKXtcbiAgICAgIHJldHVybiBNYXRoLmNlaWwoaXRlbUxpc3RMZW5ndGggLyBjdXJyZW50U2l6ZSkgPiBjdXJyZW50UGFnZTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGRpcmVjdGl2ZSA9IE9iamVjdC5hc3NpZ24oYXBpLCBzbGljZUxpc3RlbmVyKHtlbWl0dGVyOiB0YWJsZX0pKTtcblxuICBkaXJlY3RpdmUub25TdW1tYXJ5Q2hhbmdlKCh7cGFnZTpwLCBzaXplOnMsIGZpbHRlcmVkQ291bnR9KSA9PiB7XG4gICAgY3VycmVudFBhZ2UgPSBwO1xuICAgIGN1cnJlbnRTaXplID0gcztcbiAgICBpdGVtTGlzdExlbmd0aCA9IGZpbHRlcmVkQ291bnQ7XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59XG4iLCJpbXBvcnQge1RPR0dMRV9TT1JUfSBmcm9tICcuLi9ldmVudHMnXG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IHNvcnRMaXN0ZW5lcnMgPSBwcm94eUxpc3RlbmVyKHtbVE9HR0xFX1NPUlRdOiAnb25Tb3J0VG9nZ2xlJ30pO1xuY29uc3QgZGlyZWN0aW9ucyA9IFsnYXNjJywgJ2Rlc2MnXTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtwb2ludGVyLCB0YWJsZSwgY3ljbGUgPSBmYWxzZX0pIHtcblxuICBjb25zdCBjeWNsZURpcmVjdGlvbnMgPSBjeWNsZSA9PT0gdHJ1ZSA/IFsnbm9uZSddLmNvbmNhdChkaXJlY3Rpb25zKSA6IFsuLi5kaXJlY3Rpb25zXS5yZXZlcnNlKCk7XG5cbiAgbGV0IGhpdCA9IDA7XG5cbiAgY29uc3QgZGlyZWN0aXZlID0gT2JqZWN0LmFzc2lnbih7XG4gICAgdG9nZ2xlKCl7XG4gICAgICBoaXQrKztcbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IGN5Y2xlRGlyZWN0aW9uc1toaXQgJSBjeWNsZURpcmVjdGlvbnMubGVuZ3RoXTtcbiAgICAgIHJldHVybiB0YWJsZS5zb3J0KHtwb2ludGVyLCBkaXJlY3Rpb259KTtcbiAgICB9XG5cbiAgfSwgc29ydExpc3RlbmVycyh7ZW1pdHRlcjogdGFibGV9KSk7XG5cbiAgZGlyZWN0aXZlLm9uU29ydFRvZ2dsZSgoe3BvaW50ZXI6cH0pID0+IHtcbiAgICBpZiAocG9pbnRlciAhPT0gcCkge1xuICAgICAgaGl0ID0gMDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkaXJlY3RpdmU7XG59IiwiaW1wb3J0IHtTVU1NQVJZX0NIQU5HRUR9IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge3Byb3h5TGlzdGVuZXJ9IGZyb20gJ3NtYXJ0LXRhYmxlLWV2ZW50cyc7XG5cbmNvbnN0IGV4ZWN1dGlvbkxpc3RlbmVyID0gcHJveHlMaXN0ZW5lcih7W1NVTU1BUllfQ0hBTkdFRF06ICdvblN1bW1hcnlDaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB7RVhFQ19DSEFOR0VEfSBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtwcm94eUxpc3RlbmVyfSBmcm9tICdzbWFydC10YWJsZS1ldmVudHMnO1xuXG5jb25zdCBleGVjdXRpb25MaXN0ZW5lciA9IHByb3h5TGlzdGVuZXIoe1tFWEVDX0NIQU5HRURdOiAnb25FeGVjdXRpb25DaGFuZ2UnfSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGV9KSB7XG4gIHJldHVybiBleGVjdXRpb25MaXN0ZW5lcih7ZW1pdHRlcjogdGFibGV9KTtcbn1cbiIsImltcG9ydCB0YWJsZURpcmVjdGl2ZSBmcm9tICcuL3NyYy90YWJsZSc7XG5pbXBvcnQgZmlsdGVyRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvZmlsdGVyJztcbmltcG9ydCBzZWFyY2hEaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zZWFyY2gnO1xuaW1wb3J0IHNsaWNlRGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc2xpY2UnO1xuaW1wb3J0IHNvcnREaXJlY3RpdmUgZnJvbSAnLi9zcmMvZGlyZWN0aXZlcy9zb3J0JztcbmltcG9ydCBzdW1tYXJ5RGlyZWN0aXZlIGZyb20gJy4vc3JjL2RpcmVjdGl2ZXMvc3VtbWFyeSc7XG5pbXBvcnQgd29ya2luZ0luZGljYXRvckRpcmVjdGl2ZSBmcm9tICcuL3NyYy9kaXJlY3RpdmVzL3dvcmtpbmdJbmRpY2F0b3InO1xuXG5leHBvcnQgY29uc3Qgc2VhcmNoID0gc2VhcmNoRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gc2xpY2VEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc3VtbWFyeSA9IHN1bW1hcnlEaXJlY3RpdmU7XG5leHBvcnQgY29uc3Qgc29ydCA9IHNvcnREaXJlY3RpdmU7XG5leHBvcnQgY29uc3QgZmlsdGVyID0gZmlsdGVyRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHdvcmtpbmdJbmRpY2F0b3IgPSB3b3JraW5nSW5kaWNhdG9yRGlyZWN0aXZlO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gdGFibGVEaXJlY3RpdmU7XG5leHBvcnQgZGVmYXVsdCB0YWJsZTtcbiIsImltcG9ydCB7d29ya2luZ0luZGljYXRvcn0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7dGFibGUsIGVsfSkge1xuICBjb25zdCBjb21wb25lbnQgPSB3b3JraW5nSW5kaWNhdG9yKHt0YWJsZX0pO1xuICBjb21wb25lbnQub25FeGVjdXRpb25DaGFuZ2UoZnVuY3Rpb24gKHt3b3JraW5nfSkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXdvcmtpbmcnKTtcbiAgICBpZiAod29ya2luZyA9PT0gdHJ1ZSkge1xuICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnc3Qtd29ya2luZycpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBjb21wb25lbnQ7XG59OyIsImltcG9ydCB7c29ydH0gZnJvbSAnc21hcnQtdGFibGUtY29yZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uICh7ZWwsIHRhYmxlLCBjb25mID0ge319KSB7XG4gIGNvbnN0IHBvaW50ZXIgPSBjb25mLnBvaW50ZXIgfHwgZWwuZ2V0QXR0cmlidXRlKCdkYXRhLXN0LXNvcnQnKTtcbiAgY29uc3QgY3ljbGUgPSBjb25mLmN5Y2xlIHx8IGVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1zdC1zb3J0LWN5Y2xlJyk7XG4gIGNvbnN0IGNvbXBvbmVudCA9IHNvcnQoe3BvaW50ZXIsIHRhYmxlLCBjeWNsZX0pO1xuICBjb21wb25lbnQub25Tb3J0VG9nZ2xlKCh7cG9pbnRlcjpjdXJyZW50UG9pbnRlciwgZGlyZWN0aW9ufSkgPT4ge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ3N0LXNvcnQtYXNjJywgJ3N0LXNvcnQtZGVzYycpO1xuICAgIGlmIChwb2ludGVyID09PSBjdXJyZW50UG9pbnRlciAmJiBkaXJlY3Rpb24gIT09ICdub25lJykge1xuICAgICAgY29uc3QgY2xhc3NOYW1lID0gZGlyZWN0aW9uID09PSAnYXNjJyA/ICdzdC1zb3J0LWFzYycgOiAnc3Qtc29ydC1kZXNjJztcbiAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICB9XG4gIH0pO1xuICBjb25zdCBldmVudExpc3RlbmVyID0gZXYgPT4gY29tcG9uZW50LnRvZ2dsZSgpO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50TGlzdGVuZXIpO1xuICByZXR1cm4gY29tcG9uZW50O1xufSIsImltcG9ydCB7c2VhcmNofSBmcm9tICdzbWFydC10YWJsZS1jb3JlJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGUsIGRlbGF5ID0gNDAwLCBjb25mID0ge319KSB7XG4gICAgY29uc3Qgc2NvcGUgPSBjb25mLnNjb3BlIHx8IChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3Qtc2VhcmNoLWZvcm0nKSB8fCAnJykuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gc2VhcmNoKHt0YWJsZSwgc2NvcGV9KTtcblxuICAgIGlmIChlbCkge1xuICAgICAgICBsZXQgaW5wdXQgPSBlbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5wdXQnKTtcbiAgICAgICAgbGV0IGJ1dHRvbiA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdidXR0b24nKTtcblxuICAgICAgICBpZiAoaW5wdXQgJiYgaW5wdXRbMF0gJiYgYnV0dG9uICYmIGJ1dHRvblswXSkge1xuICAgICAgICAgICAgYnV0dG9uWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZXZlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5zZWFyY2goaW5wdXRbMF0udmFsdWUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlucHV0WzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBldmVudCA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50ICYmIGV2ZW50LmtleUNvZGUgJiYgZXZlbnQua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNlYXJjaChpbnB1dFswXS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuXG4gICAgICAgIH1cbiAgICB9XG5cbn07IiwiaW1wb3J0IGxvYWRpbmcgZnJvbSAnLi9sb2FkaW5nSW5kaWNhdG9yJztcbmltcG9ydCBzb3J0IGZyb20gJy4vc29ydCc7XG4vLyBpbXBvcnQgZmlsdGVyIGZyb20gJy4vZmlsdGVycyc7XG4vLyBpbXBvcnQgc2VhcmNoSW5wdXQgZnJvbSAnLi9zZWFyY2gnO1xuaW1wb3J0IHNlYXJjaEZvcm0gZnJvbSAnLi9zZWFyY2hGb3JtJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKHtlbCwgdGFibGV9KSB7XG4gICAgLy8gYm9vdFxuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zb3J0XScpXS5mb3JFYWNoKGVsID0+IHNvcnQoe2VsLCB0YWJsZX0pKTtcbiAgICBbLi4uZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc3QtbG9hZGluZy1pbmRpY2F0b3JdJyldLmZvckVhY2goZWwgPT4gbG9hZGluZyh7ZWwsIHRhYmxlfSkpO1xuICAgIC8vIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1maWx0ZXJdJyldLmZvckVhY2goZWwgPT4gZmlsdGVyKHtlbCwgdGFibGV9KSk7XG4gICAgLy8gWy4uLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXN0LXNlYXJjaF0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hJbnB1dCh7ZWwsIHRhYmxlfSkpO1xuICAgIFsuLi5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zdC1zZWFyY2gtZm9ybV0nKV0uZm9yRWFjaChlbCA9PiBzZWFyY2hGb3JtKHtlbCwgdGFibGV9KSk7XG5cbiAgICAvL2V4dGVuc2lvblxuICAgIGNvbnN0IHRhYmxlRGlzcGxheUNoYW5nZSA9IHRhYmxlLm9uRGlzcGxheUNoYW5nZTtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YWJsZSwge1xuICAgICAgICBvbkRpc3BsYXlDaGFuZ2U6IChsaXN0ZW5lcikgPT4ge1xuICAgICAgICAgICAgdGFibGVEaXNwbGF5Q2hhbmdlKGxpc3RlbmVyKTtcbiAgICAgICAgICAgIHRhYmxlLmV4ZWMoKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTsiLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoe2lkLCBmaXJzdE5hbWUsIGxhc3ROYW1lLCBlbWFpbCwgcGhvbmV9LCBpbmRleCkge1xuICAgIGNvbnN0IHRyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKTtcbiAgICB0ci5zZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnLCBpbmRleCk7XG4gICAgdHIuaW5uZXJIVE1MID0gYDx0ZD4ke2lkfTwvdGQ+PHRkPiR7Zmlyc3ROYW1lfTwvdGQ+PHRkPiR7bGFzdE5hbWV9PC90ZD48dGQ+JHtlbWFpbH08L3RkPjx0ZD4ke3Bob25lfTwvdGQ+YDtcbiAgICByZXR1cm4gdHI7XG59IiwiaW1wb3J0IHtzdW1tYXJ5fSAgZnJvbSAnc21hcnQtdGFibGUtY29yZSdcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3VtbWFyeUNvbXBvbmVudCAoe3RhYmxlLCBlbH0pIHtcbiAgY29uc3QgZGlyID0gc3VtbWFyeSh7dGFibGV9KTtcbiAgZGlyLm9uU3VtbWFyeUNoYW5nZSgoe3BhZ2UsIHNpemUsIGZpbHRlcmVkQ291bnR9KSA9PiB7XG4gICAgZWwuaW5uZXJIVE1MID0gYHNob3dpbmcgaXRlbXMgPHN0cm9uZz4keyhwYWdlIC0gMSkgKiBzaXplICsgKGZpbHRlcmVkQ291bnQgPiAwID8gMSA6IDApfTwvc3Ryb25nPiAtIDxzdHJvbmc+JHtNYXRoLm1pbihmaWx0ZXJlZENvdW50LCBwYWdlICogc2l6ZSl9PC9zdHJvbmc+IG9mIDxzdHJvbmc+JHtmaWx0ZXJlZENvdW50fTwvc3Ryb25nPiBtYXRjaGluZyBpdGVtc2A7XG4gIH0pO1xuICByZXR1cm4gZGlyO1xufSIsImltcG9ydCB7c2xpY2V9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwYWdpbmF0aW9uQ29tcG9uZW50KHt0YWJsZSwgZWx9KSB7XG4gICAgY29uc3QgcHJldmlvdXNCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBwcmV2aW91c0J1dHRvbi5pbm5lckhUTUwgPSAnUHJldmlvdXMnO1xuICAgIGNvbnN0IG5leHRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBuZXh0QnV0dG9uLmlubmVySFRNTCA9ICdOZXh0JztcbiAgICBjb25zdCBwYWdlU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICBwYWdlU3Bhbi5pbm5lckhUTUwgPSAnLSBwYWdlIDEgLSc7XG5cbiAgICBjb25zdCBjb21wID0gc2xpY2Uoe3RhYmxlfSk7XG5cbiAgICBjb21wLm9uU3VtbWFyeUNoYW5nZSgoe3BhZ2V9KSA9PiB7XG4gICAgICAgIHByZXZpb3VzQnV0dG9uLmRpc2FibGVkID0gIWNvbXAuaXNQcmV2aW91c1BhZ2VFbmFibGVkKCk7XG4gICAgICAgIG5leHRCdXR0b24uZGlzYWJsZWQgPSAhY29tcC5pc05leHRQYWdlRW5hYmxlZCgpO1xuICAgICAgICBwYWdlU3Bhbi5pbm5lckhUTUwgPSBgLSAke3BhZ2V9IC1gO1xuICAgIH0pO1xuXG4gICAgcHJldmlvdXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjb21wLnNlbGVjdFByZXZpb3VzUGFnZSgpKTtcbiAgICBuZXh0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29tcC5zZWxlY3ROZXh0UGFnZSgpKTtcblxuICAgIGVsLmFwcGVuZENoaWxkKHByZXZpb3VzQnV0dG9uKTtcbiAgICBlbC5hcHBlbmRDaGlsZChwYWdlU3Bhbik7XG4gICAgZWwuYXBwZW5kQ2hpbGQobmV4dEJ1dHRvbik7XG5cbiAgICByZXR1cm4gY29tcDtcbn0iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoaXRlbSkge1xuXG4gICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgICBkaXYuaW5uZXJIVE1MID0gYNCS0YvQsdGA0LDQvSDQv9C+0LvRjNC30L7QstCw0YLQtdC70YwgPGI+JHtpdGVtLmZpcnN0TmFtZX0gJHtpdGVtLmxhc3ROYW1lfTwvYj48YnI+XG4gICAgICAgICAgICDQntC/0LjRgdCw0L3QuNC1Ojxicj5cblxuICAgICAgICAgICAgPHRleHRhcmVhPlxuICAgICAgICAgICAgJHtpdGVtLmRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgPC90ZXh0YXJlYT48YnI+XG5cbiAgICAgICAgICAgINCQ0LTRgNC10YEg0L/RgNC+0LbQuNCy0LDQvdC40Y86IDxiPiR7aXRlbS5hZHJlc3Muc3RyZWV0QWRkcmVzc308L2I+PGJyPlxuICAgICAgICAgICAg0JPQvtGA0L7QtDogPGI+JHtpdGVtLmFkcmVzcy5jaXR5fTwvYj48YnI+XG4gICAgICAgICAgICDQn9GA0L7QstC40L3RhtC40Y8v0YjRgtCw0YI6IDxiPiR7aXRlbS5hZHJlc3Muc3RhdGV9PC9iPjxicj5cbiAgICAgICAgICAgINCY0L3QtNC10LrRgTogPGI+JHtpdGVtLmFkcmVzcy56aXB9PC9iPmA7XG5cbiAgICByZXR1cm4gZGl2O1xufSIsImV4cG9ydCBsZXQgZGF0YSA9IFtcbiAgICB7XG4gICAgICAgIFwiaWRcIjogMzg0LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1heVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiUnV0dFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiVlNpZWdlbEBhbGlxdWFtLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDU4OCk1MTItNzE5M1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTI2NiBBZGlwaXNjaW5nIFN0XCIsIFwiY2l0eVwiOiBcIktlYXJuZXlcIiwgXCJzdGF0ZVwiOiBcIk1TXCIsIFwiemlwXCI6IFwiNjQ1MzNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJxdWlzIGxhY3VzIGVnZXN0YXMgY3VyYWJpdHVyIHBsYWNlcmF0IHNhcGllbiBhbGlxdWFtIG1vcmJpIHBsYWNlcmF0IGxlY3R1cyByaXN1cyBxdWlzIHJpc3VzIGxhY3VzIGlkIG5lcXVlIG1hZ25hIG51bGxhbSBlcm9zIG5lYyBtYXNzYSBjb25zZXF1YXQgc2VkIHNpdCB2ZWwgYXVndWUgYW50ZSBudW5jIGRvbG9yIGxlY3R1cyB2aXRhZSBuZWNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3MDAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVHlsZW5lXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJBbHBlcnRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlRQaWVzQHNhZ2l0dGlzLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDk1NCkzNzYtNjIyNFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNDgzIE9kaW8gU3RcIiwgXCJjaXR5XCI6IFwiU3VubnlcIiwgXCJzdGF0ZVwiOiBcIk5EXCIsIFwiemlwXCI6IFwiNzkzMjBcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJuZWMgc2NlbGVyaXNxdWUgdGVtcG9yIHBsYWNlcmF0IHNpdCBwbGFjZXJhdCB0b3J0b3IgZWdlc3RhcyBpcHN1bSBtYXNzYSBzaXQgbGFjdXMgYWxpcXVhbSBzYXBpZW4gZWxlbWVudHVtIGFtZXQgc2l0IGNvbnNlcXVhdCBhbWV0IHNhZ2l0dGlzIHZlc3RpYnVsdW0gbGVjdHVzIG51bmMgZG9sb3IgcHVsdmluYXIgc2VkIHZlbGl0IHNhZ2l0dGlzIHNlZCBsYWN1cyBpcHN1bSB0b3J0b3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3MjUsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSmFlaG9cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlBhdGVsXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJNQmlhc0BhdWd1ZS5pb1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDc3NikwNjgtMjkyMFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNjM1MSBWZWwgUmRcIiwgXCJjaXR5XCI6IFwiT2dkZW5cIiwgXCJzdGF0ZVwiOiBcIlNEXCIsIFwiemlwXCI6IFwiMTEwNDNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ2ZWwgZXQgcHJldGl1bSBzZWQgbG9yZW0gZnJpbmdpbGxhIHNlZCBhYyBzZWQgYXQgbWkgdHVycGlzIHNlZCBjb25zZWN0ZXR1ciBwb3J0YSBtb2xlc3RpZSB0dXJwaXMgZWxpdCBtYXNzYSBtaSBsYWN1cyB0b3J0b3Igc2VkIGVsaXQgY29uc2VjdGV0dXIgbW9sZXN0aWUgZWxpdCBvZGlvIGhlbmRyZXJpdCBwbGFjZXJhdCB2aXRhZSBlZ2VzdGFzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODUsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiS2FybFwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiV2Vha2xpZW1cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlZOYWphbmlja0BxdWlzLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDk2OSkwMjgtNjg1NFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMzg5NiBFbGl0IFN0XCIsIFwiY2l0eVwiOiBcIkdyZWVudmlsbGVcIiwgXCJzdGF0ZVwiOiBcIk1JXCIsIFwiemlwXCI6IFwiMzQzMTZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJtYXR0aXMgbWF0dGlzIHRlbGx1cyB0ZW1wb3IgZWxlbWVudHVtIG5lYyBtb3JiaSBhZGlwaXNjaW5nIGFtZXQgbWFsZXN1YWRhIHZlc3RpYnVsdW0gcGxhY2VyYXQgbGFjdXMgcXVpcyBzZWQgYW1ldCB2ZWwgZXQgcnV0cnVtIGxhY3VzIHZlc3RpYnVsdW0gcnV0cnVtIHRpbmNpZHVudCBpcHN1bSBjdXJhYml0dXIgZG9sb3IgaWQgbW9sZXN0aWUgcG9ydGEgb3JjaSBsYWN1cyBpcHN1bVwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDk0MyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJFbGlzc2FcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJhbHVsaXNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkFMZW9vbkBkb2xvci5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigyMjkpMzAxLTc1NDJcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjQ3NzEgTGliZXJvIFN0XCIsIFwiY2l0eVwiOiBcIlJhd2xpbnNcIiwgXCJzdGF0ZVwiOiBcIktTXCIsIFwiemlwXCI6IFwiODU2MDJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJlZ2VzdGFzIHRvcnRvciBsYWN1cyBzZWQgc2NlbGVyaXNxdWUgcGxhY2VyYXQgYWVuZWFuIHRvcnRvciBvZGlvIHZpdGFlIGVsaXQgZXQgbWFnbmEgcmlzdXMgZXQgbWFzc2Egb2RpbyBzb2xsaWNpdHVkaW4gbmVjIGR1aSBmYWNpbGlzaXMgcHVsdmluYXIgc2l0IGFudGUgaGVuZHJlcml0IHNhcGllbiBjb25zZXF1YXQgcHVsdmluYXIgdG9ydG9yIG1vbGVzdGllIG1hZ25hIHRvcnRvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDYzNixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNdW5henphXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJWYW5kZXJsaW5kZW5cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkFQYXJrQGFlbmVhbi5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig4ODYpMTk3LTA0MzNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjExNTIgT3JjaSBTdFwiLCBcImNpdHlcIjogXCJNYW5jaGVzdGVyXCIsIFwic3RhdGVcIjogXCJLU1wiLCBcInppcFwiOiBcIjQ4ODg2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2NlbGVyaXNxdWUgdml0YWUgYXVndWUgdGVsbHVzIGluIG51bGxhbSBudW5jIGFjIGNvbnZhbGxpcyBlZ2VzdGFzIGhlbmRyZXJpdCB2ZXN0aWJ1bHVtIG5vbiBxdWlzIGxhY3VzIHRpbmNpZHVudCBhZW5lYW4gcHVsdmluYXIgc2VkIG1vcmJpIHRvcnRvciB0aW5jaWR1bnQgY29uc2VjdGV0dXIgdmVzdGlidWx1bSBwb3J0YSB2ZXN0aWJ1bHVtIGRvbG9yIGR1aSBlZ2V0IGF0IGRvbG9yIHRlbGx1c1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDQzMSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJGcmVkcmlja1wiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTW9zaGVyXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJSS3JlaWdsZXJAcHVsdmluYXIuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoODI4KTQ3MS00NjgwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI2NjUwIE51bGxhbSBEclwiLCBcImNpdHlcIjogXCJOb3J0aGVyblwiLCBcInN0YXRlXCI6IFwiVkFcIiwgXCJ6aXBcIjogXCI1NTM4NVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImhlbmRyZXJpdCB0ZWxsdXMgbWFnbmEgYWRpcGlzY2luZyByaXN1cyBtYWxlc3VhZGEgbGVjdHVzIGNvbnZhbGxpcyBzZWQgbWkgYXQgc2FnaXR0aXMgZG9sb3IgbWF0dGlzIHRvcnRvciBzZWQgbmVxdWUgdmVzdGlidWx1bSB0dXJwaXMgdmVzdGlidWx1bSBtYWxlc3VhZGEgbWkgc3VzcGVuZGlzc2UgdGluY2lkdW50IG5lYyBzZWQgbmVjIHBoYXJldHJhIG1hZ25hIG5lcXVlIGR1aSBzYXBpZW5cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3MyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJMZXRpY2lhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCZXR0ZW5jb3VydFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiV1doZXRzdG9uZUBsb3JlbS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig2NzgpNzgwLTI0MjBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjI3NDAgUHVsdmluYXIgTG5cIiwgXCJjaXR5XCI6IFwiQnJhZGZvcmRcIiwgXCJzdGF0ZVwiOiBcIkNPXCIsIFwiemlwXCI6IFwiMzU5MjFcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJhbWV0IHRvcnRvciBzY2VsZXJpc3F1ZSBsZWN0dXMgdG9ydG9yIHBvcnR0aXRvciBpZCBzZWQgY29uc2VxdWF0IHNjZWxlcmlzcXVlIG1vbGVzdGllIGFtZXQgcHJldGl1bSBhdCBuZWMgYWVuZWFuIG1hZ25hIGVyb3MgZWxlbWVudHVtIHBoYXJldHJhIGVsZW1lbnR1bSBlbGl0IGxvcmVtIG1pIGVnZXN0YXMgcXVpcyBhbWV0IHBsYWNlcmF0IHRpbmNpZHVudCBsYWN1cyBzaXQgdGluY2lkdW50XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMjUwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIklzaHRpYXFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkhvd2VsbFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiS0hlc2xlckBtYWduYS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1MjMpMjYxLTIwNjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkyMzMgQXQgQXZlXCIsIFwiY2l0eVwiOiBcIlRvbWJhbGxcIiwgXCJzdGF0ZVwiOiBcIldWXCIsIFwiemlwXCI6IFwiMjI1NjZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzb2xsaWNpdHVkaW4gYWMgZG9sb3IgYWxpcXVhbSBkb2xvciBlZ2VzdGFzIG5lcXVlIHB1bHZpbmFyIGFsaXF1YW0gaXBzdW0gdml0YWUgbW9yYmkgdG9ydG9yIGRvbG9yIHZlbCBtYXNzYSBlbGVtZW50dW0gdmVsaXQgbGFjdXMgdml0YWUgdmVzdGlidWx1bSBhZW5lYW4gYWxpcXVhbSBtYWduYSBlZ2V0IGFjIHZpdGFlIGVsZW1lbnR1bSBwb3J0YSBtYXNzYSBmcmluZ2lsbGEgaW5cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA4MzAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiQmV0aFwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiSG9obWFublwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiSVJhbWF0aUBwb3J0dGl0b3IubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNzU1KTQ2MS04MTI0XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIzMzQ0IEFudGUgQ3RcIiwgXCJjaXR5XCI6IFwiSGF0dGllc2J1cmdcIiwgXCJzdGF0ZVwiOiBcIk1PXCIsIFwiemlwXCI6IFwiNzMyMTdcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJsYWN1cyBhbWV0IGN1cmFiaXR1ciBhZGlwaXNjaW5nIHRlbGx1cyBuZWMgZXQgc2VkIG5vbiBydXRydW0gc3VzcGVuZGlzc2UgaGVuZHJlcml0IG1hZ25hIG1hdHRpcyBzYXBpZW4gcG9ydGEgbWFzc2EgbmVjIGxlY3R1cyBhdCBkb2xvciBwbGFjZXJhdCB2aXRhZSBwcmV0aXVtIGFtZXQgc29sbGljaXR1ZGluIG9kaW8gbG9yZW0gbWF0dGlzIGxhY3VzIHJ1dHJ1bSBsaWJlcm9cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA1NDUsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSmFuZXRcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkRlbm9cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIktMb3lhQHZlbC5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzNjApNTgxLTA4NzBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkxMzQgVG9ydG9yIFJkXCIsIFwiY2l0eVwiOiBcIldhaGlhd2FcIiwgXCJzdGF0ZVwiOiBcIldWXCIsIFwiemlwXCI6IFwiNjM2MDdcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJwdWx2aW5hciBoZW5kcmVyaXQgcGxhY2VyYXQgZXQgbWkgc2FwaWVuIHNhcGllbiBtYXNzYSB0ZW1wb3IgY29uc2VxdWF0IHNpdCB0b3J0b3IgaWQgbm9uIGxhY3VzIGxhY3VzIG51bGxhbSBldCBzb2xsaWNpdHVkaW4gYW1ldCBtYXNzYSBkb2xvciBzaXQgZHVpIHZlc3RpYnVsdW0gY29uc2VjdGV0dXIgbWF0dGlzIHN1c3BlbmRpc3NlIHNvbGxpY2l0dWRpbiBoZW5kcmVyaXQgdGluY2lkdW50IHZlbGl0XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzMyLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlJpY2FyZG9cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkxvaHJcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlNXb29kaG91c2VAbmVjLm9yZ1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDUwNykwODctMTIyM1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjAyNSBWaXRhZSBBdmVcIiwgXCJjaXR5XCI6IFwiUGFkdWNhaFwiLCBcInN0YXRlXCI6IFwiQVJcIiwgXCJ6aXBcIjogXCI5OTIxNlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm1hZ25hIHZlc3RpYnVsdW0gbGFjdXMgdG9ydG9yIHB1bHZpbmFyIG5vbiBhdCB2aXRhZSBsZWN0dXMgaGVuZHJlcml0IGRvbG9yIG51bmMgYWVuZWFuIG5lcXVlIHNvbGxpY2l0dWRpbiBsaWJlcm8gc2VkIGxvcmVtIHRvcnRvciBsYWN1cyBhbGlxdWFtIGxlY3R1cyBwb3J0dGl0b3IgY29uc2VjdGV0dXIgdml0YWUgc2FnaXR0aXMgbWFsZXN1YWRhIGFsaXF1YW0gcXVpcyB2ZXN0aWJ1bHVtIGF1Z3VlIHZlbGl0XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNDQ5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1lbGxvbnlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlNhbnZpY2tcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk5MeWRlbkBwb3J0YS5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigxNTEpODA5LTYzNjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjc2MTkgUGxhY2VyYXQgRHJcIiwgXCJjaXR5XCI6IFwiV2hpdGUgQmVhciBMYWtlXCIsIFwic3RhdGVcIjogXCJJTFwiLCBcInppcFwiOiBcIjU2NzU5XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2l0IHNhZ2l0dGlzIGFtZXQgc2FnaXR0aXMgbWFzc2EgcG9ydHRpdG9yIGV0IHN1c3BlbmRpc3NlIG5lcXVlIGFlbmVhbiB0ZWxsdXMgcGhhcmV0cmEgYWxpcXVhbSBhbnRlIHRlbXBvciBkdWkgY3VyYWJpdHVyIGVsaXQgbWFzc2EgbGVjdHVzIGFudGUgY29udmFsbGlzIGFtZXQgb2RpbyBvcmNpIHRvcnRvciB2aXRhZSBtb3JiaSBzdXNwZW5kaXNzZSBzZWQgc2VkIHNhZ2l0dGlzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMjM5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1lbGlzc2FcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkNvb2tzb25cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlNNb3JzZUBtYWduYS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzNjYpOTIzLTk3MjJcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjU2NzkgRG9sb3IgRHJcIiwgXCJjaXR5XCI6IFwiQnVsdmVyZGVcIiwgXCJzdGF0ZVwiOiBcIk5FXCIsIFwiemlwXCI6IFwiMjU1MzVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzZWQgdmVsaXQgdG9ydG9yIHJ1dHJ1bSBpcHN1bSB2ZXN0aWJ1bHVtIHRpbmNpZHVudCBlbGl0IG1hbGVzdWFkYSBwbGFjZXJhdCBtaSBwbGFjZXJhdCBtYXNzYSBzdXNwZW5kaXNzZSBpbiB0b3J0b3Igc2VkIG5lYyBtaSBzZWQgZWxlbWVudHVtIG5lYyBlZ2VzdGFzIHNlZCBwcmV0aXVtIGlwc3VtIGluIGNvbnNlY3RldHVyIHNpdCBtb2xlc3RpZSB0dXJwaXMgYXRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA2NDUsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWFyY2VsbGluXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJLcmVic1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiSkRhbmllbHNAYWxpcXVhbS5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzNjUpOTk4LTkxMTlcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjg4MTIgVG9ydG9yIEF2ZVwiLCBcImNpdHlcIjogXCJaaW9uc3ZpbGxlXCIsIFwic3RhdGVcIjogXCJLWVwiLCBcInppcFwiOiBcIjMwMzk3XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZG9sb3Igbm9uIG1vbGVzdGllIGV0aWFtIG1vbGVzdGllIGxhY3VzIGxpYmVybyBzZWQgZXRpYW0gcGxhY2VyYXQgY3VyYWJpdHVyIGRvbG9yIGNvbnNlcXVhdCBjdXJhYml0dXIgYWMgYW1ldCB2aXRhZSBjb25zZXF1YXQgbWFnbmEgc2NlbGVyaXNxdWUgbWF0dGlzIGNvbnNlcXVhdCBkb2xvciBhZW5lYW4gbWFzc2EgYWVuZWFuIG1hc3NhIHZpdGFlIHRvcnRvciBhdCBuZWMgYWRpcGlzY2luZ1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDE4MyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJIdXNhbVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiSG93YXJkXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJHUG9zZW5AdG9ydG9yLmdvdlwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDQ4Nyk2MTgtODQ3MFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiODcyMiBMZWN0dXMgTG5cIiwgXCJjaXR5XCI6IFwiS2lsbGVlblwiLCBcInN0YXRlXCI6IFwiTUVcIiwgXCJ6aXBcIjogXCIyMzIwMVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImVsaXQgaXBzdW0gdGVsbHVzIHJ1dHJ1bSBjb25zZWN0ZXR1ciBhbGlxdWFtIGxhY3VzIHNpdCBjdXJhYml0dXIgcmlzdXMgaXBzdW0gbGFjdXMgb2RpbyBhZW5lYW4gYW50ZSBpcHN1bSBvcmNpIGFtZXQgbW9yYmkgaWQgbWFnbmEgZXJvcyBzZWQgbWFnbmEgaGVuZHJlcml0IGZhY2lsaXNpcyBzZWQgZnJpbmdpbGxhIG9yY2kgdGluY2lkdW50IGN1cmFiaXR1ciBjb252YWxsaXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA2NTcsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiQmVuaWthXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJXb29kc1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiUFBpdHplbEBwcmV0aXVtLmlvXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoOTE4KTIyNS0zODIxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1NzIzIFByZXRpdW0gQ3RcIiwgXCJjaXR5XCI6IFwiSGF6ZWwgUGFya1wiLCBcInN0YXRlXCI6IFwiTURcIiwgXCJ6aXBcIjogXCI0MTEyM1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImRvbG9yIHRvcnRvciBsaWJlcm8gZG9sb3IgZWdlc3RhcyBldCB2ZWwgbGliZXJvIHZlc3RpYnVsdW0gdGVsbHVzIHBvcnR0aXRvciBjb252YWxsaXMgdGluY2lkdW50IHRpbmNpZHVudCBtYWduYSBwbGFjZXJhdCBhZGlwaXNjaW5nIHRpbmNpZHVudCB0dXJwaXMgdHVycGlzIHNhcGllbiBzZWQgYWxpcXVhbSBhbWV0IHBsYWNlcmF0IG5lcXVlIGhlbmRyZXJpdCB0b3J0b3IgYW1ldCB0ZWxsdXMgY29udmFsbGlzIGRvbmVjXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzIwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkVsaXNoYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQm96emFsbGFcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlJTa3VibGljc0BtYWduYS5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDM4NCk5MzgtNTUwMlwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiODA2IEFjIFN0XCIsIFwiY2l0eVwiOiBcIlNhaW50IFBhdWxzXCIsIFwic3RhdGVcIjogXCJORVwiLCBcInppcFwiOiBcIjU5MjIyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2VkIGVyb3MgZHVpIGR1aSBwaGFyZXRyYSBtYXNzYSBhbWV0IHB1bHZpbmFyIHZlbCBhbWV0IGVsZW1lbnR1bSBhbWV0IHNpdCBzYWdpdHRpcyBvZGlvIHRlbGx1cyBzaXQgcGxhY2VyYXQgYWRpcGlzY2luZyBlZ2VzdGFzIHNlZCBtaSBtYWxlc3VhZGEgc2VkIGFjIHNlZCBwaGFyZXRyYSBmYWNpbGlzaXMgZHVpIGZhY2lsaXNpcyBpZCBzb2xsaWNpdHVkaW5cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzNTUsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVmFsYXJpZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiR3JhbnRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkdZYXJiZXJAb3JjaS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig3MTMpMjYyLTc5NDZcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkzNjggTGFjdXMgTG5cIiwgXCJjaXR5XCI6IFwiUHJhdHR2aWxsZVwiLCBcInN0YXRlXCI6IFwiSU5cIiwgXCJ6aXBcIjogXCIzMjIyOFwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInZlbGl0IHNhZ2l0dGlzIGZhY2lsaXNpcyB2aXRhZSBtYXNzYSBmYWNpbGlzaXMgc3VzcGVuZGlzc2Ugc2FnaXR0aXMgc2VkIHRpbmNpZHVudCBldCBudW5jIHRlbXBvciBtYXR0aXMgdml0YWUgbGliZXJvIGZhY2lsaXNpcyB2ZWwgc2VkIGF0IG1hbGVzdWFkYSBwaGFyZXRyYSBzYWdpdHRpcyBjb25zZXF1YXQgbWFzc2Egc2VkIGVnZXQgcHVsdmluYXIgZWdlc3RhcyBvZGlvIGFjIG5lY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDM2OSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJMYU5pc2hhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJGYXVyZXN0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBSG9sbGlzQHZlbGl0LmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDU2Nyk2ODUtMTU2M1wiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNDc3MiBBbWV0IERyXCIsIFwiY2l0eVwiOiBcIldhdWtlc2hhXCIsIFwic3RhdGVcIjogXCJNT1wiLCBcInppcFwiOiBcIjY3NDg1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiYWMgYWRpcGlzY2luZyBjb25zZXF1YXQgdG9ydG9yIGFkaXBpc2NpbmcgZXQgZG9uZWMgb2RpbyBldGlhbSBwaGFyZXRyYSBtYWxlc3VhZGEgYWVuZWFuIHJpc3VzIGxhY3VzIGxhY3VzIGNvbnZhbGxpcyBkb25lYyBtYXR0aXMgYWVuZWFuIGRvbmVjIHNjZWxlcmlzcXVlIHJpc3VzIG5lYyBlbGVtZW50dW0gYWMgcHVsdmluYXIgc29sbGljaXR1ZGluIGFsaXF1YW0gc2VkIG51bGxhbSBhbWV0IG9kaW9cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA0MzAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiS2FybFwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQ2xlbWVudHNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkZPbHNlbkB0b3J0b3IubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzMDEpNTgxLTE0MDFcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjUzOTUgVml0YWUgQXZlXCIsIFwiY2l0eVwiOiBcIkNoZXN0ZXJcIiwgXCJzdGF0ZVwiOiBcIk1EXCIsIFwiemlwXCI6IFwiNjU3ODNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJhdCBuZWMgc2l0IHBsYWNlcmF0IGluIGFkaXBpc2NpbmcgYWMgc2FwaWVuIHBvcnRhIHZlbGl0IHB1bHZpbmFyIGlwc3VtIG1vcmJpIGFtZXQgc2NlbGVyaXNxdWUgbWFnbmEgbWFzc2Egc2l0IHNlZCBudW5jIHNpdCBwb3J0YSBkb2xvciBuZXF1ZSBjb252YWxsaXMgcGxhY2VyYXQgcmlzdXMgcnV0cnVtIHBvcnRhIGZhY2lsaXNpcyB0b3J0b3IgZmFjaWxpc2lzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMzU3LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlRvbWlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlBlY2tcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk1XYWx0ZXJzQHNpdC5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig4MzUpNjA3LTA0NzNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjU2NCBTYXBpZW4gUmRcIiwgXCJjaXR5XCI6IFwiUHJvdmlkZW5jZVwiLCBcInN0YXRlXCI6IFwiS1lcIiwgXCJ6aXBcIjogXCI0MjI5MFwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImNvbnZhbGxpcyBtYWduYSByaXN1cyBtYWduYSBwb3J0dGl0b3IgYWxpcXVhbSBvZGlvIGFtZXQgdGVsbHVzIHNpdCBpbiBhbWV0IGF0IHBoYXJldHJhIGVsaXQgYWMgY29uc2VjdGV0dXIgYXVndWUgdG9ydG9yIHRvcnRvciBpZCBwcmV0aXVtIGFsaXF1YW0gcXVpcyBwdWx2aW5hciBuZXF1ZSBjb252YWxsaXMgYW50ZSB0dXJwaXMgb2RpbyBzZWQgaGVuZHJlcml0XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMjAsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiQW5keVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQnJhc3dlbGxcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkNTd3llcnNAZXJvcy5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMzNykwMjgtMDk3OFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiOTM1OSBBdCBTdFwiLCBcImNpdHlcIjogXCJNb3VsdHJpZVwiLCBcInN0YXRlXCI6IFwiQVpcIiwgXCJ6aXBcIjogXCI5NTkwNlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImV0IG5lYyBsYWN1cyB0ZW1wb3IgdGVtcG9yIGFtZXQgbW9sZXN0aWUgc2VkIGFtZXQgcG9ydHRpdG9yIHByZXRpdW0gZXRpYW0gbGFjdXMgc2VkIGV0IG1hZ25hIGRvbG9yIG1vbGVzdGllIHN1c3BlbmRpc3NlIG1hdHRpcyBhbWV0IHRvcnRvciB0aW5jaWR1bnQgbWFnbmEgbmVxdWUgdG9ydG9yIG9kaW8gc2l0IHZlbGl0IHNpdCB0aW5jaWR1bnQgdGVtcG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODYxLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkxhdGlhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJJdmFub3NraVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTktpbmRlckB2ZWxpdC5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigyNjQpNDU0LTQyNjFcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjU1ODAgT2RpbyBSZFwiLCBcImNpdHlcIjogXCJKb2huc29uIENvdW50eVwiLCBcInN0YXRlXCI6IFwiTlZcIiwgXCJ6aXBcIjogXCI1NzYxMlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInRvcnRvciBhYyBsYWN1cyB0ZWxsdXMgc2VkIHNhcGllbiBlbGl0IG1hc3NhIHNlZCB2ZXN0aWJ1bHVtIG1hZ25hIG5vbiBmcmluZ2lsbGEgbnVsbGFtIHZlc3RpYnVsdW0gYXQgbG9yZW0gbW9yYmkgYW1ldCBkb2xvciB0dXJwaXMgcmlzdXMgdGluY2lkdW50IHRlbGx1cyBtYXR0aXMgc2l0IGVnZXQgbGFjdXMgc2l0IHNhcGllbiBsYWN1cyBkb2xvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDIwOSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNZWxpbmRhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJEZW5hcmRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkpBbHVhQGRvbG9yLmlvXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMTc5KTkxOC0yNzk0XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyMDI4IEVnZXN0YXMgU3RcIiwgXCJjaXR5XCI6IFwiQXJ2YWRhXCIsIFwic3RhdGVcIjogXCJGTFwiLCBcInppcFwiOiBcIjg3NDEzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZWdldCBlbGVtZW50dW0gZXQgbW9sZXN0aWUgdGluY2lkdW50IHNlZCBjb25zZXF1YXQgdmVsaXQgZG9sb3Igc2l0IGZhY2lsaXNpcyBtYWduYSBvZGlvIGV0IHRlbXBvciBpcHN1bSB2ZXN0aWJ1bHVtIGxpYmVybyBsaWJlcm8gbGFjdXMgbW9yYmkgbWF0dGlzIGZyaW5naWxsYSBtb3JiaSBkdWkgZXRpYW0gdmVsIG5lYyB0aW5jaWR1bnQgc29sbGljaXR1ZGluIHBvcnR0aXRvciBjb252YWxsaXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA3NjgsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiR2VyYWxkaW5lXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJMZW56ZVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiSlBsb3VyZGVAYXVndWUuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzMyKTMyNy04ODI0XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI4NDQ0IEFsaXF1YW0gQXZlXCIsIFwiY2l0eVwiOiBcIkJhdG9uIFJvdWdlXCIsIFwic3RhdGVcIjogXCJERVwiLCBcInppcFwiOiBcIjE3NzUxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic3VzcGVuZGlzc2UgYXQgdml0YWUgaXBzdW0gbGliZXJvIGxpYmVybyB0ZW1wb3IgYW1ldCBjb25zZWN0ZXR1ciBwb3J0dGl0b3Igc2l0IG1vbGVzdGllIG51bmMgYXQgcHJldGl1bSBwbGFjZXJhdCBjb25zZWN0ZXR1ciBvcmNpIGRvbG9yIG1vcmJpIGFsaXF1YW0gYW1ldCBzdXNwZW5kaXNzZSBwb3J0YSBzYXBpZW4gYW1ldCBwb3J0dGl0b3IgbWkgc2VkIGxlY3R1cyBuZXF1ZSB0b3J0b3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA5ODIsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiU2hlaWxhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJMZXNzZW5iZXJyeVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiUkxhbmRydW1AY3VyYWJpdHVyLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzMwKTAxOS05ODMxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIxNTY3IEV0IERyXCIsIFwiY2l0eVwiOiBcIlJhcGlkIENpdHlcIiwgXCJzdGF0ZVwiOiBcIlZUXCIsIFwiemlwXCI6IFwiNzY2NDFcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJtYXNzYSBvcmNpIGlkIGFudGUgbGVjdHVzIGxpYmVybyBudW5jIHNlZCBzYWdpdHRpcyB0aW5jaWR1bnQgaXBzdW0gdGVsbHVzIHNlZCBhZW5lYW4gZWxpdCBhdCB0ZWxsdXMgYWMgc2l0IHNlZCBkb25lYyBpbiBzYWdpdHRpcyBhbWV0IHBsYWNlcmF0IGR1aSB2ZWxpdCBpbiBkb2xvciBlZ2VzdGFzIHBsYWNlcmF0IHNlZFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDMwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlZpcmdpc1wiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiUm9zc1wiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTUdpcHBsZUBwdWx2aW5hci5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigyODQpNTk2LTIzMTJcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjk5NTQgVmVzdGlidWx1bSBEclwiLCBcImNpdHlcIjogXCJDaGFybGVzdG9uXCIsIFwic3RhdGVcIjogXCJDT1wiLCBcInppcFwiOiBcIjY2NTA1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwidmVsaXQgbnVsbGFtIGxvcmVtIHByZXRpdW0gbnVsbGFtIG1hdHRpcyBwcmV0aXVtIHRlbXBvciBzZWQgcG9ydHRpdG9yIG9yY2kgbmVjIG5lcXVlIHBsYWNlcmF0IHNpdCBxdWlzIGhlbmRyZXJpdCBzZWQgZG9uZWMgc2VkIHNhZ2l0dGlzIHNhZ2l0dGlzIG1hZ25hIG51bmMgcHVsdmluYXIgYXQgZG9sb3IgYWVuZWFuIGRvbG9yIHRvcnRvciBub24gc2VkXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNTEzLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkppbVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRXZlcmx5XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJUQ2Fyc3RlbnNAbWFnbmEubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMTI2KTQxNS0zNDE5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI3Njc3IERvbG9yIFN0XCIsIFwiY2l0eVwiOiBcIldhdXdhdG9zYVwiLCBcInN0YXRlXCI6IFwiT1JcIiwgXCJ6aXBcIjogXCI0MTkzMlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImRvbG9yIGVsaXQgbGliZXJvIGR1aSB0ZWxsdXMgdG9ydG9yIG1hZ25hIG9kaW8gbWFnbmEgbWFnbmEgZWxlbWVudHVtIHZlc3RpYnVsdW0gbWFnbmEgdGluY2lkdW50IHRpbmNpZHVudCBwb3J0YSBzdXNwZW5kaXNzZSBuZXF1ZSB2ZXN0aWJ1bHVtIG9kaW8gc2l0IG1hZ25hIHRlbXBvciBjb252YWxsaXMgaXBzdW0gdml0YWUgbW9yYmkgcG9ydHRpdG9yIHNhZ2l0dGlzIGFtZXQgZG9uZWMgc2VkXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODY0LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkphc29uXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJLZW5uZWR5XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJERnJlbmNoQHNlZC5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzNTUpNjg0LTQ4NTBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjEyMTkgRHVpIEF2ZVwiLCBcImNpdHlcIjogXCJCZWx0c3ZpbGxlXCIsIFwic3RhdGVcIjogXCJSSVwiLCBcInppcFwiOiBcIjE4MzE1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibW9sZXN0aWUgYXQgYW1ldCBhdCB0aW5jaWR1bnQgZnJpbmdpbGxhIG1hZ25hIGhlbmRyZXJpdCBhYyBlbGVtZW50dW0gZWdldCB2aXRhZSBhYyBhdCBjdXJhYml0dXIgYWRpcGlzY2luZyBhYyByaXN1cyBsb3JlbSBkdWkgbGliZXJvIGVsaXQgcGxhY2VyYXQgaWQgYXVndWUgaXBzdW0gdHVycGlzIHNhcGllbiByaXN1cyBzb2xsaWNpdHVkaW4gc2VkIGFjXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODIxLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkplZmZyZXlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJhcnRsZXR0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBTGVuekBsYWN1cy5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig2MTkpNjI0LTA2NTVcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjY3OTEgU2FwaWVuIERyXCIsIFwiY2l0eVwiOiBcIkFybGluZ3RvblwiLCBcInN0YXRlXCI6IFwiVE5cIiwgXCJ6aXBcIjogXCI1NzU4M1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNlZCBsYWN1cyBzYWdpdHRpcyBhYyByaXN1cyBtYWduYSBjb252YWxsaXMgc29sbGljaXR1ZGluIG5lYyBlbGl0IGF1Z3VlIHBsYWNlcmF0IG1hZ25hIHB1bHZpbmFyIG9yY2kgc3VzcGVuZGlzc2UgYW1ldCBtYWduYSBtb2xlc3RpZSB0aW5jaWR1bnQgb2RpbyBxdWlzIGRvbmVjIHB1bHZpbmFyIG9yY2kgbmVjIGhlbmRyZXJpdCBudW5jIHBsYWNlcmF0IG5lcXVlIGluIHZlc3RpYnVsdW1cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA5NzksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiVGVycmVuY2VcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJlbGxlcXVlXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJHUGF0ZWxAZWdlc3Rhcy5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDU5Myk0NzctODA5OVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjIxOSBWZXN0aWJ1bHVtIFJkXCIsIFwiY2l0eVwiOiBcIlNvbWVyc2V0XCIsIFwic3RhdGVcIjogXCJERVwiLCBcInppcFwiOiBcIjYzNTUyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic29sbGljaXR1ZGluIGZyaW5naWxsYSBudW5jIG1hdHRpcyB0ZW1wb3IgdGVtcG9yIHF1aXMgcGxhY2VyYXQgcG9ydGEgcmlzdXMgcGxhY2VyYXQgb2RpbyBsZWN0dXMgc2VkIHR1cnBpcyBsaWJlcm8gZWdlc3RhcyBsaWJlcm8gYWMgcnV0cnVtIG51bmMgYWxpcXVhbSBzb2xsaWNpdHVkaW4gYWMgcHVsdmluYXIgc2l0IGFjIGFlbmVhbiBzb2xsaWNpdHVkaW4gdml0YWUgYW1ldCBhdWd1ZVwiXG4gICAgfSxcbiAgICB7XG4gICAgICAgIFwiaWRcIjogOTc5NjY2LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlRlcnJlbmNlXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCZWxsZXF1ZVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1BhdGVsQGVnZXN0YXMubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1OTMpNDc3LTgwOTlcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIyMTkgVmVzdGlidWx1bSBSZFwiLCBcImNpdHlcIjogXCJTb21lcnNldFwiLCBcInN0YXRlXCI6IFwiREVcIiwgXCJ6aXBcIjogXCI2MzU1MlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNvbGxpY2l0dWRpbiBmcmluZ2lsbGEgbnVuYyBtYXR0aXMgdGVtcG9yIHRlbXBvciBxdWlzIHBsYWNlcmF0IHBvcnRhIHJpc3VzIHBsYWNlcmF0IG9kaW8gbGVjdHVzIHNlZCB0dXJwaXMgbGliZXJvIGVnZXN0YXMgbGliZXJvIGFjIHJ1dHJ1bSBudW5jIGFsaXF1YW0gc29sbGljaXR1ZGluIGFjIHB1bHZpbmFyIHNpdCBhYyBhZW5lYW4gc29sbGljaXR1ZGluIHZpdGFlIGFtZXQgYXVndWVcIlxuICAgIH0sXG5cblxuXG4gICAge1xuICAgICAgICBcImlkXCI6IDM4NCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNYXlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlJ1dHRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlZTaWVnZWxAYWxpcXVhbS5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1ODgpNTEyLTcxOTNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkyNjYgQWRpcGlzY2luZyBTdFwiLCBcImNpdHlcIjogXCJLZWFybmV5XCIsIFwic3RhdGVcIjogXCJNU1wiLCBcInppcFwiOiBcIjY0NTMzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwicXVpcyBsYWN1cyBlZ2VzdGFzIGN1cmFiaXR1ciBwbGFjZXJhdCBzYXBpZW4gYWxpcXVhbSBtb3JiaSBwbGFjZXJhdCBsZWN0dXMgcmlzdXMgcXVpcyByaXN1cyBsYWN1cyBpZCBuZXF1ZSBtYWduYSBudWxsYW0gZXJvcyBuZWMgbWFzc2EgY29uc2VxdWF0IHNlZCBzaXQgdmVsIGF1Z3VlIGFudGUgbnVuYyBkb2xvciBsZWN0dXMgdml0YWUgbmVjXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzAwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlR5bGVuZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQWxwZXJ0XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJUUGllc0BzYWdpdHRpcy5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig5NTQpMzc2LTYyMjRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjQ4MyBPZGlvIFN0XCIsIFwiY2l0eVwiOiBcIlN1bm55XCIsIFwic3RhdGVcIjogXCJORFwiLCBcInppcFwiOiBcIjc5MzIwXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibmVjIHNjZWxlcmlzcXVlIHRlbXBvciBwbGFjZXJhdCBzaXQgcGxhY2VyYXQgdG9ydG9yIGVnZXN0YXMgaXBzdW0gbWFzc2Egc2l0IGxhY3VzIGFsaXF1YW0gc2FwaWVuIGVsZW1lbnR1bSBhbWV0IHNpdCBjb25zZXF1YXQgYW1ldCBzYWdpdHRpcyB2ZXN0aWJ1bHVtIGxlY3R1cyBudW5jIGRvbG9yIHB1bHZpbmFyIHNlZCB2ZWxpdCBzYWdpdHRpcyBzZWQgbGFjdXMgaXBzdW0gdG9ydG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzI1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkphZWhvXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJQYXRlbFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiTUJpYXNAYXVndWUuaW9cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig3NzYpMDY4LTI5MjBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjYzNTEgVmVsIFJkXCIsIFwiY2l0eVwiOiBcIk9nZGVuXCIsIFwic3RhdGVcIjogXCJTRFwiLCBcInppcFwiOiBcIjExMDQzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwidmVsIGV0IHByZXRpdW0gc2VkIGxvcmVtIGZyaW5naWxsYSBzZWQgYWMgc2VkIGF0IG1pIHR1cnBpcyBzZWQgY29uc2VjdGV0dXIgcG9ydGEgbW9sZXN0aWUgdHVycGlzIGVsaXQgbWFzc2EgbWkgbGFjdXMgdG9ydG9yIHNlZCBlbGl0IGNvbnNlY3RldHVyIG1vbGVzdGllIGVsaXQgb2RpbyBoZW5kcmVyaXQgcGxhY2VyYXQgdml0YWUgZWdlc3Rhc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkthcmxcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIldlYWtsaWVtXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJWTmFqYW5pY2tAcXVpcy5uZXRcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig5NjkpMDI4LTY4NTRcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjM4OTYgRWxpdCBTdFwiLCBcImNpdHlcIjogXCJHcmVlbnZpbGxlXCIsIFwic3RhdGVcIjogXCJNSVwiLCBcInppcFwiOiBcIjM0MzE2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibWF0dGlzIG1hdHRpcyB0ZWxsdXMgdGVtcG9yIGVsZW1lbnR1bSBuZWMgbW9yYmkgYWRpcGlzY2luZyBhbWV0IG1hbGVzdWFkYSB2ZXN0aWJ1bHVtIHBsYWNlcmF0IGxhY3VzIHF1aXMgc2VkIGFtZXQgdmVsIGV0IHJ1dHJ1bSBsYWN1cyB2ZXN0aWJ1bHVtIHJ1dHJ1bSB0aW5jaWR1bnQgaXBzdW0gY3VyYWJpdHVyIGRvbG9yIGlkIG1vbGVzdGllIHBvcnRhIG9yY2kgbGFjdXMgaXBzdW1cIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA5NDMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiRWxpc3NhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCYWx1bGlzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBTGVvb25AZG9sb3Iub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjI5KTMwMS03NTQyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI0NzcxIExpYmVybyBTdFwiLCBcImNpdHlcIjogXCJSYXdsaW5zXCIsIFwic3RhdGVcIjogXCJLU1wiLCBcInppcFwiOiBcIjg1NjAyXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiZWdlc3RhcyB0b3J0b3IgbGFjdXMgc2VkIHNjZWxlcmlzcXVlIHBsYWNlcmF0IGFlbmVhbiB0b3J0b3Igb2RpbyB2aXRhZSBlbGl0IGV0IG1hZ25hIHJpc3VzIGV0IG1hc3NhIG9kaW8gc29sbGljaXR1ZGluIG5lYyBkdWkgZmFjaWxpc2lzIHB1bHZpbmFyIHNpdCBhbnRlIGhlbmRyZXJpdCBzYXBpZW4gY29uc2VxdWF0IHB1bHZpbmFyIHRvcnRvciBtb2xlc3RpZSBtYWduYSB0b3J0b3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA2MzYsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTXVuYXp6YVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiVmFuZGVybGluZGVuXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJBUGFya0BhZW5lYW4ub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoODg2KTE5Ny0wNDMzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIxMTUyIE9yY2kgU3RcIiwgXCJjaXR5XCI6IFwiTWFuY2hlc3RlclwiLCBcInN0YXRlXCI6IFwiS1NcIiwgXCJ6aXBcIjogXCI0ODg4NlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNjZWxlcmlzcXVlIHZpdGFlIGF1Z3VlIHRlbGx1cyBpbiBudWxsYW0gbnVuYyBhYyBjb252YWxsaXMgZWdlc3RhcyBoZW5kcmVyaXQgdmVzdGlidWx1bSBub24gcXVpcyBsYWN1cyB0aW5jaWR1bnQgYWVuZWFuIHB1bHZpbmFyIHNlZCBtb3JiaSB0b3J0b3IgdGluY2lkdW50IGNvbnNlY3RldHVyIHZlc3RpYnVsdW0gcG9ydGEgdmVzdGlidWx1bSBkb2xvciBkdWkgZWdldCBhdCBkb2xvciB0ZWxsdXNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiA0MzEsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiRnJlZHJpY2tcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIk1vc2hlclwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiUktyZWlnbGVyQHB1bHZpbmFyLmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDgyOCk0NzEtNDY4MFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNjY1MCBOdWxsYW0gRHJcIiwgXCJjaXR5XCI6IFwiTm9ydGhlcm5cIiwgXCJzdGF0ZVwiOiBcIlZBXCIsIFwiemlwXCI6IFwiNTUzODVcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJoZW5kcmVyaXQgdGVsbHVzIG1hZ25hIGFkaXBpc2NpbmcgcmlzdXMgbWFsZXN1YWRhIGxlY3R1cyBjb252YWxsaXMgc2VkIG1pIGF0IHNhZ2l0dGlzIGRvbG9yIG1hdHRpcyB0b3J0b3Igc2VkIG5lcXVlIHZlc3RpYnVsdW0gdHVycGlzIHZlc3RpYnVsdW0gbWFsZXN1YWRhIG1pIHN1c3BlbmRpc3NlIHRpbmNpZHVudCBuZWMgc2VkIG5lYyBwaGFyZXRyYSBtYWduYSBuZXF1ZSBkdWkgc2FwaWVuXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTGV0aWNpYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmV0dGVuY291cnRcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIldXaGV0c3RvbmVAbG9yZW0ub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNjc4KTc4MC0yNDIwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyNzQwIFB1bHZpbmFyIExuXCIsIFwiY2l0eVwiOiBcIkJyYWRmb3JkXCIsIFwic3RhdGVcIjogXCJDT1wiLCBcInppcFwiOiBcIjM1OTIxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiYW1ldCB0b3J0b3Igc2NlbGVyaXNxdWUgbGVjdHVzIHRvcnRvciBwb3J0dGl0b3IgaWQgc2VkIGNvbnNlcXVhdCBzY2VsZXJpc3F1ZSBtb2xlc3RpZSBhbWV0IHByZXRpdW0gYXQgbmVjIGFlbmVhbiBtYWduYSBlcm9zIGVsZW1lbnR1bSBwaGFyZXRyYSBlbGVtZW50dW0gZWxpdCBsb3JlbSBtaSBlZ2VzdGFzIHF1aXMgYW1ldCBwbGFjZXJhdCB0aW5jaWR1bnQgbGFjdXMgc2l0IHRpbmNpZHVudFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDI1MCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJJc2h0aWFxXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJIb3dlbGxcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIktIZXNsZXJAbWFnbmEub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTIzKTI2MS0yMDYzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MjMzIEF0IEF2ZVwiLCBcImNpdHlcIjogXCJUb21iYWxsXCIsIFwic3RhdGVcIjogXCJXVlwiLCBcInppcFwiOiBcIjIyNTY2XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic29sbGljaXR1ZGluIGFjIGRvbG9yIGFsaXF1YW0gZG9sb3IgZWdlc3RhcyBuZXF1ZSBwdWx2aW5hciBhbGlxdWFtIGlwc3VtIHZpdGFlIG1vcmJpIHRvcnRvciBkb2xvciB2ZWwgbWFzc2EgZWxlbWVudHVtIHZlbGl0IGxhY3VzIHZpdGFlIHZlc3RpYnVsdW0gYWVuZWFuIGFsaXF1YW0gbWFnbmEgZWdldCBhYyB2aXRhZSBlbGVtZW50dW0gcG9ydGEgbWFzc2EgZnJpbmdpbGxhIGluXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogODMwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkJldGhcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkhvaG1hbm5cIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIklSYW1hdGlAcG9ydHRpdG9yLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDc1NSk0NjEtODEyNFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMzM0NCBBbnRlIEN0XCIsIFwiY2l0eVwiOiBcIkhhdHRpZXNidXJnXCIsIFwic3RhdGVcIjogXCJNT1wiLCBcInppcFwiOiBcIjczMjE3XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibGFjdXMgYW1ldCBjdXJhYml0dXIgYWRpcGlzY2luZyB0ZWxsdXMgbmVjIGV0IHNlZCBub24gcnV0cnVtIHN1c3BlbmRpc3NlIGhlbmRyZXJpdCBtYWduYSBtYXR0aXMgc2FwaWVuIHBvcnRhIG1hc3NhIG5lYyBsZWN0dXMgYXQgZG9sb3IgcGxhY2VyYXQgdml0YWUgcHJldGl1bSBhbWV0IHNvbGxpY2l0dWRpbiBvZGlvIGxvcmVtIG1hdHRpcyBsYWN1cyBydXRydW0gbGliZXJvXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNTQ1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkphbmV0XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJEZW5vXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJLTG95YUB2ZWwubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzYwKTU4MS0wODcwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MTM0IFRvcnRvciBSZFwiLCBcImNpdHlcIjogXCJXYWhpYXdhXCIsIFwic3RhdGVcIjogXCJXVlwiLCBcInppcFwiOiBcIjYzNjA3XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwicHVsdmluYXIgaGVuZHJlcml0IHBsYWNlcmF0IGV0IG1pIHNhcGllbiBzYXBpZW4gbWFzc2EgdGVtcG9yIGNvbnNlcXVhdCBzaXQgdG9ydG9yIGlkIG5vbiBsYWN1cyBsYWN1cyBudWxsYW0gZXQgc29sbGljaXR1ZGluIGFtZXQgbWFzc2EgZG9sb3Igc2l0IGR1aSB2ZXN0aWJ1bHVtIGNvbnNlY3RldHVyIG1hdHRpcyBzdXNwZW5kaXNzZSBzb2xsaWNpdHVkaW4gaGVuZHJlcml0IHRpbmNpZHVudCB2ZWxpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDczMixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJSaWNhcmRvXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJMb2hyXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJTV29vZGhvdXNlQG5lYy5vcmdcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1MDcpMDg3LTEyMjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIwMjUgVml0YWUgQXZlXCIsIFwiY2l0eVwiOiBcIlBhZHVjYWhcIiwgXCJzdGF0ZVwiOiBcIkFSXCIsIFwiemlwXCI6IFwiOTkyMTZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJtYWduYSB2ZXN0aWJ1bHVtIGxhY3VzIHRvcnRvciBwdWx2aW5hciBub24gYXQgdml0YWUgbGVjdHVzIGhlbmRyZXJpdCBkb2xvciBudW5jIGFlbmVhbiBuZXF1ZSBzb2xsaWNpdHVkaW4gbGliZXJvIHNlZCBsb3JlbSB0b3J0b3IgbGFjdXMgYWxpcXVhbSBsZWN0dXMgcG9ydHRpdG9yIGNvbnNlY3RldHVyIHZpdGFlIHNhZ2l0dGlzIG1hbGVzdWFkYSBhbGlxdWFtIHF1aXMgdmVzdGlidWx1bSBhdWd1ZSB2ZWxpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDQ0OSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNZWxsb255XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJTYW52aWNrXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJOTHlkZW5AcG9ydGEuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMTUxKTgwOS02MzYzXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI3NjE5IFBsYWNlcmF0IERyXCIsIFwiY2l0eVwiOiBcIldoaXRlIEJlYXIgTGFrZVwiLCBcInN0YXRlXCI6IFwiSUxcIiwgXCJ6aXBcIjogXCI1Njc1OVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNpdCBzYWdpdHRpcyBhbWV0IHNhZ2l0dGlzIG1hc3NhIHBvcnR0aXRvciBldCBzdXNwZW5kaXNzZSBuZXF1ZSBhZW5lYW4gdGVsbHVzIHBoYXJldHJhIGFsaXF1YW0gYW50ZSB0ZW1wb3IgZHVpIGN1cmFiaXR1ciBlbGl0IG1hc3NhIGxlY3R1cyBhbnRlIGNvbnZhbGxpcyBhbWV0IG9kaW8gb3JjaSB0b3J0b3Igdml0YWUgbW9yYmkgc3VzcGVuZGlzc2Ugc2VkIHNlZCBzYWdpdHRpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDIzOSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJNZWxpc3NhXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJDb29rc29uXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJTTW9yc2VAbWFnbmEub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzY2KTkyMy05NzIyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1Njc5IERvbG9yIERyXCIsIFwiY2l0eVwiOiBcIkJ1bHZlcmRlXCIsIFwic3RhdGVcIjogXCJORVwiLCBcInppcFwiOiBcIjI1NTM1XCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwic2VkIHZlbGl0IHRvcnRvciBydXRydW0gaXBzdW0gdmVzdGlidWx1bSB0aW5jaWR1bnQgZWxpdCBtYWxlc3VhZGEgcGxhY2VyYXQgbWkgcGxhY2VyYXQgbWFzc2Egc3VzcGVuZGlzc2UgaW4gdG9ydG9yIHNlZCBuZWMgbWkgc2VkIGVsZW1lbnR1bSBuZWMgZWdlc3RhcyBzZWQgcHJldGl1bSBpcHN1bSBpbiBjb25zZWN0ZXR1ciBzaXQgbW9sZXN0aWUgdHVycGlzIGF0XCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNjQ1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIk1hcmNlbGxpblwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiS3JlYnNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkpEYW5pZWxzQGFsaXF1YW0ubmV0XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzY1KTk5OC05MTE5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI4ODEyIFRvcnRvciBBdmVcIiwgXCJjaXR5XCI6IFwiWmlvbnN2aWxsZVwiLCBcInN0YXRlXCI6IFwiS1lcIiwgXCJ6aXBcIjogXCIzMDM5N1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImRvbG9yIG5vbiBtb2xlc3RpZSBldGlhbSBtb2xlc3RpZSBsYWN1cyBsaWJlcm8gc2VkIGV0aWFtIHBsYWNlcmF0IGN1cmFiaXR1ciBkb2xvciBjb25zZXF1YXQgY3VyYWJpdHVyIGFjIGFtZXQgdml0YWUgY29uc2VxdWF0IG1hZ25hIHNjZWxlcmlzcXVlIG1hdHRpcyBjb25zZXF1YXQgZG9sb3IgYWVuZWFuIG1hc3NhIGFlbmVhbiBtYXNzYSB2aXRhZSB0b3J0b3IgYXQgbmVjIGFkaXBpc2NpbmdcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAxODMsXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiSHVzYW1cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkhvd2FyZFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1Bvc2VuQHRvcnRvci5nb3ZcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig0ODcpNjE4LTg0NzBcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjg3MjIgTGVjdHVzIExuXCIsIFwiY2l0eVwiOiBcIktpbGxlZW5cIiwgXCJzdGF0ZVwiOiBcIk1FXCIsIFwiemlwXCI6IFwiMjMyMDFcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJlbGl0IGlwc3VtIHRlbGx1cyBydXRydW0gY29uc2VjdGV0dXIgYWxpcXVhbSBsYWN1cyBzaXQgY3VyYWJpdHVyIHJpc3VzIGlwc3VtIGxhY3VzIG9kaW8gYWVuZWFuIGFudGUgaXBzdW0gb3JjaSBhbWV0IG1vcmJpIGlkIG1hZ25hIGVyb3Mgc2VkIG1hZ25hIGhlbmRyZXJpdCBmYWNpbGlzaXMgc2VkIGZyaW5naWxsYSBvcmNpIHRpbmNpZHVudCBjdXJhYml0dXIgY29udmFsbGlzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNjU3LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkJlbmlrYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiV29vZHNcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlBQaXR6ZWxAcHJldGl1bS5pb1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDkxOCkyMjUtMzgyMVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNTcyMyBQcmV0aXVtIEN0XCIsIFwiY2l0eVwiOiBcIkhhemVsIFBhcmtcIiwgXCJzdGF0ZVwiOiBcIk1EXCIsIFwiemlwXCI6IFwiNDExMjNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJkb2xvciB0b3J0b3IgbGliZXJvIGRvbG9yIGVnZXN0YXMgZXQgdmVsIGxpYmVybyB2ZXN0aWJ1bHVtIHRlbGx1cyBwb3J0dGl0b3IgY29udmFsbGlzIHRpbmNpZHVudCB0aW5jaWR1bnQgbWFnbmEgcGxhY2VyYXQgYWRpcGlzY2luZyB0aW5jaWR1bnQgdHVycGlzIHR1cnBpcyBzYXBpZW4gc2VkIGFsaXF1YW0gYW1ldCBwbGFjZXJhdCBuZXF1ZSBoZW5kcmVyaXQgdG9ydG9yIGFtZXQgdGVsbHVzIGNvbnZhbGxpcyBkb25lY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDcyMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJFbGlzaGFcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJvenphbGxhXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJSU2t1YmxpY3NAbWFnbmEubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzODQpOTM4LTU1MDJcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjgwNiBBYyBTdFwiLCBcImNpdHlcIjogXCJTYWludCBQYXVsc1wiLCBcInN0YXRlXCI6IFwiTkVcIiwgXCJ6aXBcIjogXCI1OTIyMlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNlZCBlcm9zIGR1aSBkdWkgcGhhcmV0cmEgbWFzc2EgYW1ldCBwdWx2aW5hciB2ZWwgYW1ldCBlbGVtZW50dW0gYW1ldCBzaXQgc2FnaXR0aXMgb2RpbyB0ZWxsdXMgc2l0IHBsYWNlcmF0IGFkaXBpc2NpbmcgZWdlc3RhcyBzZWQgbWkgbWFsZXN1YWRhIHNlZCBhYyBzZWQgcGhhcmV0cmEgZmFjaWxpc2lzIGR1aSBmYWNpbGlzaXMgaWQgc29sbGljaXR1ZGluXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogMzU1LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlZhbGFyaWVcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkdyYW50XCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJHWWFyYmVyQG9yY2kub3JnXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNzEzKTI2Mi03OTQ2XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5MzY4IExhY3VzIExuXCIsIFwiY2l0eVwiOiBcIlByYXR0dmlsbGVcIiwgXCJzdGF0ZVwiOiBcIklOXCIsIFwiemlwXCI6IFwiMzIyMjhcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ2ZWxpdCBzYWdpdHRpcyBmYWNpbGlzaXMgdml0YWUgbWFzc2EgZmFjaWxpc2lzIHN1c3BlbmRpc3NlIHNhZ2l0dGlzIHNlZCB0aW5jaWR1bnQgZXQgbnVuYyB0ZW1wb3IgbWF0dGlzIHZpdGFlIGxpYmVybyBmYWNpbGlzaXMgdmVsIHNlZCBhdCBtYWxlc3VhZGEgcGhhcmV0cmEgc2FnaXR0aXMgY29uc2VxdWF0IG1hc3NhIHNlZCBlZ2V0IHB1bHZpbmFyIGVnZXN0YXMgb2RpbyBhYyBuZWNcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzNjksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTGFOaXNoYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRmF1cmVzdFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQUhvbGxpc0B2ZWxpdC5jb21cIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1NjcpNjg1LTE1NjNcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjQ3NzIgQW1ldCBEclwiLCBcImNpdHlcIjogXCJXYXVrZXNoYVwiLCBcInN0YXRlXCI6IFwiTU9cIiwgXCJ6aXBcIjogXCI2NzQ4NVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImFjIGFkaXBpc2NpbmcgY29uc2VxdWF0IHRvcnRvciBhZGlwaXNjaW5nIGV0IGRvbmVjIG9kaW8gZXRpYW0gcGhhcmV0cmEgbWFsZXN1YWRhIGFlbmVhbiByaXN1cyBsYWN1cyBsYWN1cyBjb252YWxsaXMgZG9uZWMgbWF0dGlzIGFlbmVhbiBkb25lYyBzY2VsZXJpc3F1ZSByaXN1cyBuZWMgZWxlbWVudHVtIGFjIHB1bHZpbmFyIHNvbGxpY2l0dWRpbiBhbGlxdWFtIHNlZCBudWxsYW0gYW1ldCBvZGlvXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNDMwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkthcmxcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkNsZW1lbnRzXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJGT2xzZW5AdG9ydG9yLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzAxKTU4MS0xNDAxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1Mzk1IFZpdGFlIEF2ZVwiLCBcImNpdHlcIjogXCJDaGVzdGVyXCIsIFwic3RhdGVcIjogXCJNRFwiLCBcInppcFwiOiBcIjY1NzgzXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiYXQgbmVjIHNpdCBwbGFjZXJhdCBpbiBhZGlwaXNjaW5nIGFjIHNhcGllbiBwb3J0YSB2ZWxpdCBwdWx2aW5hciBpcHN1bSBtb3JiaSBhbWV0IHNjZWxlcmlzcXVlIG1hZ25hIG1hc3NhIHNpdCBzZWQgbnVuYyBzaXQgcG9ydGEgZG9sb3IgbmVxdWUgY29udmFsbGlzIHBsYWNlcmF0IHJpc3VzIHJ1dHJ1bSBwb3J0YSBmYWNpbGlzaXMgdG9ydG9yIGZhY2lsaXNpc1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDM1NyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUb21pXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJQZWNrXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJNV2FsdGVyc0BzaXQuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoODM1KTYwNy0wNDczXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1NjQgU2FwaWVuIFJkXCIsIFwiY2l0eVwiOiBcIlByb3ZpZGVuY2VcIiwgXCJzdGF0ZVwiOiBcIktZXCIsIFwiemlwXCI6IFwiNDIyOTBcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJjb252YWxsaXMgbWFnbmEgcmlzdXMgbWFnbmEgcG9ydHRpdG9yIGFsaXF1YW0gb2RpbyBhbWV0IHRlbGx1cyBzaXQgaW4gYW1ldCBhdCBwaGFyZXRyYSBlbGl0IGFjIGNvbnNlY3RldHVyIGF1Z3VlIHRvcnRvciB0b3J0b3IgaWQgcHJldGl1bSBhbGlxdWFtIHF1aXMgcHVsdmluYXIgbmVxdWUgY29udmFsbGlzIGFudGUgdHVycGlzIG9kaW8gc2VkIGhlbmRyZXJpdFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDIwLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkFuZHlcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkJyYXN3ZWxsXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJDU3d5ZXJzQGVyb3MubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIigzMzcpMDI4LTA5NzhcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjkzNTkgQXQgU3RcIiwgXCJjaXR5XCI6IFwiTW91bHRyaWVcIiwgXCJzdGF0ZVwiOiBcIkFaXCIsIFwiemlwXCI6IFwiOTU5MDZcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJldCBuZWMgbGFjdXMgdGVtcG9yIHRlbXBvciBhbWV0IG1vbGVzdGllIHNlZCBhbWV0IHBvcnR0aXRvciBwcmV0aXVtIGV0aWFtIGxhY3VzIHNlZCBldCBtYWduYSBkb2xvciBtb2xlc3RpZSBzdXNwZW5kaXNzZSBtYXR0aXMgYW1ldCB0b3J0b3IgdGluY2lkdW50IG1hZ25hIG5lcXVlIHRvcnRvciBvZGlvIHNpdCB2ZWxpdCBzaXQgdGluY2lkdW50IHRlbXBvclwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg2MSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJMYXRpYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiSXZhbm9za2lcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk5LaW5kZXJAdmVsaXQuY29tXCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjY0KTQ1NC00MjYxXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI1NTgwIE9kaW8gUmRcIiwgXCJjaXR5XCI6IFwiSm9obnNvbiBDb3VudHlcIiwgXCJzdGF0ZVwiOiBcIk5WXCIsIFwiemlwXCI6IFwiNTc2MTJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJ0b3J0b3IgYWMgbGFjdXMgdGVsbHVzIHNlZCBzYXBpZW4gZWxpdCBtYXNzYSBzZWQgdmVzdGlidWx1bSBtYWduYSBub24gZnJpbmdpbGxhIG51bGxhbSB2ZXN0aWJ1bHVtIGF0IGxvcmVtIG1vcmJpIGFtZXQgZG9sb3IgdHVycGlzIHJpc3VzIHRpbmNpZHVudCB0ZWxsdXMgbWF0dGlzIHNpdCBlZ2V0IGxhY3VzIHNpdCBzYXBpZW4gbGFjdXMgZG9sb3JcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAyMDksXG4gICAgICAgIFwiZmlyc3ROYW1lXCI6IFwiTWVsaW5kYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiRGVuYXJkXCIsXG4gICAgICAgIFwiZW1haWxcIjogXCJKQWx1YUBkb2xvci5pb1wiLFxuICAgICAgICBcInBob25lXCI6IFwiKDE3OSk5MTgtMjc5NFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMjAyOCBFZ2VzdGFzIFN0XCIsIFwiY2l0eVwiOiBcIkFydmFkYVwiLCBcInN0YXRlXCI6IFwiRkxcIiwgXCJ6aXBcIjogXCI4NzQxM1wifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcImVnZXQgZWxlbWVudHVtIGV0IG1vbGVzdGllIHRpbmNpZHVudCBzZWQgY29uc2VxdWF0IHZlbGl0IGRvbG9yIHNpdCBmYWNpbGlzaXMgbWFnbmEgb2RpbyBldCB0ZW1wb3IgaXBzdW0gdmVzdGlidWx1bSBsaWJlcm8gbGliZXJvIGxhY3VzIG1vcmJpIG1hdHRpcyBmcmluZ2lsbGEgbW9yYmkgZHVpIGV0aWFtIHZlbCBuZWMgdGluY2lkdW50IHNvbGxpY2l0dWRpbiBwb3J0dGl0b3IgY29udmFsbGlzXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogNzY4LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIkdlcmFsZGluZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTGVuemVcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkpQbG91cmRlQGF1Z3VlLmNvbVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMzMikzMjctODgyNFwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiODQ0NCBBbGlxdWFtIEF2ZVwiLCBcImNpdHlcIjogXCJCYXRvbiBSb3VnZVwiLCBcInN0YXRlXCI6IFwiREVcIiwgXCJ6aXBcIjogXCIxNzc1MVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInN1c3BlbmRpc3NlIGF0IHZpdGFlIGlwc3VtIGxpYmVybyBsaWJlcm8gdGVtcG9yIGFtZXQgY29uc2VjdGV0dXIgcG9ydHRpdG9yIHNpdCBtb2xlc3RpZSBudW5jIGF0IHByZXRpdW0gcGxhY2VyYXQgY29uc2VjdGV0dXIgb3JjaSBkb2xvciBtb3JiaSBhbGlxdWFtIGFtZXQgc3VzcGVuZGlzc2UgcG9ydGEgc2FwaWVuIGFtZXQgcG9ydHRpdG9yIG1pIHNlZCBsZWN0dXMgbmVxdWUgdG9ydG9yXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogOTgyLFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlNoZWlsYVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiTGVzc2VuYmVycnlcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIlJMYW5kcnVtQGN1cmFiaXR1ci5seVwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDMzMCkwMTktOTgzMVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiMTU2NyBFdCBEclwiLCBcImNpdHlcIjogXCJSYXBpZCBDaXR5XCIsIFwic3RhdGVcIjogXCJWVFwiLCBcInppcFwiOiBcIjc2NjQxXCJ9LFxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwibWFzc2Egb3JjaSBpZCBhbnRlIGxlY3R1cyBsaWJlcm8gbnVuYyBzZWQgc2FnaXR0aXMgdGluY2lkdW50IGlwc3VtIHRlbGx1cyBzZWQgYWVuZWFuIGVsaXQgYXQgdGVsbHVzIGFjIHNpdCBzZWQgZG9uZWMgaW4gc2FnaXR0aXMgYW1ldCBwbGFjZXJhdCBkdWkgdmVsaXQgaW4gZG9sb3IgZWdlc3RhcyBwbGFjZXJhdCBzZWRcIlxuICAgIH0sIHtcbiAgICAgICAgXCJpZFwiOiAzMCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJWaXJnaXNcIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIlJvc3NcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIk1HaXBwbGVAcHVsdmluYXIuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMjg0KTU5Ni0yMzEyXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI5OTU0IFZlc3RpYnVsdW0gRHJcIiwgXCJjaXR5XCI6IFwiQ2hhcmxlc3RvblwiLCBcInN0YXRlXCI6IFwiQ09cIiwgXCJ6aXBcIjogXCI2NjUwNVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInZlbGl0IG51bGxhbSBsb3JlbSBwcmV0aXVtIG51bGxhbSBtYXR0aXMgcHJldGl1bSB0ZW1wb3Igc2VkIHBvcnR0aXRvciBvcmNpIG5lYyBuZXF1ZSBwbGFjZXJhdCBzaXQgcXVpcyBoZW5kcmVyaXQgc2VkIGRvbmVjIHNlZCBzYWdpdHRpcyBzYWdpdHRpcyBtYWduYSBudW5jIHB1bHZpbmFyIGF0IGRvbG9yIGFlbmVhbiBkb2xvciB0b3J0b3Igbm9uIHNlZFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDUxMyxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKaW1cIixcbiAgICAgICAgXCJsYXN0TmFtZVwiOiBcIkV2ZXJseVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiVENhcnN0ZW5zQG1hZ25hLm5ldFwiLFxuICAgICAgICBcInBob25lXCI6IFwiKDEyNik0MTUtMzQxOVwiLFxuICAgICAgICBcImFkcmVzc1wiOiB7XCJzdHJlZXRBZGRyZXNzXCI6IFwiNzY3NyBEb2xvciBTdFwiLCBcImNpdHlcIjogXCJXYXV3YXRvc2FcIiwgXCJzdGF0ZVwiOiBcIk9SXCIsIFwiemlwXCI6IFwiNDE5MzJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJkb2xvciBlbGl0IGxpYmVybyBkdWkgdGVsbHVzIHRvcnRvciBtYWduYSBvZGlvIG1hZ25hIG1hZ25hIGVsZW1lbnR1bSB2ZXN0aWJ1bHVtIG1hZ25hIHRpbmNpZHVudCB0aW5jaWR1bnQgcG9ydGEgc3VzcGVuZGlzc2UgbmVxdWUgdmVzdGlidWx1bSBvZGlvIHNpdCBtYWduYSB0ZW1wb3IgY29udmFsbGlzIGlwc3VtIHZpdGFlIG1vcmJpIHBvcnR0aXRvciBzYWdpdHRpcyBhbWV0IGRvbmVjIHNlZFwiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDg2NCxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKYXNvblwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiS2VubmVkeVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiREZyZW5jaEBzZWQuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoMzU1KTY4NC00ODUwXCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIxMjE5IER1aSBBdmVcIiwgXCJjaXR5XCI6IFwiQmVsdHN2aWxsZVwiLCBcInN0YXRlXCI6IFwiUklcIiwgXCJ6aXBcIjogXCIxODMxNVwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIm1vbGVzdGllIGF0IGFtZXQgYXQgdGluY2lkdW50IGZyaW5naWxsYSBtYWduYSBoZW5kcmVyaXQgYWMgZWxlbWVudHVtIGVnZXQgdml0YWUgYWMgYXQgY3VyYWJpdHVyIGFkaXBpc2NpbmcgYWMgcmlzdXMgbG9yZW0gZHVpIGxpYmVybyBlbGl0IHBsYWNlcmF0IGlkIGF1Z3VlIGlwc3VtIHR1cnBpcyBzYXBpZW4gcmlzdXMgc29sbGljaXR1ZGluIHNlZCBhY1wiXG4gICAgfSwge1xuICAgICAgICBcImlkXCI6IDgyMSxcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJKZWZmcmV5XCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCYXJ0bGV0dFwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiQUxlbnpAbGFjdXMuZ292XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNjE5KTYyNC0wNjU1XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCI2NzkxIFNhcGllbiBEclwiLCBcImNpdHlcIjogXCJBcmxpbmd0b25cIiwgXCJzdGF0ZVwiOiBcIlROXCIsIFwiemlwXCI6IFwiNTc1ODNcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzZWQgbGFjdXMgc2FnaXR0aXMgYWMgcmlzdXMgbWFnbmEgY29udmFsbGlzIHNvbGxpY2l0dWRpbiBuZWMgZWxpdCBhdWd1ZSBwbGFjZXJhdCBtYWduYSBwdWx2aW5hciBvcmNpIHN1c3BlbmRpc3NlIGFtZXQgbWFnbmEgbW9sZXN0aWUgdGluY2lkdW50IG9kaW8gcXVpcyBkb25lYyBwdWx2aW5hciBvcmNpIG5lYyBoZW5kcmVyaXQgbnVuYyBwbGFjZXJhdCBuZXF1ZSBpbiB2ZXN0aWJ1bHVtXCJcbiAgICB9LCB7XG4gICAgICAgIFwiaWRcIjogOTc5LFxuICAgICAgICBcImZpcnN0TmFtZVwiOiBcIlRlcnJlbmNlXCIsXG4gICAgICAgIFwibGFzdE5hbWVcIjogXCJCZWxsZXF1ZVwiLFxuICAgICAgICBcImVtYWlsXCI6IFwiR1BhdGVsQGVnZXN0YXMubHlcIixcbiAgICAgICAgXCJwaG9uZVwiOiBcIig1OTMpNDc3LTgwOTlcIixcbiAgICAgICAgXCJhZHJlc3NcIjoge1wic3RyZWV0QWRkcmVzc1wiOiBcIjIyMTkgVmVzdGlidWx1bSBSZFwiLCBcImNpdHlcIjogXCJTb21lcnNldFwiLCBcInN0YXRlXCI6IFwiREVcIiwgXCJ6aXBcIjogXCI2MzU1MlwifSxcbiAgICAgICAgXCJkZXNjcmlwdGlvblwiOiBcInNvbGxpY2l0dWRpbiBmcmluZ2lsbGEgbnVuYyBtYXR0aXMgdGVtcG9yIHRlbXBvciBxdWlzIHBsYWNlcmF0IHBvcnRhIHJpc3VzIHBsYWNlcmF0IG9kaW8gbGVjdHVzIHNlZCB0dXJwaXMgbGliZXJvIGVnZXN0YXMgbGliZXJvIGFjIHJ1dHJ1bSBudW5jIGFsaXF1YW0gc29sbGljaXR1ZGluIGFjIHB1bHZpbmFyIHNpdCBhYyBhZW5lYW4gc29sbGljaXR1ZGluIHZpdGFlIGFtZXQgYXVndWVcIlxuICAgIH0sXG4gICAge1xuICAgICAgICBcImlkXCI6IDk3OTY2NixcbiAgICAgICAgXCJmaXJzdE5hbWVcIjogXCJUZXJyZW5jZVwiLFxuICAgICAgICBcImxhc3ROYW1lXCI6IFwiQmVsbGVxdWVcIixcbiAgICAgICAgXCJlbWFpbFwiOiBcIkdQYXRlbEBlZ2VzdGFzLmx5XCIsXG4gICAgICAgIFwicGhvbmVcIjogXCIoNTkzKTQ3Ny04MDk5XCIsXG4gICAgICAgIFwiYWRyZXNzXCI6IHtcInN0cmVldEFkZHJlc3NcIjogXCIyMjE5IFZlc3RpYnVsdW0gUmRcIiwgXCJjaXR5XCI6IFwiU29tZXJzZXRcIiwgXCJzdGF0ZVwiOiBcIkRFXCIsIFwiemlwXCI6IFwiNjM1NTJcIn0sXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJzb2xsaWNpdHVkaW4gZnJpbmdpbGxhIG51bmMgbWF0dGlzIHRlbXBvciB0ZW1wb3IgcXVpcyBwbGFjZXJhdCBwb3J0YSByaXN1cyBwbGFjZXJhdCBvZGlvIGxlY3R1cyBzZWQgdHVycGlzIGxpYmVybyBlZ2VzdGFzIGxpYmVybyBhYyBydXRydW0gbnVuYyBhbGlxdWFtIHNvbGxpY2l0dWRpbiBhYyBwdWx2aW5hciBzaXQgYWMgYWVuZWFuIHNvbGxpY2l0dWRpbiB2aXRhZSBhbWV0IGF1Z3VlXCJcbiAgICB9XG5cbl07IiwiaW1wb3J0IHt0YWJsZSBhcyB0YWJsZUNvbXBvbmVudEZhY3Rvcnl9IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7dGFibGV9IGZyb20gJ3NtYXJ0LXRhYmxlLWNvcmUnO1xuaW1wb3J0IHJvdyBmcm9tICcuL2NvbXBvbmVudHMvcm93JztcbmltcG9ydCBzdW1tYXJ5IGZyb20gJy4vY29tcG9uZW50cy9zdW1tYXJ5JztcbmltcG9ydCBwYWdpbmF0aW9uIGZyb20gJy4vY29tcG9uZW50cy9wYWdpbmF0aW9uJztcbmltcG9ydCBkZXNjcmlwdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvZGVzY3JpcHRpb24nO1xuXG5pbXBvcnQge2RhdGF9IGZyb20gJy4vZGF0YUxvYWRlcic7XG5cbmNvbnN0IHRhYmxlQ29udGFpbmVyRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGFibGUtY29udGFpbmVyJyk7XG5jb25zdCB0Ym9keSA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcigndGJvZHknKTtcbmNvbnN0IHN1bW1hcnlFbCA9IHRhYmxlQ29udGFpbmVyRWwucXVlcnlTZWxlY3RvcignW2RhdGEtc3Qtc3VtbWFyeV0nKTtcblxuY29uc3QgdCA9IHRhYmxlKHtkYXRhLCB0YWJsZVN0YXRlOiB7c29ydDoge30sIGZpbHRlcjoge30sIHNsaWNlOiB7cGFnZTogMSwgc2l6ZTogNTB9fX0pO1xuY29uc3QgdGFibGVDb21wb25lbnQgPSB0YWJsZUNvbXBvbmVudEZhY3Rvcnkoe2VsOiB0YWJsZUNvbnRhaW5lckVsLCB0YWJsZTogdH0pO1xuXG5zdW1tYXJ5KHt0YWJsZTogdCwgZWw6IHN1bW1hcnlFbH0pO1xuXG5jb25zdCBwYWdpbmF0aW9uQ29udGFpbmVyID0gdGFibGVDb250YWluZXJFbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1zdC1wYWdpbmF0aW9uXScpO1xucGFnaW5hdGlvbih7dGFibGU6IHQsIGVsOiBwYWdpbmF0aW9uQ29udGFpbmVyfSk7XG5cblxuY29uc3QgZGVzY3JpcHRpb25Db250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVzY3JpcHRpb24tY29udGFpbmVyJyk7XG50Ym9keS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGV2ZW50ID0+IHtcblxuICAgIGxldCB0YXJnZXQgPSBldmVudC50YXJnZXQ7XG5cbiAgICBsZXQgdHIgPSB0YXJnZXQuY2xvc2VzdCgndHInKTtcbiAgICBpZiAoIXRyKSByZXR1cm47XG4gICAgaWYgKCF0Ym9keS5jb250YWlucyh0cikpIHJldHVybjtcblxuICAgIGxldCBkYXRhSW5kZXggPSB0ci5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKTtcblxuICAgIGlmIChkYXRhSW5kZXggJiYgZGF0YVtkYXRhSW5kZXhdKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuICAgICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5hcHBlbmRDaGlsZChkZXNjcmlwdGlvbihkYXRhW2RhdGFJbmRleF0pKTtcbiAgICB9XG59KTtcblxuXG50YWJsZUNvbXBvbmVudC5vbkRpc3BsYXlDaGFuZ2UoZGlzcGxheWVkID0+IHtcblxuICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgdGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gICAgZm9yIChsZXQgciBvZiBkaXNwbGF5ZWQpIHtcbiAgICAgICAgY29uc3QgbmV3Q2hpbGQgPSByb3coci52YWx1ZSwgci5pbmRleCwgdCk7XG4gICAgICAgIHRib2R5LmFwcGVuZENoaWxkKG5ld0NoaWxkKTtcbiAgICB9XG59KTsiXSwibmFtZXMiOlsicG9pbnRlciIsImZpbHRlciIsInNvcnRGYWN0b3J5Iiwic29ydCIsInNlYXJjaCIsInRhYmxlIiwiZXhlY3V0aW9uTGlzdGVuZXIiLCJzdW1tYXJ5RGlyZWN0aXZlIiwidGFibGVEaXJlY3RpdmUiLCJzdW1tYXJ5IiwicGFnaW5hdGlvbiJdLCJtYXBwaW5ncyI6Ijs7O0FBQU8sU0FBUyxJQUFJLEVBQUUsQ0FBQyxFQUFF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
