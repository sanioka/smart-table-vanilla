import {summary} from 'smart-table-core'

// TODO: переписать на appendChild, выпилить работу со строками и innerHTML

export default function summaryComponent({table, el}) {
    const dir = summary({table});
    dir.onSummaryChange(({page, size, filteredCount}) => {
        el.innerHTML = `showing items <strong>${(page - 1) * size + (filteredCount > 0 ? 1 : 0)}</strong> - <strong>${Math.min(filteredCount, page * size)}</strong> of <strong>${filteredCount}</strong> matching items`;
    });
    return dir;
}