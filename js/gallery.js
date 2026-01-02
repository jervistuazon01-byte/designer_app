import { els } from './ui.js';
import { STATE } from './state.js';
import { fetchAllImages, fetchImageById, deleteImage, saveImageToDB } from './persistence.js';
import { initCanvas } from './canvas-manager.js'; // Just in case, but unlikely needed here
import { setTool } from './tools.js';

export function setupGallery() {
    els.toggleGalleryBtn.addEventListener('click', () => {
        els.floatingGallery.classList.toggle('collapsed');
        const icon = els.toggleGalleryBtn.querySelector('.material-icons-round');
        icon.textContent = els.floatingGallery.classList.contains('collapsed') ? 'expand_less' : 'expand_more';
    });

    refreshGallery();
}

export function refreshGallery() {
    fetchAllImages().then(images => {
        els.galleryGrid.innerHTML = ''; // Clear
        if (images && images.length > 0) {
            // Append in order (Newest Top? logic in original was prepend. DB returns oldest first usually?)
            // If DB returns oldest first, we should reverse to show newest top?
            // Original code: "Append in order... addToGallery prepends". 
            // So iterating array [1, 2, 3] -> prepend(1) -> [1] -> prepend(2) -> [2, 1].
            // So if DB returns oldest first, this reverses it (Newest First). Correct.
            images.forEach(img => {
                addToGallery(img.dataUrl, img, img.id);
            });
        }
    });
}

export function addToGallery(dataUrl, meta, id) {
    const div = document.createElement('div');
    div.className = 'gallery-thumb';
    // Use ID for actions
    div.innerHTML = `
        <img src="${dataUrl}" loading="lazy" style="cursor: pointer;" title="View Large">
        <div class="thumb-actions">
            <button class="thumb-btn add-btn" title="Add to Canvas">
                <span class="material-icons-round" style="font-size:16px">add_photo_alternate</span>
            </button>
            <button class="thumb-btn download-btn" title="Download">
                <span class="material-icons-round" style="font-size:16px">download</span>
            </button>
            <button class="thumb-btn delete-btn delete" title="Delete">
                <span class="material-icons-round" style="font-size:16px">delete</span>
            </button>
        </div>
    `;

    // Attach Event Listeners (instead of inline, for modules)
    const img = div.querySelector('img');
    img.addEventListener('click', () => openInLightbox(dataUrl));

    div.querySelector('.add-btn').addEventListener('click', () => addFromHistory(id));
    div.querySelector('.download-btn').addEventListener('click', () => downloadFromHistory(id));
    div.querySelector('.delete-btn').addEventListener('click', () => deleteFromHistory(id));

    els.galleryGrid.prepend(div);
}

export function openInLightbox(url) {
    els.resultImage.src = url;
    els.resultModal.classList.remove('hidden');
}


async function addFromHistory(id) {
    const item = await fetchImageById(id);
    if (item) {
        fabric.Image.fromURL(item.dataUrl, (img) => {
            const vpt = STATE.canvas.viewportTransform;
            const centerX = (-vpt[4] + STATE.canvas.width / 2) / vpt[0];
            const centerY = (-vpt[5] + STATE.canvas.height / 2) / vpt[3];
            img.set({ left: centerX, top: centerY, originX: 'center', originY: 'center' });
            STATE.canvas.add(img);
            STATE.canvas.setActiveObject(img);
            setTool('select');
        });
    }
}

async function deleteFromHistory(id) {
    if (confirm("Delete this image?")) {
        await deleteImage(id);
        refreshGallery();
    }
}

async function downloadFromHistory(id) {
    if (id === 'temp') return;
    const item = await fetchImageById(id);
    if (item) {
        const link = document.createElement('a');
        link.download = `remix_${id}.jpg`;
        link.href = item.dataUrl;
        link.click();
    }
}
