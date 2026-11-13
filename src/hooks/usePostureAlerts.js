import { useCallback, useEffect, useRef, useState } from "react";
import { playPostureChime } from "../utils/audioChime";

const SLOUCH_THRESHOLD_MS = 5000; // 5 consecutive seconds of slouching
const COOLDOWN_MS = 15000; // 15-second cooldown between alerts

function getSavedMute() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("posture_muted") === "true";
}

function getSavedVolume() {
  if (typeof window === "undefined") return 0.6;
  const val = parseFloat(localStorage.getItem("posture_volume"));
  return isNaN(val) ? 0.6 : Math.max(0, Math.min(1, val));
}

function getInitialNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function usePostureAlerts({ postureStatus, cameraOn }) {
  const [isMuted, setIsMuted] = useState(getSavedMute);
  const [volume, setVolumeState] = useState(getSavedVolume);
  const [notificationPermission, setNotificationPermission] = useState(
    getInitialNotificationPermission
  );

  const [slouchSeconds, setSlouchSeconds] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const postureStatusRef = useRef(postureStatus);
  const slouchStartRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);

  useEffect(() => {
    postureStatusRef.current = postureStatus;
  }, [postureStatus]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const setVolume = useCallback((newVol) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    try {
      localStorage.setItem("posture_volume", clamped.toString());
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("posture_muted", next.toString());
      } catch {}
      return next;
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return "unsupported";
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch (err) {
      console.warn("Notification permission error:", err);
      return "denied";
    }
  }, []);

  const testChime = useCallback(() => {
    playPostureChime(volumeRef.current);
  }, []);

  // Monitor slouch status and trigger alerts asynchronously via interval timer
  useEffect(() => {
    if (!cameraOn) {
      slouchStartRef.current = null;
      return;
    }

    const interval = setInterval(() => {
      const current = postureStatusRef.current;
      const isSlouching = current?.status === "slouch";

      if (!isSlouching) {
        slouchStartRef.current = null;
        setSlouchSeconds((prev) => (prev !== 0 ? 0 : prev));
        return;
      }

      const now = Date.now();
      if (slouchStartRef.current === null) {
        slouchStartRef.current = now;
      }

      const elapsed = now - slouchStartRef.current;
      const currentSlouchSec = parseFloat(Math.min(5, elapsed / 1000).toFixed(1));
      setSlouchSeconds(currentSlouchSec);

      // Check if 5 consecutive seconds of slouching reached
      if (elapsed >= SLOUCH_THRESHOLD_MS) {
        const timeSinceLastAlert = now - lastAlertTimeRef.current;

        if (timeSinceLastAlert >= COOLDOWN_MS) {
          lastAlertTimeRef.current = now;

          // 1. Play gentle synthesized audio chime
          if (!isMutedRef.current) {
            playPostureChime(volumeRef.current);
          }

          // 2. Trigger native OS Desktop Notification
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("Posture Alert ⚠️", {
                body: current?.reason
                  ? `${current.reason}. Sit back and align your posture!`
                  : "You have been slouching for 5 seconds. Sit back and align your posture!",
                tag: "posture-slouch-alert",
                renotify: true,
              });
            } catch (notifErr) {
              console.warn("Could not dispatch desktop notification:", notifErr);
            }
          }
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [cameraOn]);

  // Cooldown countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const remainingMs = COOLDOWN_MS - (Date.now() - lastAlertTimeRef.current);
      if (remainingMs > 0) {
        setCooldownSeconds(Math.ceil(remainingMs / 1000));
      } else {
        setCooldownSeconds(0);
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  return {
    isMuted,
    volume,
    slouchSeconds,
    cooldownSeconds,
    notificationPermission,
    toggleMute,
    setVolume,
    testChime,
    requestNotificationPermission,
  };
}
