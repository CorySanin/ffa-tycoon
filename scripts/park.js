document.addEventListener("DOMContentLoaded", function () {
    const datefield = document.getElementById('parkdate');
    const date = new Date(document.getElementById('rawdate').firstChild.wholeText.trim());
    datefield.removeChild(datefield.lastChild);
    datefield.appendChild(document.createTextNode(`(${date.toLocaleDateString()})`));
});
