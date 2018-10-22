import AsyncDataLoader from './components/async-data-loader';
import SmartTable from './components/smart-table/smart-table';

let tableContainer = document.getElementById('table-container');

// #1 Инициализируем асинхронный загрузчик данных
let dataLoader = new AsyncDataLoader(
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

    smartTable = new SmartTable(tableContainer, responseData);
}

// #3 Привязываем сущности
dataLoader.bind(onLoadedData);