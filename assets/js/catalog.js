class CatalogGenerator {
    constructor(basePath = '/archive') {
        this.basePath = basePath;
        this.sidebar = document.querySelector('.sidebar');
        this.isReady = false;
        this.pendingPath = null;
        this.cache = new Map();
    }

    async init() {
        this.sidebar = this.sidebar || document.querySelector('.sidebar');
        const catalogContent = await this.generateCatalog(this.basePath);
        const placeholder = this.sidebar ? this.sidebar.querySelector('#catalog') : document.getElementById('catalog');
        
        if (placeholder) {
            placeholder.outerHTML = catalogContent;
        }
        
        this.attachEventListeners();
        this.isReady = true;

        if (this.pendingPath) {
            await this.expandPathToFolder(this.pendingPath);
            this.pendingPath = null;
        }
    }

    async generateCatalog(folderPath) {
        const contents = await this.getFolderContents(folderPath);
        const items = contents.filter(item => item.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
        
        let html = '<div class="catalog" id="catalog">';
        for (const item of items) { 
            html += await this.generateItemHtml(item, folderPath); 
        }
        html += '</div>';
        return html;
    }

    async generateItemHtml(item, parentPath) {
        const itemPath = `${parentPath}/${item.name}`;
        const hasHtmlFile = await this.checkForHtmlFile(parentPath, item.name);
        const linkHref = hasHtmlFile
            ? `${parentPath}/${item.name}.html`
            : `${itemPath}/`;

        const children = await this.getFolderContents(itemPath);
        const hasChildren = children.some(c => c.type === 'folder');

        let html = `<div class="catalog-folder${hasChildren ? '' : ' no-children'}" data-path="${itemPath}">`;
        
        if (hasChildren) {
            html += `<span class="catalog-toggle"></span>`;
            html += `<a href="${linkHref}" target="content" class="catalog-link">${item.name}</a>`;
            // Контейнер создается пустым. Содержимое загрузится только при клике
            html += `<div class="catalog hidden" data-loaded="false"></div>`;
        } else {
            html += `<span class="catalog-toggle-placeholder"></span>`;
            html += `<a href="${linkHref}" target="content" class="catalog-link">${item.name}</a>`;
        }
        html += `</div>`;
        return html;
    }

    async checkForHtmlFile(parentPath, folderName) {
        try {
            const response = await fetch(`${parentPath}/${folderName}.html`, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    async getFolderContents(folderPath) {
        if (this.cache.has(folderPath)) {
            return this.cache.get(folderPath);
        }
        try {
            const response = await fetch(`${folderPath}/`, {
                method: 'GET',
                headers: { 'Accept': 'text/html' }
            });
            if (!response.ok) return [];
            const html = await response.text();
            const items = this.parseDirectoryListing(html);
            this.cache.set(folderPath, items); // Сохраняем в кэш
            return items;
        } catch {
            return [];
        }
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
        if (!this.sidebar) return;
        this.sidebar.addEventListener('click', async (event) => {
            const toggle = event.target.closest('.catalog-toggle');
            if (toggle) {
                event.preventDefault();
                await this.toggleFolder(toggle);
            }
        });
    }

    async loadSubCatalog(folderDiv, subCatalog) {
        if (subCatalog.dataset.loaded !== 'false') return;

        const path = folderDiv.dataset.path;
        const contents = await this.getFolderContents(path);
        const childFolders = contents
            .filter(item => item.type === 'folder')
            .sort((a, b) => a.name.localeCompare(b.name));

        let html = '';
        for (const child of childFolders) {
            html += await this.generateItemHtml(child, path);
        }
        subCatalog.innerHTML = html;
        subCatalog.dataset.loaded = 'true';
    }

    async toggleFolder(toggleEl) {
        const folderDiv = toggleEl.closest('.catalog-folder');
        const subCatalog = folderDiv.querySelector(':scope > .catalog');
        if (subCatalog) {
            if (subCatalog.dataset.loaded === 'false') {
                await this.loadSubCatalog(folderDiv, subCatalog);
            }
            subCatalog.classList.toggle('hidden');
            folderDiv.classList.toggle('expanded');
        }
    }

    async expandPathToFolder(targetPath) {
        if (!this.isReady) {
            this.pendingPath = targetPath;
            return;
        }
        const normalizedTarget = targetPath.replace(/\/+$/, '');
        const parts = normalizedTarget.split('/').filter(Boolean);
        
        let currentPath = '';
        for (const part of parts) {
            currentPath += '/' + part;
            
            if (!currentPath.startsWith(this.basePath)) continue;

            const folder = document.querySelector(`.catalog-folder[data-path="${currentPath}"]`);
            if (folder) {
                const sub = folder.querySelector(':scope > .catalog');
                if (sub) {
                    if (sub.dataset.loaded === 'false') {
                        await this.loadSubCatalog(folder, sub);
                    }
                    sub.classList.remove('hidden');
                    folder.classList.add('expanded');
                }
            }
        }
    }

    collapseAll() {
        const subCatalogs = document.querySelectorAll('.catalog-folder > .catalog');
        subCatalogs.forEach(sub => sub.classList.add('hidden'));

        const expandedFolders = document.querySelectorAll('.catalog-folder.expanded');
        expandedFolders.forEach(folder => folder.classList.remove('expanded'));
    }
}

let catalogInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    catalogInstance = new CatalogGenerator('/archive');
    catalogInstance.init();
});

window.updateCatalogToFolder = async function(folderPath) {
    if (catalogInstance) {
        await catalogInstance.expandPathToFolder(folderPath);
    }
};

window.collapseCatalog = function() {
    if (catalogInstance) {
        catalogInstance.collapseAll();
    }
};