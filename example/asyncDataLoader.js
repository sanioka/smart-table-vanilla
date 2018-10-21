/**
 * Модуль асинхронной загрузки данных
 * В случае успешной загрузки передаёт управление подписчикам
 * Так же управляет DOM: спиннер загрузки и обработка ошибок
 */

export default DataLoader;

const STATE_LOADING = 'STATE_LOADING';
const STATE_EMPTY = 'STATE_EMPTY';
const STATE_LOADED_SUCCESSFUL = 'STATE_LOADED_SUCCESSFUL';

class DataLoader {

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
                    let url = el.getAttribute('data-src');
                    if (url) {
                        this.renderState = STATE_LOADING;

                        fetch(url)
                            .then(response => {
                                this.renderState = STATE_LOADED_SUCCESSFUL;
                                return response.json()
                            })
                            .then(response => {
                                for (let handler of this.eventListeners) {
                                    handler(response);
                                }
                            })
                            .catch(err => {
                                this.renderState = STATE_EMPTY;
                                console.error(err)
                            })
                    }
                })
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

}