// The new-order chime on the POS screen (and the rider app). iPad Safari only
// lets a page make sound after someone has touched it — and can lock it again
// after the app was in the background or reloaded — so the POS calls
// unlockOrderSound() on every tap anywhere (cheap once unlocked; see
// components/pos/order-sound-keeper.tsx) and playOrderSound() when an order
// arrives. A chime that arrives while sound is still locked isn't lost: it
// plays on the very next tap.
let ctx: AudioContext | null = null;
let pendingAt = 0;      // an order chimed while sound was locked (epoch ms)
let lastPlayed = 0;     // two orders at once ring once, not on top of each other

const CHIME_SECONDS = 4;
const PENDING_FOR_MS = 10 * 60_000; // a missed chime still plays on the next tap within 10 minutes

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
    const on = c.state === "running";
    if (on && pendingAt && Date.now() - pendingAt < PENDING_FOR_MS) { pendingAt = 0; playOrderSound(); }
    return on;
  } catch {
    return false;
  }
}

/** Back from the background: resume if the browser still allows it (no tap needed then). */
export async function resumeOrderSound(): Promise<boolean> {
  if (!ctx) return false;
  try { if (ctx.state !== "running") await ctx.resume(); } catch { /* needs a tap */ }
  return ctx.state === "running";
}

export const orderSoundReady = () => ctx?.state === "running";

/** One bell strike: a clear fundamental plus soft overtones, ringing out. */
function strike(c: AudioContext, out: AudioNode, freq: number, t: number, ring = 0.8) {
  [[1, 0.9], [2, 0.28], [3, 0.1]].forEach(([mult, level]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ring / mult);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + ring / mult + 0.05);
  });
}

/**
 * A 4-second "ding-dong" doorbell, four times over — clear and loud enough for
 * a busy counter (a compressor keeps it loud without crackling). Returns false
 * if sound is still locked; it then plays on the next tap.
 */
export function playOrderSound(): boolean {
  const c = ctx;
  if (!c || c.state !== "running") { pendingAt = Date.now(); return false; }
  if (Date.now() - lastPlayed < CHIME_SECONDS * 1000) return true; // already ringing
  lastPlayed = Date.now();

  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(comp).connect(c.destination);

  const start = c.currentTime + 0.05;
  for (let round = 0; round < 4; round++) {
    const t = start + round * 0.95;
    strike(c, master, 1318.5, t);        // E6 — "ding"
    strike(c, master, 1046.5, t + 0.32); // C6 — "dong"
  }
  return true;
}
