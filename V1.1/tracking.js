// ============================================================
// LIVE TRACKING
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

    const imageScale =
        Math.min(
            width / image.naturalWidth,
            height / image.naturalHeight
        );

    const imageWidth =
        image.naturalWidth * imageScale;

    const imageHeight =
        image.naturalHeight * imageScale;

    context.drawImage(

        image,

        (width - imageWidth) / 2,

        (height - imageHeight) / 2,

        imageWidth,

        imageHeight
    );

    const path =
        state.tracking.path;

    if (path.length < 1) {
        return;
    }

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
            (width - CANVAS_PADDING * 2) /
                rangeX,

            (height - CANVAS_PADDING * 2) /
                rangeY
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

    function alignedPoint(x, y) {

        return transformMapAreaPoint(
            {
                x: screenX(x),
                y: screenY(y)
            },
            width,
            height
        );
    }

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

        context.stroke();
    }

    const currentPoint =
        alignedPoint(
            state.tracking.x,
            state.tracking.y
        );

    context.beginPath();

    context.arc(
        currentPoint.x,
        currentPoint.y,
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


function setupTrackingEventListeners() {

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
}