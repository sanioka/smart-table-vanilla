import AsyncDataLoader from './components/async-data-loader';
import SmartTable from './components/smart-table/smart-table';

let tableContainer = document.getElementById('table-container');

// #1 Инициализируем асинхронный загрузчик данных
let dataLoader = AsyncDataLoader.createInstance({
    container: document.getElementById('data-loader-container'),
    spinnerContainer: document.getElementById('loading-spinner'),
    tableContainer: tableContainer
});

// #2 Инициализируем модуль отображения данных
let smartTable;

function onLoadedData(responseData) {
    if (smartTable) {
        smartTable.onDestroy();
        smartTable = null;
    }

    smartTable = SmartTable.createInstance({tableContainer, data: responseData});
}

// #3 Привязываем сущности
if (dataLoader) {
    dataLoader.bind(onLoadedData);
}