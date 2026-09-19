/** Renders the Jyoti diya icon procedurally — no design tooling, no binary assets. */

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * clamp(t);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hex = (value) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];
const mixColor = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const NIGHT = hex('#1B0E33');
const VOID_ = hex('#090412');
const HALO = hex('#FF9A3C');
const AURA = hex('#8B5CF6');
const CORE = hex('#FFF7E2');
const MID = hex('#FFD07A');
const EDGE = hex('#FF8A2B');
const BASE_BLUE = hex('#7C8BFF');
const BOWL_TOP = hex('#F2B655');
const BOWL_LOW = hex('#8A4212');
const RIM = hex('#FFD489');

const FLAME_TOP = 0.148;
const FLAME_BOTTOM = 0.607;
const FLAME_W = 0.163;
const BOWL_CY = 0.605;
const BOWL_RX = 0.252;
const BOWL_RY = 0.138;
const CONTENT_CY = 0.45;

/** Flame profile: a point at the tip, widest just below centre, drawn back in
 *  at the wick so the base tucks into the bowl instead of bulging over it. */
const profile = (t) => Math.pow(t, 0.75) * (1 - 0.6 * smoothstep(0.5, 1.0, t));

function flameField(u, v) {
  if (v < FLAME_TOP) return { d: Math.hypot(u - 0.5, FLAME_TOP - v), q: 1, t: 0 };
  if (v > FLAME_BOTTOM) {
    const overhang = Math.max(Math.abs(u - 0.5) - FLAME_W * profile(1), 0);
    return { d: Math.hypot(overhang, v - FLAME_BOTTOM), q: 1, t: 1 };
  }
  const t = (v - FLAME_TOP) / (FLAME_BOTTOM - FLAME_TOP);
  const halfWidth = FLAME_W * profile(t);
  const lateral = Math.abs(u - 0.5);
  return { d: lateral - halfWidth, q: halfWidth > 0 ? lateral / halfWidth : 1, t };
}

function bowlField(u, v) {
  if (v < BOWL_CY) return 1;
  const norm = Math.hypot((u - 0.5) / BOWL_RX, (v - BOWL_CY) / BOWL_RY) - 1;
  return norm * Math.min(BOWL_RX, BOWL_RY);
}

function rimField(u, v) {
  const halfHeight = 0.0145;
  const dx = Math.max(Math.abs(u - 0.5) - (0.252 - halfHeight), 0);
  const dy = Math.abs(v - 0.602);
  return Math.hypot(dx, dy) - halfHeight;
}

function shade(u, v, scale, aa, background) {
  const su = 0.5 + (u - 0.5) / scale;
  const sv = CONTENT_CY + (v - CONTENT_CY) / scale;

  let rgb = [0, 0, 0];
  let alpha = 0;
  /** Source-over compositing, so the glyph can be cut out on transparency. */
  const over = (color, coverage) => {
    if (coverage <= 0) return;
    rgb = mixColor(rgb, color, coverage);
    alpha = coverage + alpha * (1 - coverage);
  };

  if (background) {
    // Full-bleed, so a maskable crop never exposes an edge.
    const bgDist = Math.hypot(u - 0.5, v - 0.38);
    over(mixColor(NIGHT, VOID_, smoothstep(0.1, 0.78, bgDist)), 1);
  }

  // On the transparent glyph the glow must reach zero before the image edge,
  // or the PNG's bounding box shows as a faint rectangle over the app's sky.
  const vignette = background ? 1 : 1 - smoothstep(0.3, 0.5, Math.hypot(u - 0.5, v - 0.5));
  const auraDist = Math.hypot(su - 0.5, (sv - 0.38) * 0.92);
  over(AURA, 0.26 * Math.exp(-Math.pow(auraDist / 0.44, 2)) * vignette);
  over(HALO, 0.58 * Math.exp(-Math.pow(auraDist / 0.21, 2)) * vignette);

  const flame = flameField(su, sv);
  if (flame.d < aa) {
    let color = mixColor(CORE, MID, smoothstep(0.0, 0.55, flame.q));
    color = mixColor(color, EDGE, smoothstep(0.5, 1.0, flame.q));
    color = mixColor(color, BASE_BLUE, 0.3 * smoothstep(0.93, 1.0, flame.t));
    over(color, 1 - smoothstep(-aa, aa, flame.d));
  }

  const bowl = bowlField(su, sv);
  if (bowl < aa) {
    const depth = clamp((sv - BOWL_CY) / BOWL_RY);
    over(mixColor(BOWL_TOP, BOWL_LOW, Math.pow(depth, 0.8)), 1 - smoothstep(-aa, aa, bowl));
  }

  const rim = rimField(su, sv);
  if (rim < aa) over(RIM, 0.8 * (1 - smoothstep(-aa, aa, rim)));

  return [rgb[0], rgb[1], rgb[2], alpha];
}


/** @returns {Buffer} RGBA pixels, row-major. `background: false` cuts the lamp
 *  and its glow out on transparency, for use inside the app. */
export function renderLamp(size, { scale = 1, background = true } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const samples = 2;
  const aa = 1.2 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = (x + (sx + 0.5) / samples) / size;
          const v = (y + (sy + 0.5) / samples) / size;
          const c = shade(u, v, scale, aa, background);
          r += c[0];
          g += c[1];
          b += c[2];
          a += c[3];
        }
      }
      const n = samples * samples;
      const i = (y * size + x) * 4;
      out[i] = Math.round(clamp(r / n, 0, 255));
      out[i + 1] = Math.round(clamp(g / n, 0, 255));
      out[i + 2] = Math.round(clamp(b / n, 0, 255));
      out[i + 3] = Math.round(clamp((a / n) * 255, 0, 255));
    }
  }
  return out;
}
