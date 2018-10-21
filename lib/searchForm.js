import {search} from 'smart-table-core';

export default function ({el, table, delay = 400, conf = {}}) {
    const scope = conf.scope || (el.getAttribute('data-st-search-form') || '').split(',').map(s => s.trim());
    const component = search({table, scope});

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
            })


        }
    }

};