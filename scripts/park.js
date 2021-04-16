document.addEventListener("DOMContentLoaded", function () {
    const datefield = document.getElementById('parkdate');
    const date = new Date(parseInt(document.getElementById('rawdate').firstChild.wholeText));
    datefield.removeChild(datefield.lastChild);
    datefield.appendChild(document.createTextNode(`(${date.toLocaleDateString()})`));
});