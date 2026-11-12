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
 * - noseToShoulder: vertical distance between nose and shoulder midpoint (0–1)
 * - shoulderTilt: vertical difference between left and right shoulders (0–1)
 * - shoulderWidth: horizontal span between shoulders (0–1)
 * - noseToShoulderRatio: vertical distance divided by shoulder width (scale-invariant)
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
  const noseToShoulder = shoulderY - nose.y;
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const shoulderWidth = Math.max(0.05, Math.abs(leftShoulder.x - rightShoulder.x));
  const noseToShoulderRatio = noseToShoulder / shoulderWidth;

  return {
    noseToShoulder,
    shoulderTilt,
    shoulderWidth,
    noseToShoulderRatio,
  };
}

/**
 * Evaluates whether current metrics represent upright posture or slouching.
 * Uses the user's calibrated personal baseline when available, or sensible defaults.
 */
export function evaluatePosture(metrics, calibration = null) {
  if (!metrics) {
    return {
      status: "searching",
      label: "Searching Pose",
      score: 0,
      reason: "No pose detected in frame",
    };
  }

  // 1. Personalized Evaluation (Calibrated Baseline)
  if (calibration && typeof calibration.noseToShoulder === "number") {
    const baseRatio = calibration.noseToShoulderRatio || (calibration.noseToShoulder / Math.max(0.1, calibration.shoulderWidth || 0.3));
    const currentRatio = metrics.noseToShoulderRatio;

    // A drop > 18% in neck-to-shoulder ratio indicates forward head / slouching
    const ratioThreshold = baseRatio * 0.82;
    // Allow slight natural head/body movements; flag if shoulders tilt more than baseline + 5%
    const maxTilt = Math.max(0.06, (calibration.shoulderTilt || 0.02) + 0.05);

    const isHeadDropped = currentRatio < ratioThreshold || metrics.noseToShoulder < calibration.noseToShoulder * 0.80;
    const isShoulderTilted = metrics.shoulderTilt > maxTilt;

    // Calculate alignment score (0 - 100%)
    const ratioScore = Math.min(100, Math.max(0, Math.round((currentRatio / baseRatio) * 100)));
    const tiltPenalty = Math.min(30, Math.round((metrics.shoulderTilt / maxTilt) * 20));
    const score = Math.max(0, Math.min(100, ratioScore - (isShoulderTilted ? tiltPenalty : 0)));

    if (isHeadDropped) {
      return {
        status: "slouch",
        label: "Slouch Detected",
        reason: "Head dropped forward",
        score,
      };
    }

    if (isShoulderTilted) {
      return {
        status: "slouch",
        label: "Slouch Detected",
        reason: "Shoulders unlevel",
        score,
      };
    }

    return {
      status: "good",
      label: "Good Posture",
      score,
      reason: "Aligned with your calibrated baseline",
    };
  }

  // 2. Uncalibrated Default Heuristics
  const uncalibratedScore = Math.round(
    Math.min(100, Math.max(0, (metrics.noseToShoulder / 0.18) * 100))
  );

  if (metrics.noseToShoulder < 0.12) {
    return {
      status: "slouch",
      label: "Slouch Detected",
      reason: "Head dropped forward",
      score: uncalibratedScore,
    };
  }

  if (metrics.shoulderTilt > 0.08) {
    return {
      status: "slouch",
      label: "Slouch Detected",
      reason: "Shoulders unlevel",
      score: uncalibratedScore,
    };
  }

  return {
    status: "good",
    label: "Good Posture",
    score: uncalibratedScore,
    reason: "Upright (default thresholds)",
  };
}
