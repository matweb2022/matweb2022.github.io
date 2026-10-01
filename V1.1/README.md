# Production Floor Tracker V1.1

This version changes the architecture so the tracking engine is independent of the floor-plan image/PDF.

## Architecture

PHONE SENSORS
    ↓
WORLD POSITION ENGINE
    ↓
X/Y coordinates in metres
    ↓
+ checkpoints / corrections
    ↓
AREA POLYGONS in metres
    ↓
TIME LOG

Separately:

PDF FLOOR PLAN
    ↓
3–4 calibration points
    ↓
affine map transform
    ↓
PDF display coordinates

The PDF is therefore a visualization/calibration layer, not the source of truth.

## Main V1.1 functions

- Start from a user-defined world origin.
- Track estimated X/Y in metres.
- Add named checkpoints.
- Correct drift by setting current position to a known checkpoint.
- Upload a PDF floor plan.
- Click PDF locations and associate them with real-world X/Y coordinates.
- Use 3+ calibration points.
- Lock the calibration.
- Draw area polygons directly in world coordinates.
- Detect current area with point-in-polygon.
- Track time spent in areas.
- Export CSV.
- Export/import complete project JSON.
- LocalStorage persistence.

## Important limitation

The phone does NOT magically know its absolute indoor position.

V1.1 uses experimental pedestrian dead reckoning:
- accelerometer
- device orientation / heading
- step detection
- fixed estimated step length

This will drift.

The checkpoint system is intentionally designed to let you periodically correct that drift.

For a later version, the checkpoint correction can be made more automatic using:
- one BLE beacon,
- Wi-Fi fingerprinting,
- visual markers,
- QR/AprilTags,
- UWB,
- or other external references.

## iPhone requirements

Device motion/orientation APIs generally require a secure context (HTTPS) and user permission.

For the first phone test, host the files from an HTTPS site.

The PDF renderer currently loads PDF.js from a CDN, so PDF loading requires internet access in this prototype.

Later we can bundle PDF.js locally and make the application fully self-contained/offline.

## Calibration

Recommended procedure:

1. Set your workstation as world origin `(0,0)`.
2. Measure or establish several physical reference points.
3. Add those points as checkpoints.
4. Upload the PDF.
5. Start calibration.
6. Click a PDF point.
7. Enter its real-world X/Y.
8. Repeat for at least 3 points.
9. Use 4 points if possible.
10. Lock calibration.

After locking, the application can convert world coordinates to PDF coordinates.

## Area setup

Areas are stored like:

{
  "name": "Welding Cell",
  "polygon": [
    {"x": 4, "y": 3},
    {"x": 12, "y": 3},
    {"x": 12, "y": 10},
    {"x": 4, "y": 10}
  ]
}

Changing the PDF does not change the area.

## Next logical versions

V1.2:
- Better sensor fusion.
- Better step detection.
- User-adjustable heading.
- Automatic checkpoint prompts.

V1.3:
- Better calibration error display.
- PDF map panning/zooming.
- Map overlay of live position.

V2:
- Optional single BLE beacon.
- Automatic checkpoint recognition.
- Better indoor position correction.
