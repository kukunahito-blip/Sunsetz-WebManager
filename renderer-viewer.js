const titleSpan = document.getElementById('dynamic-title');

window.electronAPI.onUpdateTitle((title) => {
    titleSpan.innerText = title;
});