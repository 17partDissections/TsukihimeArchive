class CatalogGenerator {
    constructor(basePath = '/TsukihimeArchive/archive') {
        this.basePath = basePath;
        this.sidebar = document.querySelector('.sidebar');
    }
    async init() {
        const catalogContent = await this.generateCatalog(this.basePath);
        const placeholder = this.sidebar.querySelector('#catalog');
        placeholder.outerHTML = catalogContent;
        this.attachEventListeners();
    }
    async generateCatalog(folderPath, isNested = false) {
        const contents = await this.getFolderContents(folderPath);
        const items = contents.filter(item => item.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
        let html = '';
        if (!isNested) {
            html += '<div class="catalog" id="catalog">';
            //html += '<b data-i18n="sidebar.catalog">sidebar.catalog</b>';
        } else {
            html += '<div class="catalog hidden">';
        }
        for (const item of items) { html += await this.generateItemHtml(item, folderPath); }
        html += '</div>';
        return html;
    }
    async generateItemHtml(item, parentPath) { //glory to ai
        const itemPath = `${parentPath}/${item.name}`;
        const children = await this.getFolderContents(itemPath);
        const childFolders = children.filter(c => c.type === 'folder');
        const hasChildren = childFolders.length > 0;
        const hasIndexHtml = await this.checkForIndexHtml(itemPath, item.name);
        const linkHref = hasIndexHtml
            ? `${itemPath}/${item.name}.html`
            : `${itemPath}/`;
        let html = `<div class="catalog-folder${hasChildren ? '' : ' no-children'}">`;
        if (hasChildren) {
            html += `<span class="catalog-toggle" data-folder="${itemPath}"></span>`;
            let sub = '<div class="catalog hidden">';
            for (const child of childFolders) {
                sub += await this.generateItemHtml(child, itemPath);
            }
            sub += '</div>';
            html += `<a href="${linkHref}" target="content">${item.name}</a>`;
            html += sub;
        } else {
            html += `<span class="catalog-toggle-placeholder"></span>`;
            html += `<a href="${linkHref}" target="content">${item.name}</a>`;
        }
        html += `</div>`;
        return html;
    }
    async checkForIndexHtml(folderPath, folderName) {
        const response = await fetch(`${folderPath}/${folderName}.html`, { method: 'HEAD' });
        return response.ok;
    }
    async getFolderContents(folderPath) {
        const response = await fetch(`${folderPath}/`, {
            method: 'GET',
            headers: { 'Accept': 'text/html' }
        });
        const html = await response.text();
        return this.parseDirectoryListing(html);
    }
    parseDirectoryListing(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href]');
        const items = [];
        links.forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();
            if (!href || text === '') return;
            const lower = text.toLowerCase();
            if (href.includes('../') || text === '..' || lower === 'parent directory' || lower === '[parent directory]') return;
            let name = text;
            let type = 'file';
            if (name.endsWith('/')) {
                name = name.slice(0, -1);
                type = 'folder';
            }
            if (href.endsWith('/')) type = 'folder';
            if (type !== 'folder') return;
            items.push({ name, type, href });
        });
        return items;
    }
    attachEventListeners() {
        this.sidebar.addEventListener('click', (event) => {
            const toggle = event.target.closest('.catalog-toggle');
            if (toggle) {
                event.preventDefault();
                this.toggleFolder(toggle);
            }
        });
    }
    toggleFolder(toggleEl) {
        const folderDiv = toggleEl.closest('.catalog-folder');
        const subCatalog = folderDiv.querySelector(':scope > .catalog');
        const isHidden = subCatalog.classList.contains('hidden');

        subCatalog.classList.toggle('hidden', !isHidden);
        folderDiv.classList.toggle('expanded', isHidden);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new CatalogGenerator('/TsukihimeArchive/archive').init();
});