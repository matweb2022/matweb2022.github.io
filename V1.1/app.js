/* =========================================================
   PRODUCTION FLOOR TRACKER
   V1.2
   ========================================================= */


/* =========================================================
   BASIC HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const state = {

    world: {
        width: 40,
        height: 25,
        originName: "My workstation"
    },

    settings: {
        stepLength: 0.72,
        sensitivity: 1.15,
        headingOffset: 0
    },

    pos: {
        x: 0,
        y: 0,
        heading: 0,
        speed: 0
    },

    distance: 0,

    tracking: false,

    trackingStarted: null,

    lastSample: null,

    trail: [],

    samples: [],

    checkpoints: [],

    areas: [],

    areaTime: {},

    currentArea: null,

    calibration: {
        locked: false,
        points: [],
        matrix: null
    },

    pdf: {
        fileName: null,
        page: 1,
        width: 0,
        height: 0,
        scale: 1,
        fileObject: null
    },

    sensor: {
        motion: false,
        orientation: false
    },

    calibrationMode: false,

    areaMode: false,

    areaDraft: [],


    /* =====================================================
       SETUP
       ===================================================== */

    setup: {

        currentStep: 0,

        completed: {
            project: false,
            pdf: false,
            calibration: false,
            mapping: false,
            iphone: false,
            test: false
        },

        test: {

            active: false,

            startedAt: null,

            startPos: null,

            startDistance: 0,

            startHeading: 0,

            startSampleCount: 0,

            result: null

        }

    }

};


/* =========================================================
   PDF.JS
   ========================================================= */

let pdfjsLib = null;

try {

    const mod = await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
    );

    pdfjsLib = mod;

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

} catch (e) {

    console.warn("PDF.js unavailable", e);

}


/* =========================================================
   SENSOR STATE
   ========================================================= */

let motion = {

    magnitude: 0,

    filtered: 0,

    lastPeak: 0,

    accelSamples: []

};

let headingDeg = 0;

let sensorsBound = false;


/* =========================================================
   STARTUP
   ========================================================= */

loadState();

bindUI();

registerServiceWorker();

drawWorld();

updateUI();

updateSetupUI();


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function saveState() {

    try {

        const safe = JSON.parse(
            JSON.stringify(state)
        );

        /*
         * File objects cannot be serialized.
         */
        safe.pdf.fileObject = null;

        localStorage.setItem(
            "productionTrackerV12",
            JSON.stringify(safe)
        );

    } catch (e) {

        console.warn(
            "Could not save application state:",
            e
        );

    }

}


function loadState() {

    try {

        const raw =
            localStorage.getItem("productionTrackerV12") ||
            localStorage.getItem("productionTrackerV11");

        if (!raw) {

            syncInputValues();

            return;
        }

        const saved = JSON.parse(raw);

        /*
         * Preserve defaults while allowing older
         * versions to load.
         */

        if (saved.world) {
            Object.assign(state.world, saved.world);
        }

        if (saved.settings) {
            Object.assign(state.settings, saved.settings);
        }

        if (saved.pos) {
            Object.assign(state.pos, saved.pos);
        }

        if (typeof saved.distance === "number") {
            state.distance = saved.distance;
        }

        if (typeof saved.tracking === "boolean") {
            state.tracking = saved.tracking;
        }

        if (saved.trackingStarted) {
            state.trackingStarted = saved.trackingStarted;
        }

        if (saved.lastSample) {
            state.lastSample = saved.lastSample;
        }

        if (Array.isArray(saved.trail)) {
            state.trail = saved.trail;
        }

        if (Array.isArray(saved.samples)) {
            state.samples = saved.samples;
        }

        if (Array.isArray(saved.checkpoints)) {
            state.checkpoints = saved.checkpoints;
        }

        if (Array.isArray(saved.areas)) {
            state.areas = saved.areas;
        }

        if (saved.areaTime) {
            state.areaTime = saved.areaTime;
        }

        if (saved.currentArea) {
            state.currentArea = saved.currentArea;
        }

        if (saved.calibration) {
            Object.assign(
                state.calibration,
                saved.calibration
            );
        }

        if (saved.pdf) {
            Object.assign(
                state.pdf,
                saved.pdf
            );
        }

        if (saved.sensor) {
            Object.assign(
                state.sensor,
                saved.sensor
            );

            /*
             * Sensor permissions are not persistent application
             * state. They must be requested again after reload.
             */
            state.sensor.motion = false;
            state.sensor.orientation = false;
        }

        if (saved.setup) {

            if (
                typeof saved.setup.currentStep === "number"
            ) {

                state.setup.currentStep =
                    Math.max(
                        0,
                        Math.min(
                            5,
                            saved.setup.currentStep
                        )
                    );

            }

            if (saved.setup.completed) {

                Object.assign(
                    state.setup.completed,
                    saved.setup.completed
                );

            }

            if (saved.setup.test) {

                Object.assign(
                    state.setup.test,
                    saved.setup.test
                );

            }

        }

        state.pdf.fileObject = null;

    } catch (e) {

        console.warn(
            "Could not load saved state:",
            e
        );

    }

    syncInputValues();

}


/* =========================================================
   INPUT SYNCHRONIZATION
   ========================================================= */

function syncInputValues() {

    if ($("originName")) {
        $("originName").value =
            state.world.originName;
    }

    if ($("worldWidth")) {
        $("worldWidth").value =
            state.world.width;
    }

    if ($("worldHeight")) {
        $("worldHeight").value =
            state.world.height;
    }

    if ($("stepLength")) {
        $("stepLength").value =
            state.settings.stepLength;
    }

    if ($("stepSensitivity")) {
        $("stepSensitivity").value =
            state.settings.sensitivity;
    }

    if ($("headingOffset")) {
        $("headingOffset").value =
            state.settings.headingOffset;
    }

    if ($("pdfPage")) {
        $("pdfPage").value =
            state.pdf.page || 1;
    }

    if ($("pdfZoom")) {
        $("pdfZoom").value =
            state.pdf.scale || 1;
    }

}


/* =========================================================
   UI BINDING
   ========================================================= */

function bindUI() {


    /* =====================================================
       MAIN TABS
       ===================================================== */

    document.querySelectorAll(".tab").forEach(button => {

        button.addEventListener("click", () => {

            const tab = button.dataset.tab;

            document.querySelectorAll(".tab")
                .forEach(b => b.classList.remove("active"));

            document.querySelectorAll(".panel")
                .forEach(p => p.classList.remove("active"));

            button.classList.add("active");

            const panel = $(tab);

            if (panel) {
                panel.classList.add("active");
            }

            if (tab === "setup") {
                updateSetupUI();
            }

            if (tab === "map") {
                drawMapOverlay();
            }

            if (tab === "areas") {
                renderAreas();
            }

        });

    });


    /* =====================================================
       SETUP SIDEBAR
       ===================================================== */

    document.querySelectorAll(".setupStep")
        .forEach(button => {

            button.addEventListener("click", () => {

                const step =
                    Number(button.dataset.setupStep);

                goToSetupStep(step);

            });

        });


    /* =====================================================
       SETUP NEXT / PREVIOUS
       ===================================================== */

    document.querySelectorAll("[data-setup-next]")
        .forEach(button => {

            button.addEventListener("click", () => {

                const current =
                    state.setup.currentStep;

                const next =
                    Math.min(5, current + 1);

                goToSetupStep(next);

            });

        });


    document.querySelectorAll("[data-setup-prev]")
        .forEach(button => {

            button.addEventListener("click", () => {

                const current =
                    state.setup.currentStep;

                const previous =
                    Math.max(0, current - 1);

                goToSetupStep(previous);

            });

        });


    /* =====================================================
       TRACKING
       ===================================================== */

    $("startBtn")?.addEventListener(
        "click",
        startTracking
    );

    $("stopBtn")?.addEventListener(
        "click",
        stopTracking
    );

    $("resetBtn")?.addEventListener(
        "click",
        resetPosition
    );


    /* =====================================================
       WORLD SETTINGS
       ===================================================== */

    $("saveWorldBtn")?.addEventListener(
        "click",
        saveWorldSettings
    );


    /* =====================================================
       SENSOR BUTTON
       ===================================================== */

    $("requestSensorsBtn")?.addEventListener(
        "click",
        requestSensors
    );


    /* =====================================================
       CHECKPOINTS
       ===================================================== */

    $("addCheckpointBtn")?.addEventListener(
        "click",
        addCheckpointAtCurrent
    );

    $("applyCheckpointBtn")?.addEventListener(
        "click",
        applyCheckpoint
    );


    /* =====================================================
       PDF
       ===================================================== */

    $("renderPdfBtn")?.addEventListener(
        "click",
        loadPDF
    );


    $("pdfZoom")?.addEventListener(
        "change",
        renderPDFPage
    );


    $("pdfPage")?.addEventListener(
        "change",
        renderPDFPage
    );


    /* =====================================================
       CALIBRATION
       ===================================================== */

    $("startCalibrationBtn")?.addEventListener(
        "click",
        startCalibration
    );

    $("finishCalibrationBtn")?.addEventListener(
        "click",
        finishCalibration
    );

    $("clearCalibrationBtn")?.addEventListener(
        "click",
        clearCalibration
    );


    /* =====================================================
       AREAS
       ===================================================== */

    $("startAreaBtn")?.addEventListener(
        "click",
        startArea
    );

    $("finishAreaBtn")?.addEventListener(
        "click",
        finishArea
    );


    $("worldCanvas")?.addEventListener(
        "click",
        worldCanvasClick
    );


    /* =====================================================
       DATA
       ===================================================== */

    $("exportCsvBtn")?.addEventListener(
        "click",
        exportCSV
    );

    $("exportJsonBtn")?.addEventListener(
        "click",
        exportJSON
    );

    $("importJsonBtn")?.addEventListener(
        "click",
        () => $("jsonFile")?.click()
    );

    $("jsonFile")?.addEventListener(
        "change",
        importJSON
    );


    /* =====================================================
       SETUP PDF
       ===================================================== */

    $("setupPdfFile")?.addEventListener(
        "change",
        setupPdfFileSelected
    );

    $("setupLoadPdfBtn")?.addEventListener(
        "click",
        setupLoadPDF
    );

    $("setupOpenMapBtn")?.addEventListener(
        "click",
        openMapTab
    );


    /* =====================================================
       SETUP CALIBRATION
       ===================================================== */

    $("setupStartCalibrationBtn")?.addEventListener(
        "click",
        startCalibration
    );

    $("setupFinishCalibrationBtn")?.addEventListener(
        "click",
        finishCalibration
    );

    $("setupClearCalibrationBtn")?.addEventListener(
        "click",
        clearCalibration
    );


    /* =====================================================
       FIRST TEST
       ===================================================== */

    $("setTestOriginBtn")?.addEventListener(
        "click",
        setTestOrigin
    );

    $("finishTestBtn")?.addEventListener(
        "click",
        finishFirstTest
    );


    /* =====================================================
       COMPLETE
       ===================================================== */

    $("goTrackBtn")?.addEventListener(
        "click",
        () => {

            activateTab("track");

        }
    );


    $("resetSetupBtn")?.addEventListener(
        "click",
        resetSetupStatus
    );


    /* =====================================================
       MAP OVERLAY
       ===================================================== */

    $("mapOverlay")?.addEventListener(
        "click",
        pdfCanvasClick
    );


    /* =====================================================
       SENSOR INPUT CHANGES
       ===================================================== */

    $("stepLength")?.addEventListener(
        "change",
        saveSensorSettings
    );

    $("stepSensitivity")?.addEventListener(
        "change",
        saveSensorSettings
    );

    $("headingOffset")?.addEventListener(
        "change",
        saveSensorSettings
    );

}


/* =========================================================
   MAIN TAB ACTIVATION
   ========================================================= */

function activateTab(tabName) {

    document.querySelectorAll(".tab")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.tab === tabName
            );

        });

    document.querySelectorAll(".panel")
        .forEach(panel => {

            panel.classList.toggle(
                "active",
                panel.id === tabName
            );

        });

}


/* =========================================================
   SETUP NAVIGATION
   ========================================================= */

function goToSetupStep(step) {

    step = Math.max(
        0,
        Math.min(5, Number(step) || 0)
    );

    state.setup.currentStep = step;

    saveState();

    updateSetupUI();

    const setupPanel = $("setup");

    if (
        setupPanel &&
        !setupPanel.classList.contains("active")
    ) {

        activateTab("setup");

    }

}


function updateSetupUI() {

    const step = state.setup.currentStep;

    const titles = [
        "Project setup",
        "PDF setup",
        "Mapping synchronization",
        "iPhone setup",
        "First iPhone test",
        "Setup complete"
    ];

    const subtitles = [
        "Define the physical coordinate system.",
        "Load the production floor PDF.",
        "Connect PDF coordinates to real-world metres.",
        "Enable the phone sensors used by the tracker.",
        "Walk a known distance and check the result.",
        "Review the complete setup checklist."
    ];


    if ($("setupTitle")) {
        $("setupTitle").textContent =
            titles[step];
    }

    if ($("setupSubtitle")) {
        $("setupSubtitle").textContent =
            subtitles[step];
    }


    const percentage =
        (step / 5) * 100;

    if ($("setupProgressBar")) {
        $("setupProgressBar").style.width =
            percentage + "%";
    }


    document.querySelectorAll(".setupStep")
        .forEach(button => {

            const buttonStep =
                Number(button.dataset.setupStep);

            button.classList.toggle(
                "active",
                buttonStep === step
            );

            button.classList.toggle(
                "completed",
                isSetupStepComplete(buttonStep)
            );

            const number =
                button.querySelector(".stepNumber");

            if (!number) return;

            if (isSetupStepComplete(buttonStep)) {
                number.textContent = "✓";
            } else {
                number.textContent =
                    String(buttonStep + 1);
            }

        });


    document.querySelectorAll(".setupPanel")
        .forEach(panel => {

            const panelStep =
                Number(panel.dataset.setupPanel);

            panel.classList.toggle(
                "active",
                panelStep === step
            );

        });


    updateSetupCompletion();

    updateProjectSetupUI();

    updatePDFSetupUI();

    updateCalibrationSetupUI();

    updateSensorSetupUI();

    updateTestSetupUI();

    updateSetupCompleteUI();

}


function isSetupStepComplete(step) {

    switch (step) {

        case 0:
            return state.setup.completed.project;

        case 1:
            return state.setup.completed.pdf;

        case 2:
            return state.setup.completed.calibration;

        case 3:
            return state.setup.completed.iphone;

        case 4:
            return state.setup.completed.test;

        case 5:
            return (
                state.setup.completed.project &&
                state.setup.completed.pdf &&
                state.setup.completed.calibration &&
                state.setup.completed.iphone &&
                state.setup.completed.test
            );

        default:
            return false;

    }

}


/* =========================================================
   PROJECT SETUP
   ========================================================= */

function saveWorldSettings() {

    const originName =
        $("originName")?.value.trim() ||
        "My workstation";

    const width =
        Number($("worldWidth")?.value);

    const height =
        Number($("worldHeight")?.value);


    if (
        !Number.isFinite(width) ||
        width <= 0
    ) {

        alert("Enter a valid world width.");

        return;
    }


    if (
        !Number.isFinite(height) ||
        height <= 0
    ) {

        alert("Enter a valid world height.");

        return;
    }


    state.world.originName =
        originName;

    state.world.width =
        width;

    state.world.height =
        height;


    state.setup.completed.project = true;

    saveState();

    drawWorld();

    updateUI();

    updateSetupUI();

    $("status").textContent =
        "Project configured";

}


function updateProjectSetupUI() {

    const complete =
        state.setup.completed.project;


    setSetupCheck(
        "projectCheckOrigin",
        complete
    );

    setSetupCheck(
        "projectCheckSize",
        complete
    );


    if ($("setupProjectStatus")) {

        setSetupStatus(
            $("setupProjectStatus"),
            complete,
            complete
                ? "Project coordinate system is ready."
                : "Project settings have not been saved yet."
        );

    }

}


/* =========================================================
   SENSOR SETTINGS
   ========================================================= */

function saveSensorSettings() {

    state.settings.stepLength =
        Number($("stepLength")?.value) || 0.72;

    state.settings.sensitivity =
        Number($("stepSensitivity")?.value) || 1.15;

    state.settings.headingOffset =
        Number($("headingOffset")?.value) || 0;

    saveState();

}


/* =========================================================
   SENSOR PERMISSIONS
   ========================================================= */

async function requestSensors() {

    try {

        $("sensorStatus").textContent =
            "Requesting iPhone sensor permissions...";


        /*
         * iOS requires these permission requests to happen
         * from a user gesture.
         */

        if (
            typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceMotionEvent.requestPermission();

            if (permission !== "granted") {

                throw new Error(
                    "Motion permission denied."
                );

            }

        }


        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

            const permission =
                await DeviceOrientationEvent.requestPermission();

            if (permission !== "granted") {

                throw new Error(
                    "Orientation permission denied."
                );

            }

        }


        if (!sensorsBound) {

            window.addEventListener(
                "devicemotion",
                onMotion,
                true
            );

            window.addEventListener(
                "deviceorientation",
                onOrientation,
                true
            );

            sensorsBound = true;

        }


        state.sensor.motion = true;

        state.sensor.orientation = true;

        state.setup.completed.iphone = true;


        $("sensorStatus").textContent =
            "Sensors enabled. Motion and orientation are ready.";

        $("status").textContent =
            "Sensors ready";


        saveState();

        updateSetupUI();

        updateUI();

    } catch (e) {

        state.sensor.motion = false;

        state.sensor.orientation = false;

        $("sensorStatus").textContent =
            "Sensor permission failed: " +
            e.message;

        $("status").textContent =
            "Sensor permission failed";

        updateSetupUI();

    }

}


function updateSensorSetupUI() {

    const complete =
        state.setup.completed.iphone;

    const status =
        $("sensorStatus");

    if (!status) return;


    if (complete) {

        status.textContent =
            "Sensors enabled. Motion and orientation are ready.";

    }

}


/* =========================================================
   ORIENTATION
   ========================================================= */

function onOrientation(event) {

    let heading = null;


    if (
        event.webkitCompassHeading != null
    ) {

        heading =
            event.webkitCompassHeading;

    } else if (
        event.alpha != null
    ) {

        heading =
            (360 - event.alpha) % 360;

    }


    if (
        heading != null &&
        Number.isFinite(heading)
    ) {

        const offset =
            Number($("headingOffset")?.value) ||
            state.settings.headingOffset ||
            0;

        headingDeg =
            normalizeAngle(
                heading + offset
            );

        state.pos.heading =
            headingDeg;

        if (state.tracking) {

            updateUI();

        }

    }

}


/* =========================================================
   MOTION / STEP DETECTION
   ========================================================= */

function onMotion(event) {

    if (!state.tracking) {
        return;
    }


    const acceleration =
        event.accelerationIncludingGravity;

    if (!acceleration) {
        return;
    }


    const x =
        acceleration.x || 0;

    const y =
        acceleration.y || 0;

    const z =
        acceleration.z || 0;


    const magnitude =
        Math.sqrt(
            x * x +
            y * y +
            z * z
        );


    motion.filtered =
        motion.filtered * 0.85 +
        magnitude * 0.15;


    motion.accelSamples.push(
        motion.filtered
    );


    if (
        motion.accelSamples.length > 20
    ) {

        motion.accelSamples.shift();

    }


    const now =
        performance.now();


    const sensitivity =
        Number(
            $("stepSensitivity")?.value
        ) ||
        state.settings.sensitivity ||
        1.15;


    const baseline = 9.81;


    if (
        motion.filtered >
        baseline * sensitivity &&

        now - motion.lastPeak >
        300 &&

        motion.accelSamples.length >= 5
    ) {

        const recent =
            motion.accelSamples.slice(-5);


        if (
            motion.filtered >=
            Math.max(...recent)
        ) {

            motion.lastPeak =
                now;

            takeStep();

        }

    }

}


/* =========================================================
   STEP
   ========================================================= */

function takeStep() {

    const step =
        Number(
            $("stepLength")?.value
        ) ||
        state.settings.stepLength ||
        0.72;


    const heading =
        state.pos.heading;


    const radians =
        heading *
        Math.PI /
        180;


    /*
     * Heading convention:
     *
     * 0° = +Y
     * 90° = +X
     */

    const dx =
        Math.sin(radians) *
        step;

    const dy =
        Math.cos(radians) *
        step;


    const previousTime =
        state.lastSample ||
        Date.now();


    const now =
        Date.now();


    const elapsed =
        Math.max(
            1,
            now - previousTime
        );


    state.pos.x += dx;

    state.pos.y += dy;


    state.distance +=
        Math.hypot(dx, dy);


    state.pos.speed =
        Math.hypot(dx, dy) /
        (elapsed / 1000);


    state.lastSample =
        now;


    const sample = {

        t:
            new Date(now)
                .toISOString(),

        x:
            state.pos.x,

        y:
            state.pos.y,

        heading:
            state.pos.heading,

        event:
            "step"

    };


    state.trail.push({

        x:
            state.pos.x,

        y:
            state.pos.y,

        t:
            now

    });


    state.samples.push(
        sample
    );


    updateAreaTime();

    detectArea();

    drawWorld();

    drawMapOverlay();

    updateUI();

    updateTestLive();

    saveState();

}


/* =========================================================
   TRACKING
   ========================================================= */

async function startTracking() {

    if (
        !state.sensor.motion ||
        !state.sensor.orientation
    ) {

        await requestSensors();

    }


    if (
        !state.sensor.motion ||
        !state.sensor.orientation
    ) {

        return;

    }


    state.tracking =
        true;

    state.trackingStarted =
        Date.now();

    state.lastSample =
        Date.now();


    motion.lastPeak =
        performance.now();

    motion.accelSamples =
        [];


    $("status").textContent =
        "Tracking";


    $("startBtn").disabled =
        true;


    updateUI();

    saveState();

}


function stopTracking() {

    state.tracking =
        false;


    $("status").textContent =
        "Stopped";


    $("startBtn").disabled =
        false;


    saveState();

    updateUI();

}


function resetPosition() {

    if (
        !confirm(
            "Reset X/Y, distance and trail to the origin?"
        )
    ) {

        return;

    }


    state.pos.x = 0;

    state.pos.y = 0;

    state.pos.speed = 0;

    state.distance = 0;

    state.trail = [];

    state.samples = [];

    state.currentArea = null;

    state.lastSample =
        state.tracking
            ? Date.now()
            : null;


    drawWorld();

    drawMapOverlay();

    updateUI();

    saveState();

}


/* =========================================================
   TEST ORIGIN
   ========================================================= */

function setTestOrigin() {

    if (
        state.setup.test.active
    ) {

        alert(
            "The test is already running."
        );

        return;

    }


    if (
        !state.setup.completed.iphone
    ) {

        alert(
            "Enable the iPhone sensors first."
        );

        goToSetupStep(3);

        return;

    }


    if (
        !confirm(
            "Set the current physical position as the test origin (0,0)?"
        )
    ) {

        return;

    }


    state.pos.x = 0;

    state.pos.y = 0;

    state.distance = 0;

    state.pos.speed = 0;

    state.trail = [];

    state.samples = [];


    state.setup.test.active =
        true;

    state.setup.test.startedAt =
        Date.now();

    state.setup.test.startPos = {
        x:0,
        y:0
    };

    state.setup.test.startDistance =
        0;

    state.setup.test.startHeading =
        state.pos.heading;

    state.setup.test.startSampleCount =
        0;

    state.setup.test.result =
        null;


    if (!state.tracking) {

        startTracking();

    }


    $("testResult").textContent =
        "Test running. Walk approximately 5 metres in a straight line.";

    $("testResult").className =
        "testWaiting";


    $("status").textContent =
        "5 m test running";


    updateTestLive();

    saveState();

    updateSetupUI();

}


/* =========================================================
   FINISH FIRST TEST
   ========================================================= */

function finishFirstTest() {

    if (
        !state.setup.test.active
    ) {

        alert(
            "Start the test first using Set test origin."
        );

        return;

    }


    const start =
        state.setup.test.startPos || {
            x:0,
            y:0
        };


    const end = {

        x:
            state.pos.x,

        y:
            state.pos.y

    };


    const travelDistance =
        state.distance -
        state.setup.test.startDistance;


    const displacement =
        Math.hypot(
            end.x - start.x,
            end.y - start.y
        );


    const targetDistance = 5;


    /*
     * Expected endpoint based on the heading when
     * the test started.
     */

    const radians =
        state.setup.test.startHeading *
        Math.PI /
        180;


    const expectedX =
        Math.sin(radians) *
        targetDistance;


    const expectedY =
        Math.cos(radians) *
        targetDistance;


    const endpointError =
        Math.hypot(
            end.x - expectedX,
            end.y - expectedY
        );


    const steps =
        state.samples.length -
        state.setup.test.startSampleCount;


    const elapsed =
        Math.max(
            1,
            Date.now() -
            state.setup.test.startedAt
        );


    state.setup.test.active =
        false;


    state.setup.test.result = {

        steps,

        travelDistance,

        displacement,

        endpointError,

        elapsed,

        finalX:
            end.x,

        finalY:
            end.y

    };


    state.setup.completed.test =
        steps > 0;


    stopTracking();


    renderTestResult();

    updateSetupUI();

    saveState();

}


/* =========================================================
   TEST RESULT
   ========================================================= */

function renderTestResult() {

    const result =
        state.setup.test.result;


    if (!result) {

        $("testResult").textContent =
            "Test has not been started.";

        $("testResult").className =
            "testWaiting";

        return;

    }


    $("testSteps").textContent =
        result.steps;


    $("testDistance").textContent =
        result.travelDistance.toFixed(2) +
        " m";


    $("testDisplacement").textContent =
        result.displacement.toFixed(2) +
        " m";


    $("testError").textContent =
        result.endpointError.toFixed(2) +
        " m";


    $("testX").textContent =
        result.finalX.toFixed(2);


    $("testY").textContent =
        result.finalY.toFixed(2);


    if (result.steps > 0) {

        $("testResult").textContent =
            "Test completed. Review the measured distance and endpoint error.";

        $("testResult").className =
            "testPassed";

    } else {

        $("testResult").textContent =
            "No steps were detected. Check sensor permissions and step settings.";

        $("testResult").className =
            "testFailed";

    }

}


function updateTestLive() {

    if (!$("testX")) {
        return;
    }

    $("testX").textContent =
        state.pos.x.toFixed(2);

    $("testY").textContent =
        state.pos.y.toFixed(2);

}


/* =========================================================
   SETUP TEST UI
   ========================================================= */

function updateTestSetupUI() {

    updateTestLive();

    renderTestResult();

}


/* =========================================================
   PDF SETUP
   ========================================================= */

function setupPdfFileSelected(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }


    $("setupPdfStatus").className =
        "setupStatus ready";


    $("setupPdfStatus").innerHTML = `
        <span class="setupStatusDot"></span>
        <span>${escapeHTML(file.name)} selected.</span>
    `;

}


async function setupLoadPDF() {

    const input =
        $("setupPdfFile");

    if (!input?.files?.[0]) {

        alert(
            "Select a PDF first."
        );

        return;

    }


    /*
     * Copy setup values into the main Map controls.
     */

    const setupFile =
        input.files[0];


    const page =
        Number(
            $("setupPdfPage")?.value
        ) || 1;


    const zoom =
        Number(
            $("setupPdfZoom")?.value
        ) || 1;


    const mainInput =
        $("pdfFile");


    /*
     * File inputs cannot be assigned programmatically
     * in all browsers, so use the setup file directly.
     */

    state.pdf.fileObject =
        setupFile;

    state.pdf.fileName =
        setupFile.name;

    state.pdf.page =
        page;

    state.pdf.scale =
        zoom;


    if ($("pdfPage")) {
        $("pdfPage").value =
            page;
    }

    if ($("pdfZoom")) {
        $("pdfZoom").value =
            zoom;
    }


    await renderPDFFile(
        setupFile,
        page,
        zoom
    );


    state.setup.completed.pdf =
        true;


    saveState();

    updateSetupUI();

    $("setupPdfStatus").className =
        "setupStatus ready";


    $("setupPdfStatus").innerHTML = `
        <span class="setupStatusDot"></span>
        <span>${escapeHTML(setupFile.name)} loaded.</span>
    `;


    $("status").textContent =
        "PDF loaded";

}


async function loadPDF() {

    const file =
        $("pdfFile")?.files?.[0];


    if (!file) {

        alert(
            "Choose a PDF."
        );

        return;

    }


    const page =
        Math.max(
            1,
            Number(
                $("pdfPage")?.value
            ) || 1
        );


    const zoom =
        Number(
            $("pdfZoom")?.value
        ) || 1;


    state.pdf.fileObject =
        file;

    state.pdf.fileName =
        file.name;

    state.pdf.page =
        page;

    state.pdf.scale =
        zoom;


    await renderPDFFile(
        file,
        page,
        zoom
    );


    state.setup.completed.pdf =
        true;


    saveState();

    updateSetupUI();

}


/* =========================================================
   PDF RENDERING
   ========================================================= */

async function renderPDFFile(
    file,
    pageNumber,
    zoom
) {

    if (!pdfjsLib) {

        alert(
            "PDF.js could not load. Internet access is required by this prototype."
        );

        return;

    }


    try {

        const buffer =
            await file.arrayBuffer();


        const pdf =
            await pdfjsLib
                .getDocument({
                    data: buffer
                })
                .promise;


        const actualPage =
            Math.min(
                Math.max(
                    1,
                    pageNumber
                ),
                pdf.numPages
            );


        state.pdf.page =
            actualPage;


        const page =
            await pdf.getPage(
                actualPage
            );


        const viewport =
            page.getViewport({
                scale: zoom
            });


        const canvas =
            $("pdfCanvas");


        const overlay =
            $("mapOverlay");


        const context =
            canvas.getContext("2d");


        canvas.width =
            viewport.width;

        canvas.height =
            viewport.height;


        overlay.width =
            viewport.width;

        overlay.height =
            viewport.height;


        overlay.style.width =
            viewport.width + "px";

        overlay.style.height =
            viewport.height + "px";


        await page.render({

            canvasContext:
                context,

            viewport

        }).promise;


        state.pdf.width =
            viewport.width;

        state.pdf.height =
            viewport.height;

        state.pdf.scale =
            zoom;


        if ($("pdfStatus")) {

            $("pdfStatus").textContent =
                `${file.name} — page ${actualPage} / ${pdf.numPages}`;

        }


        drawMapOverlay();

    } catch (error) {

        console.error(error);

        alert(
            "Could not render the PDF: " +
            error.message
        );

    }

}


/*
 * Used by the Map tab's zoom/page controls.
 */
async function renderPDFPage() {

    const file =
        $("pdfFile")?.files?.[0] ||
        state.pdf.fileObject;


    if (!file) {
        return;
    }


    const page =
        Math.max(
            1,
            Number(
                $("pdfPage")?.value
            ) || 1
        );


    const zoom =
        Number(
            $("pdfZoom")?.value
        ) || 1;


    state.pdf.page =
        page;

    state.pdf.scale =
        zoom;


    await renderPDFFile(
        file,
        page,
        zoom
    );


    saveState();

}


/* =========================================================
   MAP TAB
   ========================================================= */

function openMapTab() {

    activateTab("map");

    drawMapOverlay();

}


/* =========================================================
   CALIBRATION
   ========================================================= */

function startCalibration() {

    if (!state.pdf.fileName) {

        alert(
            "Load a PDF first."
        );

        goToSetupStep(1);

        return;

    }


    state.calibrationMode =
        true;


    /*
     * This fixes the original issue where the overlay
     * had pointer-events:none.
     */

    $("mapOverlay").style.pointerEvents =
        "auto";


    $("calibrationStatus").textContent =
        "Calibration active: click a known point on the PDF.";


    if ($("setupCalibrationStatus")) {

        $("setupCalibrationStatus").innerHTML = `
            <span class="setupStatusDot"></span>
            <span>Calibration active. Click a known point on the PDF.</span>
        `;

        $("setupCalibrationStatus").className =
            "setupStatus warning";

    }


    drawMapOverlay();

}


function finishCalibration() {

    if (
        state.calibration.points.length < 3
    ) {

        alert(
            "Use at least 3 calibration points."
        );

        return;

    }


    const matrix =
        computeAffine(
            state.calibration.points
        );


    if (!matrix) {

        alert(
            "Could not calculate calibration. Check the points."
        );

        return;

    }


    state.calibration.matrix =
        matrix;

    state.calibration.locked =
        true;

    state.calibrationMode =
        false;


    $("mapOverlay").style.pointerEvents =
        "none";


    const message =
        "Calibration LOCKED. RMS error: " +
        matrix.rms.toFixed(3) +
        " world units.";


    if ($("calibrationStatus")) {

        $("calibrationStatus").textContent =
            message;

    }


    if ($("setupCalibrationStatus")) {

        $("setupCalibrationStatus").className =
            "setupStatus ready";

        $("setupCalibrationStatus").innerHTML = `
            <span class="setupStatusDot"></span>
            <span>${escapeHTML(message)}</span>
        `;

    }


    state.setup.completed.calibration =
        true;


    state.setup.completed.mapping =
        true;


    drawMapOverlay();

    saveState();

    updateUI();

    updateSetupUI();

}


function clearCalibration() {

    if (
        !confirm(
            "Clear all calibration points?"
        )
    ) {

        return;

    }


    state.calibration.points =
        [];

    state.calibration.matrix =
        null;

    state.calibration.locked =
        false;

    state.calibrationMode =
        false;


    $("mapOverlay").style.pointerEvents =
        "none";


    if ($("calibrationStatus")) {

        $("calibrationStatus").textContent =
            "Not calibrated";

    }


    if ($("setupCalibrationStatus")) {

        $("setupCalibrationStatus").className =
            "setupStatus warning";

        $("setupCalibrationStatus").innerHTML = `
            <span class="setupStatusDot"></span>
            <span>Calibration has not been completed.</span>
        `;

    }


    state.setup.completed.calibration =
        false;

    state.setup.completed.mapping =
        false;


    renderCalibrationPoints();

    drawMapOverlay();

    saveState();

    updateSetupUI();

}


/* =========================================================
   PDF CALIBRATION CLICK
   ========================================================= */

function pdfCanvasClick(event) {

    if (
        !state.calibrationMode ||
        state.calibration.locked
    ) {

        return;

    }


    const overlay =
        $("mapOverlay");


    const rect =
        overlay.getBoundingClientRect();


    if (
        rect.width <= 0 ||
        rect.height <= 0
    ) {

        return;

    }


    const scaleX =
        overlay.width /
        rect.width;


    const scaleY =
        overlay.height /
        rect.height;


    const px =
        (event.clientX - rect.left) *
        scaleX;


    const py =
        (event.clientY - rect.top) *
        scaleY;


    const x =
        parseFloat(
            prompt(
                "Real-world X (metres):",
                "0"
            )
        );


    const y =
        parseFloat(
            prompt(
                "Real-world Y (metres):",
                "0"
            )
        );


    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;

    }


    state.calibration.points.push({

        px,

        py,

        x,

        y

    });


    renderCalibrationPoints();

    drawMapOverlay();

    saveState();

}


/* =========================================================
   CALIBRATION LIST
   ========================================================= */

function renderCalibrationPoints() {

    const containers = [
        $("calibrationPoints"),
        $("setupCalibrationPoints")
    ];


    containers.forEach(container => {

        if (!container) {
            return;
        }


        container.innerHTML = "";


        state.calibration.points
            .forEach((point, index) => {

                const row =
                    document.createElement("div");


                row.className =
                    "calPoint";


                row.innerHTML = `

                    <strong>
                        P${index + 1}
                    </strong>

                    <span>
                        PDF:
                        ${point.px.toFixed(1)},
                        ${point.py.toFixed(1)}
                    </span>

                    <span>
                        World:
                        ${point.x.toFixed(2)} m,
                        ${point.y.toFixed(2)} m
                    </span>

                    <button
                        data-cal-delete="${index}">
                        Delete
                    </button>

                `;


                row.querySelector(
                    "[data-cal-delete]"
                )?.addEventListener(
                    "click",
                    () => {

                        state.calibration.points
                            .splice(index, 1);


                        if (
                            state.calibration.points.length <
                            3
                        ) {

                            state.calibration.locked =
                                false;

                            state.calibration.matrix =
                                null;

                            state.setup.completed.calibration =
                                false;

                            state.setup.completed.mapping =
                                false;

                        }


                        renderCalibrationPoints();

                        drawMapOverlay();

                        saveState();

                        updateSetupUI();

                    }
                );


                container.appendChild(
                    row
                );

            });

    });

}


/* =========================================================
   CALIBRATION UI
   ========================================================= */

function updateCalibrationSetupUI() {

    renderCalibrationPoints();


    const complete =
        state.setup.completed.calibration &&
        state.calibration.locked;


    if ($("setupCalibrationStatus")) {

        if (complete) {

            const rms =
                state.calibration.matrix?.rms;

            $("setupCalibrationStatus").className =
                "setupStatus ready";

            $("setupCalibrationStatus").innerHTML = `
                <span class="setupStatusDot"></span>
                <span>
                    Synchronization locked.
                    RMS error:
                    ${Number(rms || 0).toFixed(3)} m
                </span>
            `;

        } else if (
            state.calibrationMode
        ) {

            $("setupCalibrationStatus").className =
                "setupStatus warning";

            $("setupCalibrationStatus").innerHTML = `
                <span class="setupStatusDot"></span>
                <span>
                    Calibration active.
                    ${state.calibration.points.length}
                    point(s) recorded.
                </span>
            `;

        }

    }

}


/* =========================================================
   AFFINE CALIBRATION
   ========================================================= */

function computeAffine(points) {

    const rows = [];

    const bx = [];

    const by = [];


    for (
        const point of points
    ) {

        rows.push([
            point.px,
            point.py,
            1
        ]);

        bx.push(point.x);

        by.push(point.y);

    }


    const sx =
        solveLeastSquares(
            rows,
            bx
        );


    const sy =
        solveLeastSquares(
            rows,
            by
        );


    if (!sx || !sy) {

        return null;

    }


    let errorSquared = 0;


    for (
        const point of points
    ) {

        const x =
            sx[0] * point.px +
            sx[1] * point.py +
            sx[2];


        const y =
            sy[0] * point.px +
            sy[1] * point.py +
            sy[2];


        errorSquared +=
            (x - point.x) ** 2 +
            (y - point.y) ** 2;

    }


    return {

        a: sx,

        b: sy,

        rms:
            Math.sqrt(
                errorSquared /
                points.length
            )

    };

}


function solveLeastSquares(A, b) {

    /*
     * Normal equation:
     *
     * (AᵀA)x = Aᵀb
     */

    const rows =
        A.length;


    if (rows < 3) {
        return null;
    }


    const ATA = [
        [0,0,0],
        [0,0,0],
        [0,0,0]
    ];


    const ATb = [
        0,
        0,
        0
    ];


    for (
        let i = 0;
        i < rows;
        i++
    ) {

        const row =
            A[i];


        for (
            let j = 0;
            j < 3;
            j++
        ) {

            ATb[j] +=
                row[j] *
                b[i];


            for (
                let k = 0;
                k < 3;
                k++
            ) {

                ATA[j][k] +=
                    row[j] *
                    row[k];

            }

        }

    }


    return solve3(
        ATA,
        ATb
    );

}


function solve3(A, b) {

    const m = [

        [
            A[0][0],
            A[0][1],
            A[0][2],
            b[0]
        ],

        [
            A[1][0],
            A[1][1],
            A[1][2],
            b[1]
        ],

        [
            A[2][0],
            A[2][1],
            A[2][2],
            b[2]
        ]

    ];


    for (
        let col = 0;
        col < 3;
        col++
    ) {

        let pivot = col;


        for (
            let row = col + 1;
            row < 3;
            row++
        ) {

            if (
                Math.abs(m[row][col]) >
                Math.abs(m[pivot][col])
            ) {

                pivot = row;

            }

        }


        if (
            Math.abs(
                m[pivot][col]
            ) < 1e-12
        ) {

            return null;

        }


        [
            m[col],
            m[pivot]
        ] = [
            m[pivot],
            m[col]
        ];


        const divisor =
            m[col][col];


        for (
            let j = col;
            j < 4;
            j++
        ) {

            m[col][j] /=
                divisor;

        }


        for (
            let row = 0;
            row < 3;
            row++
        ) {

            if (row === col) {
                continue;
            }


            const factor =
                m[row][col];


            for (
                let j = col;
                j < 4;
                j++
            ) {

                m[row][j] -=
                    factor *
                    m[col][j];

            }

        }

    }


    return [
        m[0][3],
        m[1][3],
        m[2][3]
    ];

}


/* =========================================================
   WORLD ↔ PDF
   ========================================================= */

function worldToPdf(x, y) {

    const matrix =
        state.calibration.matrix;


    if (!matrix) {
        return null;
    }


    /*
     * World = A * PDF
     *
     * We need the inverse mapping:
     *
     * PDF = inverse(A) * World
     */

    const a =
        matrix.a[0];

    const b =
        matrix.a[1];

    const c =
        matrix.a[2];

    const d =
        matrix.b[0];

    const e =
        matrix.b[1];

    const f =
        matrix.b[2];


    const determinant =
        a * e -
        b * d;


    if (
        Math.abs(determinant) <
        1e-12
    ) {

        return null;

    }


    const wx =
        x - c;

    const wy =
        y - f;


    const px =
        (
            e * wx -
            b * wy
        ) /
        determinant;


    const py =
        (
            -d * wx +
            a * wy
        ) /
        determinant;


    return {
        px,
        py
    };

}


/* =========================================================
   MAP OVERLAY
   ========================================================= */

function drawMapOverlay() {

    const canvas =
        $("mapOverlay");


    if (
        !canvas ||
        !canvas.width ||
        !canvas.height
    ) {

        return;

    }


    const context =
        canvas.getContext("2d");


    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
     * Calibration points
     */

    state.calibration.points
        .forEach((point, index) => {

            context.beginPath();

            context.arc(
                point.px,
                point.py,
                7,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                "#ffcc00";

            context.fill();


            context.fillStyle =
                "#111";

            context.font =
                "12px sans-serif";


            context.fillText(
                "P" + (index + 1),
                point.px + 9,
                point.py - 9
            );

        });


    /*
     * Current position
     */

    if (
        state.calibration.locked
    ) {

        const point =
            worldToPdf(
                state.pos.x,
                state.pos.y
            );


        if (
            point &&
            point.px >= 0 &&
            point.py >= 0 &&
            point.px <= canvas.width &&
            point.py <= canvas.height
        ) {

            context.beginPath();

            context.arc(
                point.px,
                point.py,
                10,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                "#55b7ff";

            context.fill();


            context.strokeStyle =
                "#fff";

            context.lineWidth =
                2;

            context.stroke();

        }

    }

}


/* =========================================================
   CHECKPOINTS
   ========================================================= */

function addCheckpointAtCurrent() {

    const name =
        prompt(
            "Checkpoint name:",
            `Checkpoint ${state.checkpoints.length + 1}`
        );


    if (!name) {
        return;
    }


    state.checkpoints.push({

        name,

        x:
            state.pos.x,

        y:
            state.pos.y

    });


    renderCheckpoints();

    saveState();

    updateUI();

}


function applyCheckpoint() {

    const index =
        Number(
            $("checkpointSelect")?.value
        );


    if (
        !Number.isInteger(index) ||
        !state.checkpoints[index]
    ) {

        alert(
            "Select a checkpoint first."
        );

        return;

    }


    const checkpoint =
        state.checkpoints[index];


    state.pos.x =
        checkpoint.x;

    state.pos.y =
        checkpoint.y;


    state.pos.speed =
        0;


    state.trail.push({

        x:
            state.pos.x,

        y:
            state.pos.y,

        t:
            Date.now()

    });


    detectArea();

    drawWorld();

    drawMapOverlay();

    updateUI();

    saveState();


    $("status").textContent =
        "Position corrected";

}


function renderCheckpoints() {

    const list =
        $("checkpointList");


    if (!list) {
        return;
    }


    list.innerHTML = "";


    const select =
        $("checkpointSelect");


    if (select) {

        select.innerHTML =
            `<option value="">Select checkpoint</option>`;

    }


    state.checkpoints
        .forEach((checkpoint, index) => {

            if (select) {

                const option =
                    document.createElement("option");

                option.value =
                    String(index);

                option.textContent =
                    `${checkpoint.name} (${checkpoint.x.toFixed(2)}, ${checkpoint.y.toFixed(2)})`;

                select.appendChild(
                    option
                );

            }


            const row =
                document.createElement("div");


            row.className =
                "checkpointRow";


            row.innerHTML = `

                <strong>
                    ${escapeHTML(checkpoint.name)}
                </strong>

                <span>
                    X:
                    ${checkpoint.x.toFixed(2)} m
                </span>

                <span>
                    Y:
                    ${checkpoint.y.toFixed(2)} m
                </span>

                <button>
                    Delete
                </button>

            `;


            row.querySelector("button")
                .addEventListener(
                    "click",
                    () => {

                        state.checkpoints
                            .splice(index, 1);

                        renderCheckpoints();

                        saveState();

                    }
                );


            list.appendChild(
                row
            );

        });

}


/* =========================================================
   AREAS
   ========================================================= */

function startArea() {

    const name =
        $("areaName")?.value.trim();


    if (!name) {

        alert(
            "Enter an area name first."
        );

        return;

    }


    state.areaMode =
        true;

    state.areaDraft =
        [];


    $("areaHint").textContent =
        "Area drawing active. Click points on the world canvas.";

    drawWorld();

}


function finishArea() {

    if (
        !state.areaMode
    ) {

        return;

    }


    if (
        state.areaDraft.length < 3
    ) {

        alert(
            "Use at least 3 points to create an area."
        );

        return;

    }


    const name =
        $("areaName")?.value.trim();


    if (!name) {

        alert(
            "Enter an area name."
        );

        return;

    }


    state.areas.push({

        name,

        polygon:
            state.areaDraft.map(
                point => ({
                    x:point.x,
                    y:point.y
                })
            )

    });


    state.areaDraft =
        [];

    state.areaMode =
        false;


    $("areaName").value =
        "";


    $("areaHint").textContent =
        "Click points on the world-coordinate canvas.";


    renderAreas();

    drawWorld();

    saveState();

}


/* =========================================================
   WORLD CANVAS CLICK
   ========================================================= */

function worldCanvasClick(event) {

    if (
        !state.areaMode
    ) {

        return;

    }


    const canvas =
        $("worldCanvas");


    const rect =
        canvas.getBoundingClientRect();


    const canvasX =
        (
            event.clientX -
            rect.left
        ) *
        canvas.width /
        rect.width;


    const canvasY =
        (
            event.clientY -
            rect.top
        ) *
        canvas.height /
        rect.height;


    const point =
        canvasToWorld(
            canvasX,
            canvasY
        );


    state.areaDraft.push(
        point
    );


    drawWorld();

}


/* =========================================================
   WORLD DRAWING
   ========================================================= */

function drawWorld() {

    const canvas =
        $("worldCanvas");


    if (!canvas) {
        return;
    }


    const context =
        canvas.getContext("2d");


    const width =
        canvas.width;

    const height =
        canvas.height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    /*
     * Background
     */

    context.fillStyle =
        "#0b1324";

    context.fillRect(
        0,
        0,
        width,
        height
    );


    /*
     * Grid
     */

    const gridStep =
        5;


    for (
        let x = 0;
        x <= state.world.width;
        x += gridStep
    ) {

        const canvasX =
            x / state.world.width *
            width;


        context.beginPath();

        context.moveTo(
            canvasX,
            0
        );

        context.lineTo(
            canvasX,
            height
        );

        context.strokeStyle =
            "#1d2940";

        context.lineWidth =
            1;

        context.stroke();


        context.fillStyle =
            "#66758d";

        context.font =
            "11px sans-serif";

        context.fillText(
            `${x}m`,
            canvasX + 3,
            14
        );

    }


    for (
        let y = 0;
        y <= state.world.height;
        y += gridStep
    ) {

        const canvasY =
            height -
            (
                y /
                state.world.height *
                height
            );


        context.beginPath();

        context.moveTo(
            0,
            canvasY
        );

        context.lineTo(
            width,
            canvasY
        );

        context.strokeStyle =
            "#1d2940";

        context.stroke();


        context.fillStyle =
            "#66758d";

        context.font =
            "11px sans-serif";

        context.fillText(
            `${y}m`,
            4,
            canvasY - 4
        );

    }


    /*
     * Areas
     */

    state.areas.forEach(
        area => {

            drawPolygon(
                context,
                area.polygon,
                "#254563",
                "#55b7ff"
            );

        }
    );


    /*
     * Area currently being created
     */

    if (
        state.areaDraft.length
    ) {

        drawPolygon(
            context,
            state.areaDraft,
            "#3b5266",
            "#ffcc00"
        );

    }


    /*
     * Trail
     */

    if (
        state.trail.length > 1
    ) {

        context.beginPath();


        state.trail.forEach(
            (point, index) => {

                const canvasPoint =
                    worldToCanvas(
                        point
                    );


                if (index === 0) {

                    context.moveTo(
                        canvasPoint.x,
                        canvasPoint.y
                    );

                } else {

                    context.lineTo(
                        canvasPoint.x,
                        canvasPoint.y
                    );

                }

            }
        );


        context.strokeStyle =
            "#55b7ff";

        context.lineWidth =
            3;

        context.stroke();

    }


    /*
     * Current position
     */

    const position =
        worldToCanvas(
            state.pos
        );


    context.beginPath();

    context.arc(
        position.x,
        position.y,
        9,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "#55b7ff";

    context.fill();


    context.strokeStyle =
        "#ffffff";

    context.lineWidth =
        2;

    context.stroke();


    /*
     * Heading arrow
     */

    const headingRadians =
        state.pos.heading *
        Math.PI /
        180;


    const arrowLength =
        28;


    const arrowX =
        position.x +
        Math.sin(
            headingRadians
        ) *
        arrowLength;


    const arrowY =
        position.y -
        Math.cos(
            headingRadians
        ) *
        arrowLength;


    context.beginPath();

    context.moveTo(
        position.x,
        position.y
    );

    context.lineTo(
        arrowX,
        arrowY
    );

    context.strokeStyle =
        "#ffffff";

    context.lineWidth =
        3;

    context.stroke();

}


function drawPolygon(
    context,
    polygon,
    fill,
    stroke
) {

    if (
        !polygon ||
        polygon.length < 2
    ) {

        return;

    }


    context.beginPath();


    polygon.forEach(
        (point, index) => {

            const canvasPoint =
                worldToCanvas(
                    point
                );


            if (index === 0) {

                context.moveTo(
                    canvasPoint.x,
                    canvasPoint.y
                );

            } else {

                context.lineTo(
                    canvasPoint.x,
                    canvasPoint.y
                );

            }

        }
    );


    context.closePath();


    context.fillStyle =
        fill;

    context.globalAlpha =
        0.35;

    context.fill();

    context.globalAlpha =
        1;


    context.strokeStyle =
        stroke;

    context.lineWidth =
        2;

    context.stroke();

}


function worldToCanvas(point) {

    return {

        x:
            point.x /
            state.world.width *
            $("worldCanvas").width,

        y:
            $("worldCanvas").height -
            (
                point.y /
                state.world.height *
                $("worldCanvas").height
            )

    };

}


function canvasToWorld(
    canvasX,
    canvasY
) {

    const canvas =
        $("worldCanvas");


    return {

        x:
            canvasX /
            canvas.width *
            state.world.width,

        y:
            (
                canvas.height -
                canvasY
            ) /
            canvas.height *
            state.world.height

    };

}


/* =========================================================
   AREA DETECTION
   ========================================================= */

function pointInPolygon(
    point,
    polygon
) {

    let inside = false;


    for (
        let i = 0,
        j = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {

        const xi =
            polygon[i].x;

        const yi =
            polygon[i].y;

        const xj =
            polygon[j].x;

        const yj =
            polygon[j].y;


        const intersects =
            (
                yi > point.y
            ) !==
            (
                yj > point.y
            ) &&
            (
                point.x <
                (
                    xj - xi
                ) *
                (
                    point.y - yi
                ) /
                (
                    yj - yi
                ) +
                xi
            );


        if (intersects) {

            inside =
                !inside;

        }

    }


    return inside;

}


function detectArea() {

    let detected =
        null;


    for (
        const area of state.areas
    ) {

        if (
            pointInPolygon(
                state.pos,
                area.polygon
            )
        ) {

            detected =
                area.name;

            break;

        }

    }


    if (
        detected !==
        state.currentArea
    ) {

        state.currentArea =
            detected;

        updateAreaTime();

        saveState();

    }

}


/* =========================================================
   AREA TIME
   ========================================================= */

function updateAreaTime() {

    if (!state.tracking) {
        return;
    }


    const now =
        Date.now();


    if (!state.lastSample) {

        state.lastSample =
            now;

        return;

    }


    const elapsed =
        now -
        state.lastSample;


    if (
        state.currentArea
    ) {

        state.areaTime[
            state.currentArea
        ] =
            (
                state.areaTime[
                    state.currentArea
                ] ||
                0
            ) +
            elapsed;

    }


    state.lastSample =
        now;

}


/* =========================================================
   AREA RENDERING
   ========================================================= */

function renderAreas() {

    const list =
        $("areaList");


    if (!list) {
        return;
    }


    list.innerHTML = "";


    state.areas.forEach(
        (area, index) => {

            const row =
                document.createElement("div");


            row.className =
                "areaRow";


            row.innerHTML = `

                <strong>
                    ${escapeHTML(area.name)}
                </strong>

                <span>
                    ${area.polygon.length}
                    points
                </span>

                <span>
                    ${area.polygon
                        .map(
                            p =>
                                `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
                        )
                        .join(" ")}
                </span>

                <button>
                    Delete
                </button>

            `;


            row.querySelector("button")
                .addEventListener(
                    "click",
                    () => {

                        state.areas
                            .splice(index, 1);

                        renderAreas();

                        drawWorld();

                        saveState();

                    }
                );


            list.appendChild(
                row
            );

        }
    );

}


/* =========================================================
   AREA TIME TABLE
   ========================================================= */

function renderAreaTime() {

    const container =
        $("areaTimeTable");


    if (!container) {
        return;
    }


    const entries =
        Object.entries(
            state.areaTime
        );


    if (!entries.length) {

        container.innerHTML =
            `<div class="hint">No area time recorded yet.</div>`;

        return;

    }


    let html = `

        <table>

            <thead>

                <tr>
                    <th>Area</th>
                    <th>Time</th>
                </tr>

            </thead>

            <tbody>

    `;


    entries.forEach(
        ([name, milliseconds]) => {

            html += `

                <tr>

                    <td>
                        ${escapeHTML(name)}
                    </td>

                    <td>
                        ${formatMs(milliseconds)}
                    </td>

                </tr>

            `;

        }
    );


    html += `

            </tbody>

        </table>

    `;


    container.innerHTML =
        html;

}


/* =========================================================
   UI
   ========================================================= */

function updateUI() {

    $("xValue").textContent =
        state.pos.x.toFixed(2);


    $("yValue").textContent =
        state.pos.y.toFixed(2);


    $("headingValue").textContent =
        Math.round(
            state.pos.heading
        ) +
        "°";


    $("speedValue").textContent =
        state.pos.speed.toFixed(2) +
        " m/s";


    $("distanceValue").textContent =
        state.distance.toFixed(2) +
        " m";


    $("timeValue").textContent =
        formatTrackingTime();


    $("currentArea").textContent =
        state.currentArea ||
        "—";


    $("sampleCount").textContent =
        state.samples.length;


    $("areaChangeCount").textContent =
        countAreaChanges();


    $("dataCalibration").textContent =
        state.calibration.locked
            ? "Locked"
            : "Not locked";


    if (
        $("startBtn")
    ) {

        $("startBtn").disabled =
            state.tracking;

    }


    renderCheckpoints();

    renderAreas();

    renderAreaTime();

    renderCalibrationPoints();

    updateTestLive();

}


function formatTrackingTime() {

    if (
        !state.trackingStarted
    ) {

        return "00:00:00";

    }


    const elapsed =
        (
            state.tracking
                ? Date.now()
                : Date.now()
        ) -
        state.trackingStarted;


    return formatMs(
        elapsed
    );

}


function countAreaChanges() {

    let count = 0;

    let previous =
        null;


    state.samples.forEach(
        sample => {

            if (
                sample.area !==
                previous
            ) {

                if (
                    previous !== null
                ) {

                    count++;

                }

                previous =
                    sample.area;

            }

        }
    );


    return count;

}


/* =========================================================
   SETUP COMPLETION
   ========================================================= */

function updateSetupCompletion() {

    /*
     * PDF
     */

    state.setup.completed.pdf =
        Boolean(
            state.pdf.fileName
        );


    /*
     * Calibration
     */

    state.setup.completed.calibration =
        Boolean(
            state.calibration.locked
        );


    state.setup.completed.mapping =
        state.setup.completed.calibration;


    /*
     * Project is considered complete if the values are valid.
     */

    state.setup.completed.project =
        Boolean(
            state.world.originName &&
            state.world.width > 0 &&
            state.world.height > 0
        );


    /*
     * Sensor completion is reset after page reload,
     * because browser permissions must be verified again.
     */

    updateSetupSidebarCompletion();

}


function updateSetupSidebarCompletion() {

    document.querySelectorAll(".setupStep")
        .forEach(button => {

            const step =
                Number(
                    button.dataset.setupStep
                );


            button.classList.toggle(
                "completed",
                isSetupStepComplete(step)
            );

        });

}


/* =========================================================
   SETUP COMPLETE SCREEN
   ========================================================= */

function updateSetupCompleteUI() {

    const checks = {

        completeProject:
            state.setup.completed.project,

        completePdf:
            state.setup.completed.pdf,

        completeCalibration:
            state.setup.completed.calibration,

        completeSensors:
            state.setup.completed.iphone,

        completeTest:
            state.setup.completed.test

    };


    Object.entries(checks)
        .forEach(
            ([id, complete]) => {

                setSetupCheck(
                    id,
                    complete
                );

            }
        );


    const ready =
        Object.values(checks)
            .every(Boolean);


    if ($("setupReadyBox")) {

        if (ready) {

            $("setupReadyBox").className =
                "setupStatus ready";

            $("setupReadyBox").innerHTML = `
                <span class="setupStatusDot"></span>
                <span>
                    Setup complete. The tracker is ready for a real session.
                </span>
            `;

        } else {

            $("setupReadyBox").className =
                "setupStatus warning";

            $("setupReadyBox").innerHTML = `
                <span class="setupStatusDot"></span>
                <span>
                    Complete the setup checklist before starting production tracking.
                </span>
            `;

        }

    }

}


/* =========================================================
   SETUP CHECKMARK HELPER
   ========================================================= */

function setSetupCheck(
    id,
    complete
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    element.classList.toggle(
        "complete",
        complete
    );


    const icon =
        element.querySelector(
            ".setupCheckIcon"
        );


    if (icon) {

        icon.textContent =
            complete
                ? "✓"
                : "○";

    }

}


/* =========================================================
   PDF SETUP UI
   ========================================================= */

function updatePDFSetupUI() {

    if (!$("setupPdfStatus")) {
        return;
    }


    if (
        state.setup.completed.pdf
    ) {

        $("setupPdfStatus").className =
            "setupStatus ready";

        $("setupPdfStatus").innerHTML = `
            <span class="setupStatusDot"></span>
            <span>
                ${escapeHTML(state.pdf.fileName || "PDF loaded")}
            </span>
        `;

    }

}


/* =========================================================
   EXPORT CSV
   ========================================================= */

function exportCSV() {

    const rows = [

        [
            "Timestamp",
            "X",
            "Y",
            "Heading",
            "Event"
        ]

    ];


    state.samples.forEach(
        sample => {

            rows.push([

                sample.t,

                sample.x,

                sample.y,

                sample.heading,

                sample.event

            ]);

        }
    );


    const csv =
        rows
            .map(
                row =>
                    row
                        .map(csvCell)
                        .join(",")
            )
            .join("\n");


    download(
        "production-floor-tracker.csv",
        csv,
        "text/csv"
    );

}


/* =========================================================
   EXPORT JSON
   ========================================================= */

function exportJSON() {

    const data =
        JSON.parse(
            JSON.stringify(state)
        );


    data.pdf.fileObject =
        null;


    download(
        "production-floor-tracker-project.json",
        JSON.stringify(
            data,
            null,
            2
        ),
        "application/json"
    );

}


/* =========================================================
   IMPORT JSON
   ========================================================= */

function importJSON(event) {

    const file =
        event.target.files?.[0];


    if (!file) {
        return;
    }


    const reader =
        new FileReader();


    reader.onload = () => {

        try {

            const imported =
                JSON.parse(
                    reader.result
                );


            if (!imported.world) {

                throw new Error(
                    "Invalid project file."
                );

            }


            /*
             * Merge the project.
             */

            if (imported.world) {
                Object.assign(
                    state.world,
                    imported.world
                );
            }

            if (imported.settings) {
                Object.assign(
                    state.settings,
                    imported.settings
                );
            }

            if (imported.pos) {
                Object.assign(
                    state.pos,
                    imported.pos
                );
            }

            if (
                typeof imported.distance ===
                "number"
            ) {

                state.distance =
                    imported.distance;

            }

            if (
                Array.isArray(
                    imported.trail
                )
            ) {

                state.trail =
                    imported.trail;

            }

            if (
                Array.isArray(
                    imported.samples
                )
            ) {

                state.samples =
                    imported.samples;

            }

            if (
                Array.isArray(
                    imported.checkpoints
                )
            ) {

                state.checkpoints =
                    imported.checkpoints;

            }

            if (
                Array.isArray(
                    imported.areas
                )
            ) {

                state.areas =
                    imported.areas;

            }

            if (imported.areaTime) {

                state.areaTime =
                    imported.areaTime;

            }

            if (imported.calibration) {

                Object.assign(
                    state.calibration,
                    imported.calibration
                );

            }

            if (imported.pdf) {

                Object.assign(
                    state.pdf,
                    imported.pdf
                );

            }

            if (imported.setup) {

                if (
                    imported.setup.completed
                ) {

                    Object.assign(
                        state.setup.completed,
                        imported.setup.completed
                    );

                }

            }


            state.pdf.fileObject =
                null;


            syncInputValues();

            saveState();

            drawWorld();

            drawMapOverlay();

            updateUI();

            updateSetupUI();


            alert(
                "Project imported successfully."
            );

        } catch (error) {

            alert(
                "Could not import project: " +
                error.message
            );

        }

    };


    reader.readAsText(
        file
    );

}


/* =========================================================
   DOWNLOAD
   ========================================================= */

function download(
    filename,
    text,
    type
) {

    const blob =
        new Blob(
            [text],
            {type}
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const anchor =
        document.createElement("a");


    anchor.href =
        url;

    anchor.download =
        filename;


    document.body.appendChild(
        anchor
    );


    anchor.click();


    anchor.remove();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   HELPERS
   ========================================================= */

function csvCell(value) {

    const string =
        String(value ?? "");


    return `"${string.replace(
        /"/g,
        '""'
    )}"`;

}


function formatMs(ms) {

    const totalSeconds =
        Math.max(
            0,
            Math.floor(
                ms / 1000
            )
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );


    const seconds =
        totalSeconds % 60;


    return [

        String(hours).padStart(2,"0"),

        String(minutes).padStart(2,"0"),

        String(seconds).padStart(2,"0")

    ].join(":");

}


function normalizeAngle(angle) {

    return (
        (
            angle % 360
        ) +
        360
    ) % 360;

}


function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   SETUP RESET
   ========================================================= */

function resetSetupStatus() {

    if (
        !confirm(
            "Reset the setup checklist? Your project, PDF and calibration data will remain."
        )
    ) {

        return;

    }


    state.setup.completed = {

        project:
            state.setup.completed.project,

        pdf:
            state.setup.completed.pdf,

        calibration:
            state.setup.completed.calibration,

        mapping:
            state.setup.completed.mapping,

        iphone:
            false,

        test:
            false

    };


    state.setup.test.active =
        false;

    state.setup.test.result =
        null;


    state.setup.currentStep =
        0;


    saveState();

    updateSetupUI();

}


/* =========================================================
   SERVICE WORKER
   ========================================================= */

async function registerServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {

        return;

    }


    try {

        await navigator.serviceWorker.register(
            "./service-worker.js"
        );

        console.log(
            "Production Floor Tracker service worker registered."
        );

    } catch (error) {

        console.warn(
            "Service worker registration failed:",
            error
        );

    }

}


/* =========================================================
   PERIODIC UPDATE
   ========================================================= */

setInterval(
    () => {

        if (
            state.tracking
        ) {

            updateAreaTime();

            updateUI();

            updateTestLive();

        }

    },
    1000
);