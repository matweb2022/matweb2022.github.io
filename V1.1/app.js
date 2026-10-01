// ============================================================
// FLOOR TRACKER
// Static GitHub Pages version
// JPEG maps only - no PDF / no upload server required
// ============================================================

const STORAGE_KEY = "production-floor-tracker-clean-v3";

// ============================================================
// FLOOR MAPS
// ============================================================
//
// Put your JPEG files in:
//
//     /maps/
//
// Example:
//
//     /maps/factory.jpg
//     /maps/assembly.jpg
//     /maps/welding.jpg
//
// Add them to this list.
//

const FLOOR_MAPS = [
    {
        id: "factory",
        name: "Factory Floor",
        image: "./maps/factory.jpg"
    }
];


// ============================================================
// CONSTANTS
// ============================================================

const STEP_LENGTH = 0.72;
const STEP_THRESHOLD = 1.15;
const STEP_COOLDOWN = 280;

const CANVAS_PADDING = 50;

const DEG_TO_RAD = Math.PI / 180;


// ============================================================
// APPLICATION STATE
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

        selectedMapId: null,

        imageUrl: null,

        imageName: null,

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
// DOM HELPERS
// ============================================================

function get(id) {
    return document.getElementById(id);
}


function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
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
            "Unable to save application state:",
            error
        );
    }
}


function loadState() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            return;
        }

        if (parsed.workstation) {

            state.workstation.x =
                safeNumber(
                    parsed.workstation.x,
                    0
                );

            state.workstation.y =
                safeNumber(
                    parsed.workstation.y,
                    0
                );
        }

        if (parsed.mapping) {

            state.mapping.x =
                safeNumber(
                    parsed.mapping.x,
                    0
                );

            state.mapping.y =
                safeNumber(
                    parsed.mapping.y,
                    0
                );

            state.mapping.heading =
                safeNumber(
                    parsed.mapping.heading,
                    0
                );

            state.mapping.distance =
                safeNumber(
                    parsed.mapping.distance,
                    0
                );

            state.mapping.path =
                Array.isArray(parsed.mapping.path)
                    ? parsed.mapping.path
                    : [];

            state.mapping.references =
                Array.isArray(parsed.mapping.references)
                    ? parsed.mapping.references
                    : [];
        }

        if (parsed.plan) {

            state.plan.selectedMapId =
                parsed.plan.selectedMapId || null;

            state.plan.imageUrl =
                parsed.plan.imageUrl || null;

            state.plan.imageName =
                parsed.plan.imageName || null;

            if (parsed.plan.imageTransform) {

                state.plan.imageTransform = {

                    x: safeNumber(
                        parsed.plan.imageTransform.x,
                        0
                    ),

                    y: safeNumber(
                        parsed.plan.imageTransform.y,
                        0
                    ),

                    scale: safeNumber(
                        parsed.plan.imageTransform.scale,
                        1
                    ),

                    rotation: safeNumber(
                        parsed.plan.imageTransform.rotation,
                        0
                    )
                };
            }
        }

        state.locked =
            parsed.locked === true;

    } catch (error) {

        console.warn(
            "Unable to load saved state:",
            error
        );
    }
}


// ============================================================
// SETUP NAVIGATION
// ============================================================

function showSetupStep(step) {

    state.setupStep = step;

    const sections = document.querySelectorAll(
        "[data-setup-step]"
    );

    sections.forEach(section => {

        const sectionStep =
            Number(
                section.dataset.setupStep
            );

        const isActive =
            sectionStep === step;

        section.classList.toggle(
            "active",
            isActive
        );

        section.style.display =
            isActive ? "" : "none";
    });

    const indicators =
        document.querySelectorAll(
            "[data-step-indicator]"
        );

    indicators.forEach(indicator => {

        const indicatorStep =
            Number(
                indicator.dataset.stepIndicator
            );

        indicator.classList.toggle(
            "active",
            indicatorStep === step
        );

        indicator.classList.toggle(
            "completed",
            indicatorStep < step
        );
    });

    const sideButtons =
        document.querySelectorAll(
            ".setupStep"
        );

    sideButtons.forEach(button => {

        const buttonStep =
            Number(
                button.dataset.goStep
            );

        button.classList.toggle(
            "active",
            buttonStep === step
        );
    });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    drawMapping();

    saveState();
}


// ============================================================
// SENSOR PERMISSIONS
// ============================================================

async function requestMotionPermission() {

    try {

        if (
            typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission === "function"
        ) {

            const result =
                await DeviceMotionEvent.requestPermission();

            state.sensors.motionPermission =
                result === "granted";

        } else {

            state.sensors.motionPermission = true;
        }

    } catch (error) {

        console.warn(
            "Motion permission failed:",
            error
        );

        state.sensors.motionPermission = false;
    }

    attachMotionSensor();
    updateSensorStatus();
}


async function requestOrientationPermission() {

    try {

        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const result =
                await DeviceOrientationEvent.requestPermission();

            state.sensors.orientationPermission =
                result === "granted";

        } else {

            state.sensors.orientationPermission = true;
        }

    } catch (error) {

        console.warn(
            "Orientation permission failed:",
            error
        );

        state.sensors.orientationPermission = false;
    }

    attachOrientationSensor();
    updateSensorStatus();
}


async function enablePhoneSensors() {

    await Promise.all([
        requestMotionPermission(),
        requestOrientationPermission()
    ]);

    updateSensorStatus();
}


function updateSensorStatus() {

    const status =
        get("sensorStatus");

    if (!status) {
        return;
    }

    function sensorState(name, supported, permission, listener, data) {

        if (!supported) {
            return `${name}: unavailable`;
        }

        if (data) {
            return `${name}: receiving data`;
        }

        if (!permission) {
            return listener
                ? `${name}: permission not granted`
                : `${name}: not enabled`;
        }

        return listener
            ? `${name}: waiting for data`
            : `${name}: listener unavailable`;
    }

    status.textContent = [
        sensorState(
            "Motion",
            "DeviceMotionEvent" in window,
            state.sensors.motionPermission,
            state.sensors.motionListener,
            state.sensors.motionData
        ),
        sensorState(
            "Orientation",
            "DeviceOrientationEvent" in window,
            state.sensors.orientationPermission,
            state.sensors.orientationListener,
            state.sensors.orientationData
        )
    ].join(" | ");
}


// ============================================================
// MOTION SENSOR
// ============================================================

function attachMotionSensor() {

    if (state.sensors.motionListener) {
        return;
    }

    if (!("DeviceMotionEvent" in window)) {

        console.warn(
            "Device motion is not available."
        );

        return;
    }

    window.addEventListener(
        "devicemotion",
        handleMotion,
        true
    );

    state.sensors.motionListener = true;
}


function handleMotion(event) {

    const acceleration =
        event.accelerationIncludingGravity;

    if (!acceleration) {
        return;
    }

    const x =
        safeNumber(acceleration.x, 0);

    const y =
        safeNumber(acceleration.y, 0);

    const z =
        safeNumber(acceleration.z, 0);

    const magnitude =
        Math.sqrt(
            x * x +
            y * y +
            z * z
        );

    if (!state.sensors.motionData) {

        state.sensors.motionData = true;
        updateSensorStatus();
    }

    processStepDetection(magnitude);
}


// ============================================================
// ORIENTATION SENSOR
// ============================================================

function attachOrientationSensor() {

    if (state.sensors.orientationListener) {
        return;
    }

    if (!("DeviceOrientationEvent" in window)) {

        console.warn(
            "Device orientation is not available."
        );

        return;
    }

    window.addEventListener(
        "deviceorientation",
        handleOrientation,
        true
    );

    state.sensors.orientationListener = true;
}


function handleOrientation(event) {

    let heading = null;

    if (typeof event.webkitCompassHeading === "number") {

        heading =
            event.webkitCompassHeading;

    } else if (
        typeof event.alpha === "number"
    ) {

        heading =
            360 - event.alpha;
    }

    if (heading === null) {
        return;
    }

    if (!state.sensors.orientationData) {

        state.sensors.orientationData = true;
        updateSensorStatus();
    }

    if (state.mapping.active) {

        state.mapping.heading =
            heading;

    }

    if (state.tracking.active) {

        state.tracking.heading =
            heading;
    }
}


// ============================================================
// STEP DETECTION
// ============================================================

function processStepDetection(magnitude) {

    const now =
        performance.now();

    const previous =
        state.mapping.active
            ? state.mapping.lastStepAcceleration
            : state.tracking.lastStepAcceleration;

    const lastTime =
        state.mapping.active
            ? state.mapping.lastStepTime
            : state.tracking.lastStepTime;

    const cooldownPassed =
        now - lastTime >
        STEP_COOLDOWN;

    const rising =
        magnitude >
        STEP_THRESHOLD &&
        magnitude >
        previous;

    if (
        rising &&
        cooldownPassed
    ) {

        if (state.mapping.active) {

            registerMappingStep();

        } else if (state.tracking.active) {

            registerTrackingStep();
        }
    }

    if (state.mapping.active) {

        state.mapping.lastStepAcceleration =
            magnitude;
    }

    if (state.tracking.active) {

        state.tracking.lastStepAcceleration =
            magnitude;
    }
}


// ============================================================
// MOVEMENT
// ============================================================

function registerMappingStep() {

    const now =
        performance.now();

    const heading =
        state.mapping.heading *
        DEG_TO_RAD;

    state.mapping.x +=
        Math.sin(heading) *
        STEP_LENGTH;

    state.mapping.y +=
        Math.cos(heading) *
        STEP_LENGTH;

    state.mapping.distance +=
        STEP_LENGTH;

    state.mapping.lastStepTime =
        now;

    state.mapping.path.push({

        x: state.mapping.x,
        y: state.mapping.y
    });

    drawMapping();
    updateMappingInformation();

    saveState();
}


function registerTrackingStep() {

    const now =
        performance.now();

    const heading =
        state.tracking.heading *
        DEG_TO_RAD;

    state.tracking.x +=
        Math.sin(heading) *
        STEP_LENGTH;

    state.tracking.y +=
        Math.cos(heading) *
        STEP_LENGTH;

    state.tracking.distance +=
        STEP_LENGTH;

    state.tracking.lastStepTime =
        now;

    state.tracking.path.push({

        x: state.tracking.x,
        y: state.tracking.y
    });

    drawTracking();

    updateTrackingInformation();
}


// ============================================================
// START MAPPING
// ============================================================

async function startMapping() {

    await requestMotionPermission();

    await requestOrientationPermission();

    state.mapping.active = true;

    state.mapping.x =
        state.workstation.x;

    state.mapping.y =
        state.workstation.y;

    state.mapping.heading = 0;

    state.mapping.distance = 0;

    state.mapping.path = [

        {
            x: state.mapping.x,
            y: state.mapping.y
        }

    ];

    state.mapping.references = [];

    state.mapping.lastStepTime = 0;

    state.mapping.lastStepAcceleration = 0;

    drawMapping();

    updateMappingInformation();

    const startButton =
        get("startMappingButton");

    if (startButton) {

        startButton.textContent =
            "MAPPING ACTIVE";

        startButton.classList.add(
            "active"
        );
    }

    const stopButton =
        get("stopMappingButton");

    if (stopButton) {

        stopButton.style.display =
            "";
    }

    saveState();
}


// ============================================================
// STOP MAPPING
// ============================================================

function stopMapping() {

    state.mapping.active = false;

    const startButton =
        get("startMappingButton");

    if (startButton) {

        startButton.textContent =
            "START MAPPING";

        startButton.classList.remove(
            "active"
        );
    }

    const stopButton =
        get("stopMappingButton");

    if (stopButton) {

        stopButton.style.display =
            "none";
    }

    saveState();

    updateMappingInformation();
}


// ============================================================
// REFERENCE POINT
// ============================================================

function dropReferencePoint() {

    const point = {

        x: safeNumber(
            state.mapping.x,
            0
        ),

        y: safeNumber(
            state.mapping.y,
            0
        ),

        id:
            Date.now(),

        name:
            `Reference ${state.mapping.references.length + 1}`
    };

    state.mapping.references.push(
        point
    );

    drawMapping();

    updateMappingInformation();

    saveState();
}


// ============================================================
// MAPPING INFORMATION
// ============================================================

function updateMappingInformation() {

    const distanceElements =
        document.querySelectorAll(
            "[data-mapping-distance]"
        );

    distanceElements.forEach(element => {

        element.textContent =
            `${state.mapping.distance.toFixed(1)} m`;
    });


    const referenceElements =
        document.querySelectorAll(
            "[data-reference-count]"
        );

    referenceElements.forEach(element => {

        element.textContent =
            state.mapping.references.length;
    });


    const xElements =
        document.querySelectorAll(
            "[data-mapping-x]"
        );

    xElements.forEach(element => {

        element.textContent =
            state.mapping.x.toFixed(2);
    });


    const yElements =
        document.querySelectorAll(
            "[data-mapping-y]"
        );

    yElements.forEach(element => {

        element.textContent =
            state.mapping.y.toFixed(2);
    });
}


// ============================================================
// CANVAS UTILITIES
// ============================================================

function getCanvas(id) {

    const canvas =
        get(id);

    if (!canvas) {
        return null;
    }

    const rect =
        canvas.getBoundingClientRect();

    if (
        rect.width <= 1 ||
        rect.height <= 1
    ) {

        return null;
    }

    const dpr =
        window.devicePixelRatio || 1;

    if (
        canvas.width !==
        Math.round(rect.width * dpr) ||
        canvas.height !==
        Math.round(rect.height * dpr)
    ) {

        canvas.width =
            Math.max(
                1,
                Math.round(rect.width * dpr)
            );

        canvas.height =
            Math.max(
                1,
                Math.round(rect.height * dpr)
            );
    }

    const context =
        canvas.getContext("2d");

    context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    return {
        canvas,
        context,
        width: rect.width,
        height: rect.height
    };
}


function calculatePathBounds(path) {

    if (!Array.isArray(path) || path.length === 0) {

        return {

            minX: -1,
            maxX: 1,

            minY: -1,
            maxY: 1
        };
    }

    let minX = Infinity;
    let maxX = -Infinity;

    let minY = Infinity;
    let maxY = -Infinity;

    path.forEach(point => {

        const x =
            safeNumber(point.x, 0);

        const y =
            safeNumber(point.y, 0);

        minX =
            Math.min(minX, x);

        maxX =
            Math.max(maxX, x);

        minY =
            Math.min(minY, y);

        maxY =
            Math.max(maxY, y);
    });

    if (
        !Number.isFinite(minX) ||
        !Number.isFinite(maxX)
    ) {

        minX = -1;
        maxX = 1;
    }

    if (
        !Number.isFinite(minY) ||
        !Number.isFinite(maxY)
    ) {

        minY = -1;
        maxY = 1;
    }

    if (maxX - minX < 0.01) {

        minX -= 1;
        maxX += 1;
    }

    if (maxY - minY < 0.01) {

        minY -= 1;
        maxY += 1;
    }

    return {
        minX,
        maxX,
        minY,
        maxY
    };
}


// ============================================================
// DRAW MAPPING
// ============================================================

function drawMapping() {

    const result =
        getCanvas(
            state.setupStep === 4
                ? "alignmentCanvas"
                : "mappingCanvas"
        );

    if (!result) {
        return;
    }

    const {
        context,
        width,
        height
    } = result;

    context.clearRect(
        0,
        0,
        width,
        height
    );

    context.fillStyle =
        "#080f1b";

    context.fillRect(
        0,
        0,
        width,
        height
    );

    const image =
        state.setupStep === 4
            ? document.querySelector(
                "[data-floor-map-image]"
            )
            : null;

    if (image && image.complete && image.naturalWidth > 0) {

        const transform =
            state.plan.imageTransform;

        context.save();

        context.translate(
            width / 2 +
            transform.x,

            height / 2 +
            transform.y
        );

        context.rotate(
            transform.rotation *
            DEG_TO_RAD
        );

        const imageWidth =
            image.naturalWidth *
            transform.scale;

        const imageHeight =
            image.naturalHeight *
            transform.scale;

        const maxDimension =
            Math.max(
                imageWidth,
                imageHeight
            );

        let drawScale = 1;

        if (
            maxDimension >
            Math.max(width, height) * 3
        ) {

            drawScale =
                Math.max(width, height) /
                maxDimension *
                3;
        }

        context.drawImage(

            image,

            -imageWidth *
            drawScale / 2,

            -imageHeight *
            drawScale / 2,

            imageWidth *
            drawScale,

            imageHeight *
            drawScale
        );

        context.restore();
    }

    const path =
        state.mapping.path;

    const bounds =
        calculatePathBounds([
            ...path,
            ...state.mapping.references,
            {
                x: state.mapping.x,
                y: state.mapping.y
            }
        ]);

    const availableWidth =
        Math.max(
            width - CANVAS_PADDING * 2,
            1
        );

    const availableHeight =
        Math.max(
            height - CANVAS_PADDING * 2,
            1
        );

    const rangeX =
        Math.max(
            bounds.maxX - bounds.minX,
            0.01
        );

    const rangeY =
        Math.max(
            bounds.maxY - bounds.minY,
            0.01
        );

    const scale =
        Math.min(
            availableWidth / rangeX,
            availableHeight / rangeY
        );

    function screenX(x) {

        return (
            CANVAS_PADDING +
            (x - bounds.minX) *
            scale
        );
    }

    function screenY(y) {

        return (
            height -
            CANVAS_PADDING -
            (y - bounds.minY) *
            scale
        );
    }

    if (state.setupStep !== 4) {

        const rawGridInterval =
            80 / scale;

        const gridMagnitude =
            10 ** Math.floor(
                Math.log10(rawGridInterval)
            );

        const normalizedGridInterval =
            rawGridInterval / gridMagnitude;

        const gridFactor =
            normalizedGridInterval <= 1
                ? 1
                : normalizedGridInterval <= 2
                    ? 2
                    : normalizedGridInterval <= 5
                        ? 5
                        : 10;

        const gridInterval =
            gridFactor * gridMagnitude;

        const scaleDisplay =
            document.querySelector(
                "[data-mapping-scale]"
            );

        if (scaleDisplay) {

            scaleDisplay.textContent =
                `${Number(gridInterval.toPrecision(2))} m per grid`;
        }

        context.strokeStyle =
            "rgba(255, 255, 255, 0.12)";

        context.lineWidth = 1;

        context.fillStyle =
            "#d5dde8";

        context.font =
            "11px sans-serif";

        context.textAlign =
            "center";

        const firstXTick =
            Math.ceil(bounds.minX / gridInterval) *
            gridInterval;

        for (
            let x = firstXTick;
            x <= bounds.maxX;
            x += gridInterval
        ) {

            const pixelX =
                screenX(x);

            context.beginPath();
            context.moveTo(pixelX, CANVAS_PADDING);
            context.lineTo(pixelX, height - CANVAS_PADDING);
            context.stroke();

            context.fillText(
                `${Number(x.toPrecision(3))}`,
                pixelX,
                height - 18
            );
        }

        const firstYTick =
            Math.ceil(bounds.minY / gridInterval) *
            gridInterval;

        context.textAlign =
            "right";

        for (
            let y = firstYTick;
            y <= bounds.maxY;
            y += gridInterval
        ) {

            const pixelY =
                screenY(y);

            context.beginPath();
            context.moveTo(CANVAS_PADDING, pixelY);
            context.lineTo(width - CANVAS_PADDING, pixelY);
            context.stroke();

            context.fillText(
                `${Number(y.toPrecision(3))}`,
                CANVAS_PADDING - 8,
                pixelY + 4
            );
        }

        context.textAlign =
            "start";

        context.fillStyle =
            "#ffffff";

        context.font =
            "12px sans-serif";

        context.fillText(
            "X (m)",
            width - CANVAS_PADDING - 36,
            height - 8
        );

        context.fillText(
            "Y (m)",
            8,
            CANVAS_PADDING - 12
        );
    }

    // Path

    if (path.length > 1) {

        context.beginPath();

        path.forEach((point, index) => {

            const x =
                screenX(
                    safeNumber(point.x)
                );

            const y =
                screenY(
                    safeNumber(point.y)
                );

            if (index === 0) {

                context.moveTo(x, y);

            } else {

                context.lineTo(x, y);
            }
        });

        context.strokeStyle =
            "#ffffff";

        context.lineWidth = 3;

        context.stroke();
    }


    // Reference points

    state.mapping.references.forEach(
        (reference, index) => {

            const x =
                screenX(reference.x);

            const y =
                screenY(reference.y);

            context.beginPath();

            context.arc(
                x,
                y,
                7,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                "#ffb000";

            context.fill();

            context.fillStyle =
                "#ffffff";

            context.font =
                "12px sans-serif";

            context.fillText(
                `R${index + 1}`,
                x + 10,
                y - 10
            );
        }
    );


    // Current position

    const currentX =
        screenX(
            state.mapping.x
        );

    const currentY =
        screenY(
            state.mapping.y
        );

    context.beginPath();

    context.arc(
        currentX,
        currentY,
        9,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#00ff88";

    context.fill();

    context.strokeStyle =
        "#ffffff";

    context.lineWidth = 2;

    context.stroke();


    // Starting position

    const start =
        path.length > 0
            ? path[0]
            : {
                x: 0,
                y: 0
            };

    const startX =
        screenX(start.x);

    const startY =
        screenY(start.y);

    context.beginPath();

    context.arc(
        startX,
        startY,
        6,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#ffffff";

    context.fill();

    context.fillStyle =
        "#ffffff";

    context.font =
        "12px sans-serif";

    context.fillText(
        "START",
        startX + 10,
        startY + 4
    );
}


// ============================================================
// FLOOR MAP DROPDOWN
// ============================================================

function populateFloorMaps() {

    const selects =
        document.querySelectorAll(
            "#setupFloorMapSelect, #trackFloorMapSelect, [data-floor-map-select]"
        );

    selects.forEach(select => {

        const previousValue =
            select.value;

        select.innerHTML = "";

        FLOOR_MAPS.forEach(map => {

            const option =
                document.createElement("option");

            option.value =
                map.id;

            option.textContent =
                map.name;

            select.appendChild(
                option
            );
        });

        if (
            state.plan.selectedMapId &&
            FLOOR_MAPS.some(
                map =>
                    map.id ===
                    state.plan.selectedMapId
            )
        ) {

            select.value =
                state.plan.selectedMapId;

        } else if (previousValue) {

            select.value =
                previousValue;
        }
    });


    if (state.plan.selectedMapId) {

        updateMapPreview(
            state.plan.selectedMapId
        );

    } else if (FLOOR_MAPS.length > 0) {

        selectFloorMap(
            FLOOR_MAPS[0].id
        );
    }
}


// ============================================================
// SELECT MAP
// ============================================================

function selectFloorMap(mapId) {

    const map =
        FLOOR_MAPS.find(
            item =>
                item.id === mapId
        );

    if (!map) {

        console.warn(
            "Floor map not found:",
            mapId
        );

        return;
    }

    state.plan.selectedMapId =
        map.id;

    state.plan.imageUrl =
        map.image;

    state.plan.imageName =
        map.name;

    updateMapPreview(
        map.id
    );

    saveState();
}


// ============================================================
// MAP PREVIEW
// ============================================================

function updateMapPreview(mapId) {

    const map =
        FLOOR_MAPS.find(
            item =>
                item.id === mapId
        );

    if (!map) {
        return;
    }

    const loadStatus =
        document.querySelector(
            "[data-map-load-status]"
        );

    if (loadStatus) {

        loadStatus.textContent =
            `Loading floor map: ${map.name}...`;
    }

    const images =
        document.querySelectorAll(
            "[data-floor-map-image]"
        );

    images.forEach(image => {

        image.src =
            map.image;

        image.alt =
            map.name;

        image.style.display =
            "";

        image.onload =
            () => {

                if (loadStatus) {

                    loadStatus.textContent =
                        `Floor map loaded: ${map.name}`;
                }

                drawMapping();
            };

        image.onerror =
            () => {

                if (loadStatus) {

                    loadStatus.textContent =
                        `Could not load floor map: ${map.image}`;
                }

                drawMapping();
            };
    });


    const nameElements =
        document.querySelectorAll(
            "[data-floor-map-name]"
        );

    nameElements.forEach(element => {

        element.textContent =
            map.name;
    });


    const urlElements =
        document.querySelectorAll(
            "[data-floor-map-url]"
        );

    urlElements.forEach(element => {

        element.textContent =
            map.image;
    });
}


// ============================================================
// IMAGE TRANSFORM
// ============================================================

function updateImageTransform() {

    const image =
        document.querySelector(
            "[data-floor-map-image]"
        );

    if (!image) {
        return;
    }

    const transform =
        state.plan.imageTransform;

    image.style.transform =
        `translate(${transform.x}px, ${transform.y}px) ` +
        `scale(${transform.scale}) ` +
        `rotate(${transform.rotation}deg)`;

    const scaleDisplay =
        document.querySelector(
            "[data-map-scale]"
        );

    if (scaleDisplay) {

        scaleDisplay.textContent =
            `${Math.round(
                transform.scale * 100
            )}%`;
    }

    drawMapping();
    drawTracking();
}


function changeImageScale(amount) {

    state.plan.imageTransform.scale =
        clamp(
            state.plan.imageTransform.scale +
            amount,
            0.1,
            10
        );

    updateImageTransform();

    saveState();
}


function moveImage(dx, dy) {

    state.plan.imageTransform.x +=
        dx;

    state.plan.imageTransform.y +=
        dy;

    updateImageTransform();

    saveState();
}


function rotateImage(amount) {

    state.plan.imageTransform.rotation +=
        amount;

    updateImageTransform();

    saveState();
}


// ============================================================
// RESET IMAGE ALIGNMENT
// ============================================================

function resetImageAlignment() {

    state.plan.imageTransform = {

        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
    };

    updateImageTransform();

    saveState();
}


// ============================================================
// LOCK SETUP
// ============================================================

function lockSetup() {

    if (!state.plan.selectedMapId) {

        alert(
            "Please select a floor map first."
        );

        return;
    }

    if (
        state.mapping.path.length <
        2
    ) {

        alert(
            "Please complete some mapping movement first."
        );

        return;
    }

    state.locked = true;

    stopMapping();

    saveState();

    showSetupStep(4);

    updateSetupStatus();
}


// ============================================================
// SETUP STATUS
// ============================================================

function updateSetupStatus() {

    const statusElements =
        document.querySelectorAll(
            "[data-setup-status]"
        );

    statusElements.forEach(element => {

        if (state.locked) {

            element.textContent =
                "Setup locked";

        } else {

            element.textContent =
                "Setup not locked";
        }
    });


    const mapElements =
        document.querySelectorAll(
            "[data-setup-map-name]"
        );

    mapElements.forEach(element => {

        element.textContent =
            state.plan.imageName ||
            "No map selected";
    });
}


// ============================================================
// START TRACKING
// ============================================================

async function startTracking() {

    if (!state.locked) {

        alert(
            "Complete and lock the setup first."
        );

        return;
    }

    await requestMotionPermission();

    await requestOrientationPermission();

    state.tracking.active = true;

    state.tracking.x =
        state.workstation.x;

    state.tracking.y =
        state.workstation.y;

    state.tracking.heading = 0;

    state.tracking.distance = 0;

    state.tracking.path = [

        {
            x: state.tracking.x,
            y: state.tracking.y
        }

    ];

    state.tracking.lastStepTime = 0;

    state.tracking.lastStepAcceleration = 0;

    drawTracking();

    updateTrackingInformation();

    const button =
        get("startTrackingButton");

    if (button) {

        button.textContent =
            "TRACKING ACTIVE";

        button.classList.add(
            "active"
        );
    }
}


// ============================================================
// STOP TRACKING
// ============================================================

function stopTracking() {

    state.tracking.active = false;

    const button =
        get("startTrackingButton");

    if (button) {

        button.textContent =
            "START TRACKING";

        button.classList.remove(
            "active"
        );
    }
}


// ============================================================
// TRACKING INFORMATION
// ============================================================

function updateTrackingInformation() {

    const distanceElements =
        document.querySelectorAll(
            "[data-tracking-distance]"
        );

    distanceElements.forEach(element => {

        element.textContent =
            `${state.tracking.distance.toFixed(1)} m`;
    });


    const xElements =
        document.querySelectorAll(
            "[data-tracking-x]"
        );

    xElements.forEach(element => {

        element.textContent =
            state.tracking.x.toFixed(2);
    });


    const yElements =
        document.querySelectorAll(
            "[data-tracking-y]"
        );

    yElements.forEach(element => {

        element.textContent =
            state.tracking.y.toFixed(2);
    });
}


// ============================================================
// DRAW TRACKING
// ============================================================

function drawTracking() {

    const result =
        getCanvas("trackingCanvas");

    if (!result) {
        return;
    }

    const {
        context,
        width,
        height
    } = result;

    context.clearRect(
        0,
        0,
        width,
        height
    );

    const image =
        document.querySelector(
            "[data-floor-map-image]"
        );

    if (!image) {
        return;
    }

    if (!image.complete) {

        image.onload =
            () => drawTracking();

        return;
    }

    // --------------------------------------------------------
    // Draw map
    // --------------------------------------------------------

    const transform =
        state.plan.imageTransform;

    context.save();

    context.translate(
        width / 2 +
        transform.x,

        height / 2 +
        transform.y
    );

    context.rotate(
        transform.rotation *
        DEG_TO_RAD
    );

    const imageWidth =
        image.naturalWidth *
        transform.scale;

    const imageHeight =
        image.naturalHeight *
        transform.scale;

    const maxDimension =
        Math.max(
            imageWidth,
            imageHeight
        );

    let drawScale = 1;

    if (
        maxDimension >
        Math.max(width, height) * 3
    ) {

        drawScale =
            Math.max(width, height) /
            maxDimension *
            3;
    }

    context.drawImage(

        image,

        -imageWidth *
            drawScale / 2,

        -imageHeight *
            drawScale / 2,

        imageWidth *
            drawScale,

        imageHeight *
            drawScale
    );

    context.restore();


    // --------------------------------------------------------
    // Draw tracking path
    // --------------------------------------------------------

    const path =
        state.tracking.path;

    if (path.length < 1) {
        return;
    }

    const bounds =
        calculatePathBounds(
            path
        );

    const rangeX =
        Math.max(
            bounds.maxX -
            bounds.minX,
            0.01
        );

    const rangeY =
        Math.max(
            bounds.maxY -
            bounds.minY,
            0.01
        );

    const scale =
        Math.min(
            (width - 40) /
                rangeX,

            (height - 40) /
                rangeY
        );

    function screenX(x) {

        return (
            20 +
            (x - bounds.minX) *
            scale
        );
    }

    function screenY(y) {

        return (
            height -
            20 -
            (y - bounds.minY) *
            scale
        );
    }


    if (path.length > 1) {

        context.beginPath();

        path.forEach(
            (point, index) => {

                const x =
                    screenX(
                        point.x
                    );

                const y =
                    screenY(
                        point.y
                    );

                if (index === 0) {

                    context.moveTo(
                        x,
                        y
                    );

                } else {

                    context.lineTo(
                        x,
                        y
                    );
                }
            }
        );

        context.strokeStyle =
            "#00d4ff";

        context.lineWidth = 4;

        context.stroke();
    }


    // --------------------------------------------------------
    // Current position
    // --------------------------------------------------------

    const currentX =
        screenX(
            state.tracking.x
        );

    const currentY =
        screenY(
            state.tracking.y
        );

    context.beginPath();

    context.arc(
        currentX,
        currentY,
        10,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#00ff88";

    context.fill();

    context.strokeStyle =
        "#ffffff";

    context.lineWidth = 3;

    context.stroke();
}


// ============================================================
// WORKSTATION
// ============================================================

function saveWorkstation() {

    const xInput =
        get("workstationX");

    const yInput =
        get("workstationY");

    if (xInput) {

        state.workstation.x =
            safeNumber(
                xInput.value,
                0
            );
    }

    if (yInput) {

        state.workstation.y =
            safeNumber(
                yInput.value,
                0
            );
    }

    state.mapping.x =
        state.workstation.x;

    state.mapping.y =
        state.workstation.y;

    saveState();

    showSetupStep(2);
}


// ============================================================
// MAP SETUP
// ============================================================

function finishMapping() {

    stopMapping();

    drawMapping();

    showSetupStep(3);

    populateFloorMaps();

    updateMapPreview(
        state.plan.selectedMapId
    );

    updateImageTransform();
}


// ============================================================
// NEW SETUP
// ============================================================

function resetSetup() {

    const confirmed =
        confirm(
            "Reset the complete setup?"
        );

    if (!confirmed) {
        return;
    }

    state.setupStep = 1;

    state.workstation = {

        x: 0,
        y: 0
    };

    state.mapping = {

        active: false,

        x: 0,
        y: 0,

        heading: 0,

        distance: 0,

        path: [],

        references: [],

        lastStepTime: 0,

        lastStepAcceleration: 0
    };

    state.tracking = {

        active: false,

        x: 0,
        y: 0,

        heading: 0,

        distance: 0,

        path: [],

        lastStepTime: 0,

        lastStepAcceleration: 0
    };

    state.plan = {

        selectedMapId: null,

        imageUrl: null,

        imageName: null,

        imageTransform: {

            x: 0,
            y: 0,

            scale: 1,

            rotation: 0
        }
    };

    state.locked = false;

    saveState();

    location.reload();
}


// ============================================================
// EVENT CONNECTIONS
// ============================================================

function setupEventListeners() {

    const sensorButton =
        get("sensorBtn");

    if (sensorButton) {

        sensorButton.addEventListener(
            "click",
            enablePhoneSensors
        );
    }

    // --------------------------------------------------------
    // Workstation
    // --------------------------------------------------------

    const workstationButton =
        get("saveWorkstationButton");

    if (workstationButton) {

        workstationButton.addEventListener(
            "click",
            saveWorkstation
        );
    }


    // --------------------------------------------------------
    // Mapping
    // --------------------------------------------------------

    const startMappingButton =
        get("startMappingButton");

    if (startMappingButton) {

        startMappingButton.addEventListener(
            "click",
            startMapping
        );
    }


    const stopMappingButton =
        get("stopMappingButton");

    if (stopMappingButton) {

        stopMappingButton.addEventListener(
            "click",
            stopMapping
        );
    }


    const referenceButton =
        get("dropReferenceButton");

    if (referenceButton) {

        referenceButton.addEventListener(
            "click",
            dropReferencePoint
        );
    }


    const finishMappingButton =
        get("finishMappingButton");

    if (finishMappingButton) {

        finishMappingButton.addEventListener(
            "click",
            finishMapping
        );
    }


    // --------------------------------------------------------
    // Map selection
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-floor-map-select]"
        )
        .forEach(select => {

            select.addEventListener(
                "change",
                event => {

                    selectFloorMap(
                        event.target.value
                    );
                }
            );
        });


    // --------------------------------------------------------
    // Image controls
    // --------------------------------------------------------

    const scalePlus =
        get("mapScalePlus");

    if (scalePlus) {

        scalePlus.addEventListener(
            "click",
            () => changeImageScale(0.1)
        );
    }


    const scaleMinus =
        get("mapScaleMinus");

    if (scaleMinus) {

        scaleMinus.addEventListener(
            "click",
            () => changeImageScale(-0.1)
        );
    }


    const moveLeft =
        get("mapMoveLeft");

    if (moveLeft) {

        moveLeft.addEventListener(
            "click",
            () => moveImage(-10, 0)
        );
    }


    const moveRight =
        get("mapMoveRight");

    if (moveRight) {

        moveRight.addEventListener(
            "click",
            () => moveImage(10, 0)
        );
    }


    const moveUp =
        get("mapMoveUp");

    if (moveUp) {

        moveUp.addEventListener(
            "click",
            () => moveImage(0, -10)
        );
    }


    const moveDown =
        get("mapMoveDown");

    if (moveDown) {

        moveDown.addEventListener(
            "click",
            () => moveImage(0, 10)
        );
    }


    const rotateLeft =
        get("mapRotateLeft");

    if (rotateLeft) {

        rotateLeft.addEventListener(
            "click",
            () => rotateImage(-2)
        );
    }


    const rotateRight =
        get("mapRotateRight");

    if (rotateRight) {

        rotateRight.addEventListener(
            "click",
            () => rotateImage(2)
        );
    }


    const resetAlignment =
        get("resetMapAlignment");

    if (resetAlignment) {

        resetAlignment.addEventListener(
            "click",
            resetImageAlignment
        );
    }


    // --------------------------------------------------------
    // Lock
    // --------------------------------------------------------

    const lockButton =
        get("lockSetupButton");

    if (lockButton) {

        lockButton.addEventListener(
            "click",
            lockSetup
        );
    }


    // --------------------------------------------------------
    // Tracking
    // --------------------------------------------------------

    const trackingButton =
        get("startTrackingButton");

    if (trackingButton) {

        trackingButton.addEventListener(
            "click",
            startTracking
        );
    }


    const stopTrackingButton =
        get("stopTrackingButton");

    if (stopTrackingButton) {

        stopTrackingButton.addEventListener(
            "click",
            stopTracking
        );
    }


    // --------------------------------------------------------
    // Reset
    // --------------------------------------------------------

    const resetButton =
        get("resetSetupButton");

    if (resetButton) {

        resetButton.addEventListener(
            "click",
            resetSetup
        );
    }


    // --------------------------------------------------------
    // Navigation buttons
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-go-step]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const step =
                        Number(
                            button.dataset.goStep
                        );

                    if (
                        Number.isFinite(step)
                    ) {

                        showSetupStep(step);
                    }
                }
            );
        });
}


// ============================================================
// RESIZE
// ============================================================

function handleResize() {

    drawMapping();

    drawTracking();

    updateImageTransform();
}


window.addEventListener(
    "resize",
    handleResize
);


// ============================================================
// INITIALIZATION
// ============================================================

function initializeApplication() {

    loadState();

    setupEventListeners();

    populateFloorMaps();

    updateMappingInformation();

    updateTrackingInformation();

    updateSensorStatus();

    updateSetupStatus();

    updateImageTransform();

    drawMapping();

    drawTracking();


    // If there is an existing locked setup,
    // keep the user on the setup page for now.
    //
    // The existing UI can navigate to tracking
    // using the normal navigation controls.

    showSetupStep(
        state.setupStep || 1
    );
}


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);