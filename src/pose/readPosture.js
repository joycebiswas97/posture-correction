import {
  LEFT_SHOULDER,
  MIN_VISIBILITY,
  NOSE,
  RIGHT_SHOULDER,
} from "./constants";

function usable(point) {
  return point != null && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * Extracts raw posture metrics from MediaPipe landmarks:
 * - noseToShoulder: vertical distance between nose and shoulder line (normalized 0–1)
 * - shoulderTilt: difference between left and right shoulder height (normalized 0–1)
 */
export function readPosture(landmarks) {
  if (!landmarks) return null;

  const nose = landmarks[NOSE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  if (!usable(nose) || !usable(leftShoulder) || !usable(rightShoulder)) {
    return null;
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;

  return {
    noseToShoulder: shoulderY - nose.y,
    shoulderTilt: Math.abs(leftShoulder.y - rightShoulder.y),
  };
}

/**
 * Evaluates whether current metrics represent good posture or slouching.
 * Uses calibrated baseline if available, or sensible heuristics otherwise.
 */
export function evaluatePosture(metrics, calibration = null) {
  if (!metrics) {
    return { status: "searching", label: "Searching Pose" };
  }

  // If user calibrated their upright posture
  if (calibration && typeof calibration.noseToShoulder === "number") {
    // 15% drop from calibrated baseline indicates head forward/slouch
    const minNoseDist = calibration.noseToShoulder * 0.85;
    // Allow small natural movement, flag if shoulder tilt exceeds baseline + 5%
    const maxTilt = Math.max(0.06, (calibration.shoulderTilt || 0.02) + 0.05);

    if (metrics.noseToShoulder < minNoseDist) {
      return { status: "slouch", label: "Slouch Detected", reason: "Head dropped forward" };
    }
    if (metrics.shoulderTilt > maxTilt) {
      return { status: "slouch", label: "Slouch Detected", reason: "Shoulders unlevel" };
    }
    return { status: "good", label: "Good Posture" };
  }

  // Uncalibrated defaults
  if (metrics.noseToShoulder < 0.12) {
    return { status: "slouch", label: "Slouch Detected", reason: "Head dropped forward" };
  }
  if (metrics.shoulderTilt > 0.08) {
    return { status: "slouch", label: "Slouch Detected", reason: "Shoulders unlevel" };
  }

  return { status: "good", label: "Good Posture" };
}
