// ============================================================
// PRODUCTION FLOOR TRACKER
// Clean Setup + Tracking Version
// ============================================================

const STORAGE_KEY = "production-floor-tracker-clean-v2";


// ============================================================
// STATE
// ============================================================

const state = {
    setupStep: 1,

    workstation: {
        x: 0,
        y: 0
    },

    sensors: {
        motionPermission: false,
        orientationPermission: false,

        motionData: false,
        orientationData: false,

        motionListener: false,
        orientationListener: false
    },

    mapping: {
        active: false,

        x: 0,
        y: 0,

        heading: 0,
        distance: 0,

        path: [],

        references: [],

        lastStepTime: 0,

        lastStepAcceleration: 0
    },

    tracking: {
        active: false,

        x: 0,
        y: 0,

        heading: 0,
        distance: 0,

        path: [],

        lastStepTime: 0,

        lastStepAcceleration: 0
    },

    plan: {
        jpegUrl: null,
        jpegName: null,

        pdfName: null,
        pdfUrl: null,

        imageTransform: {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        }
    },

    locked: false
};


// ============================================================
// CONSTANTS
// ============================================================

const STEP_LENGTH = 0.72;

const STEP_THRESHOLD = 1.15;

const STEP_COOLDOWN = 280;

const CANVAS_PADDING = 50;


// ============================================================
// DOM HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function setText(id, value) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent = String(value);
}


function safeNumber(value, fallback = 0) {

    const number = Number(value);

    if (Number.isFinite(number)) {
        return number;
    }

    return fallback;
}


function clamp(value, min, max) {

    value = safeNumber(value, min);

    return Math.min(
        max,
        Math.max(min, value)
    );
}


// ============================================================
// STORAGE
// ============================================================

function saveState() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {

        console.warn(
            "Could not save application state:",
            error
        );

    }
}


function loadState() {

    try {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            initializeFreshState();
            return;
        }

        const parsed = JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            initializeFreshState();
            return;
        }


        // ----------------------------------------------------
        // Merge safe parts
        // ----------------------------------------------------

        if (parsed.workstation) {

            state.workstation.x =
                safeNumber(parsed.workstation.x);

            state.workstation.y =
                safeNumber(parsed.workstation.y);

        }


        if (parsed.plan) {

            state.plan.jpegUrl =
                parsed.plan.jpegUrl || null;

            state.plan.jpegName =
                parsed.plan.jpegName || null;

            state.plan.pdfName =
                parsed.plan.pdfName || null;

            state.plan.pdfUrl =
                parsed.plan.pdfUrl || null;

            if (parsed.plan.imageTransform) {

                state.plan.imageTransform.x =
                    safeNumber(
                        parsed.plan.imageTransform.x
                    );

                state.plan.imageTransform.y =
                    safeNumber(
                        parsed.plan.imageTransform.y
                    );

                state.plan.imageTransform.scale =
                    clamp(
                        parsed.plan.imageTransform.scale,
                        0.1,
                        5
                    );

                state.plan.imageTransform.rotation =
                    safeNumber(
                        parsed.plan.imageTransform.rotation
                    );
            }
        }


        if (parsed.mapping) {

            state.mapping.x =
                safeNumber(parsed.mapping.x);

            state.mapping.y =
                safeNumber(parsed.mapping.y);

            state.mapping.heading =
                safeNumber(parsed.mapping.heading);

            state.mapping.distance =
                safeNumber(parsed.mapping.distance);


            if (Array.isArray(parsed.mapping.path)) {

                state.mapping.path =
                    parsed.mapping.path
                        .filter(point =>
                            point &&
                            Number.isFinite(Number(point.x)) &&
                            Number.isFinite(Number(point.y))
                        )
                        .map(point => ({
                            x: safeNumber(point.x),
                            y: safeNumber(point.y),
                            t: safeNumber(point.t, Date.now())
                        }));

            }


            if (!state.mapping.path.length) {

                state.mapping.path = [
                    {
                        x: 0,
                        y: 0,
                        t: Date.now()
                    }
                ];

            }


            if (Array.isArray(parsed.mapping.references)) {

                state.mapping.references =
                    parsed.mapping.references
                        .filter(point =>
                            point &&
                            Number.isFinite(Number(point.x)) &&
                            Number.isFinite(Number(point.y))
                        )
                        .map(point => ({
                            id:
                                point.id ||
                                createId(),

                            name:
                                point.name ||
                                `Reference ${state.mapping.references.length + 1}`,

                            x: safeNumber(point.x),

                            y: safeNumber(point.y),

                            heading:
                                safeNumber(point.heading),

                            time:
                                safeNumber(point.time, Date.now())
                        }));

            }

        }


        state.locked =
            parsed.locked === true;


        if (parsed.setupStep >= 1 &&
            parsed.setupStep <= 5) {

            state.setupStep =
                parsed.setupStep;

        }

    } catch (error) {

        console.warn(
            "Could not load saved state:",
            error
        );

        initializeFreshState();
    }
}


function initializeFreshState() {

    state.setupStep = 1;

    state.workstation.x = 0;
    state.workstation.y = 0;

    state.mapping.active = false;

    state.mapping.x = 0;
    state.mapping.y = 0;

    state.mapping.heading = 0;
    state.mapping.distance = 0;

    state.mapping.path = [
        {
            x: 0,
            y: 0,
            t: Date.now()
        }
    ];

    state.mapping.references = [];

    state.tracking.active = false;

    state.tracking.x = 0;
    state.tracking.y = 0;

    state.tracking.heading = 0;
    state.tracking.distance = 0;

    state.tracking.path = [
        {
            x: 0,
            y: 0,
            t: Date.now()
        }
    ];

    state.plan.jpegUrl = null;
    state.plan.jpegName = null;

    state.plan.pdfName = null;
    state.plan.pdfUrl = null;

    state.plan.imageTransform = {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
    };

    state.locked = false;
}


// ============================================================
// ID GENERATOR
// ============================================================

function createId() {

    if (
        typeof crypto !== "undefined" &&
        crypto.randomUUID
    ) {

        return crypto.randomUUID();

    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2)
    );
}


// ============================================================
// NAVIGATION
// ============================================================

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active",
                page.id === pageId
            );

        });


    document
        .querySelectorAll(".mainTab")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === pageId
            );

        });


    if (pageId === "setupPage") {

        updateSetupUI();

    }


    if (pageId === "trackPage") {

        updateTrackingUI();

        drawLiveMap();

    }
}


function showSetupStep(step) {

    step = clamp(
        step,
        1,
        5
    );

    state.setupStep = step;

    saveState();


    document
        .querySelectorAll(".setupStep")
        .forEach(button => {

            const buttonStep =
                Number(button.dataset.step);

            button.classList.toggle(
                "active",
                buttonStep === step
            );

            button.classList.toggle(
                "completed",
                buttonStep < step
            );

        });


    document
        .querySelectorAll(".setupPanel")
        .forEach(panel => {

            panel.classList.toggle(
                "active",
                Number(panel.dataset.panel) === step
            );

        });


    updateSetupUI();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    if (step === 2) {

        requestAnimationFrame(() => {

            drawMovement();

        });

    }


    if (step === 4) {

        requestAnimationFrame(() => {

            drawAlignment();

        });

    }


    if (step === 5) {

        updateCompletionSummary();

    }
}


// ============================================================
// STATUS
// ============================================================

function updateGlobalStatus() {

    const badge = $("statusBadge");

    if (!badge) {
        return;
    }


    badge.classList.remove(
        "ready",
        "warning",
        "error"
    );


    if (state.locked) {

        badge.textContent =
            "Setup locked";

        badge.classList.add("ready");

        return;
    }


    badge.textContent =
        `Setup step ${state.setupStep} / 5`;

    badge.classList.add("warning");
}


// ============================================================
// SENSOR PERMISSIONS
// ============================================================

async function requestSensorPermissions() {

    const result = {
        motion: false,
        orientation: false
    };


    // --------------------------------------------------------
    // Motion
    // --------------------------------------------------------

    try {

        if (
            typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceMotionEvent.requestPermission();

            result.motion =
                permission === "granted";

        } else {

            result.motion =
                typeof DeviceMotionEvent !== "undefined";

        }

    } catch (error) {

        console.warn(
            "Motion permission error:",
            error
        );

        result.motion = false;
    }


    // --------------------------------------------------------
    // Orientation
    // --------------------------------------------------------

    try {

        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            result.orientation =
                permission === "granted";

        } else {

            result.orientation =
                typeof DeviceOrientationEvent !== "undefined";

        }

    } catch (error) {

        console.warn(
            "Orientation permission error:",
            error
        );

        result.orientation = false;
    }


    state.sensors.motionPermission =
        result.motion;

    state.sensors.orientationPermission =
        result.orientation;


    installSensorListeners();


    updateSensorStatus();


    return (
        result.motion ||
        result.orientation
    );
}


// ============================================================
// SENSOR LISTENERS
// ============================================================

function installSensorListeners() {

    if (
        typeof window.DeviceMotionEvent !== "undefined" &&
        !state.sensors.motionListener
    ) {

        window.addEventListener(
            "devicemotion",
            onMotion,
            {
                passive: true
            }
        );

        state.sensors.motionListener = true;
    }


    if (
        typeof window.DeviceOrientationEvent !== "undefined" &&
        !state.sensors.orientationListener
    ) {

        window.addEventListener(
            "deviceorientation",
            onOrientation,
            {
                passive: true
            }
        );

        state.sensors.orientationListener = true;
    }


    if (
        typeof window.DeviceOrientationEvent !== "undefined"
    ) {

        window.addEventListener(
            "deviceorientationabsolute",
            onOrientation,
            {
                passive: true
            }
        );
    }
}


// ============================================================
// ORIENTATION
// ============================================================

function onOrientation(event) {

    let heading = null;


    // iPhone / Safari compass heading
    if (
        Number.isFinite(
            Number(event.webkitCompassHeading)
        )
    ) {

        heading =
            Number(event.webkitCompassHeading);

    } else if (
        Number.isFinite(
            Number(event.alpha)
        )
    ) {

        heading =
            Number(event.alpha);
    }


    if (!Number.isFinite(heading)) {
        return;
    }


    heading =
        ((heading % 360) + 360) % 360;


    state.mapping.heading = heading;

    state.tracking.heading = heading;

    state.sensors.orientationData = true;


    updateSensorStatus();

    updatePositionDisplays();

    drawMovement();

    drawAlignment();

    drawLiveMap();
}


// ============================================================
// MOTION
// ============================================================

function onMotion(event) {

    const acceleration =
        event.accelerationIncludingGravity;


    if (!acceleration) {
        return;
    }


    const x =
        safeNumber(acceleration.x, NaN);

    const y =
        safeNumber(acceleration.y, NaN);

    const z =
        safeNumber(acceleration.z, NaN);


    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
    ) {

        return;
    }


    const magnitude =
        Math.sqrt(
            x * x +
            y * y +
            z * z
        );


    if (!Number.isFinite(magnitude)) {
        return;
    }


    state.sensors.motionData = true;


    detectStep(magnitude);


    updateSensorStatus();
}


// ============================================================
// STEP DETECTION
// ============================================================

function detectStep(accelerationMagnitude) {

    const now = performance.now();


    // Remove approximate gravity component.
    const dynamicAcceleration =
        Math.abs(
            accelerationMagnitude - 9.81
        );


    if (
        dynamicAcceleration < STEP_THRESHOLD
    ) {

        return;
    }


    // Prevent multiple steps from one foot movement.
    if (
        now - state.mapping.lastStepTime <
        STEP_COOLDOWN
    ) {

        return;
    }


    state.mapping.lastStepTime = now;

    state.tracking.lastStepTime = now;


    if (state.mapping.active) {

        applyMappingStep();

    }


    if (state.tracking.active) {

        applyTrackingStep();

    }
}


// ============================================================
// HEADING TO MOVEMENT
// ============================================================

function headingToVector(heading) {

    heading =
        safeNumber(heading, 0);


    const radians =
        heading * Math.PI / 180;


    return {
        x: Math.sin(radians),
        y: Math.cos(radians)
    };
}


// ============================================================
// MAPPING STEP
// ============================================================

function applyMappingStep() {

    const direction =
        headingToVector(
            state.mapping.heading
        );


    const dx =
        direction.x * STEP_LENGTH;

    const dy =
        direction.y * STEP_LENGTH;


    if (
        !Number.isFinite(dx) ||
        !Number.isFinite(dy)
    ) {

        return;
    }


    state.mapping.x += dx;

    state.mapping.y += dy;

    state.mapping.distance +=
        STEP_LENGTH;


    state.mapping.path.push({

        x: safeNumber(
            state.mapping.x
        ),

        y: safeNumber(
            state.mapping.y
        ),

        t: Date.now()

    });


    drawMovement();

    updatePositionDisplays();

    saveState();
}


// ============================================================
// TRACKING STEP
// ============================================================

function applyTrackingStep() {

    const direction =
        headingToVector(
            state.tracking.heading
        );


    const dx =
        direction.x * STEP_LENGTH;

    const dy =
        direction.y * STEP_LENGTH;


    if (
        !Number.isFinite(dx) ||
        !Number.isFinite(dy)
    ) {

        return;
    }


    state.tracking.x += dx;

    state.tracking.y += dy;

    state.tracking.distance +=
        STEP_LENGTH;


    state.tracking.path.push({

        x: safeNumber(
            state.tracking.x
        ),

        y: safeNumber(
            state.tracking.y
        ),

        t: Date.now()

    });


    drawLiveMap();

    updateTrackingPosition();

    saveState();
}


// ============================================================
// SENSOR UI
// ============================================================

function updateSensorStatus() {

    const element =
        $("sensorStatus");

    if (!element) {
        return;
    }


    const motion =
        state.sensors.motionPermission;

    const orientation =
        state.sensors.orientationPermission;

    const motionData =
        state.sensors.motionData;

    const orientationData =
        state.sensors.orientationData;


    if (motion && orientation) {

        element.innerHTML =
            `
            <strong>✓ Sensors enabled</strong><br>
            Motion: ${motionData ? "receiving data" : "waiting for data"}<br>
            Compass: ${orientationData ? "receiving data" : "waiting for data"}
            `;

        return;
    }


    if (motion || orientation) {

        element.innerHTML =
            `
            <strong>Partial sensor access</strong><br>
            Motion: ${motion ? "enabled" : "not available"}<br>
            Compass: ${orientation ? "enabled" : "not available"}
            `;

        return;
    }


    element.textContent =
        "Sensors have not been enabled yet.";
}


// ============================================================
// SETUP UI
// ============================================================

function updateSetupUI() {

    updateGlobalStatus();

    updatePositionDisplays();

    updateCompletionSummary();


    if ($("uploadedImagePreview")) {

        renderUploadedImagePreview();

    }


    if ($("imageX")) {

        $("imageX").value =
            state.plan.imageTransform.x;

    }


    if ($("imageY")) {

        $("imageY").value =
            state.plan.imageTransform.y;

    }


    if ($("imageScale")) {

        $("imageScale").value =
            state.plan.imageTransform.scale;

    }


    if ($("imageRotation")) {

        $("imageRotation").value =
            state.plan.imageTransform.rotation;

    }


    updateAlignmentValues();


    requestAnimationFrame(() => {

        drawMovement();

        drawAlignment();

    });
}


// ============================================================
// POSITION DISPLAYS
// ============================================================

function updatePositionDisplays() {

    setText(
        "mapX",
        safeNumber(state.mapping.x).toFixed(2)
    );

    setText(
        "mapY",
        safeNumber(state.mapping.y).toFixed(2)
    );

    setText(
        "mapDistance",
        `${safeNumber(state.mapping.distance).toFixed(2)} m`
    );

    setText(
        "referenceCount",
        state.mapping.references.length
    );
}


// ============================================================
// START MAPPING
// ============================================================

function startMapping() {

    state.mapping.active = true;

    state.mapping.x = 0;
    state.mapping.y = 0;

    state.mapping.heading = 0;
    state.mapping.distance = 0;

    state.mapping.lastStepTime = 0;


    state.mapping.path = [
        {
            x: 0,
            y: 0,
            t: Date.now()
        }
    ];


    drawMovement();

    updatePositionDisplays();

    saveState();


    const button =
        $("startMapBtn");

    if (button) {
        button.disabled = true;
    }


    const stopButton =
        $("stopMapBtn");

    if (stopButton) {
        stopButton.disabled = false;
    }
}


// ============================================================
// STOP MAPPING
// ============================================================

function stopMapping() {

    state.mapping.active = false;

    saveState();


    const button =
        $("startMapBtn");

    if (button) {
        button.disabled = false;
    }
}


// ============================================================
// RESET MAPPING
// ============================================================

function resetMapping() {

    state.mapping.active = false;

    state.mapping.x = 0;
    state.mapping.y = 0;

    state.mapping.heading = 0;
    state.mapping.distance = 0;

    state.mapping.lastStepTime = 0;

    state.mapping.path = [
        {
            x: 0,
            y: 0,
            t: Date.now()
        }
    ];

    state.mapping.references = [];


    drawMovement();

    updatePositionDisplays();

    saveState();
}


// ============================================================
// DROP REFERENCE POINT
// ============================================================

function dropReferencePoint() {

    const index =
        state.mapping.references.length + 1;


    const reference = {

        id: createId(),

        name:
            `Reference ${index}`,

        x:
            safeNumber(
                state.mapping.x
            ),

        y:
            safeNumber(
                state.mapping.y
            ),

        heading:
            safeNumber(
                state.mapping.heading
            ),

        time:
            Date.now()

    };


    state.mapping.references.push(
        reference
    );


    renderReferenceList();

    drawMovement();

    drawAlignment();

    saveState();
}


// ============================================================
// REFERENCE LIST
// ============================================================

function renderReferenceList() {

    const container =
        $("referenceList");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        state.mapping.references.length === 0
    ) {

        container.innerHTML =
            `
            <div class="setupCheck">

                <div class="setupCheckIcon">
                    —
                </div>

                <div>

                    <strong>
                        No reference points
                    </strong>

                    <div class="hint">
                        Press "Drop Reference Point"
                        while walking.
                    </div>

                </div>

            </div>
            `;

        return;
    }


    state.mapping.references.forEach(
        (reference, index) => {

            const row =
                document.createElement("div");

            row.className =
                "setupCheck complete";


            row.innerHTML =
                `
                <div class="setupCheckIcon">
                    ${index + 1}
                </div>

                <div>

                    <strong>
                        ${escapeHtml(reference.name)}
                    </strong>

                    <div class="hint">
                        X: ${safeNumber(reference.x).toFixed(2)} m
                        &nbsp;&nbsp;
                        Y: ${safeNumber(reference.y).toFixed(2)} m
                        &nbsp;&nbsp;
                        Heading: ${safeNumber(reference.heading).toFixed(0)}°
                    </div>

                </div>
                `;


            container.appendChild(row);

        }
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// CANVAS HELPERS
// ============================================================

function getCanvasContext(id) {

    const canvas =
        $(id);

    if (!canvas) {
        return null;
    }


    const context =
        canvas.getContext("2d");

    if (!context) {
        return null;
    }


    return {
        canvas,
        ctx: context
    };
}


function clearCanvas(canvas, ctx) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


// ============================================================
// CALCULATE PATH BOUNDS
// ============================================================

function getWorldBounds(points) {

    const validPoints =
        Array.isArray(points)
            ? points.filter(point =>
                point &&
                Number.isFinite(Number(point.x)) &&
                Number.isFinite(Number(point.y))
            )
            : [];


    if (validPoints.length === 0) {

        return {
            minX: -1,
            maxX: 1,
            minY: -1,
            maxY: 1,
            width: 2,
            height: 2
        };
    }


    let minX =
        Number(validPoints[0].x);

    let maxX =
        Number(validPoints[0].x);

    let minY =
        Number(validPoints[0].y);

    let maxY =
        Number(validPoints[0].y);


    validPoints.forEach(point => {

        const x =
            Number(point.x);

        const y =
            Number(point.y);


        minX =
            Math.min(minX, x);

        maxX =
            Math.max(maxX, x);

        minY =
            Math.min(minY, y);

        maxY =
            Math.max(maxY, y);

    });


    // IMPORTANT:
    // Never allow zero width/height.
    const width =
        Math.max(
            maxX - minX,
            0.001
        );

    const height =
        Math.max(
            maxY - minY,
            0.001
        );


    return {
        minX,
        maxX,
        minY,
        maxY,
        width,
        height
    };
}


// ============================================================
// DRAW MOVEMENT
// ============================================================

function drawMovement() {

    const result =
        getCanvasContext(
            "movementCanvas"
        );

    if (!result) {
        return;
    }


    const {
        canvas,
        ctx
    } = result;


    clearCanvas(
        canvas,
        ctx
    );


    const path =
        Array.isArray(state.mapping.path)
            ? state.mapping.path
            : [];


    const points =
        path.filter(point =>
            point &&
            Number.isFinite(Number(point.x)) &&
            Number.isFinite(Number(point.y))
        );


    // --------------------------------------------------------
    // Background
    // --------------------------------------------------------

    ctx.fillStyle =
        "#080f1b";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    if (points.length === 0) {

        drawCanvasMessage(
            ctx,
            canvas,
            "Start mapping to record movement."
        );

        return;
    }


    const bounds =
        getWorldBounds(points);


    // Include references in bounds.
    state.mapping.references.forEach(
        reference => {

            bounds.minX =
                Math.min(
                    bounds.minX,
                    safeNumber(reference.x)
                );

            bounds.maxX =
                Math.max(
                    bounds.maxX,
                    safeNumber(reference.x)
                );

            bounds.minY =
                Math.min(
                    bounds.minY,
                    safeNumber(reference.y)
                );

            bounds.maxY =
                Math.max(
                    bounds.maxY,
                    safeNumber(reference.y)
                );

        }
    );


    const width =
        Math.max(
            bounds.maxX - bounds.minX,
            0.001
        );

    const height =
        Math.max(
            bounds.maxY - bounds.minY,
            0.001
        );


    const availableWidth =
        Math.max(
            canvas.width - CANVAS_PADDING * 2,
            1
        );

    const availableHeight =
        Math.max(
            canvas.height - CANVAS_PADDING * 2,
            1
        );


    const scale =
        Math.min(
            availableWidth / width,
            availableHeight / height
        );


    const safeScale =
        Number.isFinite(scale) &&
        scale > 0
            ? scale
            : 1;


    const centerX =
        canvas.width / 2;

    const centerY =
        canvas.height / 2;


    const worldCenterX =
        (bounds.minX + bounds.maxX) / 2;

    const worldCenterY =
        (bounds.minY + bounds.maxY) / 2;


    function toCanvas(point) {

        const x =
            centerX +
            (
                safeNumber(point.x) -
                worldCenterX
            ) *
            safeScale;


        const y =
            centerY -
            (
                safeNumber(point.y) -
                worldCenterY
            ) *
            safeScale;


        return {
            x: Number.isFinite(x)
                ? x
                : centerX,

            y: Number.isFinite(y)
                ? y
                : centerY
        };
    }


    // --------------------------------------------------------
    // Grid
    // --------------------------------------------------------

    drawCanvasGrid(
        ctx,
        canvas
    );


    // --------------------------------------------------------
    // Movement path
    // --------------------------------------------------------

    if (points.length >= 2) {

        ctx.beginPath();

        points.forEach(
            (point, index) => {

                const p =
                    toCanvas(point);

                if (index === 0) {

                    ctx.moveTo(
                        p.x,
                        p.y
                    );

                } else {

                    ctx.lineTo(
                        p.x,
                        p.y
                    );

                }

            }
        );


        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth = 3;

        ctx.lineJoin = "round";

        ctx.lineCap = "round";

        ctx.stroke();

    }


    // --------------------------------------------------------
    // Workstation
    // --------------------------------------------------------

    const workstation =
        toCanvas({
            x: 0,
            y: 0
        });


    drawPoint(
        ctx,
        workstation.x,
        workstation.y,
        "#39c77b",
        9
    );


    drawLabel(
        ctx,
        workstation.x + 12,
        workstation.y - 12,
        "WORKSTATION 0,0"
    );


    // --------------------------------------------------------
    // References
    // --------------------------------------------------------

    state.mapping.references.forEach(
        (reference, index) => {

            const point =
                toCanvas(reference);


            drawPoint(
                ctx,
                point.x,
                point.y,
                "#e7ad4c",
                7
            );


            drawLabel(
                ctx,
                point.x + 11,
                point.y - 10,
                `R${index + 1}`
            );

        }
    );


    // --------------------------------------------------------
    // Current position
    // --------------------------------------------------------

    const current =
        toCanvas({
            x: state.mapping.x,
            y: state.mapping.y
        });


    drawPoint(
        ctx,
        current.x,
        current.y,
        "#4ca8ff",
        8
    );


    drawLabel(
        ctx,
        current.x + 12,
        current.y + 16,
        "YOU"
    );
}


// ============================================================
// DRAW GRID
// ============================================================

function drawCanvasGrid(ctx, canvas) {

    const gridSize = 40;


    ctx.save();


    ctx.strokeStyle =
        "rgba(255,255,255,0.045)";

    ctx.lineWidth = 1;


    for (
        let x = 0;
        x <= canvas.width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            canvas.height
        );

        ctx.stroke();

    }


    for (
        let y = 0;
        y <= canvas.height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            canvas.width,
            y
        );

        ctx.stroke();

    }


    ctx.restore();
}


// ============================================================
// DRAW POINT
// ============================================================

function drawPoint(
    ctx,
    x,
    y,
    color,
    radius
) {

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;
    }


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        color;

    ctx.fill();


    ctx.strokeStyle =
        "#ffffff";

    ctx.lineWidth = 2;

    ctx.stroke();
}


// ============================================================
// DRAW LABEL
// ============================================================

function drawLabel(
    ctx,
    x,
    y,
    text
) {

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;
    }


    ctx.font =
        "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";

    ctx.fillStyle =
        "#edf3fa";

    ctx.fillText(
        text,
        x,
        y
    );
}


// ============================================================
// CANVAS MESSAGE
// ============================================================

function drawCanvasMessage(
    ctx,
    canvas,
    message
) {

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.font =
        "14px -apple-system, BlinkMacSystemFont, sans-serif";

    ctx.fillStyle =
        "#8f9db2";


    ctx.fillText(
        message,
        canvas.width / 2,
        canvas.height / 2
    );


    ctx.textAlign =
        "start";

    ctx.textBaseline =
        "alphabetic";
}


// ============================================================
// JPEG UPLOAD
// ============================================================

async function uploadJPEG(event) {

    const input =
        event.target;

    if (
        !input ||
        !input.files ||
        !input.files.length
    ) {

        return;
    }


    const file =
        input.files[0];


    if (
        !file.type ||
        !file.type.toLowerCase().includes("jpeg")
    ) {

        setText(
            "uploadStatus",
            "Please select a JPEG image."
        );

        return;
    }


    setText(
        "uploadStatus",
        "Uploading JPEG..."
    );


    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );


        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                `Upload failed: HTTP ${response.status}`
            );

        }


        const result =
            await response.json();


        if (
            !result ||
            !result.url
        ) {

            throw new Error(
                "Server did not return an image URL."
            );

        }


        state.plan.jpegUrl =
            result.url;

        state.plan.jpegName =
            result.name ||
            file.name;


        saveState();


        setText(
            "uploadStatus",
            `Uploaded: ${state.plan.jpegName}`
        );


        renderUploadedImagePreview();

        drawAlignment();

        updateCompletionSummary();

    } catch (error) {

        console.error(
            "JPEG upload failed:",
            error
        );


        setText(
            "uploadStatus",
            `Upload failed: ${error.message}`
        );

    }
}


// ============================================================
// IMAGE PREVIEW
// ============================================================

function renderUploadedImagePreview() {

    const container =
        $("uploadedImagePreview");

    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!state.plan.jpegUrl) {

        return;
    }


    const image =
        document.createElement("img");


    image.src =
        state.plan.jpegUrl;


    image.alt =
        "Uploaded floor plan";


    image.onload = () => {

        container.innerHTML = "";

        container.appendChild(
            image
        );

    };


    image.onerror = () => {

        container.innerHTML =
            `
            <div class="hint">
                Could not load uploaded JPEG.
            </div>
            `;

    };
}


// ============================================================
// SERVER FILES
// ============================================================

async function loadServerFiles() {

    const select =
        $("pdfSelect");

    if (!select) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/files"
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const files =
            await response.json();


        select.innerHTML =
            `
            <option value="">
                Select a PDF
            </option>
            `;


        if (!Array.isArray(files)) {
            return;
        }


        files
            .filter(file =>
                file &&
                String(
                    file.extension ||
                    ""
                ).toLowerCase() === ".pdf"
            )
            .forEach(file => {

                const option =
                    document.createElement("option");


                option.value =
                    file.url;


                option.textContent =
                    file.name;


                option.dataset.name =
                    file.name;


                select.appendChild(
                    option
                );

            });


    } catch (error) {

        console.warn(
            "Could not load server files:",
            error
        );


        select.innerHTML =
            `
            <option value="">
                Could not load server files
            </option>
            `;

    }
}


// ============================================================
// LOAD PDF
// ============================================================

async function loadSelectedPDF() {

    const select =
        $("pdfSelect");

    if (!select) {
        return;
    }


    const url =
        select.value;


    if (!url) {

        setText(
            "pdfStatus",
            "Please select a PDF."
        );

        return;
    }


    const selectedOption =
        select.options[
            select.selectedIndex
        ];


    const name =
        selectedOption?.dataset?.name ||
        selectedOption?.textContent ||
        "Floor plan.pdf";


    setText(
        "pdfStatus",
        "Loading PDF..."
    );


    try {

        const pdfjs =
            await import(
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
            );


        pdfjs.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.arrayBuffer();


        const pdf =
            await pdfjs.getDocument({
                data
            }).promise;


        const page =
            await pdf.getPage(1);


        const canvas =
            $("pdfCanvas");


        if (!canvas) {
            return;
        }


        const context =
            canvas.getContext("2d");


        const viewport =
            page.getViewport({
                scale: 1.4
            });


        canvas.width =
            viewport.width;

        canvas.height =
            viewport.height;


        await page.render({
            canvasContext: context,
            viewport
        }).promise;


        state.plan.pdfUrl =
            url;

        state.plan.pdfName =
            name;


        saveState();


        setText(
            "pdfStatus",
            `Loaded: ${name}`
        );


        updateCompletionSummary();

    } catch (error) {

        console.error(
            "PDF loading failed:",
            error
        );


        setText(
            "pdfStatus",
            `PDF failed: ${error.message}`
        );

    }
}


// ============================================================
// ALIGNMENT CONTROLS
// ============================================================

function updateAlignmentValues() {

    const transform =
        state.plan.imageTransform;


    setText(
        "imageXValue",
        `${safeNumber(transform.x).toFixed(0)} px`
    );


    setText(
        "imageYValue",
        `${safeNumber(transform.y).toFixed(0)} px`
    );


    setText(
        "imageScaleValue",
        safeNumber(
            transform.scale,
            1
        ).toFixed(2)
    );


    setText(
        "imageRotationValue",
        `${safeNumber(transform.rotation).toFixed(1)}°`
    );
}


function updateAlignmentFromControls() {

    state.plan.imageTransform.x =
        safeNumber(
            $("imageX")?.value,
            0
        );


    state.plan.imageTransform.y =
        safeNumber(
            $("imageY")?.value,
            0
        );


    state.plan.imageTransform.scale =
        clamp(
            $("imageScale")?.value,
            0.1,
            5
        );


    state.plan.imageTransform.rotation =
        safeNumber(
            $("imageRotation")?.value,
            0
        );


    updateAlignmentValues();

    drawAlignment();

    drawLiveMap();

    saveState();
}


// ============================================================
// LOAD IMAGE FOR CANVAS
// ============================================================

function loadImage(url) {

    return new Promise(
        (resolve, reject) => {

            if (!url) {

                reject(
                    new Error(
                        "No image URL."
                    )
                );

                return;
            }


            const image =
                new Image();


            image.onload = () => {
                resolve(image);
            };


            image.onerror = () => {

                reject(
                    new Error(
                        "Image could not be loaded."
                    )
                );

            };


            image.src =
                url;

        }
    );
}


// ============================================================
// ALIGNMENT DRAW
// ============================================================

async function drawAlignment() {

    const result =
        getCanvasContext(
            "alignmentCanvas"
        );

    if (!result) {
        return;
    }


    const {
        canvas,
        ctx
    } = result;


    clearCanvas(
        canvas,
        ctx
    );


    ctx.fillStyle =
        "#080f1b";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawCanvasGrid(
        ctx,
        canvas
    );


    if (state.plan.jpegUrl) {

        try {

            const image =
                await loadImage(
                    state.plan.jpegUrl
                );


            drawPlanImage(
                ctx,
                canvas,
                image
            );

        } catch (error) {

            console.warn(
                "Could not draw alignment image:",
                error
            );

        }

    }


    drawWorldLayer(
        ctx,
        canvas
    );
}


// ============================================================
// DRAW PLAN IMAGE
// ============================================================

function drawPlanImage(
    ctx,
    canvas,
    image
) {

    const transform =
        state.plan.imageTransform;


    const scale =
        Math.max(
            safeNumber(
                transform.scale,
                1
            ),
            0.01
        );


    const rotation =
        safeNumber(
            transform.rotation
        ) *
        Math.PI /
        180;


    const x =
        canvas.width / 2 +
        safeNumber(transform.x);


    const y =
        canvas.height / 2 +
        safeNumber(transform.y);


    const width =
        image.naturalWidth ||
        image.width ||
        1;


    const height =
        image.naturalHeight ||
        image.height ||
        1;


    const maxWidth =
        canvas.width * 0.9;


    const maxHeight =
        canvas.height * 0.9;


    const baseScale =
        Math.min(
            maxWidth / width,
            maxHeight / height
        );


    const finalScale =
        Math.max(
            baseScale * scale,
            0.01
        );


    ctx.save();


    ctx.translate(
        x,
        y
    );


    ctx.rotate(
        rotation
    );


    ctx.globalAlpha =
        0.72;


    ctx.drawImage(
        image,
        -(width * finalScale) / 2,
        -(height * finalScale) / 2,
        width * finalScale,
        height * finalScale
    );


    ctx.restore();

}


// ============================================================
// DRAW WORLD OVERLAY
// ============================================================

function drawWorldLayer(
    ctx,
    canvas
) {

    const points =
        Array.isArray(state.mapping.path)
            ? state.mapping.path.filter(point =>
                point &&
                Number.isFinite(Number(point.x)) &&
                Number.isFinite(Number(point.y))
            )
            : [];


    const bounds =
        getWorldBounds(points);


    const width =
        Math.max(
            bounds.maxX - bounds.minX,
            0.001
        );


    const height =
        Math.max(
            bounds.maxY - bounds.minY,
            0.001
        );


    const scale =
        Math.min(
            (canvas.width - 100) / width,
            (canvas.height - 100) / height
        );


    const safeScale =
        Number.isFinite(scale) &&
        scale > 0
            ? scale
            : 1;


    const centerWorldX =
        (bounds.minX + bounds.maxX) / 2;

    const centerWorldY =
        (bounds.minY + bounds.maxY) / 2;


    function toCanvas(point) {

        return {

            x:
                canvas.width / 2 +
                (
                    safeNumber(point.x) -
                    centerWorldX
                ) *
                safeScale,

            y:
                canvas.height / 2 -
                (
                    safeNumber(point.y) -
                    centerWorldY
                ) *
                safeScale

        };
    }


    // --------------------------------------------------------
    // Path
    // --------------------------------------------------------

    if (points.length >= 2) {

        ctx.save();

        ctx.beginPath();


        points.forEach(
            (point, index) => {

                const p =
                    toCanvas(point);


                if (index === 0) {

                    ctx.moveTo(
                        p.x,
                        p.y
                    );

                } else {

                    ctx.lineTo(
                        p.x,
                        p.y
                    );

                }

            }
        );


        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth = 3;

        ctx.lineJoin = "round";

        ctx.lineCap = "round";

        ctx.stroke();

        ctx.restore();
    }


    // --------------------------------------------------------
    // Workstation
    // --------------------------------------------------------

    const workstation =
        toCanvas({
            x: 0,
            y: 0
        });


    drawPoint(
        ctx,
        workstation.x,
        workstation.y,
        "#39c77b",
        8
    );


    drawLabel(
        ctx,
        workstation.x + 10,
        workstation.y - 10,
        "0,0"
    );


    // --------------------------------------------------------
    // References
    // --------------------------------------------------------

    state.mapping.references.forEach(
        (reference, index) => {

            const p =
                toCanvas(reference);


            drawPoint(
                ctx,
                p.x,
                p.y,
                "#e7ad4c",
                7
            );


            drawLabel(
                ctx,
                p.x + 10,
                p.y - 8,
                `R${index + 1}`
            );

        }
    );
}


// ============================================================
// LOCK SETUP
// ============================================================

function lockSetup() {

    if (!state.plan.jpegUrl) {

        setText(
            "lockedSetup",
            "Upload a JPEG before locking the setup."
        );

        return;
    }


    if (
        !Array.isArray(state.mapping.path) ||
        state.mapping.path.length < 1
    ) {

        setText(
            "lockedSetup",
            "Record movement before locking the setup."
        );

        return;
    }


    state.mapping.active = false;

    state.locked = true;


    saveState();


    setText(
        "lockedSetup",
        "✓ Setup locked successfully."
    );


    updateGlobalStatus();

    updateCompletionSummary();


    const goTrackButton =
        $("goTrackBtn");

    if (goTrackButton) {

        goTrackButton.classList.add(
            "primary"
        );

    }
}


// ============================================================
// COMPLETION SUMMARY
// ============================================================

function updateCompletionSummary() {

    const container =
        $("completionSummary");

    if (!container) {
        return;
    }


    const movementReady =
        state.mapping.path.length >= 1;

    const jpegReady =
        Boolean(
            state.plan.jpegUrl
        );

    const pdfReady =
        Boolean(
            state.plan.pdfUrl
        );

    const locked =
        state.locked;


    container.innerHTML =
        `
        ${summaryItem(
            "1",
            "Workstation",
            "Position: 0.00, 0.00",
            true
        )}

        ${summaryItem(
            "2",
            "Movement",
            movementReady
                ? `${state.mapping.path.length} recorded points`
                : "No movement recorded",
            movementReady
        )}

        ${summaryItem(
            "3",
            "JPEG Floor Plan",
            jpegReady
                ? state.plan.jpegName || "Uploaded"
                : "No JPEG uploaded",
            jpegReady
        )}

        ${summaryItem(
            "4",
            "PDF",
            pdfReady
                ? state.plan.pdfName || "Loaded"
                : "Optional / not loaded",
            pdfReady
        )}

        ${summaryItem(
            "5",
            "Setup",
            locked
                ? "Setup locked"
                : "Ready to lock",
            locked
        )}
        `;
}


function summaryItem(
    number,
    title,
    description,
    complete
) {

    return `
        <div class="setupCheck ${complete ? "complete" : ""}">

            <div class="setupCheckIcon">
                ${complete ? "✓" : number}
            </div>

            <div>

                <strong>
                    ${escapeHtml(title)}
                </strong>

                <div class="hint">
                    ${escapeHtml(description)}
                </div>

            </div>

        </div>
    `;
}


// ============================================================
// TRACKING UI
// ============================================================

function updateTrackingUI() {

    const lockedMessage =
        $("trackLockedMessage");

    const application =
        $("trackingApplication");


    if (!lockedMessage ||
        !application) {

        return;
    }


    if (state.locked) {

        lockedMessage.style.display =
            "none";

        application.style.display =
            "block";

    } else {

        lockedMessage.style.display =
            "block";

        application.style.display =
            "none";

    }


    updateTrackingPosition();

}


// ============================================================
// START TRACKING
// ============================================================

function startTracking() {

    if (!state.locked) {

        setText(
            "trackingState",
            "Lock the setup first."
        );

        return;
    }


    if (
        !state.sensors.motionPermission
    ) {

        setText(
            "trackingState",
            "Enable phone sensors first."
        );

        return;
    }


    state.tracking.active = true;

    state.tracking.x = 0;
    state.tracking.y = 0;

    state.tracking.heading = 0;
    state.tracking.distance = 0;

    state.tracking.lastStepTime = 0;


    state.tracking.path = [
        {
            x: 0,
            y: 0,
            t: Date.now()
        }
    ];


    setText(
        "trackingState",
        "Tracking active."
    );


    updateTrackingPosition();

    drawLiveMap();

    saveState();
}


// ============================================================
// STOP TRACKING
// ============================================================

function stopTracking() {

    state.tracking.active = false;


    setText(
        "trackingState",
        "Tracking stopped."
    );


    saveState();
}


// ============================================================
// TRACKING POSITION
// ============================================================

function updateTrackingPosition() {

    setText(
        "trackX",
        safeNumber(
            state.tracking.x
        ).toFixed(2)
    );


    setText(
        "trackY",
        safeNumber(
            state.tracking.y
        ).toFixed(2)
    );


    setText(
        "trackHeading",
        `${safeNumber(
            state.tracking.heading
        ).toFixed(0)}°`
    );


    setText(
        "trackDistance",
        `${safeNumber(
            state.tracking.distance
        ).toFixed(2)} m`
    );
}


// ============================================================
// LIVE MAP
// ============================================================

async function drawLiveMap() {

    const result =
        getCanvasContext(
            "liveCanvas"
        );

    if (!result) {
        return;
    }


    const {
        canvas,
        ctx
    } = result;


    clearCanvas(
        canvas,
        ctx
    );


    ctx.fillStyle =
        "#080f1b";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawCanvasGrid(
        ctx,
        canvas
    );


    if (state.plan.jpegUrl) {

        try {

            const image =
                await loadImage(
                    state.plan.jpegUrl
                );


            drawPlanImage(
                ctx,
                canvas,
                image
            );

        } catch (error) {

            console.warn(
                "Could not load tracking image:",
                error
            );

        }

    }


    drawSavedSetupLayer(
        ctx,
        canvas
    );


    drawTrackingPath(
        ctx,
        canvas
    );
}


// ============================================================
// SAVED SETUP LAYER
// ============================================================

function drawSavedSetupLayer(
    ctx,
    canvas
) {

    const points =
        state.mapping.path;


    const bounds =
        getWorldBounds(points);


    const width =
        Math.max(
            bounds.maxX - bounds.minX,
            0.001
        );


    const height =
        Math.max(
            bounds.maxY - bounds.minY,
            0.001
        );


    const scale =
        Math.min(
            (canvas.width - 100) / width,
            (canvas.height - 100) / height
        );


    const safeScale =
        Number.isFinite(scale) &&
        scale > 0
            ? scale
            : 1;


    const centerX =
        (bounds.minX + bounds.maxX) / 2;

    const centerY =
        (bounds.minY + bounds.maxY) / 2;


    function toCanvas(point) {

        return {

            x:
                canvas.width / 2 +
                (
                    safeNumber(point.x) -
                    centerX
                ) *
                safeScale,

            y:
                canvas.height / 2 -
                (
                    safeNumber(point.y) -
                    centerY
                ) *
                safeScale

        };
    }


    // --------------------------------------------------------
    // Saved movement
    // --------------------------------------------------------

    if (points.length >= 2) {

        ctx.save();

        ctx.beginPath();


        points.forEach(
            (point, index) => {

                const p =
                    toCanvas(point);


                if (index === 0) {

                    ctx.moveTo(
                        p.x,
                        p.y
                    );

                } else {

                    ctx.lineTo(
                        p.x,
                        p.y
                    );

                }

            }
        );


        ctx.strokeStyle =
            "rgba(255,255,255,0.35)";

        ctx.lineWidth = 2;

        ctx.stroke();

        ctx.restore();

    }


    // --------------------------------------------------------
    // Workstation
    // --------------------------------------------------------

    const workstation =
        toCanvas({
            x: 0,
            y: 0
        });


    drawPoint(
        ctx,
        workstation.x,
        workstation.y,
        "#39c77b",
        8
    );


    // --------------------------------------------------------
    // Reference points
    // --------------------------------------------------------

    state.mapping.references.forEach(
        (reference, index) => {

            const point =
                toCanvas(reference);


            drawPoint(
                ctx,
                point.x,
                point.y,
                "#e7ad4c",
                7
            );


            drawLabel(
                ctx,
                point.x + 10,
                point.y - 8,
                `R${index + 1}`
            );

        }
    );
}


// ============================================================
// TRACKING PATH
// ============================================================

function drawTrackingPath(
    ctx,
    canvas
) {

    const path =
        state.tracking.path;


    if (!Array.isArray(path) ||
        path.length === 0) {

        return;
    }


    const bounds =
        getWorldBounds(
            state.mapping.path
        );


    const width =
        Math.max(
            bounds.maxX - bounds.minX,
            0.001
        );


    const height =
        Math.max(
            bounds.maxY - bounds.minY,
            0.001
        );


    const scale =
        Math.min(
            (canvas.width - 100) / width,
            (canvas.height - 100) / height
        );


    const safeScale =
        Number.isFinite(scale) &&
        scale > 0
            ? scale
            : 1;


    const centerX =
        (bounds.minX + bounds.maxX) / 2;

    const centerY =
        (bounds.minY + bounds.maxY) / 2;


    function toCanvas(point) {

        return {

            x:
                canvas.width / 2 +
                (
                    safeNumber(point.x) -
                    centerX
                ) *
                safeScale,

            y:
                canvas.height / 2 -
                (
                    safeNumber(point.y) -
                    centerY
                ) *
                safeScale

        };
    }


    if (path.length >= 2) {

        ctx.save();

        ctx.beginPath();


        path.forEach(
            (point, index) => {

                const p =
                    toCanvas(point);


                if (index === 0) {

                    ctx.moveTo(
                        p.x,
                        p.y
                    );

                } else {

                    ctx.lineTo(
                        p.x,
                        p.y
                    );

                }

            }
        );


        ctx.strokeStyle =
            "#e05b66";

        ctx.lineWidth = 4;

        ctx.lineJoin = "round";

        ctx.lineCap = "round";

        ctx.stroke();

        ctx.restore();

    }


    const current =
        toCanvas({
            x: state.tracking.x,
            y: state.tracking.y
        });


    drawPoint(
        ctx,
        current.x,
        current.y,
        "#e05b66",
        9
    );


    drawLabel(
        ctx,
        current.x + 12,
        current.y + 4,
        "YOU"
    );
}


// ============================================================
// INITIALIZATION
// ============================================================

function initializeApp() {

    loadState();


    // --------------------------------------------------------
    // Main navigation
    // --------------------------------------------------------

    document
        .querySelectorAll(".mainTab")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.page
                    );

                }
            );

        });


    // --------------------------------------------------------
    // Setup steps
    // --------------------------------------------------------

    document
        .querySelectorAll(".setupStep")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSetupStep(
                        Number(
                            button.dataset.step
                        )
                    );

                }
            );

        });


    // --------------------------------------------------------
    // Next buttons
    // --------------------------------------------------------

    document
        .querySelectorAll(".nextStepBtn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSetupStep(
                        Number(
                            button.dataset.next
                        )
                    );

                }
            );

        });


    // --------------------------------------------------------
    // Previous buttons
    // --------------------------------------------------------

    document
        .querySelectorAll(".prevStepBtn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSetupStep(
                        Number(
                            button.dataset.prev
                        )
                    );

                }
            );

        });


    // --------------------------------------------------------
    // Sensors
    // --------------------------------------------------------

    $("sensorBtn")?.addEventListener(
        "click",
        async () => {

            await requestSensorPermissions();

        }
    );


    $("trackSensorBtn")?.addEventListener(
        "click",
        async () => {

            const success =
                await requestSensorPermissions();


            if (success) {

                setText(
                    "trackingState",
                    "Sensors enabled. Ready to track."
                );

            }

        }
    );


    // --------------------------------------------------------
    // Mapping
    // --------------------------------------------------------

    $("startMapBtn")?.addEventListener(
        "click",
        startMapping
    );


    $("stopMapBtn")?.addEventListener(
        "click",
        stopMapping
    );


    $("dropPointBtn")?.addEventListener(
        "click",
        dropReferencePoint
    );


    $("resetMapBtn")?.addEventListener(
        "click",
        resetMapping
    );


    // --------------------------------------------------------
    // JPEG
    // --------------------------------------------------------

    $("jpegUpload")?.addEventListener(
        "change",
        uploadJPEG
    );


    // --------------------------------------------------------
    // PDF
    // --------------------------------------------------------

    $("loadPdfBtn")?.addEventListener(
        "click",
        loadSelectedPDF
    );


    // --------------------------------------------------------
    // Alignment
    // --------------------------------------------------------

    $("imageX")?.addEventListener(
        "input",
        updateAlignmentFromControls
    );


    $("imageY")?.addEventListener(
        "input",
        updateAlignmentFromControls
    );


    $("imageScale")?.addEventListener(
        "input",
        updateAlignmentFromControls
    );


    $("imageRotation")?.addEventListener(
        "input",
        updateAlignmentFromControls
    );


    // --------------------------------------------------------
    // Lock
    // --------------------------------------------------------

    $("lockSetupBtn")?.addEventListener(
        "click",
        lockSetup
    );


    // --------------------------------------------------------
    // Tracking
    // --------------------------------------------------------

    $("startTrackBtn")?.addEventListener(
        "click",
        startTracking
    );


    $("stopTrackBtn")?.addEventListener(
        "click",
        stopTracking
    );


    // --------------------------------------------------------
    // Navigation buttons
    // --------------------------------------------------------

    $("goTrackBtn")?.addEventListener(
        "click",
        () => {

            showPage(
                "trackPage"
            );

        }
    );


    $("goSetupBtn")?.addEventListener(
        "click",
        () => {

            showPage(
                "setupPage"
            );

            showSetupStep(
                state.setupStep
            );

        }
    );


    // --------------------------------------------------------
    // Initial UI
    // --------------------------------------------------------

    renderReferenceList();

    renderUploadedImagePreview();

    updateSetupUI();

    updateTrackingUI();

    updateSensorStatus();

    loadServerFiles();


    showSetupStep(
        state.setupStep
    );


    if (state.locked) {

        updateTrackingUI();

    }


    window.addEventListener(
        "resize",
        () => {

            drawMovement();

            drawAlignment();

            drawLiveMap();

        }
    );

}


// ============================================================
// START
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();

}