import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages Picture-in-Picture (PiP) streaming from an HTML5 canvas to an auxiliary
 * video element. Standard PiP creates an OS-level floating window that remains on top
 * of all desktop apps (VS Code, terminal, etc.).
 */
export function usePictureInPicture(canvasRef) {
  const pipVideoRef = useRef(null);
  const streamRef = useRef(null);

  const [isPipSupported] = useState(
    () =>
      typeof document !== "undefined" &&
      Boolean(document.pictureInPictureEnabled)
  );
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipError, setPipError] = useState("");

  // Listen to PiP enter/leave events on the auxiliary video
  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video) return;

    const handleEnter = () => {
      setIsPipActive(true);
      setPipError("");
    };

    const handleLeave = () => {
      setIsPipActive(false);
    };

    video.addEventListener("enterpictureinpicture", handleEnter);
    video.addEventListener("leavepictureinpicture", handleLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnter);
      video.removeEventListener("leavepictureinpicture", handleLeave);
    };
  }, []);

  const togglePip = useCallback(async () => {
    setPipError("");

    // If already in PiP, exit
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (err) {
        console.error("Error exiting Picture-in-Picture:", err);
      }
      return;
    }

    const canvas = canvasRef.current;
    const video = pipVideoRef.current;

    if (!canvas || !video) {
      setPipError("Canvas is not ready for Picture-in-Picture.");
      return;
    }

    try {
      // Create stream with 30fps cap so 15fps worker ticks are captured smoothly without dropped frames
      if (!video.srcObject) {
        const stream = canvas.captureStream(30);
        streamRef.current = stream;
        video.srcObject = stream;
      }

      await video.play();
      await video.requestPictureInPicture();
    } catch (err) {
      console.error("Picture-in-Picture request failed:", err);
      setPipError(
        err?.message || "Could not launch Picture-in-Picture window."
      );
    }
  }, [canvasRef]);

  const closePip = useCallback(async () => {
    if (document.pictureInPictureElement) {
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

  return {
    pipVideoRef,
    isPipSupported,
    isPipActive,
    pipError,
    togglePip,
    closePip,
  };
}
