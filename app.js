// App state
let state = {
    drawMode: 'select', // 'select', 'brush', 'line', 'arrow', 'eraser'
    selectedColor: '#00ff66',
    pitchStyle: 'grass',
    showGrid: false,
    players: [],
    drawings: [],
    selectedItem: null,
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
};

// DOM Elements
const canvas = document.getElementById('drawingPitchCanvas');
const ctx = canvas.getContext('2d');
const playersOverlay = document.getElementById('playersOverlay');
const pitchWrapper = document.getElementById('pitchWrapper');
const inspectorPanel = document.getElementById('inspectorPanel');
const inspectorType = document.getElementById('inspector-type');
const inspectName = document.getElementById('inspect-name');
const inspectNumber = document.getElementById('inspect-number');
const inspectNumberRow = document.getElementById('inspect-number-row');

// Modal Elements
const nameModal = document.getElementById('nameModal');
const modalTitle = document.getElementById('modalTitle');
const modalNameInput = document.getElementById('modalNameInput');
let modalCallback = null;

// Initialize app when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
    initDrawings();
    initPlayerListeners();
    initTabListeners();
    initToolbar();
    initPDFViewer();
    initOffsideSimulator();
    initDecisionTrees();
    initXAIAnalyst();
    
    // Draw initial empty pitch
    drawDrawingPitch();
    addLog("Tactical Analyst Studio initialized.");
});

// Event Logging
function addLog(message) {
    const logBody = document.getElementById('eventLogBody');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg">${message}</span>`;
    logBody.appendChild(entry);
    logBody.scrollTop = logBody.scrollHeight;
}

/* ==========================================
   CANVAS & TACTICAL BOARD DRAWING LOGIC
   ========================================== */

function initDrawings() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Style dropdown changes
    document.getElementById('pitch-style-select').addEventListener('change', (e) => {
        state.pitchStyle = e.target.value;
        drawDrawingPitch();
        addLog(`Changed pitch style to ${state.pitchStyle}`);
    });

    document.getElementById('line-color-select').addEventListener('change', (e) => {
        state.selectedColor = e.target.value;
    });

    document.getElementById('toggle-gridlines').addEventListener('click', (e) => {
        state.showGrid = !state.showGrid;
        const btn = document.getElementById('toggle-gridlines');
        if (state.showGrid) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        drawDrawingPitch();
        addLog(`Tactical gridlines ${state.showGrid ? 'enabled' : 'disabled'}`);
    });

    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
        state.drawings = [];
        drawDrawingPitch();
        addLog("Cleared all drawing lines.");
    });

    document.getElementById('btn-reset-board').addEventListener('click', () => {
        state.drawings = [];
        state.players = [];
        playersOverlay.innerHTML = '';
        state.selectedItem = null;
        inspectorPanel.style.display = 'none';
        drawDrawingPitch();
        addLog("Reset tactical board.");
    });
}

function drawDrawingPitch() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Background Fill
    if (state.pitchStyle === 'dark') {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    } else {
        // Classic Grass
        ctx.fillStyle = '#1b4d22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Mowed grass strips
        ctx.fillStyle = '#225929';
        const stripWidth = canvas.width / 15;
        for (let i = 0; i < 15; i += 2) {
            ctx.fillRect(i * stripWidth, 0, stripWidth, canvas.height);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    }

    ctx.lineWidth = 2.5;

    // Pitch Dimensions
    const w = canvas.width;
    const h = canvas.height;
    const padding = 25;
    const pw = w - (padding * 2);
    const ph = h - (padding * 2);

    if (state.pitchStyle === 'half') {
        // Render Half Pitch Layout
        ctx.strokeRect(padding, padding, pw, ph);
        
        // Halfway line (drawn at left edge)
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h - padding);
        ctx.stroke();

        // Center arc
        ctx.beginPath();
        ctx.arc(padding, h/2, 60, -Math.PI/2, Math.PI/2);
        ctx.stroke();

        // Right Penalty Area
        const boxH = ph * 0.6;
        const boxW = pw * 0.35;
        const boxY = padding + (ph - boxH)/2;
        ctx.strokeRect(w - padding - boxW, boxY, boxW, boxH);

        // Goal Box (6 yard box)
        const gBoxH = ph * 0.25;
        const gBoxW = pw * 0.12;
        const gBoxY = padding + (ph - gBoxH)/2;
        ctx.strokeRect(w - padding - gBoxW, gBoxY, gBoxW, gBoxH);

        // Penalty spot
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(w - padding - (pw * 0.22), h/2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Penalty Arc
        ctx.beginPath();
        ctx.arc(w - padding - (pw * 0.22), h/2, 60, Math.PI * 0.68, Math.PI * 1.32, true);
        ctx.stroke();

        // Goal outline
        ctx.strokeRect(w - padding, h/2 - 35, 10, 70);

    } else if (state.pitchStyle === 'goal') {
        // Goal Area Close-up Layout
        ctx.strokeRect(padding, padding, pw, ph);
        
        // Goal line (bottom of canvas)
        const boxH = ph * 0.7;
        const boxW = pw * 0.7;
        const boxX = padding + (pw - boxW)/2;
        ctx.strokeRect(boxX, h - padding - boxH, boxW, boxH);

        // 6-yard box
        const gBoxH = ph * 0.25;
        const gBoxW = pw * 0.35;
        const gBoxX = padding + (pw - gBoxW)/2;
        ctx.strokeRect(gBoxX, h - padding - gBoxH, gBoxW, gBoxH);

        // Penalty Spot
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(w/2, h - padding - (ph * 0.45), 3, 0, Math.PI * 2);
        ctx.fill();

        // Penalty Arc
        ctx.beginPath();
        ctx.arc(w/2, h - padding - (ph * 0.45), 70, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        // Goalposts
        ctx.lineWidth = 4;
        ctx.strokeRect(w/2 - 60, padding, 120, 10);
        ctx.lineWidth = 2.5;

    } else {
        // Full Pitch Layout
        // Border
        ctx.strokeRect(padding, padding, pw, ph);

        // Halfway Line
        ctx.beginPath();
        ctx.moveTo(w / 2, padding);
        ctx.lineTo(w / 2, h - padding);
        ctx.stroke();

        // Center Circle
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center spot
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Left Penalty Box
        const boxH = ph * 0.6;
        const boxW = pw * 0.18;
        const boxY = padding + (ph - boxH) / 2;
        ctx.strokeRect(padding, boxY, boxW, boxH);

        // Left Goal Box
        const gBoxH = ph * 0.25;
        const gBoxW = pw * 0.06;
        const gBoxY = padding + (ph - gBoxH) / 2;
        ctx.strokeRect(padding, gBoxY, gBoxW, gBoxH);

        // Left Penalty spot
        ctx.beginPath();
        ctx.arc(padding + (pw * 0.11), h/2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Left Penalty Arc
        ctx.beginPath();
        ctx.arc(padding + (pw * 0.11), h/2, 60, Math.PI * 1.68, Math.PI * 0.32);
        ctx.stroke();

        // Left Goalposts outline
        ctx.strokeRect(padding - 10, h/2 - 35, 10, 70);

        // Right Penalty Box
        ctx.strokeRect(w - padding - boxW, boxY, boxW, boxH);

        // Right Goal Box
        ctx.strokeRect(w - padding - gBoxW, gBoxY, gBoxW, gBoxH);

        // Right Penalty spot
        ctx.beginPath();
        ctx.arc(w - padding - (pw * 0.11), h/2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Right Penalty Arc
        ctx.beginPath();
        ctx.arc(w - padding - (pw * 0.11), h/2, 60, Math.PI * 0.68, Math.PI * 1.32, true);
        ctx.stroke();

        // Right Goalposts outline
        ctx.strokeRect(w - padding, h/2 - 35, 10, 70);

        // Corners
        const corners = [
            { x: padding, y: padding, start: 0, end: Math.PI / 2 },
            { x: w - padding, y: padding, start: Math.PI / 2, end: Math.PI },
            { x: padding, y: h - padding, start: Math.PI * 1.5, end: 0 },
            { x: w - padding, y: h - padding, start: Math.PI, end: Math.PI * 1.5 }
        ];
        corners.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 10, c.start, c.end);
            ctx.stroke();
        });
    }

    // 2. Render Tactical gridlines
    if (state.showGrid) {
        ctx.strokeStyle = state.pitchStyle === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        // Columns
        for (let x = padding; x < w - padding; x += pw / 8) {
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, h - padding);
            ctx.stroke();
        }
        // Rows
        for (let y = padding; y < h - padding; y += ph / 6) {
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(w - padding, y);
            ctx.stroke();
        }
    }

    // 3. Draw saved drawings lines/arrows
    state.drawings.forEach(drawObj => {
        ctx.strokeStyle = drawObj.color;
        ctx.lineWidth = drawObj.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (drawObj.type === 'brush') {
            if (drawObj.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(drawObj.points[0].x, drawObj.points[0].y);
            for (let i = 1; i < drawObj.points.length; i++) {
                ctx.lineTo(drawObj.points[i].x, drawObj.points[i].y);
            }
            ctx.stroke();
        } else if (drawObj.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(drawObj.x1, drawObj.y1);
            ctx.lineTo(drawObj.x2, drawObj.y2);
            ctx.stroke();
        } else if (drawObj.type === 'arrow') {
            drawArrowOnCanvas(drawObj.x1, drawObj.y1, drawObj.x2, drawObj.y2, drawObj.color, drawObj.width);
        }
    });

    // 4. Draw active path (in-progress drawing)
    if (state.isDrawing && state.drawMode !== 'select') {
        ctx.strokeStyle = state.selectedColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (state.drawMode === 'brush') {
            ctx.beginPath();
            ctx.moveTo(state.startX, state.startY);
            ctx.lineTo(state.currentX, state.currentY);
            ctx.stroke();
        } else if (state.drawMode === 'line') {
            ctx.beginPath();
            ctx.moveTo(state.startX, state.startY);
            ctx.lineTo(state.currentX, state.currentY);
            ctx.stroke();
        } else if (state.drawMode === 'arrow') {
            drawArrowOnCanvas(state.startX, state.startY, state.currentX, state.currentY, state.selectedColor, 3);
        }
    }
}

function drawArrowOnCanvas(x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    
    // Draw shaft
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 12;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    if (state.drawMode === 'select') return;
    
    state.isDrawing = true;
    const coords = getCanvasCoords(e);
    state.startX = coords.x;
    state.startY = coords.y;
    state.currentX = coords.x;
    state.currentY = coords.y;

    if (state.drawMode === 'brush') {
        state.brushPoints = [{ x: coords.x, y: coords.y }];
    }
}

function draw(e) {
    if (!state.isDrawing || state.drawMode === 'select') return;

    const coords = getCanvasCoords(e);
    state.currentX = coords.x;
    state.currentY = coords.y;

    if (state.drawMode === 'brush') {
        state.brushPoints.push({ x: coords.x, y: coords.y });
        // Draw temporarily on canvas
        ctx.strokeStyle = state.selectedColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const pts = state.brushPoints;
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
    } else {
        // Redraw canvas to show temp shape guidelines
        drawDrawingPitch();
    }
}

function stopDrawing() {
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.drawMode === 'brush' && state.brushPoints && state.brushPoints.length > 1) {
        state.drawings.push({
            type: 'brush',
            color: state.selectedColor,
            width: 3,
            points: state.brushPoints
        });
    } else if (state.drawMode === 'line') {
        state.drawings.push({
            type: 'line',
            color: state.selectedColor,
            width: 3,
            x1: state.startX,
            y1: state.startY,
            x2: state.currentX,
            y2: state.currentY
        });
    } else if (state.drawMode === 'arrow') {
        state.drawings.push({
            type: 'arrow',
            color: state.selectedColor,
            width: 3,
            x1: state.startX,
            y1: state.startY,
            x2: state.currentX,
            y2: state.currentY
        });
    } else if (state.drawMode === 'eraser') {
        // Erase drawing shapes close to eraser click
        eraseDrawingAt(state.startX, state.startY);
    }
    
    drawDrawingPitch();
}

function eraseDrawingAt(x, y) {
    const threshold = 15;
    state.drawings = state.drawings.filter(d => {
        if (d.type === 'line' || d.type === 'arrow') {
            // Distance from point to line segment
            const dist = getDistanceToSegment(x, y, d.x1, d.y1, d.x2, d.y2);
            return dist > threshold;
        } else if (d.type === 'brush') {
            // Check if any point in brush is close
            const anyClose = d.points.some(pt => {
                const dx = pt.x - x;
                const dy = pt.y - y;
                return Math.sqrt(dx*dx + dy*dy) < threshold;
            });
            return !anyClose;
        }
        return true;
    });
}

function getDistanceToSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

/* ==========================================
   DRAGGABLE PLAYERS & MARKERS OVERLAY
   ========================================== */

let activeDragId = null;
let dragOffset = { x: 0, y: 0 };

function initPlayerListeners() {
    // Buttons to add items
    document.getElementById('add-blue').addEventListener('click', () => addMarker('blue'));
    document.getElementById('add-red').addEventListener('click', () => addMarker('red'));
    document.getElementById('add-ref').addEventListener('click', () => addMarker('ref'));
    document.getElementById('add-ball').addEventListener('click', () => addMarker('ball'));
    document.getElementById('add-cone').addEventListener('click', () => addMarker('cone'));

    // Drag move handlers
    window.addEventListener('mousemove', dragMarker);
    window.addEventListener('mouseup', stopDragMarker);

    // Inspector handlers
    document.getElementById('inspector-close').addEventListener('click', () => {
        inspectorPanel.style.display = 'none';
        deselectAll();
    });

    inspectName.addEventListener('input', (e) => {
        if (!state.selectedItem) return;
        state.selectedItem.label = e.target.value;
        updateMarkerDOM(state.selectedItem);
    });

    inspectNumber.addEventListener('input', (e) => {
        if (!state.selectedItem) return;
        state.selectedItem.number = e.target.value;
        updateMarkerDOM(state.selectedItem);
    });

    document.getElementById('inspect-delete').addEventListener('click', () => {
        if (!state.selectedItem) return;
        deleteMarker(state.selectedItem.id);
    });

    // Modal cancellation/submission
    document.getElementById('modal-cancel').addEventListener('click', () => {
        nameModal.style.display = 'none';
        modalCallback = null;
    });

    document.getElementById('modal-submit').addEventListener('click', () => {
        if (modalCallback) {
            modalCallback(modalNameInput.value);
        }
        nameModal.style.display = 'none';
        modalCallback = null;
    });
}

function promptLabel(title, defaultVal, callback) {
    modalTitle.textContent = title;
    modalNameInput.value = defaultVal;
    nameModal.style.display = 'flex';
    modalNameInput.focus();
    modalNameInput.select();
    modalCallback = callback;
}

function addMarker(type) {
    const id = 'marker_' + Date.now();
    let label = '';
    let number = '';
    let x = canvas.width / 2;
    let y = canvas.height / 2;

    // Default offsets to spread them out a bit
    x += (Math.random() - 0.5) * 80;
    y += (Math.random() - 0.5) * 80;

    if (type === 'blue') {
        const teamBlueCount = state.players.filter(p => p.type === 'blue').length;
        number = (teamBlueCount + 1).toString();
        label = `Blue ${number}`;
    } else if (type === 'red') {
        const teamRedCount = state.players.filter(p => p.type === 'red').length;
        number = (teamRedCount + 1).toString();
        label = `Red ${number}`;
    } else if (type === 'ref') {
        label = 'Referee';
        number = 'R';
    } else if (type === 'ball') {
        label = 'Ball';
    } else if (type === 'cone') {
        label = 'Cone';
    }

    const newMarker = { id, type, x, y, label, number };
    state.players.push(newMarker);
    
    renderMarkerDOM(newMarker);
    addLog(`Added ${type} marker: ${label}`);
}

function renderMarkerDOM(marker) {
    const el = document.createElement('div');
    el.id = marker.id;
    el.className = `draggable-item team-${marker.type}`;
    if (marker.type === 'ball' || marker.type === 'cone') {
        el.className = `draggable-item ${marker.type}`;
    }
    
    // Set text contents
    if (marker.type === 'ref') {
        el.innerHTML = '<i class="fa-solid fa-user-tie"></i>';
    } else if (marker.type === 'ball') {
        el.innerHTML = '';
    } else if (marker.type === 'cone') {
        el.innerHTML = '';
    } else {
        el.textContent = marker.number;
    }

    // Add text label
    const labelEl = document.createElement('div');
    labelEl.className = 'player-label';
    labelEl.textContent = marker.label;
    el.appendChild(labelEl);

    // Initial position
    positionMarkerDOM(el, marker.x, marker.y);

    // Event listener for dragging
    el.addEventListener('mousedown', (e) => {
        if (state.drawMode !== 'select') return;
        e.stopPropagation();
        activeDragId = marker.id;
        
        // Calculate offset relative to item center
        const rect = el.getBoundingClientRect();
        const wrapperRect = pitchWrapper.getBoundingClientRect();
        
        // Marker coordinates on canvas scale
        const scaleX = canvas.width / wrapperRect.width;
        const scaleY = canvas.height / wrapperRect.height;
        
        const mCanvasX = (rect.left + rect.width / 2 - wrapperRect.left) * scaleX;
        const mCanvasY = (rect.top + rect.height / 2 - wrapperRect.top) * scaleY;
        
        const coords = getCanvasCoords(e);
        dragOffset.x = coords.x - mCanvasX;
        dragOffset.y = coords.y - mCanvasY;

        selectMarker(marker);
    });

    // Double-click to rename label/number quickly
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (marker.type === 'ball' || marker.type === 'cone') {
            promptLabel(`Change ${marker.type} label`, marker.label, (newLabel) => {
                marker.label = newLabel;
                updateMarkerDOM(marker);
            });
        } else {
            promptLabel("Rename Player Name", marker.label, (newName) => {
                marker.label = newName;
                updateMarkerDOM(marker);
            });
        }
    });

    playersOverlay.appendChild(el);
}

function positionMarkerDOM(el, x, y) {
    // Map canvas coordinates back to parent percent
    const pctX = (x / canvas.width) * 100;
    const pctY = (y / canvas.height) * 100;
    
    el.style.left = `calc(${pctX}% - ${el.offsetWidth / 2}px)`;
    el.style.top = `calc(${pctY}% - ${el.offsetHeight / 2}px)`;
}

function updateMarkerDOM(marker) {
    const el = document.getElementById(marker.id);
    if (!el) return;
    
    const labelEl = el.querySelector('.player-label');
    if (labelEl) {
        labelEl.textContent = marker.label;
    }

    if (marker.type !== 'ref' && marker.type !== 'ball' && marker.type !== 'cone') {
        el.firstChild.textContent = marker.number;
    }
    
    // Update fields in inspector if open
    if (state.selectedItem && state.selectedItem.id === marker.id) {
        inspectName.value = marker.label;
        inspectNumber.value = marker.number;
    }
}

function dragMarker(e) {
    if (!activeDragId) return;
    const marker = state.players.find(p => p.id === activeDragId);
    if (!marker) return;

    const coords = getCanvasCoords(e);
    let newX = coords.x - dragOffset.x;
    let newY = coords.y - dragOffset.y;

    // Bounds check
    const padding = 5;
    newX = Math.max(padding, Math.min(canvas.width - padding, newX));
    newY = Math.max(padding, Math.min(canvas.height - padding, newY));

    marker.x = newX;
    marker.y = newY;

    const el = document.getElementById(activeDragId);
    if (el) {
        positionMarkerDOM(el, newX, newY);
    }
}

function stopDragMarker() {
    if (activeDragId) {
        const marker = state.players.find(p => p.id === activeDragId);
        if (marker) {
            addLog(`Moved marker ${marker.label} to position (${Math.round(marker.x)}, ${Math.round(marker.y)})`);
        }
        activeDragId = null;
    }
}

function selectMarker(marker) {
    deselectAll();
    state.selectedItem = marker;
    const el = document.getElementById(marker.id);
    if (el) {
        el.classList.add('selected');
    }

    // Display inspector Panel
    inspectorPanel.style.display = 'flex';
    inspectorType.textContent = `${marker.type.toUpperCase()} EDITOR`;
    inspectName.value = marker.label;
    
    if (marker.type === 'ball' || marker.type === 'cone') {
        inspectNumberRow.style.display = 'none';
    } else {
        inspectNumberRow.style.display = 'flex';
        inspectNumber.value = marker.number;
    }
}

function deselectAll() {
    state.players.forEach(p => {
        const el = document.getElementById(p.id);
        if (el) el.classList.remove('selected');
    });
    state.selectedItem = null;
}

function deleteMarker(id) {
    state.players = state.players.filter(p => p.id !== id);
    const el = document.getElementById(id);
    if (el) {
        el.remove();
    }
    inspectorPanel.style.display = 'none';
    state.selectedItem = null;
    addLog(`Deleted marker`);
}


/* ==========================================
   TOOLBAR SELECTION & PAGE UTILITIES
   ========================================== */

function initToolbar() {
    const btns = document.querySelectorAll('.control-sidebar .tool-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Check if it's an action button
            if (btn.id === 'btn-clear-canvas' || btn.id === 'btn-reset-board') return;
            if (btn.id.startsWith('add-')) return; // Marker add triggers

            // Update drawing states
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Map tool names
            state.drawMode = btn.id.replace('tool-', '');
            
            // Toggle cursor style on canvas
            if (state.drawMode === 'select') {
                canvas.className = 'select-mode';
                deselectAll();
            } else {
                canvas.className = '';
                deselectAll();
                inspectorPanel.style.display = 'none';
            }
            addLog(`Drawing tool switched to: ${state.drawMode}`);
        });
    });

    // Save and Load Local Tactics File
    document.getElementById('btn-save-tactic').addEventListener('click', saveTacticState);
    document.getElementById('btn-load-tactic').addEventListener('click', loadTacticState);
    document.getElementById('btn-export-png').addEventListener('click', exportTacticImage);
}

function saveTacticState() {
    const dataStr = JSON.stringify({
        players: state.players,
        drawings: state.drawings,
        pitchStyle: state.pitchStyle
    });
    localStorage.setItem('tactical_studio_save', dataStr);
    addLog("Tactical configuration saved to browser local storage.");
    alert("Tactical configuration saved!");
}

function loadTacticState() {
    const dataStr = localStorage.getItem('tactical_studio_save');
    if (!dataStr) {
        alert("No saved layout found in local storage.");
        return;
    }
    
    const saved = JSON.parse(dataStr);
    state.drawings = saved.drawings || [];
    state.pitchStyle = saved.pitchStyle || 'grass';
    document.getElementById('pitch-style-select').value = state.pitchStyle;
    
    // Clear old elements
    playersOverlay.innerHTML = '';
    state.players = saved.players || [];
    
    // Render restored items
    state.players.forEach(p => renderMarkerDOM(p));
    
    drawDrawingPitch();
    addLog("Tactical configuration loaded from browser local storage.");
}

function exportTacticImage() {
    deselectAll();
    inspectorPanel.style.display = 'none';
    
    // Create temporary export canvas that merges background pitch + lines + custom players icons
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    
    // 1. Draw the current background & paths onto the export canvas
    // Save current active context references, swap to export canvas context
    const origCtx = ctx;
    
    // Hacky binding of drawPitch to custom context
    // Instead, just replicate background draw on expCtx
    expCtx.drawImage(canvas, 0, 0);

    // 2. Draw DOM players onto export canvas
    state.players.forEach(p => {
        expCtx.save();
        expCtx.shadowColor = 'rgba(0,0,0,0.3)';
        expCtx.shadowBlur = 6;
        expCtx.shadowOffsetY = 3;

        if (p.type === 'ball') {
            // Draw Ball
            expCtx.beginPath();
            expCtx.arc(p.x, p.y, 11, 0, Math.PI * 2);
            expCtx.fillStyle = '#ffffff';
            expCtx.fill();
            expCtx.lineWidth = 1.5;
            expCtx.strokeStyle = '#333333';
            expCtx.stroke();
            
            // Draw simple soccer panel dashes
            expCtx.fillStyle = '#333';
            expCtx.beginPath();
            expCtx.arc(p.x, p.y, 3, 0, Math.PI*2);
            expCtx.fill();
        } else if (p.type === 'cone') {
            // Draw Cone (triangle)
            expCtx.beginPath();
            expCtx.moveTo(p.x, p.y - 12);
            expCtx.lineTo(p.x - 12, p.y + 12);
            expCtx.lineTo(p.x + 12, p.y + 12);
            expCtx.closePath();
            expCtx.fillStyle = '#ff8c00';
            expCtx.fill();
        } else {
            // Draw circular jersey player
            expCtx.beginPath();
            expCtx.arc(p.x, p.y, 19, 0, Math.PI * 2);
            
            if (p.type === 'blue') {
                expCtx.fillStyle = '#0070cc';
            } else if (p.type === 'red') {
                expCtx.fillStyle = '#cc1c40';
            } else if (p.type === 'ref') {
                expCtx.fillStyle = '#ffd200';
            }
            expCtx.fill();
            
            expCtx.lineWidth = 2.5;
            expCtx.strokeStyle = '#ffffff';
            if (p.type === 'ref') expCtx.strokeStyle = '#111';
            expCtx.stroke();

            // Text
            expCtx.font = 'bold 12px sans-serif';
            expCtx.textAlign = 'center';
            expCtx.textBaseline = 'middle';
            expCtx.fillStyle = p.type === 'ref' ? '#000000' : '#ffffff';
            expCtx.fillText(p.number || '', p.x, p.y);
        }

        // Draw text tag below player
        if (p.label) {
            expCtx.font = '500 10px sans-serif';
            expCtx.fillStyle = '#ffffff';
            expCtx.shadowColor = '#000';
            expCtx.shadowBlur = 4;
            expCtx.fillText(p.label, p.x, p.y + 28);
        }
        
        expCtx.restore();
    });

    // 3. Trigger download of temporary image
    const dataURL = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'soccer-tactical-session.png';
    link.href = dataURL;
    link.click();
    addLog("Exported tactical session as PNG.");
}

/* ==========================================
   TAB NAVIGATION SYSTEM
   ========================================== */

function initTabListeners() {
    const tabs = document.querySelectorAll('.rules-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const contentId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-content-container .tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(contentId).classList.add('active');
            addLog(`Switched laws tab to: ${tab.textContent.trim()}`);
        });
    });
}

/* ==========================================
   PDF.JS LAWS OF THE GAME VIEW CODE
   ========================================== */

let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.25;
let canvasPdf = document.getElementById('pdf-render-canvas');
let ctxPdf = canvasPdf.getContext('2d');
let pdfPageTextCache = []; // Cache page texts to make all future searches and page mapping instant!

// Cache PDF texts sequentially without freezing browser
async function cacheAllPDFText() {
    if (!pdfDoc) return;
    pdfPageTextCache = [];
    addLog("Caching PDF page text for instant AI rule analysis...");
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            pdfPageTextCache[i] = text;
        } catch (e) {
            console.error(`Error caching page ${i}:`, e);
        }
        
        // Yield to prevent UI stutter
        if (i % 15 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    addLog("PDF rule text successfully cached. XAI engine optimized.");
}

function loadPDF(pdfUrl) {
    // Show loading
    const loadingOverlay = document.getElementById('pdf-loading');
    const loadingText = document.getElementById('pdf-loading-text');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        const spinner = document.querySelector('#pdf-loading .spinner');
        if (spinner) spinner.style.display = 'block';
        if (loadingText) loadingText.textContent = `Loading ${pdfUrl}...`;
    }
    
    pdfDoc = null;
    pageNum = 1;
    pdfPageTextCache = [];

    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('pdf-page-num').textContent = `Page 1 / ${pdfDoc.numPages}`;
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        renderPage(pageNum);
        addLog(`Successfully loaded PDF rules: ${pdfUrl} (${pdfDoc.numPages} pages).`);
        
        // Cache text in the background
        cacheAllPDFText();
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        if (loadingText) {
            loadingText.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; color: var(--team-red); margin-bottom: 10px;"></i>
                <div>Could not load PDF directly (${pdfUrl}).</div>
                <div style="font-size: 11px; margin-top: 4px; color: var(--text-muted);">Please make sure the PDF file exists in the directory and you are running a local web server.</div>
            `;
        }
        const spinner = document.querySelector('#pdf-loading .spinner');
        if (spinner) spinner.style.display = 'none';
    });
}

function initPDFViewer() {
    // Set worker url explicitly
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    // Load initial PDF
    const fileSelector = document.getElementById('pdf-file-select');
    const initialPdf = fileSelector ? fileSelector.value : 'Laws of the Game 2026_27_single pages.pdf';
    loadPDF(initialPdf);

    // Dynamic dropdown select listener
    if (fileSelector) {
        fileSelector.addEventListener('change', (e) => {
            loadPDF(e.target.value);
        });
    }

    // Pagination Click Listeners
    document.getElementById('pdf-prev').addEventListener('click', onPrevPage);
    document.getElementById('pdf-next').addEventListener('click', onNextPage);

    // Search bar submit (enter key)
    document.getElementById('pdf-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPDF(e.target.value);
        }
    });
}

function renderPage(num) {
    pageRendering = true;
    
    // Using promise to fetch the page
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        canvasPdf.height = viewport.height;
        canvasPdf.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: ctxPdf,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        // Wait for rendering to finish
        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Update page counters
    document.getElementById('pdf-page-num').textContent = `Page ${num} / ${pdfDoc.numPages}`;
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

// Search function to crawl pages for match text (utilizes cache if available)
async function searchPDF(query) {
    if (!pdfDoc || !query) return;
    
    const cleanQuery = query.toLowerCase();
    
    // If cached, use cache for instant result
    if (pdfPageTextCache.length > 0) {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            if (pdfPageTextCache[i] && pdfPageTextCache[i].toLowerCase().includes(cleanQuery)) {
                pageNum = i;
                queueRenderPage(pageNum);
                addLog(`Found query match "${query}" on Page ${i} (cached).`);
                return;
            }
        }
        addLog(`Search query "${query}" not found in PDF cache.`);
        alert(`No matches found for "${query}".`);
        return;
    }
    
    // Fallback if not cached
    const loadingOverlay = document.getElementById('pdf-loading');
    const loadingText = document.getElementById('pdf-loading-text');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        const spinner = document.querySelector('#pdf-loading .spinner');
        if (spinner) spinner.style.display = 'block';
        if (loadingText) loadingText.textContent = `Searching pages for "${query}"...`;
    }

    try {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map(item => item.str).join(' ');
            
            if (textItems.toLowerCase().includes(cleanQuery)) {
                pageNum = i;
                queueRenderPage(pageNum);
                addLog(`Found query match "${query}" on Page ${i}.`);
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                return;
            }
        }
        addLog(`Search query "${query}" not found in PDF.`);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        alert(`No matches found for "${query}".`);
    } catch(err) {
        console.error(err);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

/* ==========================================
   INTERACTIVE OFFSIDE SIMULATOR LOGIC
   ========================================== */

function initOffsideSimulator() {
    const simField = document.getElementById('simField');
    const simNodes = document.querySelectorAll('.sim-node');
    const btnCheck = document.getElementById('btn-check-offside');

    let draggedSimNode = null;

    // Draggable listeners for simulator nodes
    simNodes.forEach(node => {
        node.addEventListener('mousedown', (e) => {
            draggedSimNode = node;
            e.stopPropagation();
        });
    });

    simField.addEventListener('mousemove', (e) => {
        if (!draggedSimNode) return;
        const rect = simField.getBoundingClientRect();
        
        // Percent X/Y calculations
        let px = ((e.clientX - rect.left) / rect.width) * 100;
        let py = ((e.clientY - rect.top) / rect.height) * 100;

        // Constraint boundaries
        px = Math.max(2, Math.min(98, px));
        py = Math.max(5, Math.min(95, py));

        draggedSimNode.style.left = `${px}%`;
        draggedSimNode.style.top = `${py}%`;

        // If dragging passer, link ball position to it
        if (draggedSimNode.id === 'simPasser') {
            const ball = document.getElementById('simBall');
            ball.style.left = `${px + 2}%`;
            ball.style.top = `${py + 5}%`;
        }

        // Dynamically recalculate offside line at second-last defender position
        updateOffsideBoundaryLine();
    });

    window.addEventListener('mouseup', () => {
        draggedSimNode = null;
    });

    btnCheck.addEventListener('click', checkOffsidePosition);
}

function updateOffsideBoundaryLine() {
    const def2 = document.getElementById('simDef2');
    const gk = document.getElementById('simGK');
    const offsideLine = document.getElementById('simOffsideLine');

    // Parse X positions
    const def2X = parseFloat(def2.style.left);
    const gkX = parseFloat(gk.style.left);

    // Opponent defending right side (X=100%).
    // Second-last opponent is the second-closest to the right side (smaller X among def2X and gkX).
    const secondLastDefX = Math.min(def2X, gkX);

    // Position offside line at this X coordinate
    offsideLine.style.left = `${secondLastDefX}%`;
}

function checkOffsidePosition() {
    const def2 = document.getElementById('simDef2');
    const gk = document.getElementById('simGK');
    const att = document.getElementById('simAtt');
    const ball = document.getElementById('simBall');
    const statusBanner = document.getElementById('simStatusBanner');
    const statusDetails = document.getElementById('simStatusDetails');

    // Parse X positions
    const def2X = parseFloat(def2.style.left);
    const gkX = parseFloat(gk.style.left);
    const attX = parseFloat(att.style.left);
    const ballX = parseFloat(ball.style.left);

    // 1. Sort opponents to find second-last defender X position
    const secondLastDefX = Math.min(def2X, gkX);

    // 2. Offside criteria evaluations
    const isPastHalfway = attX > 50; // Opponent half begins at X > 50%
    const isAheadOfBall = attX > ballX;
    const isAheadOfDefenders = attX > secondLastDefX;

    const isOffside = isPastHalfway && isAheadOfBall && isAheadOfDefenders;

    // Apply class styling to banner
    statusBanner.className = 'sim-status-banner ' + (isOffside ? 'offside' : 'onside');
    statusBanner.textContent = isOffside ? 'OFFSIDE POSITION' : 'ONSIDE POSITION';

    if (isOffside) {
        statusDetails.innerHTML = `
            <strong>Offside offense confirmed:</strong> At the moment of the pass, the attacker (FW) is:<br>
            - In the opponent half (X: ${Math.round(attX)}% > 50%)<br>
            - Closer to the goal than the second-last defender (X: ${Math.round(attX)}% > ${Math.round(secondLastDefX)}%)<br>
            - Closer to the goal than the ball (X: ${Math.round(attX)}% > ${Math.round(ballX)}%)
        `;
        addLog("Offside Simulator run: OFFSIDE detected.");
    } else {
        let reason = '';
        if (!isPastHalfway) reason = "Attacker is in their own half of the pitch.";
        else if (!isAheadOfBall) reason = "Attacker is behind the ball at the moment of the pass.";
        else if (!isAheadOfDefenders) reason = "Attacker is behind or in-line with the second-last defender.";

        statusDetails.innerHTML = `
            <strong>Onside condition met:</strong> ${reason}<br>
            (Attacker X: ${Math.round(attX)}%, Ball X: ${Math.round(ballX)}%, Second-last opponent boundary X: ${Math.round(secondLastDefX)}%)
        `;
        addLog("Offside Simulator run: ONSIDE detected.");
    }
}

/* ==========================================
   DECISION TREE MATRIX LOGIC
   ========================================== */

function initDecisionTrees() {
    // --- Handball Analyzer Q1 listeners ---
    const hbQ1Btns = document.querySelectorAll('#handball-q1 .flow-option-btn');
    hbQ1Btns.forEach(btn => {
        btn.addEventListener('click', () => {
            hbQ1Btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            const val = btn.getAttribute('data-val');
            const q2Label = document.getElementById('handball-q2-label');
            const q2Options = document.getElementById('handball-q2');
            const resultBox = document.getElementById('handball-result');
            const resultText = document.getElementById('handball-result-text');

            if (val === 'no') {
                q2Label.style.display = 'none';
                q2Options.style.display = 'none';
                
                resultBox.style.display = 'block';
                resultBox.className = 'flow-result-box highlight-green';
                resultText.innerHTML = `<strong>PLAY ON (No Handball):</strong> The ball did not contact the hand or arm region below the armpit.`;
                addLog("Handball Analyzer checked: PLAY ON (No arm contact).");
            } else {
                q2Label.style.display = 'block';
                q2Options.style.display = 'flex';
                resultBox.style.display = 'none';
                
                // Clear any Q2 selections
                document.querySelectorAll('#handball-q2 .flow-option-btn').forEach(b => b.classList.remove('selected'));
            }
        });
    });

    // Handball Q2 Options
    const hbQ2Btns = document.querySelectorAll('#handball-q2 .flow-option-btn');
    hbQ2Btns.forEach(btn => {
        btn.addEventListener('click', () => {
            hbQ2Btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            const val = btn.getAttribute('data-val');
            const resultBox = document.getElementById('handball-result');
            const resultText = document.getElementById('handball-result-text');
            resultBox.style.display = 'block';

            if (val === 'deliberate') {
                resultBox.className = 'flow-result-box highlight-red';
                resultText.innerHTML = `<strong>HANDBALL OFFENSE:</strong> Direct Free Kick (or Penalty Kick).<br>
                                        <em>Disciplinary:</em> Red Card if denying a goal-scoring opportunity (DOGSO), Yellow Card if stopping a promising attack (SPA).`;
                addLog("Handball Analyzer checked: Deliberate Offense.");
            } else if (val === 'unnatural') {
                resultBox.className = 'flow-result-box highlight-yellow';
                resultText.innerHTML = `<strong>HANDBALL OFFENSE:</strong> Direct Free Kick (or Penalty Kick). The arm position made the body unnaturally larger and was not justified by the movement.<br>
                                        <em>Disciplinary:</em> Card depending on match impact.`;
                addLog("Handball Analyzer checked: Unnatural arm posture.");
            } else if (val === 'accidental-scorer') {
                resultBox.className = 'flow-result-box highlight-red';
                resultText.innerHTML = `<strong>HANDBALL OFFENSE:</strong> Direct Free Kick. Accidental handball by an attacker that results in a goal being scored directly or immediately after.`;
                addLog("Handball Analyzer checked: Accidental attacker scorer.");
            } else if (val === 'natural') {
                resultBox.className = 'flow-result-box highlight-green';
                resultText.innerHTML = `<strong>PLAY ON (No handball):</strong> Contact was natural movement/rebound off player's own head/body/foot or another player close by. No offense.`;
                addLog("Handball Analyzer checked: Natural movement Play On.");
            }
        });
    });

    // --- DOGSO Analyzer Q1 listeners ---
    const dogsoQ1Btns = document.querySelectorAll('#dogso-q1 .flow-option-btn');
    dogsoQ1Btns.forEach(btn => {
        btn.addEventListener('click', () => {
            dogsoQ1Btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            const val = btn.getAttribute('data-val');
            const q2Label = document.getElementById('dogso-q2-label');
            const q2Options = document.getElementById('dogso-q2');
            const resultBox = document.getElementById('dogso-result');
            const resultText = document.getElementById('dogso-result-text');

            if (val === 'outside') {
                q2Label.style.display = 'none';
                q2Options.style.display = 'none';
                resultBox.style.display = 'block';
                resultBox.className = 'flow-result-box highlight-red';
                resultText.innerHTML = `<strong>RED CARD & Direct Free Kick (DOGSO Outside Box):</strong><br>
                                        Any foul outside the box denying an obvious goal-scoring opportunity is a Red Card dismissal.`;
                addLog("DOGSO Analyzer checked: Outside Penalty Box (Red Card).");
            } else {
                q2Label.style.display = 'block';
                q2Options.style.display = 'flex';
                resultBox.style.display = 'none';
                
                // Clear Q2
                document.querySelectorAll('#dogso-q2 .flow-option-btn').forEach(b => b.classList.remove('selected'));
            }
        });
    });

    // DOGSO Q2 listeners
    const dogsoQ2Btns = document.querySelectorAll('#dogso-q2 .flow-option-btn');
    dogsoQ2Btns.forEach(btn => {
        btn.addEventListener('click', () => {
            dogsoQ2Btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            const val = btn.getAttribute('data-val');
            const resultBox = document.getElementById('dogso-result');
            const resultText = document.getElementById('dogso-result-text');
            resultBox.style.display = 'block';

            if (val === 'yes') {
                resultBox.className = 'flow-result-box highlight-yellow';
                resultText.innerHTML = `<strong>YELLOW CARD & Penalty Kick (Genuine Ball Attempt):</strong><br>
                                        Double Jeopardy exemption applies. Since the player made a genuine attempt to challenge/play the ball, the sanction is downgraded from Red to Yellow.`;
                addLog("DOGSO Analyzer checked: Inside Box with ball attempt (Yellow Card).");
            } else {
                resultBox.className = 'flow-result-box highlight-red';
                resultText.innerHTML = `<strong>RED CARD & Penalty Kick (No Ball Attempt):</strong><br>
                                        No attempt to play ball (holding, pulling, pushing, handball). Double jeopardy protection does NOT apply. Defender is sent off.`;
                addLog("DOGSO Analyzer checked: Inside Box, no ball attempt (Red Card).");
            }
        });
    });
}

/* ==========================================
   AI & XAI ANALYST ENGINE
   ========================================== */

function initXAIAnalyst() {
    // 1. Analyze board state button
    const btnRunAnalysis = document.getElementById('btn-run-analysis');
    if (btnRunAnalysis) {
        btnRunAnalysis.addEventListener('click', runBoardAnalysis);
    }

    // 2. Preset query buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            const searchInput = document.getElementById('qa-search-input');
            if (searchInput) searchInput.value = btn.textContent;
            crawlPDFForQuery(query);
        });
    });

    // 3. Ask custom question button
    const btnRunQA = document.getElementById('btn-run-qa');
    if (btnRunQA) {
        btnRunQA.addEventListener('click', () => {
            const query = document.getElementById('qa-search-input').value;
            if (query.trim()) {
                crawlPDFForQuery(query);
            }
        });
    }

    // 4. Enter key in Q&A search box
    const qaSearchInput = document.getElementById('qa-search-input');
    if (qaSearchInput) {
        qaSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value;
                if (query.trim()) {
                    crawlPDFForQuery(query);
                }
            }
        });
    }
    
    // Bind Tab Click to run initial analysis if user goes to XAI panel
    const analysisTabBtn = document.getElementById('tab-btn-analysis');
    if (analysisTabBtn) {
        analysisTabBtn.addEventListener('click', () => {
            // Auto run if board is populated
            if (state.players.length >= 3) {
                runBoardAnalysis();
            }
        });
    }
}

// Global window handle for PDF Page citation jumps
window.jumpToPDFPage = function(num) {
    if (!pdfDoc) return;
    
    // Switch TACTICS OS page to laws-hub
    if (typeof nav === 'function') {
        const lawsHubTabBtn = document.getElementById('ni-laws-hub');
        nav('laws-hub', lawsHubTabBtn);
    }
    
    // 1. Switch active tab buttons
    const tabs = document.querySelectorAll('.rules-tabs .tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    
    // Find the 'pdf-tab' button
    const pdfTabBtn = Array.from(tabs).find(t => t.getAttribute('data-tab') === 'pdf-tab');
    if (pdfTabBtn) pdfTabBtn.classList.add('active');

    // 2. Switch active tab content
    document.querySelectorAll('.tab-content-container .tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const pdfTabContent = document.getElementById('pdf-tab');
    if (pdfTabContent) pdfTabContent.classList.add('active');
    
    // 3. Render exact page
    pageNum = num;
    queueRenderPage(pageNum);
    addLog(`Jumped to PDF Page ${num}.`);
};

function findCachedPageForTerm(term) {
    const cleanTerm = term.toLowerCase();
    if (pdfPageTextCache && pdfPageTextCache.length > 0) {
        for (let i = 1; i < pdfPageTextCache.length; i++) {
            if (pdfPageTextCache[i] && pdfPageTextCache[i].toLowerCase().includes(cleanTerm)) {
                return i;
            }
        }
    }
    return null;
}

function runBoardAnalysis() {
    const attTeam = document.getElementById('att-team-select').value;
    const defTeam = attTeam === 'red' ? 'blue' : 'red';

    const attackers = state.players.filter(p => p.type === attTeam);
    const defenders = state.players.filter(p => p.type === defTeam);
    const balls = state.players.filter(p => p.type === 'ball');

    const resultsBox = document.getElementById('board-analysis-results');
    const resultPill = document.getElementById('board-result-pill');
    const treeContainer = document.getElementById('board-reasoning-tree');
    const citationsContainer = document.getElementById('board-citations');

    if (!resultsBox || !resultPill || !treeContainer || !citationsContainer) return;

    resultsBox.style.display = 'block';
    treeContainer.innerHTML = '';
    citationsContainer.innerHTML = '';

    // Verify minimum players
    if (attackers.length < 1 || defenders.length < 2) {
        resultPill.className = 'result-summary-pill failed';
        resultPill.textContent = 'INSUFFICIENT DATA';
        treeContainer.innerHTML = `
            <div class="reasoning-step danger">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                    <strong>Setup issue:</strong> Make sure you have added at least <strong>1 attacker</strong> (Team ${attTeam.toUpperCase()}) and <strong>2 defenders</strong> (Team ${defTeam.toUpperCase()}) on the tactical board.
                </div>
            </div>
        `;
        return;
    }

    // Goal line: Attack goes Left to Right. Goal line is X = 775. Halfway line is X = 400.
    const sortedDefenders = [...defenders].sort((a, b) => b.x - a.x);
    const secondLastDef = sortedDefenders[1]; // Index 1 is second-last (Index 0 is GK/deepest defender)
    const secondLastDefBoundaryX = secondLastDef.x;

    let passer = attackers[0];
    let receiver = attackers[0];

    const ballX = balls.length > 0 ? balls[0].x : null;
    const ballY = balls.length > 0 ? balls[0].y : null;

    if (balls.length > 0) {
        let minBallDist = Infinity;
        attackers.forEach(att => {
            const dx = att.x - ballX;
            const dy = att.y - ballY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minBallDist) {
                minBallDist = dist;
                passer = att;
            }
        });
    } else {
        let minX = Infinity;
        attackers.forEach(att => {
            if (att.x < minX) {
                minX = att.x;
                passer = att;
            }
        });
    }

    let maxX = -Infinity;
    attackers.forEach(att => {
        if (att.x > maxX) {
            maxX = att.x;
            receiver = att;
        }
    });

    const isSelfPass = passer.id === receiver.id;

    // Convert positions to percentages
    const rxPct = Math.round((receiver.x / canvas.width) * 100);
    const bxPct = ballX !== null ? Math.round((ballX / canvas.width) * 100) : Math.round((passer.x / canvas.width) * 100);
    const dxPct = Math.round((secondLastDefBoundaryX / canvas.width) * 100);

    const isPastHalfway = receiver.x > 400;
    const isAheadOfBall = receiver.x > (ballX !== null ? ballX : passer.x);
    const isAheadOfDefenders = receiver.x > secondLastDefBoundaryX;

    const isOffside = isPastHalfway && isAheadOfBall && isAheadOfDefenders && !isSelfPass;

    let treeHTML = '';

    // Step 1: Roles
    treeHTML += `
        <div class="reasoning-step info">
            <i class="fa-solid fa-users-viewfinder"></i>
            <div>
                <strong>Player Role Mapping:</strong><br>
                - Attacking Receiver identified as <strong>${receiver.label}</strong> (Position X: ${rxPct}%)<br>
                - Passer/Ball Carrier identified as <strong>${passer.label}</strong> (Position X: ${Math.round((passer.x/canvas.width)*100)}%)
            </div>
        </div>
    `;

    // Step 2: Halfway Line
    if (isPastHalfway) {
        treeHTML += `
            <div class="reasoning-step success">
                <i class="fa-solid fa-circle-check"></i>
                <div>
                    <strong>Opponent Half check:</strong> Attacker is in the opponents' half of the pitch (X: ${rxPct}% > 50%).
                </div>
            </div>
        `;
    } else {
        treeHTML += `
            <div class="reasoning-step danger">
                <i class="fa-solid fa-circle-xmark"></i>
                <div>
                    <strong>Opponent Half check:</strong> Attacker is in their own half (X: ${rxPct}% <= 50%). Cannot be offside in own half under Law 11.
                </div>
            </div>
        `;
    }

    // Step 3: Ahead of ball
    if (isAheadOfBall) {
        treeHTML += `
            <div class="reasoning-step success">
                <i class="fa-solid fa-circle-check"></i>
                <div>
                    <strong>Ball Position check:</strong> Attacker is closer to opponents' goal line than the ball (Player X: ${rxPct}% > Ball X: ${bxPct}%).
                </div>
            </div>
        `;
    } else {
        treeHTML += `
            <div class="reasoning-step danger">
                <i class="fa-solid fa-circle-xmark"></i>
                <div>
                    <strong>Ball Position check:</strong> Attacker is behind or level with the ball (Player X: ${rxPct}% <= Ball X: ${bxPct}%). Cannot be offside.
                </div>
            </div>
        `;
    }

    // Step 4: Ahead of second-last defender
    if (isAheadOfDefenders) {
        treeHTML += `
            <div class="reasoning-step success">
                <i class="fa-solid fa-circle-check"></i>
                <div>
                    <strong>Second-Last Defender check:</strong> Attacker is closer to goal than the second-last opponent, <strong>${secondLastDef.label}</strong> (Player X: ${rxPct}% > Defender X: ${dxPct}%).
                </div>
            </div>
        `;
    } else {
        treeHTML += `
            <div class="reasoning-step danger">
                <i class="fa-solid fa-circle-xmark"></i>
                <div>
                    <strong>Second-Last Defender check:</strong> Attacker is behind or level with the second-last opponent, <strong>${secondLastDef.label}</strong> (Player X: ${rxPct}% <= Defender X: ${dxPct}%). ONSIDE.
                </div>
            </div>
        `;
    }

    if (isSelfPass && attackers.length === 1) {
        treeHTML += `
            <div class="reasoning-step danger">
                <i class="fa-solid fa-circle-xmark"></i>
                <div>
                    <strong>Interference check:</strong> There is only 1 attacker on the pitch. Offside position only applies if the ball is passed by a teammate.
                </div>
            </div>
        `;
    }

    if (isOffside) {
        resultPill.className = 'result-summary-pill offside';
        resultPill.textContent = 'OFFSIDE POSITION';
        treeHTML += `
            <div class="reasoning-step danger" style="margin-top: 10px; padding: 10px; background: rgba(255, 51, 102, 0.05); border-radius: 6px;">
                <i class="fa-solid fa-flag text-red"></i>
                <div>
                    <strong>Offside Position Confirmed:</strong> Attacker meets all 3 criteria of Law 11 at the moment of the pass. Referee should penalize if player interferes with play.
                </div>
            </div>
        `;
    } else {
        resultPill.className = 'result-summary-pill onside';
        resultPill.textContent = 'ONSIDE';
        treeHTML += `
            <div class="reasoning-step success" style="margin-top: 10px; padding: 10px; background: rgba(0, 255, 102, 0.05); border-radius: 6px;">
                <i class="fa-solid fa-play text-green"></i>
                <div>
                    <strong>Onside Play:</strong> Attacker fails to meet one or more criteria of offside. Play should continue.
                </div>
            </div>
        `;
    }

    treeContainer.innerHTML = treeHTML;

    // Citations
    const law11Page = findCachedPageForTerm("law 11") || findCachedPageForTerm("offside") || 93;
    citationsContainer.innerHTML = `
        <button class="citation-btn" onclick="window.jumpToPDFPage(${law11Page})">
            <i class="fa-solid fa-book-open"></i> Read Law 11 (Offside) on PDF Page ${law11Page}
        </button>
    `;

    addLog(`Ran tactical board analysis: ${isOffside ? 'OFFSIDE' : 'ONSIDE'}`);
}

function generateAIExtrapolation(query, pageText) {
    const q = query.toLowerCase();
    
    if (q.includes('offside')) {
        return `<strong>Law 11 (Offside) Analysis:</strong> Standing in an offside position is not an offence in itself. A player is in an offside position if they are nearer to the opponents' goal line than both the ball and the second-last opponent, while in the opponent's half. The offence occurs when a player in that position becomes involved in active play by interfering with play, interfering with an opponent, or gaining an advantage.`;
    }
    
    if (q.includes('handball')) {
        return `<strong>Law 12 (Handball) Interpretation:</strong> Handball involves the deliberate contact of the ball with the player's hand or arm, or when a player makes their body unnaturally bigger. The hand-to-ball movement, distance, and arm posture are key criteria. Note that accidental handball by an attacking teammate that leads to a goal is immediately penalized, whereas accidental defensive handball is generally play-on unless the arm position is unjustified.`;
    }
    
    if (q.includes('dogso') || q.includes('goal-scoring') || q.includes('obvious')) {
        return `<strong>DOGSO (Denial of Goal-Scoring Opportunity) Sanction Guidelines:</strong> Under Law 12, four key factors determine DOGSO: 1) Distance between the offence and the goal; 2) General direction of play; 3) Likelihood of keeping or gaining control of the ball; and 4) Location and number of defenders. If DOGSO occurs inside the penalty area and the defender made a genuine attempt to play the ball, the sanction is downgraded to a Yellow Card (exemption to double jeopardy). Otherwise (holding, pulling, pushing, handball), it remains a Red Card.`;
    }
    
    if (q.includes('injury') || q.includes('injured')) {
        return `<strong>Player Treatment & Safety rules:</strong> The referee must ensure safety. Play is stopped only if a player is seriously injured. If a player is slightly injured, play continues until the ball goes out. An injured player must be treated off the field of play unless they are the goalkeeper, or a goalkeeper and an outfield player collided, or players from the same team collided, or the injury resulted from a carded foul.`;
    }

    if (q.includes('double touch') || q.includes('twice')) {
        return `<strong>Double Touch / Restart Offence:</strong> A kicker is not allowed to touch the ball a second time on restarts (kick-offs, corner kicks, free kicks, penalty kicks, throw-ins, goal kicks) until it has touched another player. If they do, the restart is an Indirect Free Kick to the opposing team at the spot of the second touch. If the second touch is a handball, the restart is a Direct Free Kick (or penalty).`;
    }

    if (q.includes('drop ball')) {
        return `<strong>Drop Ball Restart Procedures:</strong> A drop ball is used when play is stopped for reasons not covered by standard restarts (referee touch, external interference, spectator, injury). If play was in the penalty area when stopped (or the ball was in the penalty area), the ball is dropped to the defending goalkeeper. Otherwise, it is dropped to one player of the team that last touched the ball, at the position of the last touch. All other players must remain 4m away.`;
    }

    return `Based on Law text matches: The rules prescribe that the circumstances surrounding this incident fall under the official guidelines of the Laws of the Game. Please review the highlighted paragraphs below to verify correct referee actions and restart criteria.`;
}

async function crawlPDFForQuery(query) {
    if (!pdfDoc) {
        alert("PDF is not loaded yet.");
        return;
    }
    const loader = document.getElementById('qa-loader');
    const content = document.getElementById('qa-output-content');
    const resultsBox = document.getElementById('qa-results');

    if (!loader || !content || !resultsBox) return;

    resultsBox.style.display = 'block';
    loader.style.display = 'block';
    content.innerHTML = '';

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (keywords.length === 0) {
        loader.style.display = 'none';
        content.innerHTML = '<div style="color: var(--team-red);">Please enter a search query with longer words.</div>';
        return;
    }

    const matches = [];
    const maxMatches = 5;

    try {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            if (i % 10 === 0) {
                loader.querySelector('div').textContent = `Crawling page ${i} of ${pdfDoc.numPages}...`;
            }
            
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            let text = '';
            if (pdfPageTextCache && pdfPageTextCache[i]) {
                text = pdfPageTextCache[i];
            } else {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                text = textContent.items.map(item => item.str).join(' ');
            }
            
            const lowerText = text.toLowerCase();

            let matchCount = 0;
            keywords.forEach(kw => {
                if (lowerText.includes(kw)) matchCount++;
            });

            if (matchCount > 0) {
                let snippet = '';
                let firstIndex = -1;
                for (let kw of keywords) {
                    firstIndex = lowerText.indexOf(kw);
                    if (firstIndex !== -1) break;
                }

                if (firstIndex !== -1) {
                    const start = Math.max(0, firstIndex - 100);
                    const end = Math.min(text.length, firstIndex + 150);
                    snippet = '...' + text.substring(start, end).replace(/\n/g, ' ') + '...';
                } else {
                    snippet = text.substring(0, 200) + '...';
                }

                matches.push({
                    pageNumber: i,
                    matchCount: matchCount,
                    snippet: snippet,
                    text: text
                });
            }
        }

        matches.sort((a, b) => b.matchCount - a.matchCount);

        loader.style.display = 'none';

        if (matches.length === 0) {
            content.innerHTML = `
                <div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 12px;">
                    No direct rules matches found for "${query}". Try searching for standard terms like <strong>offside</strong>, <strong>handball</strong>, <strong>penalty</strong>, or <strong>goalkeeper</strong>.
                </div>
            `;
            return;
        }

        let html = '';
        const topMatch = matches[0];
        let explanationText = generateAIExtrapolation(query, topMatch.text);

        html += `
            <div class="qa-explanation">
                <h4 style="color: var(--accent-green); margin-bottom: 6px;"><i class="fa-solid fa-microchip"></i> XAI Rules Breakdown & Interpretation</h4>
                <p style="font-size: 13px; color: var(--text-primary); line-height: 1.5; margin-bottom: 12px;">
                    ${explanationText}
                </p>
            </div>
            <h5 style="color: #fff; margin: 16px 0 8px; font-size: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                Direct Excerpts from Rules PDF (Top Matches)
            </h5>
        `;

        const displayMatches = matches.slice(0, maxMatches);
        displayMatches.forEach(m => {
            let highlightedSnippet = m.snippet;
            keywords.forEach(kw => {
                const regex = new RegExp(`(${kw})`, 'gi');
                highlightedSnippet = highlightedSnippet.replace(regex, '<span class="qa-keyword-highlight">$1</span>');
            });

            html += `
                <div style="margin-bottom: 12px; border-bottom: 1px dashed var(--border-color); padding-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">Page ${m.pageNumber}</span>
                        <button class="citation-btn" onclick="window.jumpToPDFPage(${m.pageNumber})">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Jump to Page
                        </button>
                    </div>
                    <div class="qa-extract-box">${highlightedSnippet}</div>
                </div>
            `;
        });

        content.innerHTML = html;
        addLog(`Q&A Analysis complete for "${query}". Found matches on ${matches.length} pages.`);

    } catch (err) {
        console.error(err);
        loader.style.display = 'none';
        content.innerHTML = `<div style="color: var(--team-red);">Error processing PDF content: ${err.message}</div>`;
    }
}
