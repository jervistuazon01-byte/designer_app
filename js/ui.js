import { STATE } from './state.js';
// Circular dependency removed. using dynamic imports.

export const els = {
    container: null,
    c: null,
    toolbar: null,
    tools: {},
    imgUpload: null,
    refImgUpload: null,
    arrowTools: null,
    arrowColor: null,
    arrowThickness: null,
    textTools: null,
    textColor: null,
    textSize: null,
    imageTools: null,
    setBaseBtn: null,
    brushTools: null,
    brushColor: null,
    brushThickness: null,
    brushLabel: null,
    fovTools: null,
    fovAngle: null,
    fovAngleValue: null,
    fovLength: null,
    setRefImageBtn: null,
    refImageLabel: null,
    selectionTools: null,
    deleteSelectionBtn: null,
    propertiesPanel: null,
    promptInput: null,
    modelSelect: null,
    aspectRatioSelect: null,
    settingsBtn: null,
    generateBtn: null,
    settingsModal: null,
    closeSettingsBtn: null,
    saveSettingsBtn: null,
    apiKeyInput: null,
    debugModeToggle: null,
    payloadModal: null,
    closePayloadBtn: null,
    sendRequestBtn: null,
    payloadPrompt: null,
    payloadImagePreview: null,
    resultModal: null,
    resultImage: null,
    closeResultBtn: null,
    downloadBtn: null,
    addToCanvasBtn: null,
    floatingGallery: null,
    galleryGrid: null,
    toggleGalleryBtn: null,
    connectionStatus: null
};

export function initUI() {
    els.container = document.getElementById('workspace-container');
    els.c = document.getElementById('c');
    els.toolbar = document.querySelector('.floating-toolbar');

    els.tools = {
        select: document.getElementById('toolSelect'),
        pan: document.getElementById('toolPan'),
        arrow: document.getElementById('toolArrow'),
        text: document.getElementById('toolText'),
        circle: document.getElementById('toolCircle'),
        rect: document.getElementById('toolRect'),
        image: document.getElementById('toolImage'),
        brush: document.getElementById('toolBrush'),
        remove: document.getElementById('toolRemove'),
        fov: document.getElementById('toolFov'),
        undo: document.getElementById('toolUndo'),
        clear: document.getElementById('toolClear')
    };


    els.imgUpload = document.getElementById('imgUpload');
    els.arrowTools = document.getElementById('arrowTools');
    els.arrowColor = document.getElementById('arrowColor');
    els.arrowThickness = document.getElementById('arrowThickness');
    els.textTools = document.getElementById('textTools');
    els.textColor = document.getElementById('textColor');
    els.textSize = document.getElementById('textSize');

    els.imageTools = document.getElementById('imageTools');
    els.setBaseBtn = document.getElementById('setBaseBtn');
    els.setBaseBtn = document.getElementById('setBaseBtn');

    els.brushTools = document.getElementById('brushTools');
    els.brushColor = document.getElementById('brushColor');
    els.brushThickness = document.getElementById('brushThickness');
    els.brushLabel = document.getElementById('brushLabel');

    els.fovTools = document.getElementById('fovTools');
    els.fovAngle = document.getElementById('fovAngle');
    els.fovAngleValue = document.getElementById('fovAngleValue');
    els.fovLength = document.getElementById('fovLength');
    els.setRefImageBtn = document.getElementById('setRefImageBtn');
    els.refImageLabel = document.getElementById('refImageLabel');
    els.refImgUpload = document.getElementById('refImgUpload');

    els.selectionTools = document.getElementById('selectionTools');
    els.deleteSelectionBtn = document.getElementById('deleteSelectionBtn');

    els.propertiesPanel = document.getElementById('propertiesPanel');

    els.promptInput = document.getElementById('promptInput');
    els.modelSelect = document.getElementById('modelSelect');
    els.aspectRatioSelect = document.getElementById('aspectRatioSelect');
    els.resolutionSelect = document.getElementById('resolutionSelect');
    els.settingsBtn = document.getElementById('settingsBtn');
    els.generateBtn = document.getElementById('generateBtn');

    els.settingsModal = document.getElementById('settingsModal');
    els.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    els.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    els.apiKeyInput = document.getElementById('apiKeyInput');
    els.debugModeToggle = document.getElementById('debugModeToggle');

    els.payloadModal = document.getElementById('payloadModal');
    els.closePayloadBtn = document.getElementById('closePayloadBtn');
    els.sendRequestBtn = document.getElementById('sendRequestBtn');
    els.payloadPrompt = document.getElementById('payloadPrompt');
    els.payloadImagePreview = document.getElementById('payloadImagePreview');

    els.resultModal = document.getElementById('resultModal');
    els.resultImage = document.getElementById('resultImage');
    els.closeResultBtn = document.getElementById('closeResultBtn');
    els.downloadBtn = document.getElementById('downloadBtn');
    els.addToCanvasBtn = document.getElementById('addToCanvasBtn');

    els.floatingGallery = document.getElementById('floatingGallery');
    els.galleryGrid = document.getElementById('galleryGrid');
    els.toggleGalleryBtn = document.getElementById('toggleGalleryBtn');

    els.connectionStatus = document.getElementById('connectionStatus');
    els.applyColorBtn = document.getElementById('applyColorBtn');
}

export function updateStatus(isOnline) {
    if (isOnline) {
        els.connectionStatus.classList.remove('offline');
        els.connectionStatus.classList.add('online');
        els.connectionStatus.title = "API Key Active";
    } else {
        els.connectionStatus.classList.add('offline');
        els.connectionStatus.classList.remove('online');
        els.connectionStatus.title = "No API Key";
    }
}

export function setupUIEvents() {
    // Settings
    els.settingsBtn.addEventListener('click', () => els.settingsModal.classList.remove('hidden'));
    els.closeSettingsBtn.addEventListener('click', () => els.settingsModal.classList.add('hidden'));

    els.apiKeyInput.value = STATE.apiKey;
    els.debugModeToggle.checked = STATE.showDebug;

    // Apply Color Toggle
    els.applyColorBtn.addEventListener('click', () => {
        const isActive = els.applyColorBtn.classList.toggle('active');
        if (isActive) {
            els.applyColorBtn.style.background = 'rgba(76, 175, 80, 0.2)';
            els.applyColorBtn.style.color = '#4CAF50';
        } else {
            els.applyColorBtn.style.background = '';
            els.applyColorBtn.style.color = '';
        }
    });


    els.saveSettingsBtn.addEventListener('click', () => {
        const key = els.apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('designer_api_key', key);
            STATE.apiKey = key;
            import('./api.js').then(module => {
                module.fetchModels(key);
            });
            updateStatus(true);
        }

        // Save Debug Preference
        STATE.showDebug = els.debugModeToggle.checked;
        localStorage.setItem('designer_show_debug', STATE.showDebug);

        els.settingsModal.classList.add('hidden');
    });

    // Result Modal
    els.closeResultBtn.addEventListener('click', () => els.resultModal.classList.add('hidden'));

    // Payload Modal
    els.closePayloadBtn.addEventListener('click', () => els.payloadModal.classList.add('hidden'));
    els.sendRequestBtn.addEventListener('click', () => {
        import('./api.js').then(module => module.executeGeneration());
    });

    // Close on Outside Click
    els.resultModal.addEventListener('click', (e) => {
        if (e.target === els.resultModal) els.resultModal.classList.add('hidden');
    });

    // Close on Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!els.resultModal.classList.contains('hidden')) els.resultModal.classList.add('hidden');
            if (!els.settingsModal.classList.contains('hidden')) els.settingsModal.classList.add('hidden');
            if (!els.payloadModal.classList.contains('hidden')) els.payloadModal.classList.add('hidden');
        }
    });

    // Add to Canvas (from Result Modal)
    // Add to Canvas (from Result Modal)
    els.addToCanvasBtn.addEventListener('click', () => {
        // Use global STATE directly (no dynamic import needed for it)
        fabric.Image.fromURL(els.resultImage.src, (img) => {
            if (!STATE.canvas) return;
            const vpt = STATE.canvas.viewportTransform;
            const centerX = (-vpt[4] + STATE.canvas.width / 2) / vpt[0];
            const centerY = (-vpt[5] + STATE.canvas.height / 2) / vpt[3];
            img.set({ left: centerX + 50, top: centerY + 50 });
            STATE.canvas.add(img);
            STATE.canvas.setActiveObject(img);
        });
        els.resultModal.classList.add('hidden');
    });

    // Download (from Result Modal)
    els.downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `remix_${Date.now()}.jpg`;
        link.href = els.resultImage.src;
        link.click();
    });
}

export function updatePropertiesPanel(toolName, selectedType = null) {
    // Hide all first
    els.arrowTools.classList.add('hidden');
    els.textTools.classList.add('hidden');
    els.imageTools.classList.add('hidden');
    els.brushTools.classList.add('hidden');
    els.fovTools.classList.add('hidden');
    els.selectionTools.classList.add('hidden');
    els.propertiesPanel.classList.add('hidden');

    // Check if there's a selected object to show delete button
    const hasSelection = STATE.canvas && STATE.canvas.getActiveObject() &&
        !STATE.canvas.getActiveObject().data?.isWorkspace;

    // Pan Persistence Logic:
    // If panning, checking if we have an active object. If so, show its properties.
    if (toolName === 'pan' && STATE.canvas) {
        const active = STATE.canvas.getActiveObject();
        if (active) {
            if (active.type === 'image') {
                selectedType = 'image';
                toolName = 'select'; // Treat as select mode for UI
            }
        }
    }

    if (toolName === 'arrow') {
        els.propertiesPanel.classList.remove('hidden');
        els.arrowTools.classList.remove('hidden');
    } else if (toolName === 'text') {
        els.propertiesPanel.classList.remove('hidden');
        els.textTools.classList.remove('hidden');
    } else if (toolName === 'select' && selectedType === 'image') {
        els.propertiesPanel.classList.remove('hidden');
        els.imageTools.classList.remove('hidden');
    } else if (toolName === 'brush') {
        els.propertiesPanel.classList.remove('hidden');
        els.brushTools.classList.remove('hidden');
        els.brushLabel.textContent = "Brush Style";
        els.brushColor.parentElement.style.display = 'flex'; // Show color
    } else if (toolName === 'remove') {
        els.propertiesPanel.classList.remove('hidden');
        els.brushTools.classList.remove('hidden');
        els.brushLabel.textContent = "Remove Tool (Magenta)";
        els.brushColor.parentElement.style.display = 'block';
        els.brushColor.style.display = 'none'; // Hide color picker (fixed magenta)
    } else if (toolName === 'fov') {
        els.propertiesPanel.classList.remove('hidden');
        els.fovTools.classList.remove('hidden');
    } else if (toolName === 'select' && selectedType === 'fov') {
        els.propertiesPanel.classList.remove('hidden');
        els.fovTools.classList.remove('hidden');
    } else {
        // Ensure color picker is visible for next time (reset state)
        if (els.brushColor) els.brushColor.style.display = '';
    }

    // Show selection tools (delete button) when any object is selected
    if (hasSelection && (toolName === 'select' || toolName === 'pan')) {
        els.propertiesPanel.classList.remove('hidden');
        els.selectionTools.classList.remove('hidden');
    }
}
