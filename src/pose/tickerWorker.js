/**
 * Creates an inline Web Worker that fires ticks on a setInterval.
 * Browsers clamp and throttle main-thread timers (and stop requestAnimationFrame)
 * when a tab is hidden. Web Workers continue to execute without pause, ensuring
 * posture detection continues uninterrupted when switching to VS Code or other apps.
 */
export function createTickerWorker() {
  const workerScript = `
    let timerId = null;

    self.onmessage = function(e) {
      const data = e.data || {};
      if (data.action === "start") {
        if (timerId) clearInterval(timerId);
        timerId = setInterval(function() {
          self.postMessage("tick");
        }, data.interval || 1000);
      } else if (data.action === "stop") {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
      }
    };
  `;

  const blob = new Blob([workerScript], { type: "application/javascript" });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);

  return {
    start(intervalMs = 1000) {
      worker.postMessage({ action: "start", interval: intervalMs });
    },
    stop() {
      worker.postMessage({ action: "stop" });
    },
    terminate() {
      worker.postMessage({ action: "stop" });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    },
    set onmessage(handler) {
      worker.onmessage = handler;
    },
  };
}

