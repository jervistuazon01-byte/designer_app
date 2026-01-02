import { STATE } from './state.js';
import { els, updatePropertiesPanel } from './ui.js';
import { saveWorkspace, undo } from './canvas-manager.js';


// --- Tool Setup ---

export function setupTools() {
    els.tools.select.addEventListener('click', () => setTool('select'));
    els.tools.pan.addEventListener('click', () => setTool('pan'));
    els.tools.arrow.addEventListener('click', () => setTool('arrow'));

    els.tools.text.addEventListener('click', () => setTool('text'));

    els.tools.circle.addEventListener('click', () => setTool('circle'));
    els.tools.rect.addEventListener('click', () => setTool('rect'));

    els.tools.rect.addEventListener('click', () => setTool('rect'));

    els.tools.image.addEventListener('click', () => els.imgUpload.click());
    els.imgUpload.addEventListener('change', (e) => handleImageFiles(e.target.files));

    els.tools.brush.addEventListener('click', () => setTool('brush'));
    els.tools.remove.addEventListener('click', () => setTool('remove'));
    els.tools.fov.addEventListener('click', () => setTool('fov'));

    // Undo Button (for mobile accessibility)
    els.tools.undo.addEventListener('click', () => undo());

    // Brush Properties
    els.brushColor.addEventListener('input', updateBrush);
    els.brushThickness.addEventListener('input', updateBrush);

    // Delete Key Support
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Prevent backspace from going back if not in input
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                const active = STATE.canvas.getActiveObject();
                if (active) {
                    // Don't delete workspace background
                    if (active.data?.isWorkspace) return;

                    if (active.type === 'activeSelection') {
                        active.forEachObject(o => STATE.canvas.remove(o));
                        STATE.canvas.discardActiveObject();
                    } else {
                        STATE.canvas.remove(active);
                    }
                    STATE.canvas.requestRenderAll();
                }
            }
        }
    });

    // Global Middle Click Pan Support (Moved from main.js/script.js)
    window.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Middle Click
            e.preventDefault();
            if (STATE.activeTool !== 'pan') {
                STATE.previousTool = STATE.activeTool;
                setTool('pan');
            }
            if (STATE.canvas) {
                STATE.canvas.isDragging = true;
                STATE.canvas.selection = false;
                STATE.canvas.lastPosX = e.clientX;
                STATE.canvas.lastPosY = e.clientY;
                STATE.canvas.setCursor('grabbing');
            }
        }
    }, { passive: false });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 1) {
            if (STATE.canvas) {
                STATE.canvas.isDragging = false;
                STATE.canvas.setViewportTransform(STATE.canvas.viewportTransform);
            }
            if (STATE.previousTool) {
                setTool(STATE.previousTool);
                STATE.previousTool = null;
            }
        }
    });

    // Spacebar Pan Support (Toggle skipTargetFind to prevent deselect)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat && !e.target.matches('input, textarea')) {
            if (STATE.canvas) {
                STATE.canvas.skipTargetFind = true;
                STATE.canvas.defaultCursor = 'grab';
                STATE.canvas.requestRenderAll();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            if (STATE.canvas) {
                // Restore based on active tool
                STATE.canvas.skipTargetFind = STATE.activeTool === 'pan';
                STATE.canvas.defaultCursor = STATE.activeTool === 'pan' ? 'grab' : 'default';
                STATE.canvas.requestRenderAll();
            }
        }
    });

    els.tools.clear.addEventListener('click', () => {
        if (confirm('Clear all content from the workspace?')) {
            // Soft Clear: Remove everything EXCEPT the workspace artboard
            const objects = STATE.canvas.getObjects();
            // Iterate backwards to remove safely
            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                if (!obj.data?.isWorkspace) {
                    STATE.canvas.remove(obj);
                }
            }
            STATE.canvas.discardActiveObject();
            STATE.canvas.requestRenderAll();
            setTool('select');
        }
    });

    setupCanvasToolEvents();
    setupSelectionEvents();

    els.setBaseBtn.addEventListener('click', toggleBaseImage);

    // Delete Selection Button (for mobile)
    els.deleteSelectionBtn.addEventListener('click', () => {
        const active = STATE.canvas.getActiveObject();
        if (active && !active.data?.isWorkspace) {
            if (active.type === 'activeSelection') {
                active.forEachObject(o => STATE.canvas.remove(o));
                STATE.canvas.discardActiveObject();
            } else {
                STATE.canvas.remove(active);
            }
            STATE.canvas.requestRenderAll();
            updatePropertiesPanel('select'); // Update panel to hide delete button
        }
    });

    // FOV Tool Controls
    els.fovAngle.addEventListener('input', updateFovMarker);
    els.fovLength.addEventListener('input', updateFovMarker);
    els.setRefImageBtn.addEventListener('click', () => els.refImgUpload.click());
    els.refImgUpload.addEventListener('change', handleRefImageUpload);

    // Escape Key Handler
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Check if any modal is open. If so, let ui.js handle closing it.
            // We check for existence first just in case, though they should be init.
            const isModalOpen = (els.settingsModal && !els.settingsModal.classList.contains('hidden')) ||
                (els.payloadModal && !els.payloadModal.classList.contains('hidden')) ||
                (els.resultModal && !els.resultModal.classList.contains('hidden'));

            if (!isModalOpen) {
                setTool('select');
            }
        }
    });
}

function toggleBaseImage() {
    const active = STATE.canvas.getActiveObject();
    if (active && active.type === 'image') {
        const isBase = !active.data?.isBaseImage;
        if (!active.data) active.data = {};
        active.data.isBaseImage = isBase;

        // Visual feedback? 
        // Maybe border color? Or just UI text update.
        // Fabric doesn't support 'border' easily on image without stroke.
        // Let's use opacity or just rely on the button text for now.
        // To make it clear, we can force a border.
        if (isBase) {
            active.set({
                stroke: '#4CAF50', // Green
                strokeWidth: 4,
                strokeUniform: true
            });
        } else {
            active.set({
                stroke: null,
                strokeWidth: 0
            });
        }

        STATE.canvas.requestRenderAll();
        updateBaseBtnState(active);
    }
}

function updateBaseBtnState(obj) {
    if (obj && obj.data?.isBaseImage) {
        els.setBaseBtn.classList.add('active');
        els.setBaseBtn.title = "Is Base Image";
        els.setBaseBtn.style.background = 'rgba(76, 175, 80, 0.2)';
        els.setBaseBtn.style.color = '#4CAF50';
    } else {
        els.setBaseBtn.classList.remove('active');
        els.setBaseBtn.title = "Set as Base";
        els.setBaseBtn.style.background = '';
        els.setBaseBtn.style.color = '';
    }
}

function setupSelectionEvents() {
    STATE.canvas.on('selection:created', handleSelection);
    STATE.canvas.on('selection:updated', handleSelection);
    STATE.canvas.on('selection:cleared', () => {
        updatePropertiesPanel(STATE.activeTool);
    });
}

function handleSelection(e) {
    const selected = e.selected[0];
    if (selected) {
        if (selected.type === 'image') {
            updatePropertiesPanel('select', 'image');
            updateBaseBtnState(selected);
        } else if (selected.data?.isFovMarker) {
            updatePropertiesPanel('select', 'fov');
            syncFovControlsFromMarker(selected);
        } else if (selected.type === 'i-text') {
            // Text is handled by double click usually? 
            // Logic in setTool('text') implies text creation.
            // But if we select existing text?
            updatePropertiesPanel('select', 'text'); // Optional: show text tools on select? 
            // For now, only Image needs special panel on select.
        } else {
            updatePropertiesPanel('select');
        }
    }
}

export function setTool(toolName) {
    // Cleanup pending drawing objects if switching mid-draw (e.g. via Esc)
    if (STATE.drawingObject && STATE.canvas) {
        if (STATE.drawingObject.shape) STATE.canvas.remove(STATE.drawingObject.shape);
        if (STATE.drawingObject.line) STATE.canvas.remove(STATE.drawingObject.line);
        if (STATE.drawingObject.head) STATE.canvas.remove(STATE.drawingObject.head);
        STATE.canvas.requestRenderAll();
        STATE.drawingObject = null;
    }

    STATE.activeTool = toolName;
    Object.values(els.tools).forEach(btn => btn.classList.remove('active'));
    if (els.tools[toolName]) els.tools[toolName].classList.add('active');

    if (!STATE.canvas) return;

    // Critical: Skip target find in ALL non-select modes to prevent accidental selection.
    // This allows drawing on top of images without selecting them.
    STATE.canvas.skipTargetFind = toolName !== 'select';

    STATE.canvas.defaultCursor = toolName === 'pan' ? 'grab' : 'default';
    STATE.canvas.selection = toolName === 'select';

    // Disable Drawing Mode by default
    STATE.canvas.isDrawingMode = false;

    if (toolName === 'brush' || toolName === 'remove') {
        STATE.canvas.isDrawingMode = true;
        // Ensure brush exists
        if (!STATE.canvas.freeDrawingBrush) {
            STATE.canvas.freeDrawingBrush = new fabric.PencilBrush(STATE.canvas);
        }
        updateBrush();
    } else {
        // We do NOT disable selectability here anymore. 
        // We want the selection to persist (visually) so the properties panel stays open during Pan.
        // Interaction is blocked by the 'mouse:down' event handler if tool != select.
    }

    let selectedType = null;
    if (STATE.canvas) {
        const active = STATE.canvas.getActiveObject();
        if (active) {
            if (active.type === 'image') selectedType = 'image';
            else if (active.type === 'i-text') selectedType = 'text';
        }
    }
    updatePropertiesPanel(toolName, selectedType);
}

function updateBrush() {
    if (!STATE.canvas.freeDrawingBrush) return;

    const isRemove = STATE.activeTool === 'remove';

    let color;
    if (isRemove) {
        color = '#FF00FF'; // Magenta for AI removal
    } else {
        color = els.brushColor.value || '#ff4b4b'; // User-selected or red
    }

    const width = parseInt(els.brushThickness.value, 10) || 5;

    STATE.canvas.freeDrawingBrush.color = color;
    STATE.canvas.freeDrawingBrush.width = width;
}


// --- Canvas Interaction for Tools ---

// --- Canvas Interaction for Tools ---

function setupCanvasToolEvents() {
    STATE.canvas.on('mouse:down', function (opt) {
        var evt = opt.e;

        // Pan Logic
        if (STATE.activeTool === 'pan' || evt.altKey || evt.code === 'Space' || evt.button === 1) {
            this.isDragging = true;
            this.selection = false;
            this.lastPosX = evt.clientX;
            this.lastPosY = evt.clientY;
            this.setCursor('grabbing');
            opt.e.preventDefault();
            opt.e.stopPropagation();
        } else if (STATE.activeTool === 'arrow') {
            startCreateArrow(opt);
        } else if (STATE.activeTool === 'circle' || STATE.activeTool === 'rect') {
            startCreateShape(opt);
        } else if (STATE.activeTool === 'text') {
            createInteractiveText(opt);
        } else if (STATE.activeTool === 'fov') {
            createFovMarker(opt);
        }
    });

    STATE.canvas.on('mouse:move', function (opt) {
        if (this.isDragging) {
            var e = opt.e;
            var vpt = this.viewportTransform;
            vpt[4] += e.clientX - this.lastPosX;
            vpt[5] += e.clientY - this.lastPosY;
            this.requestRenderAll();
            this.lastPosX = e.clientX;
            this.lastPosY = e.clientY;
        } else if (STATE.activeTool === 'arrow') {
            updateCreateArrow(opt);
        } else if (STATE.activeTool === 'circle' || STATE.activeTool === 'rect') {
            updateCreateShape(opt);
        }
    });

    STATE.canvas.on('mouse:up', function (opt) {
        this.setViewportTransform(this.viewportTransform);
        this.isDragging = false;

        if (STATE.activeTool === 'pan') {
            STATE.canvas.defaultCursor = 'grab';
        } else {
            STATE.canvas.defaultCursor = 'default';
        }

        this.selection = STATE.activeTool === 'select';

        if (STATE.activeTool === 'arrow') {
            finishCreateArrow();
        } else if (STATE.activeTool === 'circle' || STATE.activeTool === 'rect') {
            finishCreateShape();
        }
    });
}

// --- Arrow Logic ---
function startCreateArrow(opt) {
    const pointer = STATE.canvas.getPointer(opt.e);
    const points = [pointer.x, pointer.y, pointer.x, pointer.y];
    const color = els.arrowColor.value;
    const width = parseInt(els.arrowThickness.value, 10);

    const line = new fabric.Line(points, {
        strokeWidth: width,
        fill: color,
        stroke: color,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
    });

    const head = new fabric.Triangle({
        width: width * 4,
        height: width * 4,
        fill: color,
        left: pointer.x,
        top: pointer.y,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        angle: 90
    });

    STATE.drawingObject = { line, head };
    STATE.canvas.add(line, head);
}

function updateCreateArrow(opt) {
    if (!STATE.drawingObject) return;
    const pointer = STATE.canvas.getPointer(opt.e);
    const { line, head } = STATE.drawingObject;

    line.set({ x2: pointer.x, y2: pointer.y });
    head.set({ left: pointer.x, top: pointer.y });

    const dx = pointer.x - line.x1;
    const dy = pointer.y - line.y1;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle += 90;
    head.set({ angle: angle });

    STATE.canvas.renderAll();
}

function finishCreateArrow() {
    if (!STATE.drawingObject) return;
    const { line, head } = STATE.drawingObject;

    // Always create as selectable. 
    // Interaction is blocked by the global mouse:down handler when not in select mode.
    const group = new fabric.Group([line, head], {
        selectable: true,
        evented: true
    });

    STATE.canvas.remove(line, head);
    STATE.canvas.add(group);
    STATE.drawingObject = null;

    // Optional: Select it immediately if we were to auto-switch tools? 
    // But we stay in arrow tool. So it shouldn't be active.
}

// --- Shape Logic ---

function startCreateShape(opt) {
    const pointer = STATE.canvas.getPointer(opt.e);
    const startX = pointer.x;
    const startY = pointer.y;
    let shape;

    // Use pure red for now, maybe expose color picker later if requested
    const strokeColor = els.arrowColor ? els.arrowColor.value : '#ff4b4b';

    if (STATE.activeTool === 'circle') {
        shape = new fabric.Ellipse({
            left: startX,
            top: startY,
            originX: 'left',
            originY: 'top',
            rx: 1,
            ry: 1,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth: 5,
            selectable: false,
            evented: false
        });
    } else {
        shape = new fabric.Rect({
            left: startX,
            top: startY,
            originX: 'left',
            originY: 'top',
            width: 1,
            height: 1,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth: 5,
            selectable: false,
            evented: false
        });
    }
    STATE.drawingObject = { shape, startX, startY };
    STATE.canvas.add(shape);
}

function updateCreateShape(opt) {
    if (!STATE.drawingObject || !STATE.drawingObject.shape) return;
    const pointer = STATE.canvas.getPointer(opt.e);
    const { shape, startX, startY } = STATE.drawingObject;

    const w = Math.abs(pointer.x - startX);
    const h = Math.abs(pointer.y - startY);

    if (startX > pointer.x) shape.set({ left: pointer.x });
    if (startY > pointer.y) shape.set({ top: pointer.y });

    if (STATE.activeTool === 'circle') {
        shape.set({
            rx: w / 2,
            ry: h / 2
        });
    } else {
        shape.set({ width: w, height: h });
    }
    STATE.canvas.renderAll();
}

function finishCreateShape() {
    if (!STATE.drawingObject) return;
    const shape = STATE.drawingObject.shape;
    shape.set({ selectable: true, evented: true });
    // Keep reference or set active?
    shape.setCoords();

    // Optional: Switch to select after drawing?
    STATE.canvas.setActiveObject(shape);
    STATE.drawingObject = null;
    setTool('select');
}


// --- Dropzone & Image Handling ---

export function setupDropzone() {
    const container = document.body;

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.container.style.boxShadow = 'inset 0 0 50px rgba(123, 97, 255, 0.5)';
    });

    container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        els.container.style.boxShadow = 'none';
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        els.container.style.boxShadow = 'none';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageFiles(e.dataTransfer.files, e.clientX, e.clientY);
        }
    });
}

export function handleImageFiles(files, clientX, clientY) {
    if (!files || !files.length) return;

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (f) => {
            const data = f.target.result;
            fabric.Image.fromURL(data, (img) => {
                const maxSize = 4096;
                if (img.width > maxSize || img.height > maxSize) {
                    const scale = Math.min(maxSize / img.width, maxSize / img.height);
                    img.scale(scale);
                }

                if (clientX !== undefined) {
                    const pointer = STATE.canvas.getPointer({ clientX, clientY });
                    img.set({ left: pointer.x, top: pointer.y, originX: 'center', originY: 'center' });
                } else {
                    const vpt = STATE.canvas.viewportTransform;
                    const centerX = (-vpt[4] + STATE.canvas.width / 2) / vpt[0];
                    const centerY = (-vpt[5] + STATE.canvas.height / 2) / vpt[3];
                    img.set({ left: centerX, top: centerY, originX: 'center', originY: 'center' });
                }

                STATE.canvas.add(img);
                STATE.canvas.setActiveObject(img);
                setTool('select');
            });
        };
        reader.readAsDataURL(file);
    });
}

function createInteractiveText(opt) {
    const pointer = STATE.canvas.getPointer(opt.e);
    const color = els.textColor.value || '#ff0000';
    const size = parseInt(els.textSize.value, 10) || 40;

    const text = new fabric.IText('Text', {
        left: pointer.x,
        top: pointer.y,
        fill: color,
        fontFamily: 'Outfit',
        fontSize: size,
        originX: 'left',
        originY: 'top'
    });

    STATE.canvas.add(text);
    STATE.canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    setTool('select');
}

// --- FOV Marker Tool ---

function createFovMarker(opt) {
    // Remove existing FOV marker if there is one (only one marker allowed)
    if (STATE.fovMarker) {
        STATE.canvas.remove(STATE.fovMarker);
        STATE.fovMarker = null;
    }

    const pointer = STATE.canvas.getPointer(opt.e);
    const fovAngle = parseInt(els.fovAngle.value, 10) || 60;
    const fovLength = parseInt(els.fovLength.value, 10) || 200;

    // Create eye circle (camera position) - positioned at origin
    const eyeRadius = 14;
    const eyeCircle = new fabric.Circle({
        radius: eyeRadius,
        fill: '#00BCD4',
        stroke: '#ffffff',
        strokeWidth: 3,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Create inner pupil with direction indicator
    const pupil = new fabric.Circle({
        radius: 5,
        fill: '#0D47A1',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Create direction arrow line (from eye to tip of cone)
    const arrowLine = new fabric.Line([0, 0, fovLength * 0.7, 0], {
        stroke: '#FF5722',
        strokeWidth: 3,
        originX: 'left',
        originY: 'center'
    });

    // Create arrowhead at the end of the line
    const arrowHead = new fabric.Triangle({
        width: 16,
        height: 20,
        fill: '#FF5722',
        left: fovLength * 0.7,
        top: 0,
        angle: 90,
        originX: 'center',
        originY: 'center'
    });

    // Create FOV cone (triangle/wedge)
    const cone = createFovCone(fovAngle, fovLength);

    // Group everything - eye at center, cone extends to the right
    const fovGroup = new fabric.Group([cone, arrowLine, arrowHead, eyeCircle, pupil], {
        left: pointer.x,
        top: pointer.y,
        originX: 'left',  // Origin at the eye position (left side of group)
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        centeredRotation: false  // Rotate around origin (eye position)
    });

    // Store metadata
    fovGroup.data = {
        isFovMarker: true,
        angle: fovAngle,
        length: fovLength
    };

    STATE.canvas.add(fovGroup);
    STATE.canvas.setActiveObject(fovGroup);
    STATE.fovMarker = fovGroup;

    // Update angle display
    els.fovAngleValue.textContent = fovAngle + '°';

    setTool('select');
}

function createFovCone(angleDeg, length) {
    // Convert FOV angle to radians (half angle on each side)
    const halfAngle = (angleDeg / 2) * (Math.PI / 180);

    // Calculate cone points
    // Cone points outward from center (0,0) towards positive X
    const tipX = 0;
    const tipY = 0;

    const leftX = length;
    const leftY = -Math.tan(halfAngle) * length;

    const rightX = length;
    const rightY = Math.tan(halfAngle) * length;

    const cone = new fabric.Polygon([
        { x: tipX, y: tipY },
        { x: leftX, y: leftY },
        { x: rightX, y: rightY }
    ], {
        fill: 'rgba(0, 188, 212, 0.25)',
        stroke: '#00BCD4',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center'
    });

    return cone;
}

function updateFovMarker() {
    if (!STATE.fovMarker) return;

    const fovAngle = parseInt(els.fovAngle.value, 10) || 60;
    const fovLength = parseInt(els.fovLength.value, 10) || 200;

    // Update display
    els.fovAngleValue.textContent = fovAngle + '°';

    // Store position and rotation
    const left = STATE.fovMarker.left;
    const top = STATE.fovMarker.top;
    const angle = STATE.fovMarker.angle;

    // Remove old marker
    STATE.canvas.remove(STATE.fovMarker);

    // Create new components
    const eyeRadius = 14;
    const eyeCircle = new fabric.Circle({
        radius: eyeRadius,
        fill: '#00BCD4',
        stroke: '#ffffff',
        strokeWidth: 3,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    const pupil = new fabric.Circle({
        radius: 5,
        fill: '#0D47A1',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Create direction arrow line
    const arrowLine = new fabric.Line([0, 0, fovLength * 0.7, 0], {
        stroke: '#FF5722',
        strokeWidth: 3,
        originX: 'left',
        originY: 'center'
    });

    // Create arrowhead
    const arrowHead = new fabric.Triangle({
        width: 16,
        height: 20,
        fill: '#FF5722',
        left: fovLength * 0.7,
        top: 0,
        angle: 90,
        originX: 'center',
        originY: 'center'
    });

    const cone = createFovCone(fovAngle, fovLength);

    // Recreate group with same position and rotation
    const fovGroup = new fabric.Group([cone, arrowLine, arrowHead, eyeCircle, pupil], {
        left: left,
        top: top,
        angle: angle,
        originX: 'left',
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        centeredRotation: false
    });

    fovGroup.data = {
        isFovMarker: true,
        angle: fovAngle,
        length: fovLength
    };

    STATE.canvas.add(fovGroup);
    STATE.canvas.setActiveObject(fovGroup);
    STATE.fovMarker = fovGroup;
    STATE.canvas.requestRenderAll();
}

function syncFovControlsFromMarker(marker) {
    if (!marker || !marker.data?.isFovMarker) return;

    els.fovAngle.value = marker.data.angle || 60;
    els.fovLength.value = marker.data.length || 200;
    els.fovAngleValue.textContent = (marker.data.angle || 60) + '°';
}

function handleRefImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        // Store base64 (strip the data:image/xxx;base64, prefix)
        STATE.refImageBase64 = dataUrl.split(',')[1];

        // Update UI
        els.refImageLabel.textContent = file.name.length > 15
            ? file.name.substring(0, 12) + '...'
            : file.name;
        els.setRefImageBtn.classList.add('active');
        els.setRefImageBtn.style.background = 'rgba(76, 175, 80, 0.2)';
        els.setRefImageBtn.style.color = '#4CAF50';
    };
    reader.readAsDataURL(file);

    // Clear the input so the same file can be re-selected
    e.target.value = '';
}

