import { STATE } from './state.js';
import { els, updateStatus } from './ui.js';
import { saveImageToDB } from './persistence.js';
import { addToGallery } from './gallery.js';

export function setupGeneration() {
    els.generateBtn.addEventListener('click', prepareGeneration);
}

export async function prepareGeneration() {
    let prompt = els.promptInput.value.trim();

    // Check Key logic:
    // If no key in settings, check if we can reach server? 
    // For now, if no key, we assume proxy mode if available, OR we warn.
    // The previous logic forced alert.
    // New Logic: If no key, we proceed, but executeGeneration will assume Proxy.
    if (!STATE.apiKey) {
        // alert("Please set your Google API Key in Settings.");
        // els.settingsModal.classList.remove('hidden');
        // return; 
        console.log("No API Key in settings. Assuming Server Proxy with Env Var.");
    }

    if (!prompt) {
        prompt = "Enhance the image and remove visual markers.";
    }

    try {
        const allObjects = STATE.canvas.getObjects().filter(o => !o.data?.isWorkspace);

        if (allObjects.length === 0) {
            alert("Canvas is empty! Draw something on the workspace.");
            return;
        }

        const hasTaggedBase = allObjects.some(o => o.data?.isBaseImage);

        // Determine which objects are "content" (base images - the floor plan)
        const contentObjects = allObjects.filter(o => {
            if (hasTaggedBase) {
                return o.data?.isBaseImage;
            } else {
                // If nothing is tagged, use the FIRST/LARGEST image as base
                return o.type === 'image';
            }
        });

        // Detect REFERENCE/STYLE images - images that are NOT base images
        // These are images placed on the canvas for style reference
        // Enhanced: Now detects references even without explicit base tagging
        const referenceImages = allObjects.filter(o => {
            if (o.type !== 'image') return false;
            if (o.data?.isBaseImage) return false;  // Exclude base images
            if (o.data?.isFovMarker) return false;  // Exclude FOV markers

            if (hasTaggedBase) {
                // If base is explicitly tagged, all other images are references
                return true;
            } else {
                // If no tagged base, treat the FIRST/LARGEST image as base
                // and any additional images as style references
                // Find the "implicit base" - first image or largest by area
                const allImages = allObjects.filter(img => img.type === 'image' && !img.data?.isFovMarker);
                if (allImages.length <= 1) return false;  // Only one image, no references

                // Sort by area (largest first) - largest is likely the floor plan
                const sortedByArea = [...allImages].sort((a, b) => {
                    const areaA = (a.width * a.scaleX) * (a.height * a.scaleY);
                    const areaB = (b.width * b.scaleX) * (b.height * b.scaleY);
                    return areaB - areaA;
                });

                // The largest image is the implicit base, everything else is a reference
                return o !== sortedByArea[0];
            }
        });

        if (contentObjects.length === 0) {
            alert("No base image found! Add an image or mark one as 'Base' (click image then click the layers icon).");
            return;
        }

        // --- Calculate SEPARATE Bounding Boxes ---

        // Bounding box for CLEAN image (only base/content images)
        let cleanMinX = Infinity, cleanMinY = Infinity, cleanMaxX = -Infinity, cleanMaxY = -Infinity;
        contentObjects.forEach(o => {
            const b = o.getBoundingRect();
            if (b.left < cleanMinX) cleanMinX = b.left;
            if (b.top < cleanMinY) cleanMinY = b.top;
            if (b.left + b.width > cleanMaxX) cleanMaxX = b.left + b.width;
            if (b.top + b.height > cleanMaxY) cleanMaxY = b.top + b.height;
        });

        // Bounding box for MARKED image (ALL objects including markers)
        let markedMinX = Infinity, markedMinY = Infinity, markedMaxX = -Infinity, markedMaxY = -Infinity;
        allObjects.forEach(o => {
            const b = o.getBoundingRect();
            if (b.left < markedMinX) markedMinX = b.left;
            if (b.top < markedMinY) markedMinY = b.top;
            if (b.left + b.width > markedMaxX) markedMaxX = b.left + b.width;
            if (b.top + b.height > markedMaxY) markedMaxY = b.top + b.height;
        });

        const targetSize = 4096;

        // Capture options for CLEAN image (cropped to base image only)
        const cleanWidth = cleanMaxX - cleanMinX;
        const cleanHeight = cleanMaxY - cleanMinY;
        const cleanCaptureOptions = {
            format: 'jpeg',
            quality: 0.95,
            left: cleanMinX,
            top: cleanMinY,
            width: cleanWidth,
            height: cleanHeight,
            multiplier: targetSize / Math.max(cleanWidth, cleanHeight),
            enableRetinaScaling: false
        };

        // Capture options for MARKED image (includes all markers)
        const markedWidth = markedMaxX - markedMinX;
        const markedHeight = markedMaxY - markedMinY;
        const markedCaptureOptions = {
            format: 'jpeg',
            quality: 0.95,
            left: markedMinX,
            top: markedMinY,
            width: markedWidth,
            height: markedHeight,
            multiplier: targetSize / Math.max(markedWidth, markedHeight),
            enableRetinaScaling: false
        };

        // --- Capture 1: CLEAN Image (Base images only, no markers, no green border) ---

        // Save original visibility
        const visibilityMap = new Map();
        allObjects.forEach(o => visibilityMap.set(o, o.visible));

        // Save and remove green stroke from base images (visual indicator only)
        const strokeMap = new Map();
        contentObjects.forEach(o => {
            if (o.stroke) {
                strokeMap.set(o, { stroke: o.stroke, strokeWidth: o.strokeWidth });
                o.set({ stroke: null, strokeWidth: 0 });
            }
        });

        // Hide all non-content objects
        allObjects.forEach(o => {
            if (hasTaggedBase) {
                o.visible = !!o.data?.isBaseImage;
            } else {
                o.visible = o.type === 'image';
            }
        });

        STATE.canvas.renderAll();
        const cleanDataUrl = STATE.canvas.toDataURL(cleanCaptureOptions);

        // Restore green stroke to base images
        strokeMap.forEach((style, obj) => {
            obj.set({ stroke: style.stroke, strokeWidth: style.strokeWidth });
        });

        // --- Capture 2: MARKED Image (Everything visible) ---
        // Restore Visibility from Map
        allObjects.forEach(o => {
            if (visibilityMap.has(o)) {
                o.visible = visibilityMap.get(o);
            }
        });

        // Force re-render to ensure markups are drawn
        STATE.canvas.renderAll();
        const markedDataUrl = STATE.canvas.toDataURL(markedCaptureOptions);

        // Extract Base64
        const cleanBase64 = cleanDataUrl.split(',')[1];
        const markedBase64 = markedDataUrl.split(',')[1];

        // --- Capture 3: Reference/Style Images (if any) ---
        // Capture each reference image separately for style transfer
        const refImageBase64Array = [];
        if (referenceImages.length > 0) {
            // Temporarily hide everything except reference images
            allObjects.forEach(o => o.visible = false);

            for (const refImg of referenceImages) {
                refImg.visible = true;
                STATE.canvas.renderAll();

                const refBounds = refImg.getBoundingRect();
                const refCaptureOptions = {
                    format: 'jpeg',
                    quality: 0.9,
                    left: refBounds.left,
                    top: refBounds.top,
                    width: refBounds.width,
                    height: refBounds.height,
                    multiplier: Math.min(2048 / Math.max(refBounds.width, refBounds.height), 2),
                    enableRetinaScaling: false
                };

                const refDataUrl = STATE.canvas.toDataURL(refCaptureOptions);
                refImageBase64Array.push(refDataUrl.split(',')[1]);
                refImg.visible = false;
            }

            // Restore all visibility
            allObjects.forEach(o => {
                if (visibilityMap.has(o)) {
                    o.visible = visibilityMap.get(o);
                }
            });
            STATE.canvas.renderAll();
        }

        // Combine with manually uploaded reference image if any
        if (STATE.refImageBase64) {
            refImageBase64Array.push(STATE.refImageBase64);
        }

        // 6. Aspect Ratio Prompt Injection (Reinforcement)
        let ratioPrompt = "";
        if (els.aspectRatioSelect) {
            const r = els.aspectRatioSelect.value;
            if (r === "16:9") ratioPrompt = "Wide Cinematic 16:9 Aspect Ratio.";
            else if (r === "9:16") ratioPrompt = "Tall Vertical 9:16 Aspect Ratio.";
            else if (r === "4:3") ratioPrompt = "Standard 4:3 Aspect Ratio.";
            else if (r === "3:4") ratioPrompt = "Vertical 3:4 Aspect Ratio.";
            else if (r === "1:1") ratioPrompt = "Square 1:1 Aspect Ratio.";
        }

        let extraInstructions = "";
        if (els.applyColorBtn && els.applyColorBtn.classList.contains('active')) {
            extraInstructions = "Apply the color.";
        }

        // 7. FOV Marker Detection - Perspective View Prompt
        let perspectivePrompt = "";
        const fovMarker = allObjects.find(o => o.data?.isFovMarker);
        if (fovMarker) {
            const fovData = fovMarker.data;
            const markerRotation = fovMarker.angle || 0;
            perspectivePrompt = `
        PERSPECTIVE VIEW INSTRUCTION:
        - This floor plan contains a CAMERA MARKER with these visual elements:
          * CYAN CIRCLE: The exact camera/eye position where you are standing
          * ORANGE ARROW: Points in the EXACT DIRECTION you are looking (this is the viewing direction!)
          * CYAN CONE/TRIANGLE: Shows the field of view spread (${fovData.angle || 60}° FOV)
        
        - Generate a PHOTOREALISTIC INTERIOR PERSPECTIVE VIEW:
          * Stand at the CYAN CIRCLE position
          * Look in the direction the ORANGE ARROW points
          * The field of view should match the cone angle (${fovData.angle || 60}°)
          * Create an immersive eye-level interior view as if you are physically standing there
          
        - The orange arrow direction is CRITICAL - it shows exactly where the camera is facing
        - Do NOT include the marker graphics (circles, arrows, cone) in the output - they are instructions only
        `;
        }

        // 8. Reference Image Style Transfer
        let stylePrompt = "";
        const hasRefImages = refImageBase64Array.length > 0;
        if (hasRefImages) {
            stylePrompt = `
        REFERENCE IMAGES FOR STYLE & FURNITURE:
        - ${refImageBase64Array.length} REFERENCE IMAGE(S) are provided alongside the floor plan.
        - These images show the DESIRED STYLE, FURNITURE, MATERIALS, and ATMOSPHERE for the perspective view.
        - IMPORTANT: Incorporate elements from these reference images into your generated perspective:
          * Use similar FURNITURE STYLES (sofas, chairs, tables, etc.)
          * Match the MATERIAL FINISHES (wood, marble, fabric, metal)
          * Apply the COLOR PALETTE and LIGHTING MOOD
          * Replicate the INTERIOR DESIGN AESTHETIC
        - The reference images are your visual guide - the generated interior should feel cohesive with them.
        `;
        }

        // Build dynamic image count for prompt
        const totalImages = 2 + refImageBase64Array.length;  // Clean + Marked + References

        let imageListPrompt = `
        1. IMAGE 1: The "Clean" original scene (floor plan or base image).
        2. IMAGE 2: The "Instruction" layer (Red Arrows, Boxes, Text Labels, Magenta Brush Marks, Eye Markers) overlaid on the scene.`;

        if (hasRefImages) {
            for (let i = 0; i < refImageBase64Array.length; i++) {
                imageListPrompt += `
        ${i + 3}. IMAGE ${i + 3}: REFERENCE/STYLE IMAGE - Use this for furniture, materials, colors, and design inspiration.`;
            }
        }

        const finalPrompt = `${prompt} . ${extraInstructions} ${ratioPrompt} ${perspectivePrompt} ${stylePrompt}
        
        *** SYSTEM INSTRUCTIONS ***
        You are provided with ${totalImages} images:
        ${imageListPrompt}

        SPECIAL INSTRUCTION - MAGENTA REMOVAL ZONES:
        - Any areas marked with BRIGHT MAGENTA color (hex code #FF00FF) indicate regions to REMOVE and INTELLIGENTLY FILL IN.
        - Erase the content/objects in those magenta-painted areas.
        - Inpaint naturally based on surrounding context to make it seamless and realistic.
        - Remove all traces of the magenta markings themselves.

        ORIENTATION PRESERVATION:
        - When replacing or transforming objects, MAINTAIN the same orientation, rotation, and perspective as the original object.
        - New elements must align with the spatial direction and angle of what they are replacing.
        - Respect the existing perspective grid and vanishing points in the scene.

        TASK:
        - Apply the edits described by the MARKUPS in Image 2 to the context of Image 1.
        - The Output must correspond to the Clean Image but with the Requested Changes applied.${hasRefImages ? `
        - INCORPORATE the furniture styles, materials, and design aesthetic from the REFERENCE IMAGES.` : ''}
        - DO NOT include the red arrows, boxes, text labels, magenta brush marks, or eye markers in the final result.
        - The goal is a high-quality, continuous image that looks like the original but edited.`;

        STATE.pendingPayload = {
            prompt: finalPrompt,
            cleanBase64: cleanBase64,
            markedBase64: markedBase64,
            refImageBase64Array: refImageBase64Array,  // Array of reference images
            model: els.modelSelect.value || 'gemini-3-pro-image-preview',
            aspectRatio: els.aspectRatioSelect ? els.aspectRatioSelect.value : "1:1",
            resolution: els.resolutionSelect ? els.resolutionSelect.value : "1K"
        };


        // UI Updates - Show BOTH images for verification
        els.payloadPrompt.value = finalPrompt;
        els.payloadImagePreview.innerHTML = '';
        els.payloadImagePreview.style.display = 'flex';
        els.payloadImagePreview.style.gap = '10px';
        els.payloadImagePreview.style.overflow = 'auto'; // Allow scrolling if needed

        // Helper to create preview box
        const createPreviewBox = (src, labelText) => {
            const container = document.createElement('div');
            container.style.flex = '1';
            container.style.border = '1px solid #444';
            container.style.padding = '5px';
            container.style.borderRadius = '4px';
            container.style.textAlign = 'center';

            const img = document.createElement('img');
            img.src = src;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'contain';
            img.style.backgroundColor = '#000';

            const label = document.createElement('div');
            label.textContent = labelText;
            label.style.fontSize = '10px';
            label.style.color = '#aaa';
            label.style.marginTop = '4px';

            container.appendChild(img);
            container.appendChild(label);
            return container;
        };

        const cleanPreview = createPreviewBox(cleanDataUrl, "Image 1: Clean Context");
        const markedPreview = createPreviewBox(markedDataUrl, "Image 2: Instructions");

        els.payloadImagePreview.appendChild(cleanPreview);
        els.payloadImagePreview.appendChild(markedPreview);

        els.payloadImagePreview.style.maxHeight = 'none';

        if (STATE.showDebug) {
            els.payloadModal.classList.remove('hidden');
        } else {
            executeGeneration();
        }

    } catch (e) {
        alert("Preparation Failed: " + e.message);
        // Ensure visibility is restored if error occurs
        try {
            STATE.canvas.getObjects().forEach(o => o.visible = true);
            STATE.canvas.renderAll();
        } catch (err) { }
    }
}

export async function executeGeneration() {
    if (!STATE.pendingPayload) return;
    els.payloadModal.classList.add('hidden');

    const originalText = els.generateBtn.innerHTML;
    els.generateBtn.innerHTML = '<span class="material-icons-round spin">sync</span> Generating...';
    els.generateBtn.disabled = true;

    try {
        const modelId = STATE.pendingPayload.model;

        // Prepare Payload
        const parts = [{ text: STATE.pendingPayload.prompt }];

        // Add CLEAN Image first (Context)
        if (STATE.pendingPayload.cleanBase64) {
            parts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: STATE.pendingPayload.cleanBase64
                }
            });
        }

        // Add MARKED Image second (Instructions)
        if (STATE.pendingPayload.markedBase64) {
            parts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: STATE.pendingPayload.markedBase64
                }
            });
        }

        // Add Reference Images (Style/Furniture references) if available
        if (STATE.pendingPayload.refImageBase64Array && STATE.pendingPayload.refImageBase64Array.length > 0) {
            for (const refBase64 of STATE.pendingPayload.refImageBase64Array) {
                parts.push({
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: refBase64
                    }
                });
            }
        }

        const payload = {
            contents: [{ parts: parts }]
        };

        if (modelId.includes('gemini-3-pro-image-preview') || modelId.includes('gemini-2.5-flash-image')) {
            payload.generationConfig = { responseModalities: ["IMAGE"] };

            // Allow Aspect Ratio param even with Image Input (User Request)
            let imgSize = STATE.pendingPayload.resolution || "1K";

            // Safety check for Flash model 
            if (modelId.includes('flash') && imgSize === '4K') {
                console.warn("Downgrading 4K to 2K for Flash model compatibility.");
                imgSize = "2K";
            }

            payload.generationConfig.imageConfig = {
                aspect_ratio: STATE.pendingPayload.aspectRatio || "1:1",
                image_size: imgSize
            };
            delete payload.tools;
        }

        let resp;

        // --- ROUTING LOGIC ---
        if (STATE.apiKey) {
            // Direct Call
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${STATE.apiKey}`;
            console.log(`API Request (Direct): ${modelId}`);
            resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Proxy Call (to local Server)
            // We do NOT append key here. Server appended it.
            // But we need to tell server WHERE to send it.
            // Original code: Server was a specific proxy endpoint that accepted 'url' and 'payload'
            // Let's reuse that structure but simplify

            const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

            console.log(`API Request (Proxy): ${modelId}`);
            resp = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    payload: payload
                    // Key is NOT sent
                })
            });
        }

        if (resp.status === 404) {
            throw new Error(`Model '${modelId}' not found (404). Access denied or wrong endpoint.`);
        }

        const data = await resp.json();
        if (data.error) throw new Error(`API Error: ${data.error.message}`);

        // Parsing Logic (Reuse)
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error("No candidates returned.\n" + JSON.stringify(data, null, 2));
        if (candidate.finishReason === 'SAFETY') throw new Error("Blocked by Safety Settings.");

        const resultParts = candidate.content?.parts;
        let finalDataUrl = null;
        let foundText = null;

        if (resultParts) {
            const imgPart = resultParts.find(p => p.inline_data || p.inlineData);
            const textPart = resultParts.find(p => p.text);

            if (imgPart) {
                const mimeType = imgPart.inlineData ? imgPart.inlineData.mimeType : imgPart.inline_data.mime_type;
                const base64Data = imgPart.inlineData ? imgPart.inlineData.data : imgPart.inline_data.data;
                finalDataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;
            }
            if (textPart) foundText = textPart.text;
        }

        if (finalDataUrl) {
            els.resultImage.src = finalDataUrl;
            els.resultModal.classList.remove('hidden');

            const meta = {
                prompt: STATE.pendingPayload.prompt,
                model: STATE.pendingPayload.model,
                ratio: STATE.pendingPayload.aspectRatio
            };

            saveImageToDB(meta, finalDataUrl).then(id => {
                addToGallery(finalDataUrl, meta, id); // UI update
            });
        } else if (foundText) {
            alert(`Model Returned Text Only:\n"${foundText}"`);
        } else {
            throw new Error("Model returned unrecognized format.");
        }

    } catch (e) {
        console.error("Exec Gen Error:", e);
        alert("Generation Failed: " + e.message);
    } finally {
        els.generateBtn.innerHTML = originalText;
        els.generateBtn.disabled = false;
        STATE.pendingPayload = null;
    }
}


export function fetchModels(key) {
    // If key is present (Direct), we can try to fetch, OR we just hardcode the list as requested.
    // The user code hardcoded specific models.

    // If NO key (Proxy), we could fetch models via proxy too, but hardcoding is faster and cleaner for this specific app.
    els.modelSelect.innerHTML = '';
    const exclusiveModels = [
        { id: 'gemini-3-pro-image-preview', name: '🍌 Gemini 3 Pro Image (Preview)' }
    ];

    exclusiveModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.id})`;
        els.modelSelect.appendChild(opt);
    });
    els.modelSelect.options[0].selected = true;
}
