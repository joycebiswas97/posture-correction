/** Preview cadence for normal interactive viewing. */
export const PREVIEW_FPS = 15;

/** Background and low-CPU saver cadence (1 tick every 1000ms = 1 FPS). Keeps CPU < 5%. */
export const SAVER_FPS = 1;

export const PREVIEW_INTERVAL_MS = Math.round(1000 / PREVIEW_FPS); // ~67ms
export const SAVER_INTERVAL_MS = Math.round(1000 / SAVER_FPS); // 1000ms

/**
 * Wasm must match the installed `@mediapipe/tasks-vision` version.
 * The JS API comes from npm; these binaries are loaded at runtime.
 */
export const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";

/** Smallest pose model. Enough for shoulders, nose, and a live skeleton. */
export const POSE_LITE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Indices inside MediaPipe's 33-point pose. */
export const NOSE = 0;
export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;

export const KEY_LANDMARKS = new Set([NOSE, LEFT_SHOULDER, RIGHT_SHOULDER]);

/** Skip joints the model is not confident about. */
export const MIN_VISIBILITY = 0.5;
