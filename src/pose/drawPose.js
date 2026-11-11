import { PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  KEY_LANDMARKS,
  LEFT_SHOULDER,
  MIN_VISIBILITY,
  NOSE,
  RIGHT_SHOULDER,
} from "./constants";

function isVisible(point) {
  return point != null && (point.visibility ?? 0) >= MIN_VISIBILITY;
}

/**
 * Draws the skeleton in the current canvas transform.
 * Call this after mirroring so the joints sit on the mirrored webcam frame.
 */
export function drawPose(ctx, landmarks) {
  const { width, height } = ctx.canvas;
  const lineWidth = Math.max(2, width / 280);

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(167, 243, 208, 0.92)";
  ctx.beginPath();

  for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!isVisible(start) || !isVisible(end)) continue;
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
  }
  ctx.stroke();

  for (let index = 0; index < landmarks.length; index += 1) {
    const point = landmarks[index];
    if (!isVisible(point) || KEY_LANDMARKS.has(index)) continue;
    ctx.beginPath();
    ctx.fillStyle = "#d1fae5";
    ctx.arc(point.x * width, point.y * height, lineWidth * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawKeyPoint(ctx, landmarks[NOSE], "#f5c16c", lineWidth * 2.6);
  drawKeyPoint(ctx, landmarks[LEFT_SHOULDER], "#f8faf8", lineWidth * 2.4);
  drawKeyPoint(ctx, landmarks[RIGHT_SHOULDER], "#f8faf8", lineWidth * 2.4);
}

function drawKeyPoint(ctx, point, color, radius) {
  if (!isVisible(point)) return;
  const { width, height } = ctx.canvas;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
  ctx.fill();
}
