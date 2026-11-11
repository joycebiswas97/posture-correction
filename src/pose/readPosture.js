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
 * Two numbers Step 4 will calibrate against:
 * - noseToShoulder: how far the nose sits above the shoulder line (0–1 of frame height)
 * - shoulderTilt: how unlevel the shoulders are (0–1 of frame height)
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
