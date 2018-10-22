export default function (el) {
    if (el) {
        el.innerHTML = `
        <div data-st-loading-indicator="">
            Processing ...
        </div>
        <table>
            <thead>
            <tr>
                <th colspan="5">
                    <div data-st-search-form="id, firstName, lastName, email, phone">
                        <label for="search">global search</label>
                        <input id="search" placeholder="Case sensitive search" type="text"/>
                        <button id="searchButton">Search</button>
                    </div>
                </th>
            </tr>
            <tr>
                <th data-st-sort="id" data-st-sort-cycle>Id</th>
                <th data-st-sort="firstName">firstName</th>
                <th data-st-sort="lastName">lastName</th>
                <th data-st-sort="email">email</th>
                <th data-st-sort="phone">phone</th>
            </tr>
            </thead>
            <tbody>
            <tr>
                <td colspan="5">Loading data ...</td>
            </tr>
            </tbody>
            <tfoot>
            <tr>
                <td colspan="3" data-st-summary></td>
                <td colspan="2">
                    <div data-st-pagination></div>
                </td>
            </tr>
            </tfoot>
        </table>

        <div id="description-container">
        </div>`
    }
}