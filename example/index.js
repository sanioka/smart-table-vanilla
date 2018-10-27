import AsyncDataLoader from './components/async-data-loader';
import SmartTable from './components/smart-table/smart-table';

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
let asyncDataLoader = AsyncDataLoader.createInstance({buttonsConfig});
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
        smartTable = SmartTable.createInstance({data: responseData});
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