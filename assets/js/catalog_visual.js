document.addEventListener('DOMContentLoaded', async () => {
    const pathname = window.location.pathname;
    const fileWithExt = pathname.substring(pathname.lastIndexOf('/') + 1);
    const fileName = fileWithExt.substring(0, fileWithExt.lastIndexOf('.'));
    const currentDir = pathname.substring(0, pathname.lastIndexOf('/'));
    const subfolderDir = `${currentDir}/${fileName}`;

    if (window.parent && window.parent.updateCatalogToFolder) {
        window.parent.updateCatalogToFolder(subfolderDir);
    }

    const folderList = document.querySelector('.folder-list');
    if (!folderList) return;

    folderList.innerHTML = '';

    const parentCustomImg = `assets/images/folder_${fileName}.png`;
    const defaultFolderImg = `assets/images/folder.png`;
    const parentImgSrc = await checkImageExists(parentCustomImg)
        ? parentCustomImg
        : defaultFolderImg;

    const contents = await getFolderContents(subfolderDir);

    const subfolders = contents
        .filter(i => i.type === 'folder')
        .sort((a, b) => a.name.localeCompare(b.name));

    const files = contents
        .filter(i => {
            if (i.type !== 'file') return false;
            const lower = i.name.toLowerCase();
            return !lower.endsWith('.html') && !lower.endsWith('.htm');
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const folder of subfolders) {
        const hasHtml = await checkForHtmlFile(subfolderDir, folder.name);
        const enc = encodeURIComponent(folder.name);
        const href = hasHtml
            ? `${subfolderDir}/${enc}.html`
            : `${subfolderDir}/${enc}/`;

        const childCustomImg = `assets/images/folder_${folder.name}.png`;

        const card = document.createElement('a');
        card.className = 'folder-card';
        card.href = href;
        card.title = folder.name;
        card.onclick = () => {
            const folderPath = `${subfolderDir}/${folder.name}`;
            if (window.parent && window.parent.updateCatalogToFolder) {
                window.parent.updateCatalogToFolder(folderPath);
            }
        };

        card.innerHTML = `
            <div class="folder-box">
                <img src="${childCustomImg}" 
                     onerror="this.onerror=null; this.src='${parentImgSrc}';" 
                     alt="${folder.name}">
            </div>
            <div class="folder-name-box">${folder.name}</div>
        `;
        folderList.appendChild(card);
    }

    const imgExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

    for (const file of files) {
        const ext = getFileExtension(file.name);
        const href = `${subfolderDir}/${encodeURIComponent(file.name)}`;

        const card = document.createElement('a');
        card.className = 'folder-card file-card';
        card.href = href;
        card.title = file.name;
        card.setAttribute('download', file.name);

        if (imgExtensions.includes(ext)) {
            card.innerHTML = `
                <div class="folder-box">
                    <img class="file-preview" src="${href}" 
                         onerror="this.onerror=null; this.src='assets/images/file_${ext}.png'; this.addEventListener('error', function() { this.src='assets/images/file.png'; }, {once: true});" 
                         alt="${file.name}">
                </div>
                <div class="folder-name-box">${file.name}</div>
            `;
        } else {
            const customFileImg = `assets/images/file_${ext}.png`;
            const defaultFileImg = `assets/images/file.png`;
            card.innerHTML = `
                <div class="folder-box">
                    <img src="${customFileImg}" 
                         onerror="this.onerror=null; this.src='${defaultFileImg}';" 
                         alt="${file.name}">
                </div>
                <div class="folder-name-box">${file.name}</div>
            `;
        }

        folderList.appendChild(card);
    }

    const zipCard = document.createElement('a');
    zipCard.className = 'folder-card';
    zipCard.href = 'javascript:void(0)';
    zipCard.title = 'to zip';
    zipCard.onclick = async () => {
        await downloadFolderAsZip(subfolderDir, fileName);
    };
    zipCard.innerHTML = `
        <div class="folder-box">
            <img src="assets/images/zip.png" alt="zip">
        </div>
        <div class="folder-name-box">to zip</div>
    `;
    folderList.appendChild(zipCard);

    const parentDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
    const parentDirName = currentDir.substring(currentDir.lastIndexOf('/') + 1);

    const backHref = (parentDirName === 'archive')
        ? 'home.html'
        : `${parentDir}/${parentDirName}.html`;

    const backCard = document.createElement('a');
    backCard.className = 'folder-card';
    backCard.href = backHref;
    backCard.innerHTML = `
        <div class="folder-box">
            <img src="assets/images/back.png" alt="back">
        </div>
        <div class="folder-name-box" data-i18n="back">back</div>
    `;
    folderList.appendChild(backCard);
});

function getFileExtension(filename) {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex === -1 || dotIndex === 0) return '';
    return filename.substring(dotIndex + 1).toLowerCase();
}

async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

async function checkForHtmlFile(parentPath, folderName) {
    try {
        const response = await fetch(`${parentPath}/${encodeURIComponent(folderName)}.html`, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

async function getFolderContents(folderPath) {
    try {
        const response = await fetch(`${folderPath}/`, {
            method: 'GET',
            headers: { 'Accept': 'text/html' }
        });
        if (!response.ok) return [];
        const html = await response.text();
        return parseDirectoryListing(html);
    } catch {
        return [];
    }
}

function parseDirectoryListing(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a[href]');
    const items = [];

    links.forEach(link => {
        let href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        if (!href || text === '') return;

        const lowerText = text.toLowerCase();

        if (href.startsWith('?') || href.includes('?C=') || href.includes(';O=')) return;

        if (href.includes('../') || text === '..' || text === '.' || href.startsWith('./') ||
            lowerText === 'parent directory' || lowerText === '[parent directory]' ||
            lowerText === 'name' || lowerText === 'last modified' || lowerText === 'size' || lowerText === 'description') {
            return;
        }

        let name = href;
        let type = 'file';
        
        if (name.endsWith('/')) { 
            name = name.slice(0, -1); 
            type = 'folder'; 
        }
        
        try {
            name = decodeURIComponent(name);
        } catch {
        }

        if (!name) return;

        items.push({ name, type, href });
    });
    return items;
}

async function downloadFolderAsZip(folderPath, folderName) {
    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = async () => {
            const JSZip = window.JSZip;
            const zip = new JSZip();
            
            await addFolderToZip(zip, folderPath, '');
            
            const blob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        document.head.appendChild(script);
    } catch (error) {
        console.error('Error creating zip:', error);
    }
}

async function addFolderToZip(zip, folderPath, zipPath) {
    const contents = await getFolderContents(folderPath);
    
    for (const item of contents) {
        const itemPath = `${folderPath}/${encodeURIComponent(item.name)}`;
        const itemZipPath = zipPath ? `${zipPath}/${item.name}` : item.name;
        
        if (item.type === 'folder') {
            await addFolderToZip(zip, itemPath, itemZipPath);
        } else {
            const lower = item.name.toLowerCase();
            if (lower.endsWith('.html') || lower.endsWith('.htm')) {
                continue;
            }
            
            try {
                const response = await fetch(itemPath);
                const blob = await response.blob();
                zip.file(itemZipPath, blob);
            } catch (error) {
                console.error(`Error fetching ${item.name}:`, error);
            }
        }
    }
}