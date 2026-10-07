/**
 * 全片统一参数与「时间 → 画面」的换算核心（纯逻辑，不依赖 React）。
 *
 * 所有动画位置、时间轴刻度、公式和字幕都从这里取数，避免互相矛盾。
 * 单位约定：**严格区分 b 与 B**，十进制通信单位（1 kb = 1000 bit，1 kB = 1000 B）。
 */

/* ------------------------------------------------------------------ *
 * 1. 题目给定参数（唯一真相）
 * ------------------------------------------------------------------ */
export const P = {
  /** 带宽 R = 8 Mb/s = 8×10^6 bit/s */
  R: 8e6,
  /** 数据帧长 L = 1000 B = 8000 bit */
  L: 8000,
  /** 单向传播时延 Tp = 12 ms */
  Tp: 12,
  /** 帧序号位数（5 位 → 32 个序号） */
  seqBits: 5,
} as const;

/** 数据帧发送时延 Tf = L/R = 1 ms */
export const Tf = P.L / (P.R / 1000); // ms：8000 bit ÷ 8000 bit/ms = 1 ms
/** 单向时延带宽积 R×Tp = 96 kb = 12000 B */
export const BDP_BIT = (P.R / 1000) * P.Tp; // bit：8000 bit/ms × 12 ms = 96000 bit
export const BDP_BYTE = BDP_BIT / 8; // 12000 B
/** 链路中能容纳多少个「整帧」的比特：96000 / 8000 = 12 帧 */
export const BDP_FRAMES = BDP_BIT / P.L; // 12
/** 往返传播时延 RTT（本片只算传播，24 ms）与「发一帧→收到确认」周期 = Tf + 2Tp = 25 ms */
export const RTT = 2 * P.Tp; // 24 ms
export const CYCLE = Tf + RTT; // 25 ms
/** 序号空间 2^5 = 32 */
export const SEQ_COUNT = 2 ** P.seqBits; // 32
/** GBN 最大发送窗口 2^n − 1 = 31；SR 最大发送窗口 2^(n−1) = 16 */
export const GBN_WMAX = SEQ_COUNT - 1; // 31
export const SR_WMAX = SEQ_COUNT / 2; // 16
/** 让发送端不停顿所需的最小窗口 Wmin = ceil((Tf+2Tp)/Tf) = 25 */
export const WMIN = Math.ceil(CYCLE / Tf); // 25

/** 停止等待的利用率 = Tf/(Tf+2Tp) = 1/25 = 4% */
export const U_STOPWAIT = Tf / CYCLE;
/** 窗口 W 的利用率 = min(1, W·Tf/(Tf+2Tp)) */
export const utilization = (W: number) => Math.min(1, (W * Tf) / CYCLE);

/* ------------------------------------------------------------------ *
 * 2. 时间轴与秒毫秒换算
 * ------------------------------------------------------------------ */
export const FPS = 60;

/**
 * 每毫秒真实时间对应多少秒视频。
 * 题目给的参考值是 1 ms ≈ 0.3 s；局部需要看清细节的分镜可以单独放大，
 * 但**同一分镜内所有事件共用同一个比例**，保证时间关系不失真。
 */
export const MS_PER_SEC_DEFAULT = 0.3;

/** 把「毫秒」按给定比例换成「视频里的秒」 */
export const msToSec = (ms: number, secPerMs = MS_PER_SEC_DEFAULT) => ms * secPerMs;
/** 把「毫秒」按给定比例换成帧数（60fps） */
export const msToFrames = (ms: number, secPerMs = MS_PER_SEC_DEFAULT) => Math.round(ms * secPerMs * FPS);
/** 视频秒 → 帧 */
export const secToFrames = (sec: number) => Math.round(sec * FPS);

/* ------------------------------------------------------------------ *
 * 3. 链路几何：比特在链路中的位置
 * ------------------------------------------------------------------ */
/**
 * 链路画成一条水平线：位置 0 = 主机 A 出口，位置 1 = 主机 B 入口。
 * 一个比特在 t0 时刻进入链路，则在 t 时刻的位置是 (t − t0)/Tp（超出 [0,1] 表示还没进/已到达）。
 */
export const bitPos = (t: number, t0: number, Tp = P.Tp) => (t - t0) / Tp;

/**
 * 一帧数据在链路中的占据区间。
 * 前提：发送端从 tStart 开始连续发送，发完这一帧用 Tf 毫秒（发送时延）。
 * 首比特 t0 = tStart 进入链路；末比特 t0 = tStart + Tf 进入链路。
 * 返回 [head, tail]，均为链路归一化位置：
 *   head = 首比特当前所在位置（领先边缘）
 *   tail = 末比特当前所在位置（落后边缘）
 * 二者都裁剪到 [0, 1]。head < 0 表示首比特还没进入链路（尚未开始发送）。
 */
export const frameSpan = (t: number, tStart: number, TfMs = Tf, TpMs = P.Tp) => {
  const head = bitPos(t, tStart, TpMs);
  const tail = bitPos(t, tStart + TfMs, TpMs);
  return {head, tail};
};

/** 这一帧是否已经完整到达 B（末比特到达）*/
export const frameArrived = (t: number, tStart: number, TfMs = Tf, TpMs = P.Tp) =>
  bitPos(t, tStart + TfMs, TpMs) >= 1;
/** 首比特是否已到达 B */
export const headArrived = (t: number, tStart: number, TpMs = P.Tp) => bitPos(t, tStart, TpMs) >= 1;

/* ------------------------------------------------------------------ *
 * 4. 格式化（画面上的文字统一走这里，避免出现参差不齐的写法）
 * ------------------------------------------------------------------ */
export const fmtMs = (ms: number) => {
  const s = Number.isInteger(ms) ? String(ms) : ms.toFixed(1);
  return `${s} ms`;
};
export const fmtBits = (bit: number) => {
  if (bit >= 1e6) return `${(bit / 1e6).toFixed(bit % 1e6 === 0 ? 0 : 1)} Mb`;
  if (bit >= 1e3) return `${(bit / 1e3).toFixed(bit % 1e3 === 0 ? 0 : 1)} kb`;
  return `${bit} bit`;
};
export const fmtBytes = (bit: number) => {
  const b = bit / 8;
  return `${b % 1 === 0 ? b : b.toFixed(1)} B`;
};
export const fmtPct = (u: number, digits = 0) => `${(u * 100).toFixed(digits)}%`;

/* ------------------------------------------------------------------ *
 * 5. 关键事件时刻（全片共用，字幕/公式/竖线都用它）
 * ------------------------------------------------------------------ */
/** 单帧：0 开始发送 → Tf 末比特进入链路 → Tp 首比特到达 B → Tp+Tf 整帧接收完成 → 2Tp+Tf 收到 ACK */
export const EV = {
  sendStart: 0,
  lastBitIn: Tf, // 1 ms
  headArriveB: P.Tp, // 12 ms
  frameRecvB: P.Tp + Tf, // 13 ms
  ackArriveA: CYCLE, // 25 ms
} as const;
