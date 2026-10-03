class CatalogGenerator {
    constructor(basePath = '/TsukihimeArchive/archive') {
        this.basePath = basePath;
        this.sidebar = document.querySelector('.sidebar');
        this.isReady = false;
        this.pendingPath = null;
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
            this.expandPathToFolder(this.pendingPath);
            this.pendingPath = null;
        }
    }
    async generateCatalog(folderPath, isNested = false) {
        const contents = await this.getFolderContents(folderPath);
        const items = contents.filter(item => item.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
        
        let html = isNested 
            ? '<div class="catalog hidden">' 
            : '<div class="catalog" id="catalog">';
        
        for (const item of items) { 
            html += await this.generateItemHtml(item, folderPath); 
        }
        html += '</div>';
        return html;
    }
    async generateItemHtml(item, parentPath) {
        const itemPath = `${parentPath}/${item.name}`;
        const children = await this.getFolderContents(itemPath);
        const childFolders = children.filter(c => c.type === 'folder');
        const hasChildren = childFolders.length > 0;
        const hasHtmlFile = await this.checkForHtmlFile(parentPath, item.name);
        const linkHref = hasHtmlFile
            ? `${parentPath}/${item.name}.html`
            : `${itemPath}/`;

        let html = `<div class="catalog-folder${hasChildren ? '' : ' no-children'}" data-path="${itemPath}">`;
        
        if (hasChildren) {
            html += `<span class="catalog-toggle"></span>`;
            let sub = '<div class="catalog hidden">';
            for (const child of childFolders) { 
                sub += await this.generateItemHtml(child, itemPath); 
            }
            sub += '</div>';
            html += `<a href="${linkHref}" target="content" class="catalog-link">${item.name}</a>`;
            html += sub;
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
        try {
            const response = await fetch(`${folderPath}/`, {
                method: 'GET',
                headers: { 'Accept': 'text/html' }
            });
            if (!response.ok) return [];
            const html = await response.text();
            return this.parseDirectoryListing(html);
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
        if (subCatalog) {
            subCatalog.classList.toggle('hidden');
            folderDiv.classList.toggle('expanded');
        }
    }
    expandPathToFolder(targetPath) {
        if (!this.isReady) {
            this.pendingPath = targetPath;
            return;
        }
        const normalizedTarget = targetPath.replace(/\/+$/, '');
        const folders = document.querySelectorAll('.catalog-folder[data-path]');
        folders.forEach(folder => {
            const p = folder.dataset.path.replace(/\/+$/, '');
            if (normalizedTarget === p || normalizedTarget.startsWith(p + '/')) {
                const sub = folder.querySelector(':scope > .catalog');
                if (sub) {
                    sub.classList.remove('hidden');
                    folder.classList.add('expanded');
                }
            }
        });
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
    catalogInstance = new CatalogGenerator('/TsukihimeArchive/archive');
    catalogInstance.init();
});
window.updateCatalogToFolder = function(folderPath) {
    if (catalogInstance) {
        catalogInstance.expandPathToFolder(folderPath);
    }
};
window.collapseCatalog = function() {
    if (catalogInstance) {
        catalogInstance.collapseAll();
    }
};