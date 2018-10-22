/**
 * Модуль асинхронной загрузки данных
 * В случае успешной загрузки отправляет данные в eventListeners
 * Так же управляет DOM, спиннером загрузки и обрабатывает ошибки
 */

export default AsyncDataLoader;

const STATE_LOADING = 'STATE_LOADING';
const STATE_EMPTY = 'STATE_EMPTY';
const STATE_LOADED_SUCCESSFUL = 'STATE_LOADED_SUCCESSFUL';

class AsyncDataLoader {

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
                                    console.error(err)
                                })
                        }
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

    get renderState() {
        return this._renderState;
    }

}