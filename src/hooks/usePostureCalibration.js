import { useCallback, useState } from "react";

const CALIBRATION_KEY = "posture_calibration_v1";

function loadSavedCalibration() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.noseToShoulder === "number") {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to read calibration from localStorage:", err);
  }
  return null;
}

/**
 * Manages user's personal upright posture calibration and persistence across reloads.
 * Records 3D depth, vertical position against background, and optical head scale.
 */
export function usePostureCalibration() {
  const [calibration, setCalibration] = useState(loadSavedCalibration);
  const [justCalibrated, setJustCalibrated] = useState(false);

  const calibrate = useCallback((currentMetrics) => {
    if (!currentMetrics) return false;

    const data = {
      noseToShoulder: currentMetrics.noseToShoulder,
      shoulderTilt: currentMetrics.shoulderTilt,
      shoulderWidth: currentMetrics.shoulderWidth,
      noseToShoulderRatio: currentMetrics.noseToShoulderRatio,
      headScale: currentMetrics.headScale,
      headToShoulderRatio: currentMetrics.headToShoulderRatio,
      headForwardDepth: currentMetrics.headForwardDepth,
      headY: currentMetrics.headY,
      calibratedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(data));
      setCalibration(data);
      setJustCalibrated(true);
      setTimeout(() => setJustCalibrated(false), 3000);
      return true;
    } catch (err) {
      console.error("Failed to save calibration:", err);
      return false;
    }
  }, []);

  const resetCalibration = useCallback(() => {
    try {
      localStorage.removeItem(CALIBRATION_KEY);
      setCalibration(null);
      setJustCalibrated(false);
    } catch (err) {
      console.error("Failed to clear calibration:", err);
    }
  }, []);

  return {
    calibration,
    isCalibrated: Boolean(calibration && typeof calibration.noseToShoulder === "number"),
    justCalibrated,
    calibrate,
    resetCalibration,
  };
}
