/**
 * Модуль асинхронной загрузки данных
 * В случае успешной загрузки отправляет данные в eventListeners
 * Так же управляет DOM, спиннером загрузки и обрабатывает ошибки
 */
import AbstractComponent from "./abstract-component";

export default AsyncDataLoader;

const STATE_LOADING = 'STATE_LOADING';
const STATE_EMPTY = 'STATE_EMPTY';
const STATE_LOADED_SUCCESSFUL = 'STATE_LOADED_SUCCESSFUL';

const AFTER_ACTION = 'AFTER_ACTION';
const BEFORE_ACTION = 'BEFORE_ACTION';

class AsyncDataLoader extends AbstractComponent {

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
            )
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
                            console.error(err)
                        })
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
            instance = new AsyncDataLoader(params);
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