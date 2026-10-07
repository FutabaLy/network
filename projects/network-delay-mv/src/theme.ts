/** 画面配色 / 字体 / 缓动（全片统一） */
export const COL = {
  bg: '#05080f',
  panel: '#0c1424',
  line: '#1e2b45',
  text: '#eef3ff',
  dim: '#9fb0cc',
  faint: '#63748f',
  /** 数据帧 = 蓝 */
  data: '#38bdf8',
  dataDeep: '#0b6ea8',
  /** ACK = 橙 */
  ack: '#fb923c',
  /** 等待 = 灰 */
  wait: '#64748b',
  hostA: '#22d3ee',
  hostB: '#a78bfa',
  good: '#4ade80',
  warn: '#fbbf24',
};

export const FONT = {
  sans: "'Noto Sans SC','PingFang SC',system-ui,sans-serif",
  mono: "'JetBrains Mono',ui-monospace,SFMono-Regular,monospace",
};

export type Ease = (t: number) => number;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const eIn: Ease = (t) => t * t * t;
export const eOut: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const eInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const prog = (f: number, start: number, dur: number, ease: Ease = eOut) =>
  ease(clamp01((f - start) / Math.max(1, dur)));

const hex2 = (hex: string) => {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
export const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hex2(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};
