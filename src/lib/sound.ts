// Shared audio helpers. Browsers block audio until a user gesture — we lazily
// create an AudioContext on the first pointerdown/keydown, so any beep()
// afterwards works without a click each time.

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // play a silent buffer to fully arm iOS
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch { /* noop */ }
  unlocked = true;
}

export function isAudioUnlocked() {
  return unlocked && !!ctx && ctx.state === "running";
}

// Install a one-time gesture listener that unlocks audio.
export function installAudioUnlocker() {
  if (typeof window === "undefined" || unlocked) return;
  const handler = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: false });
  window.addEventListener("keydown", handler, { once: false });
  window.addEventListener("touchstart", handler, { once: false });
}

export function beep(freq = 880, ms = 350, gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") { c.resume().catch(() => {}); }
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(c.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch { /* noop */ } }, ms);
  } catch { /* noop */ }
}

let alertAudio: HTMLAudioElement | null = null;
function playCustomAlert(onPlaybackFailed?: () => void): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!alertAudio) {
      alertAudio = new Audio("/new-order.mp3");
      alertAudio.preload = "auto";
      alertAudio.volume = 1;
    }
    alertAudio.currentTime = 0;
    const p = alertAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => { onPlaybackFailed?.(); });
    }
    return true;
  } catch { return false; }
}

function fallbackBeeps() {
  beep(1000, 220);
  setTimeout(() => beep(1300, 260), 260);
}

// New-order alert — uses uploaded mp3, falls back to beeps
export function alertBeep() {
  if (playCustomAlert(fallbackBeeps)) return;
  fallbackBeeps();
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch {
    return "denied" as const;
  }
}

export function showNotification(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.png" }); } catch { /* noop */ }
}
