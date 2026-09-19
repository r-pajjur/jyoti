/** Renders the Jyoti drop icon procedurally — no design tooling, no binary assets. */

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

/* The lifeseva palette: sandalwood ground, saffron body, ochre depth. */
const CHANDAN = hex('#FDF8EE');
const CHANDAN_DEEP = hex('#F4E9D4');
const SAFFRON = hex('#D9741A');
const OCHRE = hex('#8F4E0A');
const HIGHLIGHT = hex('#FFE0B0');

const TOP = 0.115;
const CY = 0.625;
const R = 0.275;

/** Teardrop: a circle below the waist, tapering to a point above it. */
function halfWidth(v) {
  if (v > CY + R || v < TOP) return 0;
  if (v >= CY) return Math.sqrt(Math.max(R * R - (v - CY) * (v - CY), 0));
  return R * Math.pow((v - TOP) / (CY - TOP), 1.25);
}

/** Signed distance to the drop's edge: negative inside, positive outside. */
function dropField(u, v) {
  const lateral = Math.abs(u - 0.5);
  if (v < TOP) return Math.hypot(lateral, TOP - v);
  if (v > CY + R) return Math.hypot(lateral, v - (CY + R));
  return lateral - halfWidth(v);
}

function shade(u, v, background) {
  const d = dropField(u, v);
  const edge = 0.004;

  let color = background ? mixColor(CHANDAN, CHANDAN_DEEP, smoothstep(0, 1, v)) : [0, 0, 0];
  let alpha = background ? 1 : 0;

  // A soft warm halo under the drop, so it sits on the ground rather than floating.
  if (background) {
    const glow = 1 - smoothstep(0, 0.34, Math.hypot((u - 0.5) / 1.15, (v - 0.58) / 1.0));
    color = mixColor(color, SAFFRON, glow * 0.14);
  }

  const inside = 1 - smoothstep(-edge, edge, d);
  if (inside > 0) {
    // Vertical body gradient, lit from the upper left.
    const depth = clamp((v - TOP) / (CY + R - TOP));
    let body = mixColor(SAFFRON, OCHRE, smoothstep(0.35, 1, depth));
    const lit = 1 - smoothstep(0, 0.2, Math.hypot(u - 0.41, v - 0.46));
    body = mixColor(body, HIGHLIGHT, lit * 0.75);
    color = background ? mixColor(color, body, inside) : body;
    alpha = Math.max(alpha, inside);
  }
  return [color[0], color[1], color[2], alpha * 255];
}

/** @returns {Buffer} RGBA pixels, row-major. `background: false` cuts the drop
 *  out on transparency for use as an in-app glyph. */
export function renderDrop(size, { scale = 1, background = true } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 3; // 3×3 supersampling — these are small images, so brute force is fine.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          // `scale` shrinks the glyph for maskable icons, which get cropped.
          const su = 0.5 + (u - 0.5) / scale;
          const sv = 0.5 + (v - 0.5) / scale;
          const [pr, pg, pb, pa] = shade(su, sv, background);
          r += pr; g += pg; b += pb; a += pa; n++;
        }
      }
      const i = (y * size + x) * 4;
      out[i] = Math.round(clamp(r / n, 0, 255));
      out[i + 1] = Math.round(clamp(g / n, 0, 255));
      out[i + 2] = Math.round(clamp(b / n, 0, 255));
      out[i + 3] = Math.round(clamp(a / n, 0, 255));
    }
  }
  return out;
}
