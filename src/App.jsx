import { useEffect, useRef } from "react";
import { PREVIEW_FPS, SAVER_FPS } from "./pose/constants";
import { usePictureInPicture } from "./hooks/usePictureInPicture";
import { usePoseCamera } from "./hooks/usePoseCamera";
import { usePostureAlerts } from "./hooks/usePostureAlerts";
import { usePostureCalibration } from "./hooks/usePostureCalibration";

function percent(value) {
  if (value == null || isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function App() {
  const canvasRef = useRef(null);
  const pipCanvasRef = useRef(null);

  const {
    calibration,
    isCalibrated,
    justCalibrated,
    calibrate,
    resetCalibration,
  } = usePostureCalibration();

  // PiP hook: supports ultra-compact Document PiP (140x48) with Video PiP fallback
  const {
    pipVideoRef,
    isPipSupported,
    isPipActive,
    pipError,
    togglePip,
    closePip,
    updatePipStatus,
  } = usePictureInPicture(pipCanvasRef);

  const {
    videoRef,
    modelState,
    cameraState,
    error,
    metrics,
    postureStatus,
    fps,
    frameAspect,
    fpsMode,
    setFpsMode,
    isTabHidden,
    start,
    stop,
  } = usePoseCamera({ canvasRef, isPipActive, calibration });

  const cameraOn = cameraState === "on";

  // Alert system: Web Audio Chime + 5-second slouch accumulator + Desktop Notifications
  const {
    isMuted,
    volume,
    slouchSeconds,
    cooldownSeconds,
    notificationPermission,
    toggleMute,
    setVolume,
    testChime,
    requestNotificationPermission,
  } = usePostureAlerts({ postureStatus, cameraOn });

  // Update the dedicated compact PiP widget (Document PiP or canvas fallback)
  useEffect(() => {
    updatePipStatus({
      status: cameraOn ? postureStatus?.status || "searching" : "searching",
      label: cameraOn ? postureStatus?.label || "Searching Pose" : "Camera Off",
      reason: cameraOn ? postureStatus?.reason || "" : "",
      score: cameraOn ? postureStatus?.score : 0,
      slouchSeconds,
      cameraOn,
    });
  }, [cameraOn, postureStatus, slouchSeconds, updatePipStatus]);

  // Automatically close PiP if the user stops the camera
  useEffect(() => {
    if (!cameraOn && isPipActive) {
      closePip();
    }
  }, [cameraOn, isPipActive, closePip]);

  const buttonLabel =
    modelState === "loading"
      ? "Loading pose model…"
      : cameraState === "starting"
        ? "Starting camera…"
        : cameraOn
          ? "Stop camera"
          : "Start camera";

  return (
    <div className="min-h-svh">
      {/* Dedicated off-screen canvas for the 2:1 micro PiP status card (High-DPI 240x120 for crystal clarity) */}
      <canvas
        ref={pipCanvasRef}
        width={240}
        height={120}
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          pointerEvents: "none",
        }}
      />

      {/* Auxiliary video element streaming the 2:1 PiP status canvas */}
      <video
        ref={pipVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 240,
          height: 120,
          pointerEvents: "none",
        }}
      />

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-emerald-300/80 uppercase">
              Posture monitor
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Real-Time Posture Guardian</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Desktop Notification Pill */}
            {notificationPermission === "granted" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Desktop alerts active
              </span>
            ) : notificationPermission === "denied" ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-red-300/80 bg-red-950/40 border border-red-500/20 px-3 py-1 rounded-full"
                title="Desktop notifications blocked in browser site settings"
              >
                🔕 Alerts blocked
              </span>
            ) : (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="inline-flex items-center gap-1.5 text-xs text-amber-200 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-400/40 px-3 py-1 rounded-full cursor-pointer transition shadow-xs"
                title="Enable OS Desktop Notifications to alert you when working in VS Code"
              >
                <span>🔔</span>
                <span>Enable Desktop Alerts</span>
              </button>
            )}

            {/* Quick Mute Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border cursor-pointer transition ${
                isMuted
                  ? "bg-white/5 text-white/50 border-white/10"
                  : "bg-white/10 text-white/90 border-white/20 hover:bg-white/15"
              }`}
              title={isMuted ? "Unmute audio chime alerts" : "Mute audio chime alerts"}
            >
              <span>{isMuted ? "🔇" : "🔊"}</span>
              <span>{isMuted ? "Muted" : "Sound on"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4">
          <div
            className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
            style={{ aspectRatio: frameAspect }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full opacity-0"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {!cameraOn && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/60">
                {cameraState === "starting"
                  ? "Waiting for the camera…"
                  : "Start the camera to begin monitoring your posture across all apps."}
              </div>
            )}

            {/* Live badge overlay on top right of main video */}
            <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white/90 border border-white/10">
                {isPipActive
                  ? `📺 Floating Mini Widget · ${fpsMode === "saver" ? "1 FPS" : "15 FPS"}`
                  : isTabHidden
                    ? "🛡️ Background mode · Worker 1 FPS"
                    : fpsMode === "saver"
                      ? `🍃 Saver mode · ${SAVER_FPS} FPS (<5% CPU)`
                      : `⚡ Preview mode · ${PREVIEW_FPS} FPS`}
              </span>
              {cameraOn && (
                <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs text-emerald-300 border border-emerald-500/20 tabular-nums">
                  {fps} fps
                </span>
              )}
            </div>

            {/* 5-Second Slouch Countdown Fill Bar overlay */}
            {cameraOn && postureStatus.status === "slouch" && (
              <div className="absolute top-14 left-3 right-3 sm:right-auto sm:w-80 bg-red-950/85 backdrop-blur-md border border-red-500/40 p-3 rounded-2xl shadow-xl transition-all">
                <div className="flex items-center justify-between text-xs text-red-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                    Slouching Detected
                  </span>
                  <span className="font-mono tabular-nums text-red-300 font-bold">
                    {slouchSeconds.toFixed(1)}s / 5.0s
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 transition-all duration-200 rounded-full"
                    style={{ width: `${(slouchSeconds / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-red-200/70">
                  {slouchSeconds >= 5
                    ? cooldownSeconds > 0
                      ? `Alert dispatched! Cooldown: ${cooldownSeconds}s`
                      : "Alerting: Sitting straight resets timer"
                    : `Alert will trigger in ${(5 - slouchSeconds).toFixed(1)}s`}
                </p>
              </div>
            )}

            {/* Calibration feedback toast overlay */}
            {justCalibrated && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/90 text-emerald-950 font-semibold px-4 py-2 rounded-full text-xs shadow-lg backdrop-blur-md transition-all animate-bounce">
                <span>✓</span>
                <span>Personal upright posture calibrated & saved!</span>
              </div>
            )}

            {/* Uncalibrated prompt banner */}
            {cameraOn && metrics && !isCalibrated && !justCalibrated && (
              <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 bg-black/75 backdrop-blur-md border border-amber-400/40 text-amber-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-md">
                <span className="text-amber-400 font-bold">💡 Tip:</span>
                <span>Sit straight and click <strong>Calibrate</strong> to customize forward-lean detection.</span>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={cameraOn ? stop : start}
                disabled={modelState !== "ready" || cameraState === "starting"}
                className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40 cursor-pointer shadow-sm"
              >
                {buttonLabel}
              </button>

              {/* One-Click Personal Calibration Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => calibrate(metrics)}
                  disabled={!cameraOn || !metrics}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition cursor-pointer border ${
                    justCalibrated
                      ? "bg-emerald-400 text-emerald-950 border-emerald-300 font-bold"
                      : isCalibrated
                        ? "bg-white/10 text-white border-white/20 hover:bg-white/15"
                        : "bg-amber-400/20 text-amber-200 border-amber-400/40 hover:bg-amber-400/30"
                  } disabled:cursor-not-allowed disabled:opacity-40 shadow-xs`}
                  title="Sit upright in your natural working posture and calibrate your personal baseline"
                >
                  <span>{justCalibrated ? "✓" : "🎯"}</span>
                  <span>
                    {justCalibrated
                      ? "Calibrated!"
                      : isCalibrated
                        ? "Recalibrate"
                        : "Sit Straight & Calibrate"}
                  </span>
                </button>

                {isCalibrated && (
                  <button
                    type="button"
                    onClick={resetCalibration}
                    className="text-xs text-white/40 hover:text-white/80 transition cursor-pointer px-2 py-1"
                    title="Reset to default thresholds and clear saved baseline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* PiP Pop-out Button (Compact Status Widget Only) */}
              {isPipSupported && (
                <button
                  type="button"
                  onClick={togglePip}
                  disabled={!cameraOn}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition cursor-pointer border ${
                    isPipActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-xs"
                      : "bg-white/5 text-white/90 border-white/10 hover:bg-white/10 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                  title="Pop out a tiny floating status widget over VS Code (no camera view, status only)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 11h5v5h-5z"
                    />
                  </svg>
                  {isPipActive ? "Close Floating Widget" : "Pop-out Floating Widget"}
                </button>
              )}

              {/* FPS Mode Switcher */}
              <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setFpsMode("preview")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    fpsMode === "preview"
                      ? "bg-white/20 text-white shadow-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                  title="Smooth interactive viewing at 15 FPS"
                >
                  ⚡ Preview (15 FPS)
                </button>
                <button
                  type="button"
                  onClick={() => setFpsMode("saver")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    fpsMode === "saver"
                      ? "bg-emerald-500/30 text-emerald-300 shadow-xs border border-emerald-400/30"
                      : "text-white/60 hover:text-white"
                  }`}
                  title="Low-CPU mode (1 FPS) for long sessions under 5% CPU"
                >
                  🍃 Saver (1 FPS)
                </button>
              </div>
            </div>

            <p className="text-xs text-white/50">
              Amber dot: nose · White dots: shoulders
            </p>
          </div>

          {pipError && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200" role="alert">
              {pipError}
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">
              {error}
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          {/* Posture Status & Live Score Card */}
          <div
            className={`rounded-2xl border px-4 py-3 transition-colors ${
              !cameraOn
                ? "border-white/10 bg-white/[0.03]"
                : postureStatus.status === "good"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : postureStatus.status === "slouch"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-wide text-white/45 uppercase">Live Posture Status</p>
              {cameraOn && typeof postureStatus.score === "number" && (
                <span className="text-xs font-bold tabular-nums">
                  {postureStatus.score}% alignment
                </span>
              )}
            </div>

            <p className="mt-1.5 text-lg font-semibold flex items-center gap-2">
              {cameraOn ? (
                <>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      postureStatus.status === "good"
                        ? "bg-emerald-400 animate-pulse"
                        : postureStatus.status === "slouch"
                          ? "bg-red-400 animate-pulse"
                          : "bg-amber-400"
                    }`}
                  />
                  {postureStatus.label}
                </>
              ) : (
                "Camera off"
              )}
            </p>

            {/* Alignment Score Bar */}
            {cameraOn && typeof postureStatus.score === "number" && (
              <div className="mt-2.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    postureStatus.status === "good"
                      ? "bg-emerald-400"
                      : postureStatus.status === "slouch"
                        ? "bg-red-400"
                        : "bg-amber-400"
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, postureStatus.score))}%` }}
                />
              </div>
            )}

            {cameraOn && postureStatus.reason && (
              <p className="mt-2 text-xs text-white/60">{postureStatus.reason}</p>
            )}
          </div>

          {/* Sound & Alert Controls Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs tracking-wide text-white/45 uppercase">Cross-App Alert Engine</p>

            <div className="mt-3 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Audio Chime:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={testChime}
                    disabled={isMuted}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-white/80 transition cursor-pointer disabled:opacity-30"
                    title="Play test chime"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      isMuted
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {isMuted ? "Muted" : "Active"}
                  </button>
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-white/70">Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  disabled={isMuted}
                  className="w-28 accent-emerald-400 cursor-pointer disabled:opacity-30"
                />
                <span className="w-8 text-right tabular-nums text-white/60">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              {/* Desktop Notification status */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-white/70">Desktop Alert:</span>
                <span
                  className={`font-medium ${
                    notificationPermission === "granted" ? "text-emerald-300" : "text-white/50"
                  }`}
                >
                  {notificationPermission === "granted" ? "Active (VS Code)" : "Off"}
                </span>
              </div>

              {/* Cooldown telemetry */}
              <div className="flex items-center justify-between text-white/50 text-[11px]">
                <span>Alert Cooldown:</span>
                <span className="tabular-nums">
                  {cooldownSeconds > 0 ? `${cooldownSeconds}s cooldown` : "Ready (30s)"}
                </span>
              </div>
            </div>
          </div>

          {/* Personal Calibration Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-wide text-white/45 uppercase">Personal Baseline</p>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  isCalibrated
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {isCalibrated ? "Calibrated" : "Default"}
              </span>
            </div>

            {isCalibrated ? (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-white/80">
                  <span>Upright head depth:</span>
                  <span className="font-medium tabular-nums">{percent(calibration.headForwardDepth || 0.05)}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Upright head ratio:</span>
                  <span className="font-medium tabular-nums">{percent(calibration.headToShoulderRatio || 0.45)}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Shoulder level tilt:</span>
                  <span className="font-medium tabular-nums">{percent(calibration.shoulderTilt)}</span>
                </div>
                <div className="flex justify-between text-white/45 text-[11px] mt-1 pt-1 border-t border-white/5">
                  <span>Saved in localStorage:</span>
                  <span>{calibration.calibratedAt || "Yes"}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-xs leading-5 text-white/50">
                Not calibrated yet. Sit straight and click &quot;Sit Straight &amp; Calibrate&quot; to customize to your body.
              </p>
            )}
          </div>

          <StatusCard
            label="Floating Mini Widget"
            value={
              !isPipSupported
                ? "Not supported in this browser"
                : isPipActive
                  ? "Floating Status Widget"
                  : "Standby"
            }
            hint="Displays a compact floating badge (status only, no camera view) over other apps."
          />

          <StatusCard
            label="Head position (vs Background)"
            value={
              !cameraOn || !metrics
                ? "—"
                : postureStatus.reason === "Head leaning too far forward"
                  ? "⚠️ Leaning Forward"
                  : postureStatus.reason === "Severe head drop / slump"
                    ? "⚠️ Dropped Down"
                    : "✓ Upright & Aligned"
            }
            hint="Detects 3D depth and head movement forward away from chair/background."
          />

          <StatusCard
            label="Power mode"
            value={
              isPipActive && fpsMode === "preview"
                ? "Mini Widget (15 FPS Worker)"
                : isTabHidden
                  ? "Background Worker (1 FPS)"
                  : fpsMode === "saver"
                    ? "Saver Mode (1 FPS)"
                    : "Preview Mode (15 FPS)"
            }
            hint={
              isPipActive && fpsMode === "preview"
                ? "Web Worker drives 15 FPS so floating widget remains responsive."
                : isTabHidden
                  ? "Tab hidden: Web Worker timer prevents browser throttling."
                  : fpsMode === "saver"
                    ? "Duty cycle <2.5%, CPU usage remains under 5%."
                    : "Fluid 15 FPS tracking."
            }
          />
        </aside>
      </main>
    </div>
  );
}

function StatusCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs tracking-wide text-white/45 uppercase">{label}</p>
      <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-white/45">{hint}</p>}
    </div>
  );
}
