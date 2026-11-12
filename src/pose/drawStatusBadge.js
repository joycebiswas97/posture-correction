/**
 * Renders a high-contrast posture status badge directly onto the canvas.
 * This ensures that when the canvas is streamed via Picture-in-Picture (PiP),
 * the user sees their live status indicator floating over any application (VS Code, etc.).
 */
export function drawStatusBadge(ctx, { status = "searching", label = "Searching" } = {}) {
  const { width } = ctx.canvas;
  const padding = Math.max(12, Math.round(width * 0.025));
  const badgeHeight = Math.max(34, Math.round(width * 0.065));
  const badgeWidth = Math.max(160, Math.round(width * 0.32));
  const x = padding;
  const y = padding;
  const radius = 10;

  ctx.save();

  // Draw pill background
  ctx.fillStyle = "rgba(10, 15, 13, 0.82)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;

  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
    ctx.fill();
    ctx.stroke();
  } else {
    // Fallback for older engines
    ctx.fillRect(x, y, badgeWidth, badgeHeight);
    ctx.strokeRect(x, y, badgeWidth, badgeHeight);
  }

  // Status colors & dot
  let dotColor = "#fbbf24"; // amber for searching
  let textColor = "#fde68a";

  if (status === "good") {
    dotColor = "#34d399"; // emerald/green
    textColor = "#a7f3d0";
  } else if (status === "slouch") {
    dotColor = "#f87171"; // red
    textColor = "#fecaca";
  }

  const dotX = x + badgeHeight * 0.45;
  const dotY = y + badgeHeight / 2;
  const dotRadius = Math.max(4, badgeHeight * 0.14);

  // Outer glow for the status dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = status === "good"
    ? "rgba(52, 211, 153, 0.25)"
    : status === "slouch"
      ? "rgba(248, 113, 113, 0.25)"
      : "rgba(251, 191, 36, 0.25)";
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();

  // Status text
  const fontSize = Math.max(11, Math.round(badgeHeight * 0.38));
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), dotX + dotRadius * 2.2, dotY);

  ctx.restore();
}

