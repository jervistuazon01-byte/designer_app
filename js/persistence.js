
// --- IndexedDB Persistence ---

// --- IndexedDB Persistence ---
const DB_NAME = 'nano_banana_db';
const STORE_NAME = 'images';
const WORKSPACE_STORE = 'workspace';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
                db.createObjectStore(WORKSPACE_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
}

export async function saveImageToDB(meta, dataUrl) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = {
                ...meta,
                dataUrl: dataUrl,
                timestamp: new Date().toLocaleString(),
                isFavorite: false
            };
            const request = store.add(record);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    } catch (e) {
        console.error("Failed to save to DB:", e);
        return null;
    }
}

export async function deleteImage(id) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
    } catch (e) {
        console.error("Failed to delete image:", e);
    }
}

export async function fetchAllImages() {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch (e) {
        console.error("Failed to load DB:", e);
        return [];
    }
}

export async function fetchImageById(id) {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return new Promise((resolve) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}


// --- Workspace Persistence ---

export async function saveWorkspaceToDB(json) {
    try {
        const db = await initDB();
        const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
        const store = tx.objectStore(WORKSPACE_STORE);
        store.put({ key: 'autosave', data: json, timestamp: Date.now() });
    } catch (e) {
        console.error("Failed to save workspace to DB:", e);
    }
}

export async function loadWorkspaceFromDB() {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(WORKSPACE_STORE, 'readonly');
            const store = tx.objectStore(WORKSPACE_STORE);
            const req = store.get('autosave');

            req.onsuccess = () => {
                if (req.result && req.result.data) {
                    resolve(req.result.data);
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("Failed to load workspace from DB:", e);
        return null;
    }
}
