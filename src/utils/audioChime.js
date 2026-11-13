/**
 * Synthesizes a gentle, non-jarring 2-tone melodic chime using the Web Audio API.
 * Requires no external audio files or network requests; works 100% offline.
 */
let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch (err) {
    console.warn("Could not initialize AudioContext:", err);
  }
  return audioCtx;
}

export function playPostureChime(volume = 0.5) {
  if (volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.min(1, Math.max(0, volume)) * 0.35, now);
    masterGain.connect(ctx.destination);

    // Note 1: E5 (659.25 Hz) - soft bell attack
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.9, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Note 2: B5 (987.77 Hz) - gentle, pleasant ascending chime tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.9, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn("Audio chime playback failed:", err);
  }
}

