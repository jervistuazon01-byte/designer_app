import { STATE } from './state.js';
import { initUI, setupUIEvents, updateStatus } from './ui.js';
import { initCanvas, setupResize } from './canvas-manager.js';
import { setupTools, setupDropzone } from './tools.js';
import { setupGallery } from './gallery.js';
import { setupGeneration, fetchModels } from './api.js';

function init() {
    initUI();
    initCanvas();
    setupResize();
    setupTools();
    setupDropzone();
    setupUIEvents();
    setupGeneration();
    setupGallery();

    // Prevent default middle-click scroll (Global)
    window.addEventListener('mousedown', (e) => {
        if (e.button === 1) e.preventDefault();
    }, { passive: false });

    // Initial Status Check
    if (STATE.apiKey) {
        updateStatus(true);
        fetchModels(STATE.apiKey);
    } else {
        updateStatus(false);
        // Even if offline/no-key, we load models (hardcoded list)
        fetchModels('');
    }

    console.log("Nano Banana Application Initialized (ES Modules)");
}

// Start
init();
