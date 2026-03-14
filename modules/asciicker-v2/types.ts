// ─── Shared types for Cat in Glasgow ────────────────────────

export interface Camera {
  x: number; y: number; z: number;
  yaw: number;
  zoom: number;
}

export function rgb6(r: number, g: number, b: number): number {
  return 16 + r * 36 + g * 6 + b;
}
export function grey(n: number): number { return 232 + n; }

export function hash2d(x: number, y: number, s: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + s * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

export function fractal(x: number, y: number, s: number, oct: number): number {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < oct; i++) {
    const ix = Math.floor(x * f), iy = Math.floor(y * f);
    const fx = x * f - ix, fy = y * f - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const p = hash2d(ix, iy, s + i * 100), q = hash2d(ix + 1, iy, s + i * 100);
    const r = hash2d(ix, iy + 1, s + i * 100), t = hash2d(ix + 1, iy + 1, s + i * 100);
    v += (p + sx * (q - p) + sy * (r - p) + sx * sy * (p - q - r + t)) * a;
    m += a; a *= 0.5; f *= 2;
  }
  return v / m;
}
