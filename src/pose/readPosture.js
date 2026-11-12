import {
  LEFT_EAR,
  LEFT_EYE,
  LEFT_SHOULDER,
  MIN_VISIBILITY,
  NOSE,
  RIGHT_EAR,
  RIGHT_EYE,
  RIGHT_SHOULDER,
} from "./constants";

function usable(point) {
  return point != null && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * Extracts comprehensive 3D and 2D posture metrics from MediaPipe landmarks:
 * - headForwardDepth: 3D Z-depth displacement of head relative to torso (MediaPipe Z-axis)
 * - headToShoulderRatio: optical head size vs shoulder span (primary forward leaning metric)
 * - headScale: optical width of head in frame
 * - headY: vertical level of head relative to camera frame / background
 * - noseToShoulderRatio: vertical distance divided by shoulder width (lenient secondary metric)
 * - shoulderTilt: vertical difference between left and right shoulders
 */
export function readPosture(landmarks) {
  if (!landmarks) return null;

  const nose = landmarks[NOSE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];

  if (!usable(nose) || !usable(leftShoulder) || !usable(rightShoulder)) {
    return null;
  }

  // Calculate shoulder midpoints
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderZ = ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2;
  const shoulderWidth = Math.max(0.05, Math.abs(leftShoulder.x - rightShoulder.x));
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);

  // Vertical distance of nose above shoulders
  const noseToShoulder = shoulderY - nose.y;
  const noseToShoulderRatio = noseToShoulder / shoulderWidth;

  // Head scale: try ear-to-ear first; fall back to eye-to-eye * 1.8 if wearing headphones/hair covers ears
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  const leftEye = landmarks[LEFT_EYE];
  const rightEye = landmarks[RIGHT_EYE];

  let headSpan = 0.12;
  if (usable(leftEar) && usable(rightEar)) {
    headSpan = Math.abs(leftEar.x - rightEar.x);
  } else if (usable(leftEye) && usable(rightEye)) {
    headSpan = Math.abs(leftEye.x - rightEye.x) * 1.8;
  }

  const headScale = Math.max(0.04, headSpan);
  // Key forward leaning ratio: as you lean toward the camera, head appears larger relative to shoulders
  const headToShoulderRatio = headScale / shoulderWidth;

  // 3D Forward Depth: In MediaPipe Z coordinates, smaller/negative Z means closer to camera.
  // When head cranes forward towards screen away from shoulders, (shoulderZ - nose.z) increases.
  const headForwardDepth = shoulderZ - (nose.z ?? 0);

  // Head vertical position against the camera frame / background
  const headY = nose.y;

  return {
    noseToShoulder,
    shoulderTilt,
    shoulderWidth,
    noseToShoulderRatio,
    headScale,
    headToShoulderRatio,
    headForwardDepth,
    headY,
  };
}

/**
 * Evaluates posture focusing primarily on FORWARD LEANING.
 * Highly stable with generous vertical allowance (looking down at keyboard or normal shifts are allowed).
 */
export function evaluatePosture(metrics, calibration = null, currentStatus = "good") {
  if (!metrics) {
    return {
      status: "searching",
      label: "Searching Pose",
      score: 0,
      reason: "No pose detected in frame",
    };
  }

  const wasSlouching = currentStatus === "slouch";

  // 1. Personalized Evaluation against Calibrated Baseline
  if (calibration && typeof calibration.noseToShoulder === "number") {
    // -------------------------------------------------------------
    // PRIMARY CRITERIA: FORWARD LEANING (Craning neck toward screen)
    // -------------------------------------------------------------
    const baseHeadRatio = calibration.headToShoulderRatio || 0.45;
    const headRatioIncrease = metrics.headToShoulderRatio / Math.max(0.1, baseHeadRatio);

    const baseDepth = calibration.headForwardDepth ?? 0;
    const depthForwardShift = metrics.headForwardDepth - baseDepth;

    // Generous forward leaning allowance with hysteresis:
    // To enter slouch: head must lean > 28% closer to screen (or combined depth shift > 0.18).
    // To recover to good: head must return within 18% of baseline.
    const forwardRatioThreshold = wasSlouching ? 1.18 : 1.28;
    const forwardDepthThreshold = wasSlouching ? 0.12 : 0.18;

    const isHeadForward =
      (depthForwardShift > forwardDepthThreshold && headRatioIncrease > 1.15) ||
      headRatioIncrease > forwardRatioThreshold ||
      depthForwardShift > (forwardDepthThreshold + 0.08);

    // -------------------------------------------------------------
    // SECONDARY CRITERIA: VERY LENIENT VERTICAL HEIGHT DROP
    // (Allows comfortable natural head movements, glancing at keys/notes)
    // -------------------------------------------------------------
    const baseRatio =
      calibration.noseToShoulderRatio ||
      calibration.noseToShoulder / Math.max(0.1, calibration.shoulderWidth || 0.3);
    const currentRatio = metrics.noseToShoulderRatio;

    // Only flag vertical slump if head drops > 35% below baseline (0.65)
    const ratioDropThreshold = wasSlouching ? baseRatio * 0.95 : baseRatio * 0.90;
    const isHeadDropped = currentRatio < ratioDropThreshold;

    // Frame drop against background: very lenient (16% drop allowed)
    const baseHeadY = calibration.headY ?? (metrics.headY - 0.01);
    const frameDropThreshold = wasSlouching ? 0.02 : 0.05;
    const isFrameDropped = metrics.headY > baseHeadY + frameDropThreshold;

    // -------------------------------------------------------------
    // SECONDARY CRITERIA: LENIENT SHOULDER TILT
    // -------------------------------------------------------------
    const baseTilt = calibration.shoulderTilt || 0.02;
    const maxTilt = wasSlouching ? Math.max(0.08, baseTilt + 0.06) : Math.max(0.10, baseTilt + 0.08);
    const isShoulderTilted = metrics.shoulderTilt > maxTilt;

    // Continuous smooth alignment score centered on forward posture (0 - 100%)
    const forwardDeviation = Math.max(0, (headRatioIncrease - 1.0) * 100);
    const depthDeviation = Math.max(0, depthForwardShift * 120);
    const primaryPenalty = Math.round(Math.max(forwardDeviation * 2.2, depthDeviation));
    const verticalPenalty = isHeadDropped ? 25 : Math.max(0, Math.round((1 - (currentRatio / baseRatio)) * 30));
    const tiltPenalty = isShoulderTilted ? 15 : 0;

    const score = Math.max(0, Math.min(100, 100 - primaryPenalty - verticalPenalty - tiltPenalty));

    // Decision based primarily on forward lean
    if (isHeadForward) {
      return {
        status: "slouch",
        label: "Slouch Detected",
        reason: "Head leaning too far forward",
        score,
      };
    }

    if (isHeadDropped || isFrameDropped) {
      return {
        status: "slouch",
        label: "Slouch Detected",
        reason: "Severe head drop / slump",
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
      reason: "Comfortable upright alignment",
    };
  }

  // 2. Uncalibrated Defaults (Lenient)
  const isForwardUncalibrated = metrics.headForwardDepth > (wasSlouching ? 0.16 : 0.22);
  const isDropUncalibrated = metrics.noseToShoulder < (wasSlouching ? 0.09 : 0.07);
  const isTiltUncalibrated = metrics.shoulderTilt > (wasSlouching ? 0.09 : 0.12);

  const uncalibratedScore = Math.max(0, Math.min(100, Math.round((metrics.noseToShoulder / 0.18) * 100)));

  if (isForwardUncalibrated) {
    return {
      status: "slouch",
      label: "Slouch Detected",
      reason: "Head leaning too far forward",
      score: Math.max(20, uncalibratedScore - 30),
    };
  }

  if (isDropUncalibrated) {
    return {
      status: "slouch",
      label: "Slouch Detected",
      reason: "Severe head drop / slump",
      score: uncalibratedScore,
    };
  }

  if (isTiltUncalibrated) {
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
