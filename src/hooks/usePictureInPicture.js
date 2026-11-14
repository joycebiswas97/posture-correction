import { useCallback, useEffect, useRef, useState } from "react";
import { renderPipStatusCard } from "../pose/renderPipStatusCard";

function setupDocPipDom(doc) {
  doc.title = "Posture";
  doc.body.style.margin = "0";
  doc.body.style.padding = "0";
  doc.body.style.overflow = "hidden";
  doc.body.style.background = "#0a130f";
  doc.body.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  doc.body.innerHTML = `
    <div id="pip-container" style="
      display: flex;
      align-items: center;
      width: 100vw;
      height: 100vh;
      box-sizing: border-box;
      padding: 4px 10px;
      gap: 8px;
      background: #0a130f;
      border: 1.5px solid rgba(52, 211, 153, 0.45);
      user-select: none;
      cursor: default;
    ">
      <div id="pip-dot" style="
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.9);
        flex-shrink: 0;
      "></div>
      <div style="display: flex; flex-direction: column; justify-content: center; min-width: 0; flex: 1;">
        <div id="pip-title" style="
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #6ee7b7;
          line-height: 1.1;
        ">GOOD</div>
        <div id="pip-sub" style="
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        ">100% ALIGNED</div>
      </div>
    </div>
  `;
}

function updateDocPipDom(doc, { status, score, slouchSeconds, cameraOn } = {}) {
  if (!doc) return;
  const container = doc.getElementById("pip-container");
  const dot = doc.getElementById("pip-dot");
  const title = doc.getElementById("pip-title");
  const sub = doc.getElementById("pip-sub");

  if (!container || !dot || !title || !sub) return;

  if (!cameraOn) {
    container.style.background = "#131614";
    container.style.borderColor = "rgba(251, 191, 36, 0.35)";
    dot.style.background = "#fbbf24";
    dot.style.boxShadow = "0 0 8px rgba(251, 191, 36, 0.6)";
    title.style.color = "#fde68a";
    title.textContent = "OFF";
    sub.textContent = "CAMERA OFF";
    return;
  }

  if (status === "slouch") {
    container.style.background = "#1d0808";
    container.style.borderColor = "rgba(248, 113, 113, 0.55)";
    dot.style.background = "#ef4444";
    dot.style.boxShadow = "0 0 8px rgba(239, 68, 68, 0.9)";
    title.style.color = "#fca5a5";
    title.textContent = "SLOUCH";
    sub.textContent =
      slouchSeconds > 0
        ? `ALERT IN ${Math.max(0, 5 - slouchSeconds).toFixed(1)}s`
        : "LEANING IN";
  } else if (status === "good") {
    container.style.background = "#0a130f";
    container.style.borderColor = "rgba(52, 211, 153, 0.45)";
    dot.style.background = "#10b981";
    dot.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.9)";
    title.style.color = "#6ee7b7";
    title.textContent = "GOOD";
    sub.textContent =
      typeof score === "number" && score > 0 ? `${score}% ALIGNED` : "100% ALIGNED";
  } else {
    container.style.background = "#131614";
    container.style.borderColor = "rgba(251, 191, 36, 0.35)";
    dot.style.background = "#fbbf24";
    dot.style.boxShadow = "0 0 8px rgba(251, 191, 36, 0.6)";
    title.style.color = "#fde68a";
    title.textContent = "WAIT";
    sub.textContent = "SEEKING POSE";
  }
}

/**
 * Manages Picture-in-Picture:
 * 1. Prioritizes the modern Document Picture-in-Picture API (Chrome/Edge 111+)
 *    which creates an ultra-compact floating widget (140x48px) with NO video overlay controls.
 * 2. Seamlessly falls back to standard HTML5 Video PiP if Document PiP is unavailable.
 */
export function usePictureInPicture(canvasRef) {
  const pipVideoRef = useRef(null);
  const streamRef = useRef(null);
  const docPipWindowRef = useRef(null);
  const lastStatusRef = useRef(null);

  const [isPipSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      (Boolean("documentPictureInPicture" in window) ||
        (typeof document !== "undefined" &&
          Boolean(document.pictureInPictureEnabled)))
  );
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipError, setPipError] = useState("");

  // Video PiP listeners (for fallback)
  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    const handleEnter = () => {
      setIsPipActive(true);
      setPipError("");
    };

    const handleLeave = () => {
      // Only set inactive if docPip is also not active
      if (!docPipWindowRef.current) {
        setIsPipActive(false);
      }
    };

    video.addEventListener("enterpictureinpicture", handleEnter);
    video.addEventListener("leavepictureinpicture", handleLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnter);
      video.removeEventListener("leavepictureinpicture", handleLeave);
    };
  }, []);

  const closePip = useCallback(async () => {
    if (docPipWindowRef.current) {
      try {
        docPipWindowRef.current.close();
      } catch {
        // Ignore
      }
      docPipWindowRef.current = null;
    }

    if (
      typeof document !== "undefined" &&
      document.pictureInPictureElement
    ) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // Ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.srcObject = null;
    }

    setIsPipActive(false);
  }, []);

  const togglePip = useCallback(async () => {
    setPipError("");

    // If currently active, close it
    if (isPipActive || docPipWindowRef.current || (typeof document !== "undefined" && document.pictureInPictureElement)) {
      await closePip();
      return;
    }

    // 1. Try Document Picture-in-Picture API first (Ultra-compact 140x48 window, no media controls)
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 140,
          height: 48,
        });

        docPipWindowRef.current = pipWin;
        setIsPipActive(true);
        setPipError("");

        setupDocPipDom(pipWin.document);
        if (lastStatusRef.current) {
          updateDocPipDom(pipWin.document, lastStatusRef.current);
        }

        pipWin.addEventListener("pagehide", () => {
          docPipWindowRef.current = null;
          setIsPipActive(false);
        });

        return;
      } catch (err) {
        console.warn("Document PiP request failed, falling back to Video PiP:", err);
      }
    }

    // 2. Fallback to standard Video Picture-in-Picture
    const canvas = canvasRef.current;
    const video = pipVideoRef.current;

    if (!canvas || !video) {
      setPipError("Canvas is not ready for Picture-in-Picture.");
      return;
    }

    try {
      if (!video.srcObject) {
        const stream = canvas.captureStream(30);
        streamRef.current = stream;
        video.srcObject = stream;
      }

      await video.play();
      await video.requestPictureInPicture();
    } catch (err) {
      console.error("Picture-in-Picture request failed:", err);
      setPipError(err?.message || "Could not launch Picture-in-Picture window.");
    }
  }, [canvasRef, closePip, isPipActive]);

  // Update function to update both the Document PiP window DOM and the canvas
  const updatePipStatus = useCallback(
    (statusData) => {
      lastStatusRef.current = statusData;

      // Update Document PiP window if open
      if (docPipWindowRef.current && docPipWindowRef.current.document) {
        updateDocPipDom(docPipWindowRef.current.document, statusData);
      }

      // Update canvas for video PiP fallback or preview
      if (canvasRef.current) {
        renderPipStatusCard(canvasRef.current, statusData);
      }
    },
    [canvasRef]
  );

  return {
    pipVideoRef,
    isPipSupported,
    isPipActive,
    pipError,
    togglePip,
    closePip,
    updatePipStatus,
  };
}
