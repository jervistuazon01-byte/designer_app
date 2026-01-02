import { STATE } from './state.js';
import { saveWorkspaceToDB, loadWorkspaceFromDB } from './persistence.js';
import { setTool, handleImageFiles } from './tools.js';

export function initCanvas() {
    STATE.canvas = new fabric.Canvas('c', {
        backgroundColor: '#0d0d0d',
        selection: true,
        preserveObjectStacking: true
    });

    resizeCanvas();

    // 4K White Workspace
    // Check persistence first
    loadWorkspaceFromDB().then(json => {
        if (json) {
            restoreWorkspace(json);
        } else {
            createDefaultWorkspace();
        }
    });

    setupCanvasEvents();
}

function createDefaultWorkspace() {
    const workspace = new fabric.Rect({
        left: STATE.canvas.getWidth() / 2,
        top: STATE.canvas.getHeight() / 2,
        width: 4096,
        height: 4096,
        fill: '#ffffff',
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
        data: { isWorkspace: true }
    });
    STATE.canvas.add(workspace);
    STATE.canvas.sendToBack(workspace);
    setupClipPath(workspace);
    zoomToExtent();
}

function restoreWorkspace(data) {
    // Determine if json is string or object
    const json = typeof data === 'string' ? JSON.parse(data) : data;

    STATE.canvas.loadFromJSON(json, () => {
        // Enforce Workspace Logic
        let workspace = STATE.canvas.getObjects().find(o => o.data?.isWorkspace || (o.width === 4096 && o.height === 4096));

        if (!workspace) {
            createDefaultWorkspace();
        } else {
            // Re-bind properties
            if (!workspace.data) workspace.data = {};
            workspace.data.isWorkspace = true;
            workspace.set({
                fill: '#ffffff',
                selectable: false,
                evented: false
            });
            setupClipPath(workspace);
        }
        STATE.canvas.renderAll();
        console.log("Workspace restored.");
        zoomToExtent();
    });
}

function setupClipPath(workspace) {
    STATE.canvas.clipPath = new fabric.Rect({
        originX: 'center',
        originY: 'center',
        // Actually, if workspace is static center, this is fine.
        // Wait, standard logic used width/2 of canvas.
        // Let's use workspace coordinates.
        left: workspace.left,
        top: workspace.top,
        width: 4096,
        height: 4096,
        absolutePositioned: true
    });
}

export function saveWorkspace() {
    try {
        const json = STATE.canvas.toJSON(['data', 'selectable', 'evented', 'id', 'name']);
        saveWorkspaceToDB(json);
    } catch (e) {
        console.error("Error saving workspace:", e);
    }
}

export function resizeCanvas() {
    if (!STATE.canvas) return;
    STATE.canvas.setWidth(window.innerWidth);
    STATE.canvas.setHeight(window.innerHeight);
    STATE.canvas.renderAll();
}

export function setupResize() {
    window.addEventListener('resize', resizeCanvas);
}

// Global Event Listeners for Canvas Interaction (Zoom, Pan override)
function setupCanvasEvents() {
    STATE.canvas.on('mouse:wheel', function (opt) {
        var delta = opt.e.deltaY;
        var zoom = STATE.canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        STATE.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // --- Mobile Touch Support (Pinch Zoom & Pan) ---
    setupTouchEvents();

    // Auto-Save & History
    const handleModification = () => {
        saveWorkspace();
        saveHistory();
    };

    STATE.canvas.on('object:modified', handleModification);
    STATE.canvas.on('object:added', handleModification);
    STATE.canvas.on('object:removed', handleModification);
    STATE.canvas.on('path:created', handleModification);

    // Boundary Constraint
    STATE.canvas.on('object:moving', function (e) {
        const obj = e.target;
        const workspace = STATE.canvas.getObjects().find(o => o.data?.isWorkspace);
        if (!workspace) return;

        const centerX = workspace.left;
        const centerY = workspace.top;
        const limit = 2048; // Half of 4096

        if (obj.left < centerX - limit) obj.left = centerX - limit;
        if (obj.left > centerX + limit) obj.left = centerX + limit;
        if (obj.top < centerY - limit) obj.top = centerY - limit;
        if (obj.top > centerY + limit) obj.top = centerY + limit;
    });

    // --- Undo/Redo Keys ---
    window.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
            e.preventDefault();
            redo();
        }

        // --- Layer Management Keys ---
        // [: Send Backwards, ]: Bring Forward
        // Shift+[: Send to Back, Shift+]: Bring to Front
        if (STATE.canvas.getActiveObject() && !e.target.matches('input, textarea')) {
            if (e.key === '[') {
                e.preventDefault();
                if (e.shiftKey) sendToBack();
                else sendBackwards();
            }
            if (e.key === ']') {
                e.preventDefault();
                if (e.shiftKey) bringToFront();
                else bringForward();
            }

            // --- Nudging (Arrow Keys) ---
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const active = STATE.canvas.getActiveObject();

                if (e.key === 'ArrowUp') active.top -= step;
                if (e.key === 'ArrowDown') active.top += step;
                if (e.key === 'ArrowLeft') active.left -= step;
                if (e.key === 'ArrowRight') active.left += step;

                active.setCoords();
                STATE.canvas.renderAll();
                saveHistory(); // Auto-save after nudge
            }
        }

        // --- Copy (Internal) ---
        if ((e.ctrlKey || e.metaKey) && !e.target.matches('input, textarea')) {
            if (e.key === 'c') {
                e.preventDefault();
                copy();
            }
            // We REMOVE Ctrl+V here to allow the system 'paste' event to fire.
        }
    });

    // --- Global Paste Listener (System + Internal) ---
    window.addEventListener('paste', (e) => {
        // console.log("Paste detected", e.clipboardData.items);
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let imageFound = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                handleImageFiles([blob]); // Use existing tool logic
                imageFound = true;
                e.preventDefault(); // Prevent default browser paste (if any)
            }
        }

        // If no system image was pasted, try internal object paste
        if (!imageFound) {
            paste();
        }
    });

    // Initial Save
    saveHistory();
}

// --- History Logic ---

export function saveHistory() {
    if (STATE.isUndoing) return;

    // Prune redo stack
    if (STATE.historyIndex < STATE.history.length - 1) {
        STATE.history = STATE.history.slice(0, STATE.historyIndex + 1);
    }

    const json = JSON.stringify(STATE.canvas.toJSON(['data', 'selectable', 'evented', 'id', 'name']));
    STATE.history.push(json);
    STATE.historyIndex = STATE.history.length - 1;

    // Limit stack
    if (STATE.history.length > 20) {
        STATE.history.shift();
        STATE.historyIndex--;
    }
    // console.log("History Saved. Index:", STATE.historyIndex);
}

export function undo() {
    if (STATE.historyIndex <= 0) return; // Nothing to undo

    STATE.isUndoing = true;
    STATE.historyIndex--;
    const json = STATE.history[STATE.historyIndex];
    restoreCanvasState(json);
}

export function redo() {
    if (STATE.historyIndex >= STATE.history.length - 1) return; // Nothing to redo

    STATE.isUndoing = true;
    STATE.historyIndex++;
    const json = STATE.history[STATE.historyIndex];
    restoreCanvasState(json);
}

function restoreCanvasState(json) {
    STATE.canvas.loadFromJSON(json, () => {
        // Re-apply workspace constraints/logic if needed
        const workspace = STATE.canvas.getObjects().find(o => o.data?.isWorkspace);
        if (workspace) {
            workspace.set({ selectable: false, evented: false });
            setupClipPath(workspace); // Ensure clip path logic persists
        }

        STATE.canvas.renderAll();
        STATE.isUndoing = false;
        // console.log("State Restored. Index:", STATE.historyIndex);
    });
}


// --- Layer Logic ---

function sendBackwards() {
    const active = STATE.canvas.getActiveObject();
    if (active) {
        STATE.canvas.sendBackwards(active);
        ensureWorkspaceAtBottom();
        saveHistory();
    }
}

function sendToBack() {
    const active = STATE.canvas.getActiveObject();
    if (active) {
        STATE.canvas.sendToBack(active);
        ensureWorkspaceAtBottom(); // Fix: Workspace must be absolute bottom
        saveHistory();
    }
}

function bringForward() {
    const active = STATE.canvas.getActiveObject();
    if (active) {
        STATE.canvas.bringForward(active);
        saveHistory();
    }
}

function bringToFront() {
    const active = STATE.canvas.getActiveObject();
    if (active) {
        STATE.canvas.bringToFront(active);
        saveHistory();
    }
}

function ensureWorkspaceAtBottom() {
    const workspace = STATE.canvas.getObjects().find(o => o.data?.isWorkspace);
    if (workspace) {
        STATE.canvas.sendToBack(workspace);
    }
}

// --- Copy / Paste Logic ---

function copy() {
    const active = STATE.canvas.getActiveObject();
    if (active) {
        active.clone(function (cloned) {
            STATE.clipboard = cloned;
        });
    }
}

function paste() {
    if (!STATE.clipboard) return;

    STATE.clipboard.clone(function (clonedObj) {
        STATE.canvas.discardActiveObject();

        clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true
        });

        if (clonedObj.type === 'activeSelection') {
            // Active selection needs a canvas reference
            clonedObj.canvas = STATE.canvas;
            clonedObj.forEachObject(function (obj) {
                STATE.canvas.add(obj);
            });
            // this should solve the unselectability
            clonedObj.setCoords();
        } else {
            STATE.canvas.add(clonedObj);
        }

        STATE.clipboard.top += 20;
        STATE.clipboard.left += 20;

        STATE.canvas.setActiveObject(clonedObj);
        STATE.canvas.requestRenderAll();
        saveHistory();
    });
}

export function zoomToExtent() {
    if (!STATE.canvas) return;

    // Get all objects except workspace (if we want to zoom to CONTENT)
    // Or just Zoom to Workspace if no content?
    // User said "all elements".
    // If we have content, zoom to content + margin.
    // If valid workspace exists, maybe ensuring it fits is good?
    // Let's assume content first.

    const objects = STATE.canvas.getObjects().filter(o => !o.data?.isWorkspace);

    let targetObjects = objects;
    if (objects.length === 0) {
        // Fallback to workspace if empty
        const ws = STATE.canvas.getObjects().find(o => o.data?.isWorkspace);
        if (ws) targetObjects = [ws];
        else return; // Nothing
    }

    if (targetObjects.length === 0) return;

    // Calculate bounding rect
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    targetObjects.forEach(o => {
        const b = o.getBoundingRect();
        if (b.left < minX) minX = b.left;
        if (b.top < minY) minY = b.top;
        if (b.left + b.width > maxX) maxX = b.left + b.width;
        if (b.top + b.height > maxY) maxY = b.top + b.height;
    });

    const width = maxX - minX;
    const height = maxY - minY;

    const x = minX + width / 2;
    const y = minY + height / 2;

    // Fit to view
    const availableWidth = STATE.canvas.getWidth();
    const availableHeight = STATE.canvas.getHeight();

    // Add 10% padding
    const padding = 0.9;

    const zoomX = (availableWidth * padding) / width;
    const zoomY = (availableHeight * padding) / height;

    let zoom = Math.min(zoomX, zoomY);
    // remove cap at 1 to allow zooming in
    // Users usually mean "Show me everything". If everything is tiny, maybe max 1 is good?
    // If it's the 4k workspace, zoom will be < 1.
    // Let's uncap max zoom? No, zooming in too much on a single dot is bad. Cap at 5?
    if (zoom > 5) zoom = 5;

    // Center view
    STATE.canvas.setZoom(zoom);
    STATE.canvas.absolutePan({
        x: x * zoom - availableWidth / 2,
        y: y * zoom - availableHeight / 2
    });

    STATE.canvas.renderAll();
}

// --- Mobile Touch Events (Pinch Zoom & Two-Finger Pan) ---
function setupTouchEvents() {
    const canvasEl = STATE.canvas.upperCanvasEl;

    let touchState = {
        touches: [],
        lastDistance: 0,
        lastCenter: { x: 0, y: 0 },
        isPinching: false,
        isPanning: false
    };

    // Calculate distance between two touch points
    function getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate center point between two touches
    function getCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    canvasEl.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            touchState.isPinching = true;
            touchState.isPanning = true;
            touchState.lastDistance = getDistance(e.touches[0], e.touches[1]);
            touchState.lastCenter = getCenter(e.touches[0], e.touches[1]);

            // Disable object selection during pinch
            STATE.canvas.selection = false;
            STATE.canvas.discardActiveObject();
            STATE.canvas.requestRenderAll();
        }
    }, { passive: false });

    canvasEl.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2 && touchState.isPinching) {
            e.preventDefault();

            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const currentCenter = getCenter(e.touches[0], e.touches[1]);

            // Calculate zoom change
            const scale = currentDistance / touchState.lastDistance;
            let zoom = STATE.canvas.getZoom() * scale;

            // Clamp zoom
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;

            // Zoom to pinch center
            const canvasRect = canvasEl.getBoundingClientRect();
            const zoomPoint = {
                x: currentCenter.x - canvasRect.left,
                y: currentCenter.y - canvasRect.top
            };
            STATE.canvas.zoomToPoint(zoomPoint, zoom);

            // Pan based on center movement
            const deltaX = currentCenter.x - touchState.lastCenter.x;
            const deltaY = currentCenter.y - touchState.lastCenter.y;

            const vpt = STATE.canvas.viewportTransform;
            vpt[4] += deltaX;
            vpt[5] += deltaY;
            STATE.canvas.setViewportTransform(vpt);

            // Update state for next frame
            touchState.lastDistance = currentDistance;
            touchState.lastCenter = currentCenter;

            STATE.canvas.requestRenderAll();
        }
    }, { passive: false });

    canvasEl.addEventListener('touchend', function (e) {
        if (e.touches.length < 2) {
            touchState.isPinching = false;
            touchState.isPanning = false;

            // Re-enable selection after pinch ends
            if (STATE.activeTool === 'select') {
                STATE.canvas.selection = true;
            }
        }
    }, { passive: true });

    // Prevent default touch behaviors that interfere
    canvasEl.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    canvasEl.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
    canvasEl.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}
