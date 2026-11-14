/**
 * Renders a high-DPI micro status widget (2:1 aspect ratio).
 * Using a 240x120 native canvas resolution eliminates the blurriness caused by
 * OS window upscaling while maintaining the ultra-compact 2:1 proportion.
 */
export function renderPipStatusCard(
  canvas,
  {
    status = "searching",
    score = null,
    slouchSeconds = 0,
  } = {}
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width || 120;
  const height = canvas.height || 60;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Sleek Background & Theme Colors
  let bgColor = "#0a130f";
  let borderColor = "rgba(52, 211, 153, 0.45)";
  let dotColor = "#10b981";
  let textColor = "#6ee7b7";
  let titleText = "GOOD";
  let subText = typeof score === "number" && score > 0 ? `${score}% ALIGNED` : "100% ALIGNED";

  if (status === "slouch") {
    bgColor = "#1d0808";
    borderColor = "rgba(248, 113, 113, 0.55)";
    dotColor = "#ef4444";
    textColor = "#fca5a5";
    titleText = "SLOUCH";
    subText = slouchSeconds > 0 ? `ALERT IN ${(Math.max(0, 5 - slouchSeconds)).toFixed(1)}s` : "LEANING IN";
  } else if (status !== "good") {
    bgColor = "#131614";
    borderColor = "rgba(251, 191, 36, 0.35)";
    dotColor = "#fbbf24";
    textColor = "#fde68a";
    titleText = "WAIT";
    subText = "SEEKING POSE";
  }

  // Draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Draw crisp border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

  // 2. High-DPI Glowing Status Dot
  const dotX = Math.round(width * 0.17);
  const dotY = Math.round(height * 0.5);
  const dotRadius = Math.round(height * 0.12);

  // Outer glow
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius * 1.9, 0, Math.PI * 2);
  ctx.fillStyle =
    status === "good"
      ? "rgba(16, 185, 129, 0.28)"
      : status === "slouch"
        ? "rgba(239, 68, 68, 0.38)"
        : "rgba(251, 191, 36, 0.28)";
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();

  // 3. Crisp Vector Typography
  const textX = Math.round(width * 0.33);

  // Line 1: Primary Status ("GOOD" / "SLOUCH" / "WAIT")
  const fontSize1 = Math.round(height * 0.28);
  ctx.font = `bold ${fontSize1}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(titleText, textX, Math.round(height * 0.36));

  // Line 2: Alignment Score or Countdown Timer ("98% ALIGNED" / "ALERT IN 2.4s")
  const fontSize2 = Math.round(height * 0.18);
  ctx.font = `600 ${fontSize2}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = status === "slouch" ? "#f87171" : "rgba(255, 255, 255, 0.7)";
  ctx.fillText(subText, textX, Math.round(height * 0.68));
}
