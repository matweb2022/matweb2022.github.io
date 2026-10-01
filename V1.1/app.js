const STORAGE_KEY = "production-floor-tracker-clean-v1";

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
        orientationData: false
    },

    mapping: {
        active: false,
        x: 0,
        y: 0,
        heading: 0,
        distance: 0,

        path: [
            {
                x: 0,
                y: 0,
                t: Date.now()
            }
        ],

        references: []
    },

    tracking: {
        active: false,
        x: 0,
        y: 0,
        heading: 0,
        distance: 0,

        path: [
            {
                x: 0,
                y: 0,
                t: Date.now()
            }
        ]
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


/* =========================================================
   SENSOR VARIABLES
   ========================================================= */

let motion = {
    filtered: 9.81,
    lastPeak: 0
};

let headingDeg = 0;


/* =========================================================
   PDF
   ========================================================= */

let pdfjsLib = null;
let pdfDocument = null;


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   STARTUP
   ========================================================= */

loadState();

bindNavigation();
bindSetupSteps();
bindButtons();
bindAlignmentControls();

initializeAlignmentControls();
restoreUploadedImage();

renderSetup();
drawMovement();
drawAlignment();
drawLiveMap();
updateAllUI();
updateAllUIStatusBadge();

loadServerFiles();

registerServiceWorker();


/* =========================================================
   SERVICE WORKER
   ========================================================= */

function registerServiceWorker() {

    if (!("serviceWorker" in navigator)) {
        return;
    }

    navigator.serviceWorker
        .register("./service-worker.js")
        .then(() => {
            console.log("Service worker registered.");
        })
        .catch(error => {
            console.warn(
                "Service worker registration failed:",
                error
            );
        });
}


/* =========================================================
   PERSISTENCE
   ========================================================= */

function saveState() {

    try {

        const copy =
            JSON.parse(
                JSON.stringify(state)
            );

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(copy)
        );

    } catch (error) {

        console.warn(
            "Could not save state:",
            error
        );

    }
}


function loadState() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) {
            return;
        }

        const saved =
            JSON.parse(raw);

        /*
         * Merge top-level state.
         */

        Object.assign(
            state,
            saved
        );


        /*
         * Make sure important nested structures
         * exist even if an older version of the
         * application saved incomplete data.
         */

        state.workstation ??= {
            x: 0,
            y: 0
        };

        state.sensors ??= {
            motionPermission: false,
            orientationPermission: false,
            motionData: false,
            orientationData: false
        };

        state.mapping ??= {
            active: false,
            x: 0,
            y: 0,
            heading: 0,
            distance: 0,
            path: [],
            references: []
        };

        state.tracking ??= {
            active: false,
            x: 0,
            y: 0,
            heading: 0,
            distance: 0,
            path: []
        };

        state.plan ??= {
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
        };

        state.plan.imageTransform ??= {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0
        };

        state.mapping.path ??= [];
        state.mapping.references ??= [];

        state.tracking.path ??= [];

        /*
         * Make sure the origin always exists.
         */

        state.workstation.x = 0;
        state.workstation.y = 0;


        /*
         * Make sure mapping has an origin point.
         */

        if (
            state.mapping.path.length === 0
        ) {

            state.mapping.path.push({
                x: 0,
                y: 0,
                t: Date.now()
            });

        }


        /*
         * Mapping/tracking should never remain
         * active after a page reload.
         */

        state.mapping.active = false;
        state.tracking.active = false;

    } catch (error) {

        console.warn(
            "Could not load saved state:",
            error
        );

    }
}


/* =========================================================
   MAIN PAGE NAVIGATION
   ========================================================= */

function bindNavigation() {

    document
        .querySelectorAll(".mainTab")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;

                    openPage(page);

                }
            );

        });

}


function openPage(pageId) {

    document
        .querySelectorAll(".mainTab")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === pageId
            );

        });


    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.toggle(
                "active",
                page.id === pageId
            );

        });


    if (
        pageId === "trackPage"
    ) {

        drawLiveMap();
        updateTrackingPage();

    }

}


/* =========================================================
   SETUP STEP NAVIGATION
   ========================================================= */

function bindSetupSteps() {

    document
        .querySelectorAll(".setupStep")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const step =
                        Number(
                            button.dataset.step
                        );

                    /*
                     * Don't allow jumping to later
                     * steps unless the basic requirements
                     * have been completed.
                     */

                    if (
                        !canOpenSetupStep(step)
                    ) {

                        return;

                    }

                    showSetupStep(step);

                }
            );

        });


    document
        .querySelectorAll(".nextStepBtn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const next =
                        Number(
                            button.dataset.next
                        );

                    if (
                        !canOpenSetupStep(next)
                    ) {

                        return;

                    }

                    showSetupStep(next);

                }
            );

        });


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

}


function canOpenSetupStep(step) {

    /*
     * Step 1 is always available.
     */

    if (step <= 1) {
        return true;
    }


    /*
     * Step 2 is always available because the user
     * needs to start the mapping process there.
     */

    if (step === 2) {
        return true;
    }


    /*
     * Step 3 requires movement.
     */

    if (
        step >= 3 &&
        state.mapping.path.length < 2
    ) {

        alert(
            "Complete Step 2 first. Start Mapping and walk around the area."
        );

        return false;

    }


    /*
     * Step 4 requires a JPEG.
     */

    if (
        step >= 4 &&
        !state.plan.jpegUrl
    ) {

        alert(
            "Upload a JPEG floor plan in Step 3 first."
        );

        return false;

    }


    return true;

}


function showSetupStep(step) {

    state.setupStep = step;

    document
        .querySelectorAll(".setupStep")
        .forEach(button => {

            const buttonStep =
                Number(
                    button.dataset.step
                );

            button.classList.toggle(
                "active",
                buttonStep === step
            );

        });


    document
        .querySelectorAll(".setupPanel")
        .forEach(panel => {

            const panelStep =
                Number(
                    panel.dataset.panel
                );

            panel.classList.toggle(
                "active",
                panelStep === step
            );

        });


    if (step === 4) {

        syncAlignmentControls();

        drawAlignment();

    }


    if (step === 5) {

        updateCompletionSummary();

    }


    renderSetup();

}


/* =========================================================
   SETUP VISUAL STATE
   ========================================================= */

function renderSetup() {

    document
        .querySelectorAll(".setupStep")
        .forEach(button => {

            const step =
                Number(
                    button.dataset.step
                );

            button.classList.remove(
                "completed"
            );


            if (
                isSetupStepComplete(step)
            ) {

                button.classList.add(
                    "completed"
                );

            }

        });


    if (state.locked) {

        $("statusBadge").textContent =
            "Setup locked";

    } else {

        $("statusBadge").textContent =
            "Setup required";

    }

}


function isSetupStepComplete(step) {

    if (step === 1) {

        return true;

    }


    if (step === 2) {

        return (
            state.mapping.path.length > 1
        );

    }


    if (step === 3) {

        return Boolean(
            state.plan.jpegUrl
        );

    }


    if (step === 4) {

        return Boolean(
            state.plan.jpegUrl &&
            state.mapping.path.length > 1
        );

    }


    if (step === 5) {

        return state.locked;

    }


    return false;

}


/* =========================================================
   BUTTON BINDINGS
   ========================================================= */

function bindButtons() {

    /*
     * Sensor permission.
     */

    $("sensorBtn")
        .addEventListener(
            "click",
            requestSensorPermissions
        );


    /*
     * Mapping.
     */

    $("startMapBtn")
        .addEventListener(
            "click",
            startMapping
        );


    $("stopMapBtn")
        .addEventListener(
            "click",
            stopMapping
        );


    $("dropPointBtn")
        .addEventListener(
            "click",
            dropReferencePoint
        );


    $("resetMapBtn")
        .addEventListener(
            "click",
            resetMapping
        );


    /*
     * JPEG upload.
     */

    $("jpegUpload")
        .addEventListener(
            "change",
            uploadJPEG
        );


    /*
     * PDF.
     */

    $("loadPdfBtn")
        .addEventListener(
            "click",
            loadSelectedPDF
        );


    /*
     * Lock setup.
     */

    $("lockSetupBtn")
        .addEventListener(
            "click",
            lockSetup
        );


    $("goTrackBtn")
        .addEventListener(
            "click",
            () => {

                openPage(
                    "trackPage"
                );

            }
        );


    /*
     * Setup page from tracking page.
     */

    $("goSetupBtn")
        .addEventListener(
            "click",
            () => {

                openPage(
                    "setupPage"
                );

                showSetupStep(
                    state.setupStep
                );

            }
        );


    /*
     * Tracking sensors.
     */

    $("trackSensorBtn")
        .addEventListener(
            "click",
            requestSensorPermissions
        );


    /*
     * Tracking.

     */

    $("startTrackBtn")
        .addEventListener(
            "click",
            startTracking
        );


    $("stopTrackBtn")
        .addEventListener(
            "click",
            stopTracking
        );

}


/* =========================================================
   SENSOR PERMISSIONS
   ========================================================= */

async function requestSensorPermissions() {

    const setupStatus =
        $("sensorStatus");

    try {

        setupStatus.textContent =
            "Requesting iPhone sensor permissions...";


        let motionGranted = true;
        let orientationGranted = true;


        /*
         * iOS requires this call to happen from
         * a user interaction.
         */

        if (
            typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission ===
                "function"
        ) {

            const result =
                await DeviceMotionEvent.requestPermission();

            console.log(
                "DeviceMotionEvent permission:",
                result
            );

            motionGranted =
                result === "granted";

        }


        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission ===
                "function"
        ) {

            const result =
                await DeviceOrientationEvent.requestPermission();

            console.log(
                "DeviceOrientationEvent permission:",
                result
            );

            orientationGranted =
                result === "granted";

        }


        /*
         * Motion listener.
         */

        if (motionGranted) {

            window.removeEventListener(
                "devicemotion",
                onMotion,
                true
            );

            window.addEventListener(
                "devicemotion",
                onMotion,
                true
            );

            state.sensors.motionPermission =
                true;

        } else {

            state.sensors.motionPermission =
                false;

        }


        /*
         * Orientation listener.
         */

        if (orientationGranted) {

            window.removeEventListener(
                "deviceorientation",
                onOrientation,
                true
            );

            window.removeEventListener(
                "deviceorientationabsolute",
                onOrientation,
                true
            );


            window.addEventListener(
                "deviceorientation",
                onOrientation,
                true
            );

            window.addEventListener(
                "deviceorientationabsolute",
                onOrientation,
                true
            );


            state.sensors.orientationPermission =
                true;

        } else {

            state.sensors.orientationPermission =
                false;

        }


        /*
         * Status.
         */

        if (
            motionGranted &&
            orientationGranted
        ) {

            setupStatus.textContent =
                "Motion and orientation permissions granted.";

        } else if (motionGranted) {

            setupStatus.textContent =
                "Motion granted. Orientation was not granted.";

        } else if (orientationGranted) {

            setupStatus.textContent =
                "Orientation granted. Motion was not granted.";

        } else {

            setupStatus.textContent =
                "Sensor permissions were not granted.";

        }


        updateSensorStatus();

        saveState();

    } catch (error) {

        console.error(
            "Sensor permission error:",
            error
        );


        setupStatus.textContent =
            "Sensor permission error: " +
            (
                error?.message ||
                error
            );

    }

}


/* =========================================================
   ORIENTATION
   ========================================================= */

function onOrientation(event) {

    let heading = null;


    /*
     * iPhone Safari exposes the compass heading
     * through webkitCompassHeading.
     */

    if (
        event.webkitCompassHeading != null &&
        Number.isFinite(
            event.webkitCompassHeading
        )
    ) {

        heading =
            event.webkitCompassHeading;

    }


    /*
     * Fallback.
     */

    else if (
        event.alpha != null &&
        Number.isFinite(
            event.alpha
        )
    ) {

        heading =
            (
                360 -
                event.alpha
            ) % 360;

    }


    if (
        heading == null ||
        !Number.isFinite(heading)
    ) {

        return;

    }


    headingDeg =
        normalizeAngle(
            heading
        );


    state.sensors.orientationData =
        true;


    state.mapping.heading =
        headingDeg;


    state.tracking.heading =
        headingDeg;


    updateSensorStatus();
    updateAllUI();

}


/* =========================================================
   MOTION
   ========================================================= */

function onMotion(event) {

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


    /*
     * Smooth the accelerometer signal.
     */

    motion.filtered =
        motion.filtered * 0.85 +
        magnitude * 0.15;


    state.sensors.motionData =
        true;


    /*
     * Don't detect steps when the user
     * isn't actively mapping/tracking.
     */

    if (
        !state.mapping.active &&
        !state.tracking.active
    ) {

        updateSensorStatus();

        return;

    }


    /*
     * Basic step detection.
     *
     * This is deliberately simple for the
     * first clean version.
     */

    const sensitivity =
        1.12;


    const baseline =
        9.81;


    const now =
        performance.now();


    if (
        motion.filtered >
            baseline * sensitivity &&
        now - motion.lastPeak >
            300
    ) {

        motion.lastPeak =
            now;

        takeStep();

    }


    updateSensorStatus();

}


/* =========================================================
   STEP
   ========================================================= */

function takeStep() {

    /*
     * Initial estimated step length.
     *
     * We can make this configurable later.
     */

    const stepLength =
        0.72;


    const radians =
        headingDeg *
        Math.PI /
        180;


    /*
     * Heading convention:
     *
     * 0° = North / +Y
     * 90° = East / +X
     */

    const dx =
        Math.sin(
            radians
        ) *
        stepLength;


    const dy =
        Math.cos(
            radians
        ) *
        stepLength;


    /*
     * Mapping mode.
     */

    if (
        state.mapping.active
    ) {

        state.mapping.x += dx;

        state.mapping.y += dy;

        state.mapping.distance +=
            Math.hypot(
                dx,
                dy
            );


        state.mapping.path.push({

            x:
                state.mapping.x,

            y:
                state.mapping.y,

            t:
                Date.now()

        });


        drawMovement();

    }


    /*
     * Live tracking mode.
     */

    if (
        state.tracking.active
    ) {

        state.tracking.x += dx;

        state.tracking.y += dy;

        state.tracking.distance +=
            Math.hypot(
                dx,
                dy
            );


        state.tracking.path.push({

            x:
                state.tracking.x,

            y:
                state.tracking.y,

            t:
                Date.now()

        });


        drawLiveMap();

    }


    updateAllUI();

    saveState();

}


/* =========================================================
   ANGLE
   ========================================================= */

function normalizeAngle(value) {

    return (
        (
            value % 360
        ) +
        360
    ) % 360;

}


/* =========================================================
   MAPPING
   ========================================================= */

function startMapping() {

    /*
     * We need accelerometer permission.
     */

    if (
        !state.sensors.motionPermission
    ) {

        alert(
            "Enable the iPhone sensors first."
        );

        return;

    }


    state.mapping.active =
        true;


    $("startMapBtn").disabled =
        true;

    $("stopMapBtn").disabled =
        false;

    $("dropPointBtn").disabled =
        false;


    setStatus(
        "Mapping"
    );


    updateAllUI();

}


function stopMapping() {

    state.mapping.active =
        false;


    $("startMapBtn").disabled =
        false;

    $("stopMapBtn").disabled =
        true;

    $("dropPointBtn").disabled =
        true;


    setStatus(
        "Mapping saved"
    );


    saveState();

    renderSetup();

}


function resetMapping() {

    if (
        !confirm(
            "Delete the recorded movement and all reference points?"
        )
    ) {

        return;

    }


    state.mapping = {

        active: false,

        x: 0,

        y: 0,

        heading: 0,

        distance: 0,

        path: [
            {
                x: 0,
                y: 0,
                t: Date.now()
            }
        ],

        references: []

    };


    $("startMapBtn").disabled =
        false;

    $("stopMapBtn").disabled =
        true;

    $("dropPointBtn").disabled =
        true;


    drawMovement();

    updateAllUI();

    saveState();

}


/* =========================================================
   DROP REFERENCE POINT
   ========================================================= */

function dropReferencePoint() {

    if (
        !state.mapping.active
    ) {

        alert(
            "Start Mapping before dropping a reference point."
        );

        return;

    }


    const number =
        state.mapping.references.length + 1;


    const reference = {

        id:
            (
                crypto &&
                typeof crypto.randomUUID ===
                    "function"
            )
                ? crypto.randomUUID()
                : String(
                    Date.now()
                ),

        name:
            `Reference ${number}`,

        x:
            Number(
                state.mapping.x.toFixed(3)
            ),

        y:
            Number(
                state.mapping.y.toFixed(3)
            ),

        heading:
            Number(
                state.mapping.heading.toFixed(1)
            ),

        time:
            new Date().toISOString()

    };


    state.mapping.references.push(
        reference
    );


    drawMovement();

    updateAllUI();

    saveState();

}


/* =========================================================
   MOVEMENT CANVAS
   ========================================================= */

function drawMovement() {

    const canvas =
        $("movementCanvas");


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawGrid(
        ctx,
        canvas.width,
        canvas.height
    );


    const points =
        state.mapping.path;


    if (
        !points ||
        points.length === 0
    ) {

        return;

    }


    const bounds =
        calculateBounds(
            points
        );


    const transform =
        createFitTransform(
            bounds,
            canvas.width,
            canvas.height,
            70
        );


    /*
     * Movement path.
     */

    ctx.beginPath();


    points.forEach(
        (point, index) => {

            const p =
                worldToCanvas(
                    point.x,
                    point.y,
                    transform
                );


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


    ctx.lineWidth =
        4;

    ctx.strokeStyle =
        "#55b7ff";

    ctx.stroke();


    /*
     * Workstation.
     */

    const origin =
        worldToCanvas(
            0,
            0,
            transform
        );


    drawCircle(
        ctx,
        origin.x,
        origin.y,
        9,
        "#45d483"
    );


    ctx.fillStyle =
        "#edf2f7";

    ctx.font =
        "bold 13px sans-serif";


    ctx.fillText(
        "WORKSTATION",
        origin.x + 14,
        origin.y - 12
    );


    /*
     * Reference points.
     */

    state.mapping.references
        .forEach(
            (reference, index) => {

                const p =
                    worldToCanvas(
                        reference.x,
                        reference.y,
                        transform
                    );


                drawCircle(
                    ctx,
                    p.x,
                    p.y,
                    9,
                    "#e9a84b"
                );


                ctx.fillStyle =
                    "#edf2f7";

                ctx.font =
                    "bold 12px sans-serif";


                ctx.fillText(
                    `R${index + 1}`,
                    p.x + 12,
                    p.y + 4
                );

            }
        );


    /*
     * Current mapping position.
     */

    if (
        state.mapping.active
    ) {

        const current =
            worldToCanvas(
                state.mapping.x,
                state.mapping.y,
                transform
            );


        drawCircle(
            ctx,
            current.x,
            current.y,
            7,
            "#ffffff"
        );


        ctx.fillStyle =
            "#edf2f7";

        ctx.font =
            "12px sans-serif";


        ctx.fillText(
            "Current",
            current.x + 10,
            current.y + 4
        );

    }

}


/* =========================================================
   GRID
   ========================================================= */

function drawGrid(
    ctx,
    width,
    height
) {

    ctx.fillStyle =
        "#080d18";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    ctx.strokeStyle =
        "#18243a";

    ctx.lineWidth =
        1;


    const spacing =
        40;


    for (
        let x = 0;
        x <= width;
        x += spacing
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();

    }


    for (
        let y = 0;
        y <= height;
        y += spacing
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();

    }

}


/* =========================================================
   CIRCLE
   ========================================================= */

function drawCircle(
    ctx,
    x,
    y,
    radius,
    color
) {

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

}


/* =========================================================
   WORLD BOUNDS
   ========================================================= */

function calculateBounds(
    points
) {

    let minX =
        Infinity;

    let maxX =
        -Infinity;

    let minY =
        Infinity;

    let maxY =
        -Infinity;


    points.forEach(
        point => {

            minX =
                Math.min(
                    minX,
                    point.x
                );

            maxX =
                Math.max(
                    maxX,
                    point.x
                );

            minY =
                Math.min(
                    minY,
                    point.y
                );

            maxY =
                Math.max(
                    maxY,
                    point.y
                );

        }
    );


    /*
     * Always include workstation.
     */

    minX =
        Math.min(
            minX,
            0
        );

    maxX =
        Math.max(
            maxX,
            0
        );

    minY =
        Math.min(
            minY,
            0
        );

    maxY =
        Math.max(
            maxY,
            0
        );


    /*
     * Prevent zero-size maps.
     */

    if (
        maxX - minX < 4
    ) {

        minX -= 2;
        maxX += 2;

    }


    if (
        maxY - minY < 4
    ) {

        minY -= 2;
        maxY += 2;

    }


    return {

        minX,
        maxX,
        minY,
        maxY

    };

}


/* =========================================================
   FIT TRANSFORM
   ========================================================= */

function createFitTransform(
    bounds,
    width,
    height,
    margin
) {

    const worldWidth =
        bounds.maxX -
        bounds.minX;


    const worldHeight =
        bounds.maxY -
        bounds.minY;


    const scale =
        Math.min(

            (
                width -
                margin * 2
            ) /
            worldWidth,

            (
                height -
                margin * 2
            ) /
            worldHeight

        );


    return {

        minX:
            bounds.minX,

        minY:
            bounds.minY,

        scale,

        margin

    };

}


/* =========================================================
   WORLD → CANVAS
   ========================================================= */

function worldToCanvas(
    x,
    y,
    transform
) {

    return {

        x:
            transform.margin +
            (
                x -
                transform.minX
            ) *
            transform.scale,


        /*
         * Canvas Y increases downward.
         *
         * World Y increases upward.
         */

        y:
            transform.margin +
            (
                transform.maxY -
                y
            ) *
            transform.scale

    };

}


/* =========================================================
   JPEG UPLOAD
   ========================================================= */

async function uploadJPEG(event) {

    const file =
        event.target.files[0];


    if (!file) {
        return;
    }


    if (
        file.type !==
        "image/jpeg"
    ) {

        alert(
            "Please select a JPEG image."
        );

        return;

    }


    $("uploadStatus").textContent =
        "Uploading JPEG to server...";


    const formData =
        new FormData();


    formData.append(
        "file",
        file
    );


    try {

        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            const errorData =
                await response
                    .json()
                    .catch(
                        () => null
                    );


            throw new Error(
                errorData?.error ||
                "Upload failed."
            );

        }


        const result =
            await response.json();


        state.plan.jpegUrl =
            result.url;

        state.plan.jpegName =
            result.name;


        $("uploadStatus").textContent =
            "Uploaded: " +
            result.name;


        $("uploadedImagePreview").innerHTML =
            "";


        const image =
            document.createElement(
                "img"
            );


        image.src =
            result.url;

        image.alt =
            "Uploaded floor plan";


        $("uploadedImagePreview")
            .appendChild(
                image
            );


        saveState();

        renderSetup();

        drawAlignment();


    } catch (error) {

        console.error(
            "JPEG upload failed:",
            error
        );


        $("uploadStatus").textContent =
            "Upload failed: " +
            error.message;

    }

}


/* =========================================================
   SERVER FILE LIST
   ========================================================= */

async function loadServerFiles() {

    const select =
        $("pdfSelect");


    try {

        const response =
            await fetch(
                "/api/files"
            );


        if (!response.ok) {

            throw new Error(
                "Cannot load server file list."
            );

        }


        const files =
            await response.json();


        select.innerHTML =
            `
            <option value="">
                Select a PDF...
            </option>
            `;


        files
            .filter(
                file =>
                    file.extension ===
                        ".pdf"
            )
            .forEach(
                file => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        file.url;


                    option.textContent =
                        file.name;


                    select.appendChild(
                        option
                    );

                }
            );


    } catch (error) {

        console.warn(
            "Could not load PDF list:",
            error
        );


        select.innerHTML =
            `
            <option value="">
                No PDFs available
            </option>
            `;

    }

}


/* =========================================================
   PDF
   ========================================================= */

async function loadSelectedPDF() {

    const url =
        $("pdfSelect").value;


    if (!url) {

        alert(
            "Select a PDF first."
        );

        return;

    }


    $("pdfStatus").textContent =
        "Loading PDF...";


    try {

        if (!pdfjsLib) {

            const module =
                await import(
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
                );


            pdfjsLib =
                module;


            pdfjsLib
                .GlobalWorkerOptions
                .workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

        }


        pdfDocument =
            await pdfjsLib
                .getDocument(url)
                .promise;


        const page =
            await pdfDocument.getPage(
                1
            );


        const viewport =
            page.getViewport({
                scale: 1.5
            });


        const canvas =
            $("pdfCanvas");


        const ctx =
            canvas.getContext(
                "2d"
            );


        canvas.width =
            viewport.width;

        canvas.height =
            viewport.height;


        await page.render({

            canvasContext:
                ctx,

            viewport

        }).promise;


        state.plan.pdfUrl =
            url;


        const selected =
            $("pdfSelect")
                .selectedOptions[0];


        state.plan.pdfName =
            selected
                ? selected.textContent
                : url;


        $("pdfStatus").textContent =
            "Loaded: " +
            state.plan.pdfName;


        saveState();

    } catch (error) {

        console.error(
            "PDF loading failed:",
            error
        );


        $("pdfStatus").textContent =
            "PDF error: " +
            error.message;

    }

}


/* =========================================================
   ALIGNMENT CONTROLS
   ========================================================= */

function bindAlignmentControls() {

    [
        "imageX",
        "imageY",
        "imageScale",
        "imageRotation"
    ]
    .forEach(
        id => {

            $(id).addEventListener(
                "input",
                updateImageTransform
            );

        }
    );

}


function initializeAlignmentControls() {

    syncAlignmentControls();

}


function syncAlignmentControls() {

    $("imageX").value =
        state.plan.imageTransform.x;


    $("imageY").value =
        state.plan.imageTransform.y;


    $("imageScale").value =
        state.plan.imageTransform.scale;


    $("imageRotation").value =
        state.plan.imageTransform.rotation;


    $("imageXValue").textContent =
        state.plan.imageTransform.x;


    $("imageYValue").textContent =
        state.plan.imageTransform.y;


    $("imageScaleValue").textContent =
        state.plan.imageTransform.scale
            .toFixed(2);


    $("imageRotationValue").textContent =
        state.plan.imageTransform.rotation +
        "°";

}


function updateImageTransform() {

    state.plan.imageTransform = {

        x:
            Number(
                $("imageX").value
            ),

        y:
            Number(
                $("imageY").value
            ),

        scale:
            Number(
                $("imageScale").value
            ),

        rotation:
            Number(
                $("imageRotation").value
            )

    };


    $("imageXValue").textContent =
        state.plan.imageTransform.x;


    $("imageYValue").textContent =
        state.plan.imageTransform.y;


    $("imageScaleValue").textContent =
        state.plan.imageTransform.scale
            .toFixed(2);


    $("imageRotationValue").textContent =
        state.plan.imageTransform.rotation +
        "°";


    drawAlignment();

    saveState();

}


/* =========================================================
   ALIGNMENT CANVAS
   ========================================================= */

function drawAlignment() {

    const canvas =
        $("alignmentCanvas");


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawGrid(
        ctx,
        canvas.width,
        canvas.height
    );


    if (
        !state.plan.jpegUrl
    ) {

        ctx.fillStyle =
            "#9aa8bd";


        ctx.font =
            "16px sans-serif";


        ctx.fillText(
            "Upload a JPEG floor plan in Step 3.",
            30,
            40
        );


        return;

    }


    const image =
        new Image();


    image.onload = () => {

        /*
         * Draw JPEG first.
         */

        const centerX =
            canvas.width / 2 +
            state.plan.imageTransform.x;


        const centerY =
            canvas.height / 2 +
            state.plan.imageTransform.y;


        ctx.save();


        ctx.translate(
            centerX,
            centerY
        );


        ctx.rotate(
            state.plan.imageTransform.rotation *
            Math.PI /
            180
        );


        const baseScale =
            Math.min(

                canvas.width /
                    image.width,

                canvas.height /
                    image.height

            ) * 0.8;


        const imageScale =
            baseScale *
            state.plan.imageTransform.scale;


        ctx.globalAlpha =
            0.9;


        ctx.drawImage(

            image,

            -image.width *
                imageScale /
                2,

            -image.height *
                imageScale /
                2,

            image.width *
                imageScale,

            image.height *
                imageScale

        );


        ctx.restore();


        /*
         * Draw movement above JPEG.
         */

        const transform =
            calculateOverlayTransform(
                canvas.width,
                canvas.height
            );


        drawWorldLayer(
            ctx,
            transform
        );

    };


    image.src =
        state.plan.jpegUrl;

}


/* =========================================================
   OVERLAY TRANSFORM
   ========================================================= */

function calculateOverlayTransform(
    width,
    height
) {

    const points =
        state.mapping.path;


    const bounds =
        calculateBounds(
            points
        );


    const worldWidth =
        Math.max(
            bounds.maxX -
            bounds.minX,
            1
        );


    const worldHeight =
        Math.max(
            bounds.maxY -
            bounds.minY,
            1
        );


    const scale =
        Math.min(

            (
                width *
                0.75
            ) /
            worldWidth,

            (
                height *
                0.75
            ) /
            worldHeight

        );


    return {

        scale,

        offsetX:
            width / 2 -
            (
                (
                    bounds.minX +
                    bounds.maxX
                ) / 2
            ) *
            scale,


        offsetY:
            height / 2 -
            (
                (
                    bounds.minY +
                    bounds.maxY
                ) / 2
            ) *
            scale

    };

}


/* =========================================================
   DRAW WORLD LAYER
   ========================================================= */

function drawWorldLayer(
    ctx,
    transform
) {

    const points =
        state.mapping.path;


    if (
        !points ||
        points.length === 0
    ) {

        return;

    }


    function mapPoint(
        x,
        y
    ) {

        return {

            x:
                x *
                transform.scale +
                transform.offsetX,

            y:
                y *
                transform.scale +
                transform.offsetY

        };

    }


    /*
     * Recorded movement.
     */

    ctx.beginPath();


    points.forEach(
        (point, index) => {

            const p =
                mapPoint(
                    point.x,
                    point.y
                );


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


    ctx.lineWidth =
        4;

    ctx.strokeStyle =
        "#55b7ff";

    ctx.stroke();


    /*
     * Workstation.
     */

    const origin =
        mapPoint(
            0,
            0
        );


    drawCircle(
        ctx,
        origin.x,
        origin.y,
        10,
        "#45d483"
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.font =
        "bold 12px sans-serif";


    ctx.fillText(
        "WORKSTATION",
        origin.x + 13,
        origin.y - 12
    );


    /*
     * Reference points.
     */

    state.mapping.references
        .forEach(
            (reference, index) => {

                const p =
                    mapPoint(
                        reference.x,
                        reference.y
                    );


                drawCircle(
                    ctx,
                    p.x,
                    p.y,
                    9,
                    "#e9a84b"
                );


                ctx.fillStyle =
                    "#ffffff";

                ctx.font =
                    "bold 12px sans-serif";


                ctx.fillText(
                    `R${index + 1}`,
                    p.x + 12,
                    p.y + 4
                );

            }
        );

}


/* =========================================================
   LOCK SETUP
   ========================================================= */

function updateCompletionSummary() {

    const summary =
        $("completionSummary");


    summary.innerHTML = `

        <div class="summaryRow">
            <span>Workstation</span>
            <strong>
                X 0.00 / Y 0.00
            </strong>
        </div>

        <div class="summaryRow">
            <span>Movement distance</span>
            <strong>
                ${state.mapping.distance.toFixed(2)} m
            </strong>
        </div>

        <div class="summaryRow">
            <span>Movement samples</span>
            <strong>
                ${state.mapping.path.length}
            </strong>
        </div>

        <div class="summaryRow">
            <span>Reference points</span>
            <strong>
                ${state.mapping.references.length}
            </strong>
        </div>

        <div class="summaryRow">
            <span>JPEG floor plan</span>
            <strong>
                ${state.plan.jpegName || "Not uploaded"}
            </strong>
        </div>

        <div class="summaryRow">
            <span>PDF</span>
            <strong>
                ${state.plan.pdfName || "Optional"}
            </strong>
        </div>

    `;

}


function lockSetup() {

    if (
        !state.plan.jpegUrl
    ) {

        alert(
            "Upload a JPEG floor plan before locking the setup."
        );

        return;

    }


    if (
        state.mapping.path.length < 2
    ) {

        alert(
            "Record movement before locking the setup."
        );

        return;

    }


    state.locked =
        true;


    state.mapping.active =
        false;


    saveState();


    $("lockedSetup")
        .classList.remove(
            "hidden"
        );


    $("lockSetupBtn")
        .disabled = true;


    setStatus(
        "Setup locked"
    );


    renderSetup();

    updateCompletionSummary();

}


/* =========================================================
   LIVE TRACKING
   ========================================================= */

function startTracking() {

    if (!state.locked) {

        alert(
            "Complete and lock the setup first."
        );

        return;

    }


    /*
     * IMPORTANT:
     *
     * We do NOT call requestSensorPermissions()
     * here because iOS permission requests need
     * to originate from a direct user interaction.
     */

    if (
        !state.sensors.motionPermission
    ) {

        alert(
            "Enable the iPhone sensors first."
        );

        return;

    }


    /*
     * Start at workstation.
     */

    state.tracking = {

        active: true,

        x: 0,

        y: 0,

        heading:
            headingDeg,

        distance: 0,

        path: [

            {
                x: 0,
                y: 0,
                t: Date.now()
            }

        ]

    };


    $("startTrackBtn")
        .disabled = true;


    $("stopTrackBtn")
        .disabled = false;


    $("trackingState")
        .textContent =
        "Tracking";


    setStatus(
        "Tracking"
    );


    drawLiveMap();

    updateTrackingPage();

}


function stopTracking() {

    state.tracking.active =
        false;


    $("startTrackBtn")
        .disabled = false;


    $("stopTrackBtn")
        .disabled = true;


    $("trackingState")
        .textContent =
        "Stopped";


    setStatus(
        "Ready"
    );


    saveState();

}


/* =========================================================
   LIVE MAP
   ========================================================= */

function drawLiveMap() {

    const canvas =
        $("liveCanvas");


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawGrid(
        ctx,
        canvas.width,
        canvas.height
    );


    if (
        !state.plan.jpegUrl
    ) {

        return;

    }


    const image =
        new Image();


    image.onload = () => {

        /*
         * Draw saved JPEG.
         */

        const centerX =
            canvas.width / 2 +
            state.plan.imageTransform.x;


        const centerY =
            canvas.height / 2 +
            state.plan.imageTransform.y;


        ctx.save();


        ctx.translate(
            centerX,
            centerY
        );


        ctx.rotate(
            state.plan.imageTransform.rotation *
            Math.PI /
            180
        );


        const baseScale =
            Math.min(

                canvas.width /
                    image.width,

                canvas.height /
                    image.height

            ) * 0.8;


        const imageScale =
            baseScale *
            state.plan.imageTransform.scale;


        ctx.globalAlpha =
            0.95;


        ctx.drawImage(

            image,

            -image.width *
                imageScale /
                2,

            -image.height *
                imageScale /
                2,

            image.width *
                imageScale,

            image.height *
                imageScale

        );


        ctx.restore();


        /*
         * Draw the original setup path
         * and reference points.
         */

        const transform =
            calculateOverlayTransform(
                canvas.width,
                canvas.height
            );


        drawWorldLayer(
            ctx,
            transform
        );


        /*
         * Draw LIVE tracking path.
         */

        drawLivePath(
            ctx,
            transform
        );


        /*
         * Draw current position.
         */

        const current =
            worldToLiveCanvas(
                state.tracking.x,
                state.tracking.y,
                transform
            );


        drawCircle(
            ctx,
            current.x,
            current.y,
            12,
            "#ffffff"
        );


        drawCircle(
            ctx,
            current.x,
            current.y,
            7,
            "#ff6464"
        );


        ctx.fillStyle =
            "#ffffff";

        ctx.font =
            "bold 13px sans-serif";


        ctx.fillText(
            "YOU",
            current.x + 15,
            current.y + 5
        );

    };


    image.src =
        state.plan.jpegUrl;

}


/* =========================================================
   LIVE PATH
   ========================================================= */

function drawLivePath(
    ctx,
    transform
) {

    const path =
        state.tracking.path;


    if (
        !path ||
        path.length < 2
    ) {

        return;

    }


    function mapPoint(
        x,
        y
    ) {

        return {

            x:
                x *
                transform.scale +
                transform.offsetX,

            y:
                y *
                transform.scale +
                transform.offsetY

        };

    }


    ctx.beginPath();


    path.forEach(
        (point, index) => {

            const p =
                mapPoint(
                    point.x,
                    point.y
                );


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


    ctx.lineWidth =
        5;

    ctx.strokeStyle =
        "#ff6464";

    ctx.stroke();

}


/* =========================================================
   LIVE POSITION
   ========================================================= */

function worldToLiveCanvas(
    x,
    y,
    transform
) {

    return {

        x:
            x *
            transform.scale +
            transform.offsetX,

        y:
            y *
            transform.scale +
            transform.offsetY

    };

}


/* =========================================================
   UI
   ========================================================= */

function updateAllUI() {

    updateMappingUI();

    updateReferenceList();

    updateTrackingPage();

    updateSensorStatus();

    renderSetup();

}


function updateMappingUI() {

    $("mapX").textContent =
        state.mapping.x.toFixed(2);


    $("mapY").textContent =
        state.mapping.y.toFixed(2);


    $("mapDistance").textContent =
        state.mapping.distance.toFixed(2) +
        " m";


    $("referenceCount").textContent =
        state.mapping.references.length;

}


function updateReferenceList() {

    const container =
        $("referenceList");


    if (
        state.mapping.references.length === 0
    ) {

        container.innerHTML =
            `
            <div class="emptyMessage">
                No reference points yet.
            </div>
            `;

        return;

    }


    container.innerHTML =
        state.mapping.references
            .map(
                (reference, index) => `

                    <div class="referenceRow">

                        <div class="referenceBadge">
                            R${index + 1}
                        </div>

                        <div>
                            <strong>
                                ${reference.name}
                            </strong>
                        </div>

                        <div>
                            X:
                            ${reference.x.toFixed(2)}
                            m
                        </div>

                        <div>
                            Y:
                            ${reference.y.toFixed(2)}
                            m
                        </div>

                    </div>

                `
            )
            .join("");

}


function updateSensorStatus() {

    const setupStatus =
        $("sensorStatus");


    const parts = [];


    if (
        state.sensors.motionPermission
    ) {

        parts.push(
            "Motion permission OK"
        );

    }


    if (
        state.sensors.orientationPermission
    ) {

        parts.push(
            "Orientation permission OK"
        );

    }


    if (
        state.sensors.motionData
    ) {

        parts.push(
            "Motion data OK"
        );

    }


    if (
        state.sensors.orientationData
    ) {

        parts.push(
            "Heading data OK"
        );

    }


    if (
        parts.length > 0
    ) {

        setupStatus.textContent =
            parts.join(
                " • "
            );

    }

}


/* =========================================================
   TRACKING PAGE UI
   ========================================================= */

function updateTrackingPage() {

    if (
        !state.locked
    ) {

        $("trackLockedMessage")
            .classList.remove(
                "hidden"
            );


        $("trackingApplication")
            .classList.add(
                "hidden"
            );


        return;

    }


    $("trackLockedMessage")
        .classList.add(
            "hidden"
        );


    $("trackingApplication")
        .classList.remove(
            "hidden"
        );


    $("trackX").textContent =
        state.tracking.x.toFixed(2);


    $("trackY").textContent =
        state.tracking.y.toFixed(2);


    $("trackHeading").textContent =
        Math.round(
            state.tracking.heading
        ) + "°";


    $("trackDistance").textContent =
        state.tracking.distance.toFixed(2) +
        " m";

}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {

    $("statusBadge").textContent =
        text;

}


function updateAllUIStatusBadge() {

    if (
        state.locked
    ) {

        setStatus(
            "Setup locked"
        );

    } else {

        setStatus(
            "Setup required"
        );

    }

}


/* =========================================================
   RESTORE UPLOADED IMAGE
   ========================================================= */

function restoreUploadedImage() {

    if (
        !state.plan.jpegUrl
    ) {

        return;

    }


    const image =
        document.createElement(
            "img"
        );


    image.src =
        state.plan.jpegUrl;

    image.alt =
        "Uploaded floor plan";


    $("uploadedImagePreview")
        .innerHTML =
        "";


    $("uploadedImagePreview")
        .appendChild(
            image
        );


    $("uploadStatus").textContent =
        "Uploaded: " +
        state.plan.jpegName;

}


/* =========================================================
   FINAL INITIALIZATION
   ========================================================= */

if (
    state.locked
) {

    $("lockSetupBtn")
        .disabled = true;


    $("lockedSetup")
        .classList.remove(
            "hidden"
        );

}


renderSetup();
updateAllUI();