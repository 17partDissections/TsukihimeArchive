(function () {
	var h1 = document.querySelector('h1');
	if (!h1 || h1.textContent.trim() !== 'Auto') return;

	var path = window.location.pathname;
	var marker = '/archive/';
	var archiveIndex = path.indexOf(marker);

	if (archiveIndex === -1) return;
	var folderPath = path
		.substring(archiveIndex + marker.length)
		.replace(/\.html$/i, '');

	if (folderPath) {
		h1.textContent = decodeURIComponent(folderPath);
	}
})();