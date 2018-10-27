/**
 * Абстрактный класс компонента
 * От него наследуются все остальные компоненты страницы
 */

export default AbstractComponent;

class AbstractComponent {
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
    appendTo(selector, isReplace = true) {
        if (isReplace) {
            let container = document.getElementById(selector);
            if (container) {
                container.parentNode.replaceChild(this.domElement, container);
                this.domElement.className = selector;
                this.domElement.setAttribute('id', selector);
            }
        } else {

            this.appendChildSafety(document.querySelector(selector), this.domElement);
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