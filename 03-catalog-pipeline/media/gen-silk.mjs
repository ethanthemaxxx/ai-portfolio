/* Procedural "dark silk" loop generator.
 *
 * Renders a seamless N-frame loop of a domain-warped fractal-noise field and
 * pipes raw RGB24 frames to stdout for ffmpeg. Seamless because time is a full
 * revolution around a circle in an extra pair of noise dimensions — frame 0 and
 * frame N land on the same point.
 *
 * Usage: node gen-silk.mjs <seed> <W> <H> <FRAMES> | ffmpeg -f rawvideo ...
 */

const seed = Number(process.argv[2] ?? 1);
const W = Number(process.argv[3] ?? 720);
const H = Number(process.argv[4] ?? 405);
const FRAMES = Number(process.argv[5] ?? 120);

/* ---------------------------------------------------------------- 4D noise */
/* Value noise on a 4D lattice with a hashed gradient — cheap, and at this blur
 * level indistinguishable from simplex. */

function hash(x, y, z, w) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647 + w * 1274126177 + seed * 9781;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function noise4(x, y, z, w) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), wi = Math.floor(w);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi), wf = fade(w - wi);
  let acc = 0;
  // 16 lattice corners, folded into nested lerps.
  const c = (dz, dw) => {
    const n00 = hash(xi, yi, zi + dz, wi + dw);
    const n10 = hash(xi + 1, yi, zi + dz, wi + dw);
    const n01 = hash(xi, yi + 1, zi + dz, wi + dw);
    const n11 = hash(xi + 1, yi + 1, zi + dz, wi + dw);
    return lerp(lerp(n00, n10, xf), lerp(n01, n11, xf), yf);
  };
  const z0 = lerp(c(0, 0), c(1, 0), zf);
  const z1 = lerp(c(0, 1), c(1, 1), zf);
  acc = lerp(z0, z1, wf);
  return acc * 2 - 1;
}

function fbm(x, y, z, w, oct) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise4(x * f, y * f, z * f, w * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* ------------------------------------------------------------------ render */

const frame = Buffer.allocUnsafe(W * H * 3);
const field = new Float32Array(W * H);
const aspect = W / H;

/* Ground: the light warm grey the reference floats its sculpture on. */
const BG_TOP = [0xcf, 0xcf, 0xd1];
const BG_BOT = [0xb6, 0xb6, 0xb9];
/* Mass: near-black body, cool grey highlight. Shading — not a colour ramp —
 * is what makes it read as a solid twisted object rather than a stain. */
const BODY = [0x0b, 0x0b, 0x0d];
const HILITE = [0xa8, 0xa8, 0xad];

/* Light comes from the upper left, slightly toward camera. */
const LX = -0.55, LY = -0.66, LZ = 0.51;

for (let f = 0; f < FRAMES; f++) {
  const ang = (f / FRAMES) * Math.PI * 2;
  // Loop carrier: a circle of radius R in the (z,w) noise plane, so the last
  // frame lands exactly back on the first.
  const R = 0.40;
  const cz = Math.cos(ang) * R;
  const cw = Math.sin(ang) * R;

  // ---- pass 1: height field ------------------------------------------------
  for (let y = 0; y < H; y++) {
    const v = (y / H - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const u = (x / W - 0.5) * 2 * aspect;

      // Two-pass domain warp at low frequency — large sweeping folds rather
      // than marble veining. Octave counts stay low on purpose: the reference
      // shape is smooth sculpture, and fine detail just reads as noise.
      const F = 0.74;
      const q1 = fbm(u * F + 0.0, v * F + 0.0, cz, cw, 2);
      const q2 = fbm(u * F + 4.7, v * F + 1.3, cz, cw, 2);
      const r1 = fbm(u * F + 2.6 * q1 + 1.7, v * F + 2.6 * q2 + 9.2, cz, cw, 3);
      const r2 = fbm(u * F + 2.6 * q1 + 8.3, v * F + 2.6 * q2 + 2.8, cz, cw, 3);
      const n = fbm(u * F + 2.0 * r1, v * F + 2.0 * r2, cz, cw, 3);

      // Radial falloff keeps the mass a single object floating on the page,
      // with the ground left clear at the edges.
      const d = Math.sqrt(u * u * 0.40 + v * v * 0.72);
      const body = 1 - smooth(0.10, 1.30, d);

      field[y * W + x] = body * 1.05 + r1 * 0.72 + n * 0.34;
    }
  }

  // ---- pass 2: shade the field --------------------------------------------
  let p = 0;
  for (let y = 0; y < H; y++) {
    const gy = (y / H);
    const bg0 = lerp(BG_TOP[0], BG_BOT[0], gy);
    const bg1 = lerp(BG_TOP[1], BG_BOT[1], gy);
    const bg2 = lerp(BG_TOP[2], BG_BOT[2], gy);
    const yUp = Math.max(0, y - 1) * W;
    const yDn = Math.min(H - 1, y + 1) * W;
    const yC = y * W;

    for (let x = 0; x < W; x++) {
      const h = field[yC + x];
      // Alpha of the mass. The band is wide so the silhouette stays soft.
      const alpha = smooth(0.44, 0.68, h);

      let r = bg0, g = bg1, b = bg2;

      if (alpha > 0.001) {
        // Normal from the height gradient. Scale is tuned by eye: too large and
        // the surface turns to foil, too small and it flattens out.
        const dx = (field[yC + Math.min(W - 1, x + 1)] - field[yC + Math.max(0, x - 1)]) * (W * 0.055);
        const dy = (field[yDn + x] - field[yUp + x]) * (H * 0.055);
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        const nx = -dx * inv, ny = -dy * inv, nz = inv;

        const diff = Math.max(0, nx * LX + ny * LY + nz * LZ);
        // Rim term: grazing angles catch the light, which is what gives the
        // reference its silk sheen along every fold.
        const rim = Math.pow(1 - Math.abs(nz), 2.4);
        const spec = Math.pow(diff, 22) * 0.85;

        const k = Math.min(1, diff * 0.60 + rim * 0.26 + spec);
        const mr = lerp(BODY[0], HILITE[0], k);
        const mg = lerp(BODY[1], HILITE[1], k);
        const mb = lerp(BODY[2], HILITE[2], k);

        r = lerp(r, mr, alpha);
        g = lerp(g, mg, alpha);
        b = lerp(b, mb, alpha);
      }

      frame[p++] = r | 0;
      frame[p++] = g | 0;
      frame[p++] = b | 0;
    }
  }

  process.stdout.write(frame);
  process.stderr.write(`frame ${f + 1}/${FRAMES}\r`);
}
process.stderr.write('\ndone\n');
