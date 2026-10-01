// The new-order chime on the POS screen. iPad Safari only lets a page make
// sound after someone has touched it — and can lock it again after the app
// was in the background — so the POS calls unlockOrderSound() on every tap
// (cheap once unlocked) and playOrderSound() when an online order arrives.
let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

/** Call from inside a tap/click. Resolves to whether the POS can make sound now. */
export async function unlockOrderSound(): Promise<boolean> {
  try {
    const c = audio();
    if (c.state !== "running") await c.resume();
    // A silent blip played inside the gesture is what actually unlocks iOS.
    const blip = c.createBufferSource();
    blip.buffer = c.createBuffer(1, 1, 22050);
    blip.connect(c.destination);
    blip.start(0);
    return c.state === "running";
  } catch {
    return false;
  }
}

export const orderSoundReady = () => ctx?.state === "running";

/** A doorbell chime, three times over ~2s — loud enough for a busy counter. */
export function playOrderSound(): boolean {
  const c = ctx;
  if (!c || c.state !== "running") return false;
  const start = c.currentTime + 0.05;
  for (let round = 0; round < 3; round++) {
    [880, 1320].forEach((freq, i) => {
      const t = start + round * 0.7 + i * 0.18;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }
  return true;
}
