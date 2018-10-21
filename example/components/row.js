export default function ({id, firstName, lastName, email, phone}, index) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-index', index);
    tr.innerHTML = `<td>${id}</td><td>${firstName}</td><td>${lastName}</td><td>${email}</td><td>${phone}</td>`;
    return tr;
}