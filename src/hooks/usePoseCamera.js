import { useCallback, useEffect, useRef, useState } from "react";
import {
  PREVIEW_INTERVAL_MS,
  SAVER_INTERVAL_MS,
} from "../pose/constants";
import { createPoseLandmarker } from "../pose/createPoseLandmarker";
import { drawPose } from "../pose/drawPose";
import { readPosture } from "../pose/readPosture";
import { createTickerWorker } from "../pose/tickerWorker";

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Camera permission was denied. Allow the camera for this site, then try again.";
  }
  if (error?.name === "NotFoundError") {
    return "No camera was found on this computer.";
  }
  return error?.message || "The camera could not be started.";
}

function snapshotPose(result) {
  const pose = result.landmarks?.[0];
  if (!pose) return null;
  return pose.map((point) => ({
    x: point.x,
    y: point.y,
    visibility: point.visibility ?? 0,
  }));
}

export function usePoseCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const workerRef = useRef(null);
  const landmarksRef = useRef(null);
  const lastTimestampRef = useRef(-1);
  const lastFrameTimeRef = useRef(0);
  const runningRef = useRef(false);
  const sessionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const frameCountRef = useRef(0);
  const fpsStampRef = useRef(0);

  const [modelState, setModelState] = useState("loading");
  const [delegate, setDelegate] = useState("");
  const [cameraState, setCameraState] = useState("off");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [fps, setFps] = useState(0);
  const [frameAspect, setFrameAspect] = useState(4 / 3);
  const [fpsMode, setFpsMode] = useState("preview"); // 'preview' (15 FPS) | 'saver' (1 FPS)
  const [isTabHidden, setIsTabHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false
  );

  // Initialize MediaPipe Pose Lite and the background ticker worker
  useEffect(() => {
    let cancelled = false;

    // Create the anti-throttling worker
    const ticker = createTickerWorker();
    workerRef.current = ticker;

    createPoseLandmarker()
      .then(({ landmarker, delegate: activeDelegate }) => {
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setDelegate(activeDelegate);
        setModelState("ready");
      })
      .catch((loadError) => {
        if (cancelled) return;
        setModelState("error");
        setError(loadError?.message || "The pose model could not be loaded.");
      });

    // Listen for tab visibility changes (e.g. user switching to VS Code)
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      runningRef.current = false;
      sessionRef.current += 1;
      cancelAnimationFrame(rafRef.current);
      ticker.terminate();
      workerRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Frame processing step (shared by both RAF and Web Worker)
  const processFrame = useCallback((now) => {
    if (!runningRef.current || isProcessingRef.current) return;

    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!videoEl || !canvas || !landmarker || videoEl.readyState < 2) return;

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (!width || !height) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isProcessingRef.current = true;
    try {
      let timestamp = now;
      if (timestamp <= lastTimestampRef.current) {
        timestamp = lastTimestampRef.current + 1;
      }

      try {
        const result = landmarker.detectForVideo(videoEl, timestamp);
        lastTimestampRef.current = timestamp;
        landmarksRef.current = snapshotPose(result);
        try {
          result.close?.();
        } catch {
          // No-op
        }
      } catch (detectError) {
        console.error("Detection error:", detectError);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, width, height);
      if (landmarksRef.current) {
        drawPose(ctx, landmarksRef.current);
      }
      ctx.restore();

      // Read current posture metrics (nose-to-shoulder, tilt)
      setMetrics(readPosture(landmarksRef.current));

      // Calculate actual rolling FPS
      frameCountRef.current += 1;
      const nowTime = performance.now();
      if (nowTime - fpsStampRef.current >= 1000) {
        const measured = Math.round(
          (frameCountRef.current * 1000) / (nowTime - fpsStampRef.current)
        );
        setFps(measured);
        frameCountRef.current = 0;
        fpsStampRef.current = nowTime;
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const processFrameRef = useRef(processFrame);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  // Connect Web Worker tick to processFrame
  useEffect(() => {
    const ticker = workerRef.current;
    if (!ticker) return;
    ticker.onmessage = () => {
      processFrameRef.current(performance.now());
    };
  }, []);

  // Synchronize execution cadence based on:
  // 1. Camera state (on/off)
  // 2. Tab visibility (hidden -> always use Web Worker to defeat background timer freezing)
  // 3. User FPS mode (preview 15 FPS vs saver 1 FPS)
  useEffect(() => {
    if (cameraState !== "on") {
      cancelAnimationFrame(rafRef.current);
      workerRef.current?.stop();
      return;
    }

    const ticker = workerRef.current;

    // If tab is hidden or user selected Saver Mode: run via unthrottled Web Worker (1 FPS)
    if (isTabHidden || fpsMode === "saver") {
      cancelAnimationFrame(rafRef.current);
      ticker?.start(SAVER_INTERVAL_MS);
      return;
    }

    // Otherwise, tab is visible and Preview Mode (15 FPS) is active
    ticker?.stop();
    let isCancelled = false;

    const tick = (now) => {
      if (isCancelled || !runningRef.current) return;
      rafRef.current = requestAnimationFrame(tick);

      if (now - lastFrameTimeRef.current < PREVIEW_INTERVAL_MS) return;
      lastFrameTimeRef.current = now;
      processFrameRef.current(now);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraState, fpsMode, isTabHidden]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    workerRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarksRef.current = null;
    lastTimestampRef.current = -1;

    const video = videoRef.current;
    if (video) video.srcObject = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    setMetrics(null);
    setFps(0);
    setFrameAspect(4 / 3);
    setCameraState("off");
  }, []);

  const start = useCallback(async () => {
    if (!landmarkerRef.current || runningRef.current) return;

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setError("");
    setCameraState("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraState("off");
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth && video.videoHeight) {
        setFrameAspect(video.videoWidth / video.videoHeight);
      }

      if (session !== sessionRef.current) return;

      frameCountRef.current = 0;
      fpsStampRef.current = performance.now();
      runningRef.current = true;
      setCameraState("on");
    } catch (startError) {
      if (session !== sessionRef.current) return;
      runningRef.current = false;
      setCameraState("error");
      setError(cameraErrorMessage(startError));
    }
  }, []);

  return {
    videoRef,
    canvasRef,
    modelState,
    delegate,
    cameraState,
    error,
    metrics,
    fps,
    frameAspect,
    fpsMode,
    setFpsMode,
    isTabHidden,
    start,
    stop,
  };
}
