"use client";
import { useEffect, useRef } from "react";

// Live steam rising off the momo in the homepage photo. A small WebGL
// fragment shader draws turbulent, wispy vapour (domain-warped fractal
// noise, advected upward) inside a plume above the momo box, and the canvas
// is "screen"-blended over the photo so it lightens like real steam in that
// warm light. Drawn at low resolution (steam is soft) and capped at 30 fps;
// it stops when off screen, in a background tab, for reduced-motion users,
// and simply doesn't appear where WebGL isn't available — the photo already
// has still steam of its own.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  // uv: (0,0) bottom-left of the canvas. The canvas sits over the momo box:
  // the steam starts low (the momo tops) and rises to the top edge.
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;

  // Height above the momo: 0 at their tops, 1 at the top of the canvas.
  float h = clamp((uv.y - 0.16) / 0.84, 0.0, 1.0);

  // The plume: a column that sways, leans a little right as it rises, and
  // spreads out as it cools — like the steam already in the photo.
  float sway = 0.06 * sin(uv.y * 4.0 - t * 0.55) + 0.035 * sin(uv.y * 9.0 + t * 0.9);
  float cx = 0.56 + 0.12 * h + sway;
  float width = 0.16 + 0.30 * h;
  float dx = (uv.x - cx) / width;
  float column = exp(-dx * dx * 2.2);

  // Turbulence moving upward: warp the noise field by itself (twice) so it
  // breaks into curling wisps, all scrolling up at slightly different speeds.
  vec2 rise = vec2(0.0, -t * 0.22);
  vec2 q = vec2(fbm(p * 2.2 + rise), fbm(p * 2.2 + vec2(5.2, 1.3) + rise * 1.1));
  vec2 r = vec2(fbm(p * 2.8 + 3.2 * q + vec2(1.7, 9.2) + rise * 1.6), fbm(p * 2.8 + 3.2 * q + vec2(8.3, 2.8) + rise * 1.4));
  float n = fbm(p * 2.4 + 2.6 * r + rise * 2.0);

  // Soft body of the steam plus thin bright filaments where the field folds.
  float body = smoothstep(0.42, 0.85, n);
  float wisps = pow(1.0 - abs(2.0 * fbm(p * 3.6 + 2.0 * r + rise * 2.6) - 1.0), 6.0);

  // Born just above the momo (ragged edge, not a line), thinning as it rises.
  float base = smoothstep(0.10, 0.30, uv.y + 0.10 * (n - 0.5));
  float fade = (1.0 - smoothstep(0.55, 1.0, h)) * (0.65 + 0.35 * (1.0 - h));

  // Never a hard edge at the sides of the canvas.
  float edges = smoothstep(0.0, 0.14, uv.x) * (1.0 - smoothstep(0.84, 1.0, uv.x));
  float d = (body * 0.55 + wisps * 0.45) * column * base * fade * edges;
  d = clamp(d * 1.25, 0.0, 1.0);

  // Warm-white, lit by the same light as the photo. Premultiplied alpha.
  vec3 col = mix(vec3(0.93, 0.90, 0.86), vec3(1.0, 0.97, 0.93), wisps);
  float a = d * 0.55;
  gl_FragColor = vec4(col * a, a);
}`;

export default function HeroSteam({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");

    // Steam is soft: half the CSS size is plenty, and much cheaper on phones.
    const resize = () => {
      const scale = 0.5;
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true, raf = 0, last = 0;
    const start = performance.now() - 20000; // begin mid-flow, not from an empty frame
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps
      last = now;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const run = () => { if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); else stop(); });
    io.observe(canvas);
    const onVis = () => (document.visibilityState === "visible" ? run() : stop());
    document.addEventListener("visibilitychange", onVis);
    canvas.style.opacity = "1";
    run();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ mixBlendMode: "screen", opacity: 0, transition: "opacity 1.2s ease" }}
    />
  );
}
