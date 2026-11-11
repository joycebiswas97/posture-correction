import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_LITE_MODEL, WASM_BASE } from "./constants";

const TASK_OPTIONS = {
  runningMode: "VIDEO",
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputSegmentationMasks: false,
};

/**
 * Loads Pose Landmarker Lite once. GPU is preferred; CPU is the fallback
 * when WebGL is unavailable. The returned landmarker is closed by the caller.
 */
export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  try {
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      ...TASK_OPTIONS,
      baseOptions: {
        modelAssetPath: POSE_LITE_MODEL,
        delegate: "GPU",
      },
    });
    return { landmarker, delegate: "GPU" };
  } catch {
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      ...TASK_OPTIONS,
      baseOptions: {
        modelAssetPath: POSE_LITE_MODEL,
        delegate: "CPU",
      },
    });
    return { landmarker, delegate: "CPU" };
  }
}
