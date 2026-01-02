const OLD_KEY_NAME = 'nano_banana_key';
const NEW_KEY_NAME = 'designer_api_key';

// Auto-migrate key if old exists and new doesn't
if (localStorage.getItem(OLD_KEY_NAME) && !localStorage.getItem(NEW_KEY_NAME)) {
    localStorage.setItem(NEW_KEY_NAME, localStorage.getItem(OLD_KEY_NAME));
    // Optional: localStorage.removeItem(OLD_KEY_NAME);
}

export const STATE = {
    apiKey: localStorage.getItem(NEW_KEY_NAME) || '',
    showDebug: localStorage.getItem('designer_show_debug') === 'true',
    canvas: null,
    cameraFrame: null, // Visual Camera
    activeTool: 'select',
    isDragging: false,
    lastPosX: 0,
    lastPosY: 0,
    clipboard: null,
    drawingObject: null,
    pendingPayload: null, // For debugging modal
    previousTool: null, // For middle-click panning

    // Undo/Redo
    history: [],
    historyIndex: -1,
    isUndoing: false,

    // FOV Marker
    fovMarker: null,      // The Fabric.js group containing the FOV marker
    refImageBase64: null  // Base64 of the reference image for style transfer
};
