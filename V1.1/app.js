
// ============================================================
// FLOOR TRACKER
// Static GitHub Pages version
// JPEG maps only - no PDF / no upload server required
//
// V1.1 SENSOR IMPROVEMENTS
// - Accelerometer step detection
// - Gyroscope-assisted heading
// - Smoothed compass heading
// - Adaptive step length
// - Stationary/noise rejection
// - Better turn handling
// - World X/Y remains the source of truth
// ============================================================

const STORAGE_KEY = "production-floor-tracker-clean-v4";

// ============================================================
// FLOOR MAPS
// ============================================================

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

// Base step length.
const STEP_LENGTH = 0.72;

// Minimum / maximum adaptive step length.
const MIN_STEP_LENGTH = 0.55;
const MAX_STEP_LENGTH = 0.95;

// Step detection.
const STEP_THRESHOLD = 1.15;
const STEP_PEAK_THRESHOLD = 1.35;
const STEP_COOLDOWN = 280;

// Sensor filtering.
const GRAVITY_FILTER_ALPHA = 0.08;
const ACCELERATION_FILTER_ALPHA = 0.25;
const HEADING_FILTER_ALPHA = 0.12;

// Gyroscope heading fusion.
const GYRO_WEIGHT = 0.92;
const COMPASS_CORRECTION_WEIGHT = 0.08;

// Stationary detection.
const STATIONARY_ACCEL_THRESHOLD = 0.20;
const STATIONARY_TIME = 500;

// Adaptive step timing.
const MIN_STEP_INTERVAL = 280;
const MAX_STEP_INTERVAL = 1100;

// Canvas.
const CANVAS_PADDING = 50;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

let gravityVectorBaseline = null;
let lastSensorStatusUpdate = 0;


// ============================================================
// APPLICATION STATE
// ============================================================

const state = {

    setupStep: 2,

    workstation: {
        x: 0,
        y: 0
    },

    sensors: {

        motionPermission: false,
        orientationPermission: false,

        motionData: false,
        orientationData: false,

        motionReading: null,
        orientationReading: null,

        motionListener: false,
        orientationListener: false,

        // ----------------------------------------------------
        // Enhanced sensor information
        // ----------------------------------------------------

        gyroAvailable: false,

        gyroReading: null,

        filteredAcceleration: 0,

        lastMotionTimestamp: 0,

        stationarySince: 0,

        isStationary: false,

        // Compass heading after circular filtering.
        compassHeading: null,

        // Gyroscope integrated heading.
        gyroHeading: null,

        lastGyroTimestamp: 0,

        // Final fused heading.
        fusedHeading: 0,

        headingInitialized: false,

        // Step detector state.
        stepPeak: 0,

        stepValley: 0,

        lastStepTimestamp: 0,

        stepIntervals: []
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

        calibrationBounds: null,

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
// ANGLE UTILITIES
// ============================================================

function normalizeHeading(degrees) {

    let value =
        safeNumber(degrees, 0) % 360;

    if (value < 0) {
        value += 360;
    }

    return value;
}


function shortestAngleDifference(
    target,
    current
) {

    let difference =
        normalizeHeading(target) -
        normalizeHeading(current);

    if (difference > 180) {
        difference -= 360;
    }

    if (difference < -180) {
        difference += 360;
    }

    return difference;
}


function interpolateHeading(
    current,
    target,
    amount
) {

    const difference =
        shortestAngleDifference(
            target,
            current
        );

    return normalizeHeading(
        current +
        difference * amount
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
                    state.workstation.x
                );

            state.mapping.y =
                safeNumber(
                    parsed.mapping.y,
                    state.workstation.y
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

        if (parsed.tracking) {

            state.tracking.x =
                safeNumber(
                    parsed.tracking.x,
                    state.workstation.x
                );

            state.tracking.y =
                safeNumber(
                    parsed.tracking.y,
                    state.workstation.y
                );

            state.tracking.heading =
                safeNumber(
                    parsed.tracking.heading,
                    0
                );

            state.tracking.distance =
                safeNumber(
                    parsed.tracking.distance,
                    0
                );

            state.tracking.path =
                Array.isArray(parsed.tracking.path)
                    ? parsed.tracking.path
                    : [];
        }

        if (parsed.plan) {

            state.plan.selectedMapId =
                parsed.plan.selectedMapId || null;

            state.plan.imageUrl =
                parsed.plan.imageUrl || null;

            state.plan.imageName =
                parsed.plan.imageName || null;

            if (parsed.plan.calibrationBounds) {

                state.plan.calibrationBounds = {
                    minX: safeNumber(
                        parsed.plan.calibrationBounds.minX,
                        -1
                    ),

                    maxX: safeNumber(
                        parsed.plan.calibrationBounds.maxX,
                        1
                    ),

                    minY: safeNumber(
                        parsed.plan.calibrationBounds.minY,
                        -1
                    ),

                    maxY: safeNumber(
                        parsed.plan.calibrationBounds.maxY,
                        1
                    )
                };
            }

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

        if (Number.isFinite(parsed.setupStep)) {

            state.setupStep =
                parsed.setupStep;
        }

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


// ============================================================
// SENSOR STATUS
// ============================================================

function updateSensorStatus() {

    const status =
        get("sensorStatus");

    if (!status) {
        return;
    }

    function sensorState(
        name,
        supported,
        permission,
        listener,
        data,
        reading
    ) {

        if (!supported) {
            return `${name}: unavailable`;
        }

        if (data) {
            return `${name}: receiving data${reading ? ` (${reading})` : ""}`;
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

    const motionReading =
        state.sensors.motionReading;

    const orientationReading =
        state.sensors.orientationReading;

    const gyro =
        state.sensors.gyroReading;

    status.textContent = [

        sensorState(
            "Motion",
            "DeviceMotionEvent" in window,
            state.sensors.motionPermission,
            state.sensors.motionListener,
            state.sensors.motionData,
            motionReading
                ? `x ${motionReading.x.toFixed(2)}, y ${motionReading.y.toFixed(2)}, z ${motionReading.z.toFixed(2)} m/s²`
                : ""
        ),

        sensorState(
            "Orientation",
            "DeviceOrientationEvent" in window,
            state.sensors.orientationPermission,
            state.sensors.orientationListener,
            state.sensors.orientationData,
            orientationReading
                ? `heading ${orientationReading.heading}°`
                : ""
        ),

        `Gyro: ${
            state.sensors.gyroAvailable
                ? gyro
                    ? `active ${gyro.z.toFixed(1)} °/s`
                    : "available"
                : "unavailable"
        }`

    ].join(" | ");

    lastSensorStatusUpdate =
        performance.now();
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

    let magnitude;
    let rawReading;

    const firstReading =
        !state.sensors.motionData;

    if (event.acceleration) {

        const acceleration =
            event.acceleration;

        const x =
            safeNumber(acceleration.x, 0);

        const y =
            safeNumber(acceleration.y, 0);

        const z =
            safeNumber(acceleration.z, 0);

        rawReading = {
            x,
            y,
            z
        };

        magnitude =
            Math.sqrt(
                x * x +
                y * y +
                z * z
            );

    } else {

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

        rawReading = {
            x,
            y,
            z
        };

        if (gravityVectorBaseline === null) {

            gravityVectorBaseline = {
                x,
                y,
                z
            };
        }

        gravityVectorBaseline.x +=
            (x - gravityVectorBaseline.x) *
            GRAVITY_FILTER_ALPHA;

        gravityVectorBaseline.y +=
            (y - gravityVectorBaseline.y) *
            GRAVITY_FILTER_ALPHA;

        gravityVectorBaseline.z +=
            (z - gravityVectorBaseline.z) *
            GRAVITY_FILTER_ALPHA;

        magnitude =
            Math.sqrt(
                (x - gravityVectorBaseline.x) ** 2 +
                (y - gravityVectorBaseline.y) ** 2 +
                (z - gravityVectorBaseline.z) ** 2
            );
    }

    // --------------------------------------------------------
    // Low-pass acceleration magnitude.
    // --------------------------------------------------------

    state.sensors.filteredAcceleration +=
        (
            magnitude -
            state.sensors.filteredAcceleration
        ) *
        ACCELERATION_FILTER_ALPHA;

    const filtered =
        state.sensors.filteredAcceleration;

    // --------------------------------------------------------
    // Stationary detection.
    // --------------------------------------------------------

    const now =
        performance.now();

    if (
        filtered <
        STATIONARY_ACCEL_THRESHOLD
    ) {

        if (!state.sensors.stationarySince) {

            state.sensors.stationarySince =
                now;
        }

        if (
            now -
            state.sensors.stationarySince >
            STATIONARY_TIME
        ) {

            state.sensors.isStationary =
                true;
        }

    } else {

        state.sensors.stationarySince = 0;

        state.sensors.isStationary =
            false;
    }

    // --------------------------------------------------------
    // Gyroscope.
    // --------------------------------------------------------

    if (event.rotationRate) {

        const alpha =
            safeNumber(
                event.rotationRate.alpha,
                0
            );

        const beta =
            safeNumber(
                event.rotationRate.beta,
                0
            );

        const gamma =
            safeNumber(
                event.rotationRate.gamma,
                0
            );

        state.sensors.gyroAvailable = true;

        state.sensors.gyroReading = {
            x: beta,
            y: gamma,
            z: alpha
        };

        updateGyroscopeHeading(
            event,
            now
        );
    }

    state.sensors.motionData = true;

    state.sensors.motionReading =
        rawReading;

    state.sensors.lastMotionTimestamp =
        now;

    if (
        firstReading ||
        now - lastSensorStatusUpdate >= 250
    ) {

        updateSensorStatus();
    }

    processStepDetection(
        filtered
    );
}


// ============================================================
// GYROSCOPE HEADING
// ============================================================

function updateGyroscopeHeading(
    event,
    now
) {

    if (!event.rotationRate) {
        return;
    }

    const rotationRate =
        safeNumber(
            event.rotationRate.alpha,
            0
        );

    if (!Number.isFinite(rotationRate)) {
        return;
    }

    if (
        !state.sensors.headingInitialized ||
        state.sensors.gyroHeading === null
    ) {

        if (
            state.sensors.compassHeading !== null
        ) {

            state.sensors.gyroHeading =
                state.sensors.compassHeading;

            state.sensors.fusedHeading =
                state.sensors.compassHeading;

            state.sensors.headingInitialized =
                true;
        }

        state.sensors.lastGyroTimestamp =
            now;

        return;
    }

    if (!state.sensors.lastGyroTimestamp) {

        state.sensors.lastGyroTimestamp =
            now;

        return;
    }

    const dt =
        (now -
            state.sensors.lastGyroTimestamp) /
        1000;

    state.sensors.lastGyroTimestamp =
        now;

    // Ignore impossible sensor timing.
    if (
        dt <= 0 ||
        dt > 0.25
    ) {
        return;
    }

    // DeviceMotion rotationRate is degrees/second.
    //
    // The sign convention can vary slightly by device,
    // so the compass correction below continually pulls
    // the integrated heading back toward absolute north.

    state.sensors.gyroHeading =
        normalizeHeading(
            state.sensors.gyroHeading +
            rotationRate * dt
        );

    // Complementary filter.
    if (
        state.sensors.compassHeading !== null
    ) {

        const compass =
            state.sensors.compassHeading;

        const error =
            shortestAngleDifference(
                compass,
                state.sensors.gyroHeading
            );

        state.sensors.gyroHeading =
            normalizeHeading(
                state.sensors.gyroHeading +
                error *
                COMPASS_CORRECTION_WEIGHT
            );
    }

    state.sensors.fusedHeading =
        state.sensors.gyroHeading;
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

    if (
        typeof event.webkitCompassHeading ===
        "number"
    ) {

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

    heading =
        normalizeHeading(heading);

    const firstReading =
        !state.sensors.orientationData;

    state.sensors.orientationData = true;

    state.sensors.orientationReading = {

        alpha:
            Number.isFinite(event.alpha)
                ? event.alpha.toFixed(1)
                : "n/a",

        beta:
            Number.isFinite(event.beta)
                ? event.beta.toFixed(1)
                : "n/a",

        gamma:
            Number.isFinite(event.gamma)
                ? event.gamma.toFixed(1)
                : "n/a",

        heading:
            heading.toFixed(1)
    };

    // --------------------------------------------------------
    // Circular heading smoothing.
    // --------------------------------------------------------

    if (
        state.sensors.compassHeading === null
    ) {

        state.sensors.compassHeading =
            heading;

    } else {

        state.sensors.compassHeading =
            interpolateHeading(
                state.sensors.compassHeading,
                heading,
                HEADING_FILTER_ALPHA
            );
    }

    // --------------------------------------------------------
    // Initialize / correct gyro heading.
    // --------------------------------------------------------

    if (
        !state.sensors.headingInitialized
    ) {

        state.sensors.gyroHeading =
            state.sensors.compassHeading;

        state.sensors.fusedHeading =
            state.sensors.compassHeading;

        state.sensors.headingInitialized =
            true;

    } else if (
        state.sensors.gyroHeading === null
    ) {

        state.sensors.gyroHeading =
            state.sensors.compassHeading;
    }

    // If gyro isn't available, use the smoothed compass.
    if (!state.sensors.gyroAvailable) {

        state.sensors.fusedHeading =
            state.sensors.compassHeading;
    }

    const finalHeading =
        state.sensors.fusedHeading;

    if (state.mapping.active) {

        state.mapping.heading =
            finalHeading;
    }

    if (state.tracking.active) {

        state.tracking.heading =
            finalHeading;
    }

    if (
        firstReading ||
        performance.now() -
        lastSensorStatusUpdate >= 250
    ) {

        updateSensorStatus();
    }
}


// ============================================================
// STEP DETECTION
// ============================================================

function processStepDetection(magnitude) {

    const now =
        performance.now();

    // --------------------------------------------------------
    // Never create steps while completely stationary.
    // --------------------------------------------------------

    if (state.sensors.isStationary) {

        state.sensors.stepPeak =
            Math.max(
                state.sensors.stepPeak * 0.9,
                magnitude
            );

        state.sensors.stepValley =
            magnitude;

        return;
    }

    // --------------------------------------------------------
    // Track local peak.
    // --------------------------------------------------------

    state.sensors.stepPeak =
        Math.max(
            state.sensors.stepPeak * 0.92,
            magnitude
        );

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
        previous <= STEP_THRESHOLD;

    // Additional peak requirement.
    const strongEnough =
        magnitude >= STEP_PEAK_THRESHOLD ||
        state.sensors.stepPeak >= STEP_PEAK_THRESHOLD;

    if (
        rising &&
        cooldownPassed &&
        strongEnough
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
// ADAPTIVE STEP LENGTH
// ============================================================

function getAdaptiveStepLength() {

    const intervals =
        state.sensors.stepIntervals;

    if (
        intervals.length < 2
    ) {

        return STEP_LENGTH;
    }

    const recent =
        intervals
            .slice(-5)
            .filter(
                value =>
                    value >= MIN_STEP_INTERVAL &&
                    value <= MAX_STEP_INTERVAL
            );

    if (!recent.length) {
        return STEP_LENGTH;
    }

    const average =
        recent.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        recent.length;

    // Faster walking -> slightly longer step.
    //
    // This is deliberately conservative because
    // step frequency is only an approximation of
    // actual stride length.

    const normalized =
        clamp(
            (600 - average) / 250,
            -1,
            1
        );

    const adaptive =
        STEP_LENGTH +
        normalized * 0.10;

    return clamp(
        adaptive,
        MIN_STEP_LENGTH,
        MAX_STEP_LENGTH
    );
}


function recordStepTiming(now) {

    if (
        state.sensors.lastStepTimestamp > 0
    ) {

        const interval =
            now -
            state.sensors.lastStepTimestamp;

        if (
            interval >= MIN_STEP_INTERVAL &&
            interval <= MAX_STEP_INTERVAL
        ) {

            state.sensors.stepIntervals.push(
                interval
            );

            if (
                state.sensors.stepIntervals.length >
                8
            ) {

                state.sensors.stepIntervals.shift();
            }
        }
    }

    state.sensors.lastStepTimestamp =
        now;
}


// ============================================================
// MOVEMENT
// ============================================================

function registerMappingStep() {

    const now =
        performance.now();

    recordStepTiming(now);

    const stepLength =
        getAdaptiveStepLength();

    const heading =
        state.mapping.heading *
        DEG_TO_RAD;

    state.mapping.x +=
        Math.sin(heading) *
        stepLength;

    state.mapping.y +=
        Math.cos(heading) *
        stepLength;

    state.mapping.distance +=
        stepLength;

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

    recordStepTiming(now);

    const stepLength =
        getAdaptiveStepLength();

    const heading =
        state.tracking.heading *
        DEG_TO_RAD;

    state.tracking.x +=
        Math.sin(heading) *
        stepLength;

    state.tracking.y +=
        Math.cos(heading) *
        stepLength;

    state.tracking.distance +=
        stepLength;

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

    resetSensorFusion();

    state.mapping.active = true;

    state.mapping.x =
        state.workstation.x;

    state.mapping.y =
        state.workstation.y;

    state.mapping.heading =
        state.sensors.fusedHeading || 0;

    state.mapping.distance = 0;

    state.mapping.path = [

        {
            x: state.mapping.x,
            y: state.mapping.y
        }

    ];

    state.mapping.references = [];

    state.mapping.lastStepTime =
        performance.now();

    state.mapping.lastStepAcceleration = 0;

    drawMapping();

    updateMappingInformation();

    const startButton =
        get("startMappingButton");

    if (startButton) {

        startButton.textContent =
            "STOP MAPPING";

        startButton.classList.add(
            "active"
        );
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

    saveState();

    updateMappingInformation();
}


async function resetMapping() {

    stopMapping();

    resetSensorFusion();

    await startMapping();
}


// ============================================================
// RESET SENSOR FUSION
// ============================================================

function resetSensorFusion() {

    gravityVectorBaseline = null;

    state.sensors.filteredAcceleration = 0;

    state.sensors.stationarySince = 0;

    state.sensors.isStationary = false;

    state.sensors.stepPeak = 0;

    state.sensors.stepValley = 0;

    state.sensors.lastStepTimestamp = 0;

    state.sensors.stepIntervals = [];

    state.sensors.lastGyroTimestamp = 0;

    if (
        state.sensors.compassHeading !== null
    ) {

        state.sensors.gyroHeading =
            state.sensors.compassHeading;

        state.sensors.fusedHeading =
            state.sensors.compassHeading;

        state.sensors.headingInitialized =
            true;
    }
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

    if (
        !Array.isArray(path) ||
        path.length === 0
    ) {

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


function getMapAreaBounds() {

    if (
        state.locked &&
        state.plan.calibrationBounds
    ) {

        return state.plan.calibrationBounds;
    }

    return calculatePathBounds([

        ...state.mapping.path,

        ...state.mapping.references,

        {
            x: state.mapping.x,
            y: state.mapping.y
        }
    ]);
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

    if (
        image &&
        image.complete &&
        image.naturalWidth > 0
    ) {

        const imageScale =
            Math.min(
                width / image.naturalWidth,
                height / image.naturalHeight
            );

        const imageWidth =
            image.naturalWidth *
            imageScale;

        const imageHeight =
            image.naturalHeight *
            imageScale;

        context.drawImage(

            image,

            (width - imageWidth) / 2,

            (height - imageHeight) / 2,

            imageWidth,

            imageHeight
        );
    }

    const path =
        state.mapping.path;

    const bounds =
        getMapAreaBounds();

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

    function mapAreaScreenPoint(x, y) {

        const point = {
            x: screenX(x),
            y: screenY(y)
        };

        return state.setupStep === 4
            ? transformMapAreaPoint(
                point,
                width,
                height
            )
            : point;
    }

    if (state.setupStep !== 4) {

        const rawGridInterval =
            80 / scale;

        const gridMagnitude =
            10 ** Math.floor(
                Math.log10(rawGridInterval)
            );

        const normalizedGridInterval =
            rawGridInterval /
            gridMagnitude;

        const gridFactor =
            normalizedGridInterval <= 1
                ? 1
                : normalizedGridInterval <= 2
                    ? 2
                    : normalizedGridInterval <= 5
                        ? 5
                        : 10;

        const gridInterval =
            gridFactor *
            gridMagnitude;

        const scaleDisplay =
            document.querySelector(
                "[data-mapping-scale]"
            );

        if (scaleDisplay) {

            scaleDisplay.textContent =
                `${Number(
                    gridInterval.toPrecision(2)
                )} m per grid`;
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
            Math.ceil(
                bounds.minX /
                gridInterval
            ) *
            gridInterval;

        for (
            let x = firstXTick;
            x <= bounds.maxX;
            x += gridInterval
        ) {

            const pixelX =
                screenX(x);

            context.beginPath();

            context.moveTo(
                pixelX,
                CANVAS_PADDING
            );

            context.lineTo(
                pixelX,
                height -
                CANVAS_PADDING
            );

            context.stroke();

            context.fillText(
                `${Number(
                    x.toPrecision(3)
                )}`,
                pixelX,
                height - 18
            );
        }

        const firstYTick =
            Math.ceil(
                bounds.minY /
                gridInterval
            ) *
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

            context.moveTo(
                CANVAS_PADDING,
                pixelY
            );

            context.lineTo(
                width -
                CANVAS_PADDING,
                pixelY
            );

            context.stroke();

            context.fillText(
                `${Number(
                    y.toPrecision(3)
                )}`,
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
            width -
            CANVAS_PADDING -
            36,
            height - 8
        );

        context.fillText(
            "Y (m)",
            8,
            CANVAS_PADDING - 12
        );
    }

    // --------------------------------------------------------
    // Path
    // --------------------------------------------------------

    if (path.length > 1) {

        context.beginPath();

        path.forEach(
            (point, index) => {

                const screenPoint =
                    mapAreaScreenPoint(
                        safeNumber(point.x),
                        safeNumber(point.y)
                    );

                if (index === 0) {

                    context.moveTo(
                        screenPoint.x,
                        screenPoint.y
                    );

                } else {

                    context.lineTo(
                        screenPoint.x,
                        screenPoint.y
                    );
                }
            }
        );

        context.strokeStyle =
            "#ffffff";

        context.lineWidth = 3;

        context.stroke();
    }

    // --------------------------------------------------------
    // Reference points
    // --------------------------------------------------------

    state.mapping.references.forEach(
        (reference, index) => {

            const screenPoint =
                mapAreaScreenPoint(
                    reference.x,
                    reference.y
                );

            context.beginPath();

            context.arc(
                screenPoint.x,
                screenPoint.y,
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
                screenPoint.x + 10,
                screenPoint.y - 10
            );
        }
    );

    // --------------------------------------------------------
    // Current position
    // --------------------------------------------------------

    const currentPoint =
        mapAreaScreenPoint(
            state.mapping.x,
            state.mapping.y
        );

    context.beginPath();

    context.arc(
        currentPoint.x,
        currentPoint.y,
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

    // --------------------------------------------------------
    // Starting position
    // --------------------------------------------------------

    const start =
        path.length > 0
            ? path[0]
            : {
                x: 0,
                y: 0
            };

    const startPoint =
        mapAreaScreenPoint(
            start.x,
            start.y
        );

    context.beginPath();

    context.arc(
        startPoint.x,
        startPoint.y,
        6,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#ffffff";

    context.fill();

    context.font =
        "12px sans-serif";

    context.fillText(
        "START",
        startPoint.x + 10,
        startPoint.y + 4
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

    if (
        state.locked &&
        map.id !== state.plan.selectedMapId
    ) {

        alert(
            "Reset the setup before changing the locked floor map."
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
                drawTracking();
            };

        image.onerror =
            () => {

                if (loadStatus) {

                    loadStatus.textContent =
                        `Could not load floor map: ${map.image}`;
                }

                drawMapping();
                drawTracking();
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

function transformMapAreaPoint(
    point,
    width,
    height
) {

    const transform =
        state.plan.imageTransform;

    const offsetX =
        point.x -
        width / 2;

    const offsetY =
        point.y -
        height / 2;

    const rotation =
        transform.rotation *
        DEG_TO_RAD;

    return {

        x:
            width / 2 +
            transform.x +
            (
                offsetX *
                Math.cos(rotation) -
                offsetY *
                Math.sin(rotation)
            ) *
            transform.scale,

        y:
            height / 2 +
            transform.y +
            (
                offsetX *
                Math.sin(rotation) +
                offsetY *
                Math.cos(rotation)
            ) *
            transform.scale
    };
}


function updateImageTransform() {

    const transform =
        state.plan.imageTransform;

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


function setupMapGestureControls() {

    const canvas =
        get("alignmentCanvas");

    if (!canvas) {
        return;
    }

    const pointers =
        new Map();

    let gestureStart = null;

    function getCanvasPoint(event) {

        const rect =
            canvas.getBoundingClientRect();

        return {

            x:
                event.clientX -
                rect.left,

            y:
                event.clientY -
                rect.top
        };
    }

    function getGestureMetrics(points) {

        const first =
            points[0];

        const second =
            points.length > 1
                ? points[1]
                : first;

        return {

            center: {

                x:
                    (first.x +
                        second.x) / 2,

                y:
                    (first.y +
                        second.y) / 2
            },

            distance:
                Math.hypot(
                    second.x -
                    first.x,

                    second.y -
                    first.y
                )
        };
    }

    function captureGestureStart() {

        const points =
            Array.from(
                pointers.values()
            ).slice(0, 2);

        if (points.length === 0) {

            gestureStart =
                null;

            return;
        }

        const metrics =
            getGestureMetrics(points);

        gestureStart = {

            points,

            center:
                metrics.center,

            distance:
                metrics.distance,

            x:
                state.plan.imageTransform.x,

            y:
                state.plan.imageTransform.y,

            scale:
                state.plan.imageTransform.scale
        };
    }

    canvas.addEventListener(
        "pointerdown",
        event => {

            if (state.locked) {
                return;
            }

            if (
                event.pointerType === "mouse" &&
                event.button !== 0
            ) {
                return;
            }

            pointers.set(
                event.pointerId,
                getCanvasPoint(event)
            );

            try {
                canvas.setPointerCapture(
                    event.pointerId
                );
            } catch {
                // Synthetic pointer events.
            }

            canvas.classList.add(
                "is-dragging"
            );

            captureGestureStart();
        }
    );

    canvas.addEventListener(
        "pointermove",
        event => {

            if (
                !pointers.has(
                    event.pointerId
                ) ||
                !gestureStart
            ) {
                return;
            }

            pointers.set(
                event.pointerId,
                getCanvasPoint(event)
            );

            const points =
                Array.from(
                    pointers.values()
                ).slice(0, 2);

            const current =
                getGestureMetrics(points);

            const transform =
                state.plan.imageTransform;

            if (points.length === 1) {

                transform.x =
                    gestureStart.x +
                    points[0].x -
                    gestureStart.points[0].x;

                transform.y =
                    gestureStart.y +
                    points[0].y -
                    gestureStart.points[0].y;

            } else {

                if (
                    gestureStart.distance > 0
                ) {

                    transform.scale =
                        clamp(
                            gestureStart.scale *
                            current.distance /
                            gestureStart.distance,

                            0.1,
                            10
                        );
                }

                transform.x =
                    gestureStart.x +
                    current.center.x -
                    gestureStart.center.x;

                transform.y =
                    gestureStart.y +
                    current.center.y -
                    gestureStart.center.y;
            }

            updateImageTransform();
        }
    );

    function finishPointer(event) {

        if (
            !pointers.has(
                event.pointerId
            )
        ) {
            return;
        }

        pointers.delete(
            event.pointerId
        );

        if (pointers.size > 0) {

            captureGestureStart();

        } else {

            gestureStart =
                null;

            canvas.classList.remove(
                "is-dragging"
            );

            saveState();
        }

        try {

            canvas.releasePointerCapture(
                event.pointerId
            );

        } catch {
            // Synthetic pointer events.
        }
    }

    canvas.addEventListener(
        "pointerup",
        finishPointer
    );

    canvas.addEventListener(
        "pointercancel",
        finishPointer
    );

    canvas.addEventListener(
        "wheel",
        event => {

            if (state.locked) {
                return;
            }

            event.preventDefault();

            const rect =
                canvas.getBoundingClientRect();

            const pointerX =
                event.clientX -
                rect.left -
                rect.width / 2;

            const pointerY =
                event.clientY -
                rect.top -
                rect.height / 2;

            const transform =
                state.plan.imageTransform;

            const oldScale =
                transform.scale;

            const newScale =
                clamp(
                    oldScale *
                    Math.exp(
                        -event.deltaY *
                        0.001
                    ),

                    0.1,
                    10
                );

            const ratio =
                newScale /
                oldScale;

            transform.x =
                pointerX -
                (
                    pointerX -
                    transform.x
                ) *
                ratio;

            transform.y =
                pointerY -
                (
                    pointerY -
                    transform.y
                ) *
                ratio;

            transform.scale =
                newScale;

            updateImageTransform();

            saveState();
        },
        {
            passive: false
        }
    );
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

    if (state.locked) {
        return;
    }

    state.plan.imageTransform.rotation +=
        amount;

    updateImageTransform();

    saveState();
}


// ============================================================
// RESET IMAGE ALIGNMENT
// ============================================================

function resetImageAlignment() {

    if (state.locked) {
        return;
    }

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

    state.plan.calibrationBounds =
        calculatePathBounds([

            ...state.mapping.path,

            ...state.mapping.references,

            {
                x: state.mapping.x,
                y: state.mapping.y
            }
        ]);

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

        element.textContent =
            state.locked
                ? "Setup locked"
                : "Setup not locked";
    });

    [
        "mapRotateLeft",
        "mapRotateRight",
        "resetMapAlignment",
        "lockSetupButton"
    ].forEach(id => {

        const button =
            get(id);

        if (button) {

            button.disabled =
                state.locked;
        }
    });

    const floorMapSelect =
        get("setupFloorMapSelect");

    if (floorMapSelect) {

        floorMapSelect.disabled =
            state.locked;
    }

    const mapElements =
        document.querySelectorAll(
            "[data-setup-map-name]"
        );

    mapElements.forEach(element => {

        element.textContent =
            state.plan.imageName ||
            "No map selected";
    });

    document
        .querySelectorAll(
            "[data-track-map-name]"
        )
        .forEach(element => {

            element.textContent =
                state.plan.imageName ||
                "No floor map selected";
        });
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

    state.tracking.x =
        state.workstation.x;

    state.tracking.y =
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

    state.setupStep = 2;

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

        calibrationBounds: null,

        imageTransform: {

            x: 0,
            y: 0,

            scale: 1,

            rotation: 0
        }
    };

    state.locked = false;

    resetSensorFusion();

    saveState();

    location.reload();
}


// ============================================================
// EVENT CONNECTIONS
// ============================================================

function showPage(pageName) {

    const showTracking =
        pageName === "track";

    const setupPage =
        get("setupPage");

    const trackPage =
        get("trackPage");

    if (setupPage) {

        setupPage.classList.toggle(
            "active",
            !showTracking
        );
    }

    if (trackPage) {

        trackPage.classList.toggle(
            "active",
            showTracking
        );
    }

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page ===
                pageName
            );
        });

    const lockedMessage =
        get("trackLockedMessage");

    if (lockedMessage) {

        lockedMessage.style.display =
            showTracking &&
            !state.locked
                ? ""
                : "none";
    }

    const trackingApplication =
        get("trackingApplication");

    if (trackingApplication) {

        trackingApplication.style.display =
            showTracking &&
            state.locked
                ? ""
                : "none";
    }

    if (
        showTracking &&
        state.locked
    ) {

        drawTracking();
    }
}


function setupEventListeners() {

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    showPage(
                        button.dataset.page
                    )
            );
        });

    const goSetupButton =
        get("goSetupBtn");

    if (goSetupButton) {

        goSetupButton.addEventListener(
            "click",
            () =>
                showPage("setup")
        );
    }

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
            () => {

                if (
                    state.mapping.active
                ) {

                    stopMapping();

                } else {

                    startMapping();
                }
            }
        );
    }

    const resetMappingButton =
        get("resetMappingButton");

    if (resetMappingButton) {

        resetMappingButton.addEventListener(
            "click",
            resetMapping
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

    setupMapGestureControls();

    const rotateMapLeft =
        get("mapRotateLeft");

    if (rotateMapLeft) {

        rotateMapLeft.addEventListener(
            "click",
            () =>
                rotateImage(-2)
        );
    }

    const rotateMapRight =
        get("mapRotateRight");

    if (rotateMapRight) {

        rotateMapRight.addEventListener(
            "click",
            () =>
                rotateImage(2)
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

                        showSetupStep(
                            step
                        );
                    }
                }
            );
        });

    setupTrackingEventListeners();
}


// ============================================================
// RESIZE
// ============================================================

function handleResize() {

    drawMapping();

    if (
        typeof drawTracking ===
        "function"
    ) {

        drawTracking();
    }

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

    // IMPORTANT:
    // Do NOT overwrite the saved workstation here.
    //
    // The old version contained:
    //
    // state.workstation = { x: 0, y: 0 };
    //
    // which destroyed the saved origin every time
    // the application started.

    if (
        !Number.isFinite(
            state.workstation.x
        )
    ) {

        state.workstation.x = 0;
    }

    if (
        !Number.isFinite(
            state.workstation.y
        )
    ) {

        state.workstation.y = 0;
    }

    if (
        state.locked &&
        !state.plan.calibrationBounds
    ) {

        state.plan.calibrationBounds =
            calculatePathBounds([

                ...state.mapping.path,

                ...state.mapping.references,

                {
                    x: state.workstation.x,
                    y: state.workstation.y
                }
            ]);
    }

    setupEventListeners();

    populateFloorMaps();

    updateMappingInformation();

    updateTrackingInformation();

    updateSensorStatus();

    updateSetupStatus();

    updateImageTransform();

    drawMapping();

    drawTracking();

    showSetupStep(
        state.setupStep || 2
    );
}


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);

// ============================================================
// LIVE TRACKING
// ============================================================
//
// Tracking uses the SAME world X/Y coordinate system as mapping.
//
// Sensors are handled by app.js:
//   - accelerometer
//   - compass
//   - gyroscope
//   - step detection
//   - adaptive step length
//
// This file is responsible for:
//   - starting/stopping tracking
//   - tracking display
//   - drawing the path
//   - displaying X/Y/distance
// ============================================================


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

    resetSensorFusion();

    state.tracking.active =
        true;

    // --------------------------------------------------------
    // Tracking ALWAYS starts at the defined workstation origin.
    // --------------------------------------------------------

    state.tracking.x =
        state.workstation.x;

    state.tracking.y =
        state.workstation.y;

    // Use current fused sensor heading.
    state.tracking.heading =
        Number.isFinite(
            state.sensors.fusedHeading
        )
            ? state.sensors.fusedHeading
            : 0;

    state.tracking.distance =
        0;

    state.tracking.path = [

        {
            x: state.tracking.x,
            y: state.tracking.y
        }

    ];

    state.tracking.lastStepTime =
        performance.now();

    state.tracking.lastStepAcceleration =
        0;

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

    state.tracking.active =
        false;

    const button =
        get("startTrackingButton");

    if (button) {

        button.textContent =
            "START TRACKING";

        button.classList.remove(
            "active"
        );
    }

    saveState();
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


    // Optional heading display if the HTML later
    // contains [data-tracking-heading].

    const headingElements =
        document.querySelectorAll(
            "[data-tracking-heading]"
        );

    headingElements.forEach(element => {

        element.textContent =
            `${normalizeHeading(
                state.tracking.heading
            ).toFixed(1)}°`;
    });


    // Optional sensor status if the HTML later
    // contains [data-tracking-sensor-status].

    const sensorElements =
        document.querySelectorAll(
            "[data-tracking-sensor-status]"
        );

    sensorElements.forEach(element => {

        const gyro =
            state.sensors.gyroAvailable
                ? "GYRO"
                : "NO GYRO";

        const stationary =
            state.sensors.isStationary
                ? "STATIONARY"
                : "MOVING";

        element.textContent =
            `${gyro} / ${stationary}`;
    });
}


// ============================================================
// TRACKING DRAW
// ============================================================

function drawTracking() {

    const result =
        getCanvas(
            "trackingCanvas"
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

    // --------------------------------------------------------
    // Floor image.
    // --------------------------------------------------------

    const image =
        document.querySelector(
            "[data-floor-map-image]"
        );

    if (
        image &&
        !image.complete
    ) {

        image.onload =
            () => drawTracking();

        return;
    }

    // --------------------------------------------------------
    // If the floor map exists, draw it.
    // --------------------------------------------------------

    if (
        image &&
        image.complete &&
        image.naturalWidth > 0
    ) {

        const imageScale =
            Math.min(
                width / image.naturalWidth,
                height / image.naturalHeight
            );

        const imageWidth =
            image.naturalWidth *
            imageScale;

        const imageHeight =
            image.naturalHeight *
            imageScale;

        context.drawImage(

            image,

            (width -
                imageWidth) / 2,

            (height -
                imageHeight) / 2,

            imageWidth,
            imageHeight
        );
    }

    // --------------------------------------------------------
    // Path.
    // --------------------------------------------------------

    const path =
        state.tracking.path;

    if (
        !Array.isArray(path) ||
        path.length === 0
    ) {

        return;
    }

    // --------------------------------------------------------
    // World bounds.
    //
    // IMPORTANT:
    // We use the locked mapping bounds.
    // This prevents the display from changing scale
    // while the user walks.
    // --------------------------------------------------------

    const bounds =
        getMapAreaBounds();

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

            (width -
                CANVAS_PADDING * 2) /
                rangeX,

            (height -
                CANVAS_PADDING * 2) /
                rangeY
        );


    function screenX(x) {

        return (
            CANVAS_PADDING +
            (x -
                bounds.minX) *
            scale
        );
    }


    function screenY(y) {

        return (
            height -
            CANVAS_PADDING -
            (y -
                bounds.minY) *
            scale
        );
    }


    function alignedPoint(
        x,
        y
    ) {

        return transformMapAreaPoint(

            {
                x:
                    screenX(x),

                y:
                    screenY(y)
            },

            width,
            height
        );
    }


    // --------------------------------------------------------
    // Grid.
    // --------------------------------------------------------

    const rawGridInterval =
        80 / scale;

    const gridMagnitude =
        10 **
        Math.floor(
            Math.log10(
                Math.max(
                    rawGridInterval,
                    0.001
                )
            )
        );

    const normalizedGridInterval =
        rawGridInterval /
        gridMagnitude;

    const gridFactor =
        normalizedGridInterval <= 1
            ? 1
            : normalizedGridInterval <= 2
                ? 2
                : normalizedGridInterval <= 5
                    ? 5
                    : 10;

    const gridInterval =
        gridFactor *
        gridMagnitude;


    context.strokeStyle =
        "rgba(255,255,255,0.12)";

    context.lineWidth = 1;


    const firstXTick =
        Math.ceil(
            bounds.minX /
            gridInterval
        ) *
        gridInterval;


    for (
        let x = firstXTick;
        x <= bounds.maxX;
        x += gridInterval
    ) {

        const pointA =
            alignedPoint(
                x,
                bounds.minY
            );

        const pointB =
            alignedPoint(
                x,
                bounds.maxY
            );

        context.beginPath();

        context.moveTo(
            pointA.x,
            pointA.y
        );

        context.lineTo(
            pointB.x,
            pointB.y
        );

        context.stroke();
    }


    const firstYTick =
        Math.ceil(
            bounds.minY /
            gridInterval
        ) *
        gridInterval;


    for (
        let y = firstYTick;
        y <= bounds.maxY;
        y += gridInterval
    ) {

        const pointA =
            alignedPoint(
                bounds.minX,
                y
            );

        const pointB =
            alignedPoint(
                bounds.maxX,
                y
            );

        context.beginPath();

        context.moveTo(
            pointA.x,
            pointA.y
        );

        context.lineTo(
            pointB.x,
            pointB.y
        );

        context.stroke();
    }


    // --------------------------------------------------------
    // Tracking path.
    // --------------------------------------------------------

    if (path.length > 1) {

        context.beginPath();

        path.forEach(
            (point, index) => {

                const screenPoint =
                    alignedPoint(
                        point.x,
                        point.y
                    );

                if (index === 0) {

                    context.moveTo(
                        screenPoint.x,
                        screenPoint.y
                    );

                } else {

                    context.lineTo(
                        screenPoint.x,
                        screenPoint.y
                    );
                }
            }
        );

        context.strokeStyle =
            "#00d4ff";

        context.lineWidth = 4;

        context.lineJoin =
            "round";

        context.lineCap =
            "round";

        context.stroke();
    }


    // --------------------------------------------------------
    // Starting position.
    // --------------------------------------------------------

    const start =
        path[0];

    const startPoint =
        alignedPoint(
            start.x,
            start.y
        );

    context.beginPath();

    context.arc(
        startPoint.x,
        startPoint.y,
        7,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#ffffff";

    context.fill();

    context.font =
        "12px sans-serif";

    context.fillText(
        "START",
        startPoint.x + 10,
        startPoint.y + 4
    );


    // --------------------------------------------------------
    // Current position.
    // --------------------------------------------------------

    const currentPoint =
        alignedPoint(
            state.tracking.x,
            state.tracking.y
        );


    // Direction line.
    //
    // This makes it easier to visually see whether the
    // phone thinks you are facing the correct direction.

    const heading =
        state.tracking.heading *
        DEG_TO_RAD;

    const directionLength =
        28;

    const directionEnd = {

        x:
            currentPoint.x +
            Math.sin(heading) *
            directionLength,

        y:
            currentPoint.y -
            Math.cos(heading) *
            directionLength
    };


    context.beginPath();

    context.moveTo(
        currentPoint.x,
        currentPoint.y
    );

    context.lineTo(
        directionEnd.x,
        directionEnd.y
    );

    context.strokeStyle =
        "#ffffff";

    context.lineWidth = 3;

    context.stroke();


    // Position circle.

    context.beginPath();

    context.arc(
        currentPoint.x,
        currentPoint.y,
        11,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        state.sensors.isStationary
            ? "#ffaa00"
            : "#00ff88";

    context.fill();

    context.strokeStyle =
        "#ffffff";

    context.lineWidth = 3;

    context.stroke();


    // --------------------------------------------------------
    // Position text.
    // --------------------------------------------------------

    context.fillStyle =
        "#ffffff";

    context.font =
        "12px sans-serif";

    context.fillText(

        `X ${state.tracking.x.toFixed(2)} m`,

        currentPoint.x + 16,

        currentPoint.y - 12
    );

    context.fillText(

        `Y ${state.tracking.y.toFixed(2)} m`,

        currentPoint.x + 16,

        currentPoint.y + 4
    );

    context.fillText(

        `${normalizeHeading(
            state.tracking.heading
        ).toFixed(0)}°`,

        currentPoint.x + 16,

        currentPoint.y + 20
    );
}


// ============================================================
// TRACKING EVENT LISTENERS
// ============================================================

function setupTrackingEventListeners() {

    const trackingButton =
        get("startTrackingButton");

    if (trackingButton) {

        trackingButton.addEventListener(
            "click",
            () => {

                if (
                    state.tracking.active
                ) {

                    stopTracking();

                } else {

                    startTracking();
                }
            }
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
}
