import { useEffect, useRef } from "react";
import { PREVIEW_FPS, SAVER_FPS } from "./pose/constants";
import { usePictureInPicture } from "./hooks/usePictureInPicture";
import { usePoseCamera } from "./hooks/usePoseCamera";

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

export default function App() {
  const canvasRef = useRef(null);

  const {
    pipVideoRef,
    isPipSupported,
    isPipActive,
    pipError,
    togglePip,
    closePip,
  } = usePictureInPicture(canvasRef);

  const {
    videoRef,
    modelState,
    delegate,
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
  } = usePoseCamera({ canvasRef, isPipActive });

  const cameraOn = cameraState === "on";

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
      {/* Off-screen auxiliary video element with real dimensions for smooth Picture-in-Picture */}
      <video
        ref={pipVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 320,
          height: 240,
          pointerEvents: "none",
        }}
      />

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-emerald-300/80 uppercase">
              Posture monitor
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Live pose & PiP Monitor</h1>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <p className="max-w-xs text-sm text-white/55 sm:text-right">
              Pose Lite model runs locally in your browser. Nothing leaves your device.
            </p>
            {cameraOn && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Anti-throttling worker active
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
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
                  : "Start the camera to see your pose and enable the PiP floating monitor."}
              </div>
            )}

            {/* Live badge overlay on top right */}
            <div className="absolute top-3 right-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white/90 border border-white/10">
                {isPipActive
                  ? `📺 Floating Mini Monitor · ${fpsMode === "saver" ? "1 FPS (Saver)" : "15 FPS (Smooth)"}`
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

              {/* PiP Pop-out Button */}
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
                  title="Pop out a floating window with posture badge over VS Code and other apps"
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
                  {isPipActive ? "Exit Mini Monitor" : "Pop-out Mini Monitor"}
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
          {/* Posture Status Card */}
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
            <p className="text-xs tracking-wide text-white/45 uppercase">Live posture status</p>
            <p className="mt-1 text-lg font-semibold flex items-center gap-2">
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
            {cameraOn && postureStatus.reason && (
              <p className="mt-1 text-xs text-red-300/80">{postureStatus.reason}</p>
            )}
          </div>

          <StatusCard
            label="Floating Mini Monitor"
            value={
              !isPipSupported
                ? "Not supported in this browser"
                : isPipActive
                  ? `Active (${fpsMode === "saver" ? "1 FPS Saver" : "15 FPS Smooth"})`
                  : "Standby"
            }
            hint="Streams the canvas and posture badge over VS Code or other desktop apps."
          />

          <StatusCard
            label="Engine"
            value={modelValue(modelState, delegate)}
            hint="Pose Lite runs in-browser with GPU/CPU fallback."
          />

          <StatusCard
            label="Power mode"
            value={
              isPipActive && fpsMode === "preview"
                ? "Mini Monitor Smooth (15 FPS Worker)"
                : isTabHidden
                  ? "Background Worker (1 FPS)"
                  : fpsMode === "saver"
                    ? "Saver Mode (1 FPS)"
                    : "Preview Mode (15 FPS)"
            }
            hint={
              isPipActive && fpsMode === "preview"
                ? "Web Worker drives 15 FPS so PiP remains fluid over other apps."
                : isTabHidden
                  ? "Tab hidden: Web Worker timer prevents browser throttling."
                  : fpsMode === "saver"
                    ? "Duty cycle <2.5%, CPU usage remains under 5%."
                    : "Fluid 15 FPS skeleton tracking."
            }
          />

          <StatusCard
            label="Detection rate"
            value={cameraOn ? `${fps} fps` : "—"}
            hint={cameraOn ? "Measured frames analyzed per second." : "Camera is currently off."}
          />

          <StatusCard
            label="Nose above shoulders"
            value={metrics ? percent(metrics.noseToShoulder) : "—"}
            hint="Shrinks when your head tilts or drops forward."
          />

          <StatusCard
            label="Shoulder tilt"
            value={metrics ? percent(metrics.shoulderTilt) : "—"}
            hint="Difference in vertical level between shoulders."
          />
        </aside>
      </main>
    </div>
  );
}

function modelValue(modelState, delegate) {
  if (modelState === "loading") return "Loading Pose Lite…";
  if (modelState === "error") return "Failed to load";
  return `Pose Lite · ${delegate}`;
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
