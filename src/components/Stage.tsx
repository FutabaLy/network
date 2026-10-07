import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {COL, FONT, clamp01, lerp, prog, rgba} from '../theme';
import {P, Tf, fmtMs} from '../sim';

/** 画布布局：所有分镜共用同一套坐标，保证主机/链路/时间轴位置一致 */
export const LAYOUT = {
  hostA: {x: 110, y: 350, w: 250, h: 210},
  hostB: {x: 1560, y: 350, w: 250, h: 210},
  link: {x0: 420, x1: 1500, y: 430, h: 62},
  axis: {x0: 420, x1: 1500, y: 812},
};

export const linkX = (p: number) => LAYOUT.link.x0 + p * (LAYOUT.link.x1 - LAYOUT.link.x0);
/** 一帧数据完全进入链路后占的像素宽度 = 链路长度 × Tf/Tp（正好 1/12） */
export const FRAME_W = ((LAYOUT.link.x1 - LAYOUT.link.x0) * Tf) / P.Tp;

/* ------------------------------------------------------------------ *
 * 分镜时钟：把「帧号」换成「模拟毫秒」，全片只有这一条换算路径
 * ------------------------------------------------------------------ */
export type ShotClock = {
  /** 每毫秒真实时间对应多少秒视频 */
  secPerMs: number;
  /** 这个分镜覆盖的模拟时间起点（ms） */
  ms0: number;
  /** 动画在第几帧开始（前面留白给标题/公式入场） */
  delay?: number;
};

export const useSimMs = (clock: ShotClock) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const elapsed = Math.max(0, (f - (clock.delay ?? 0)) / fps);
  return clock.ms0 + elapsed / clock.secPerMs;
};

/* ------------------------------------------------------------------ *
 * 主机
 * ------------------------------------------------------------------ */
export const Host: React.FC<{
  side: 'A' | 'B';
  name?: string;
  role?: string;
  active?: boolean;
  sending?: boolean;
  children?: React.ReactNode;
}> = ({side, name, role, active = false, sending = false, children}) => {
  const box = side === 'A' ? LAYOUT.hostA : LAYOUT.hostB;
  const c = side === 'A' ? COL.hostA : COL.hostB;
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: 18,
        border: `2px solid ${rgba(c, active ? 1 : 0.55)}`,
        background: `linear-gradient(180deg, ${rgba(c, active ? 0.22 : 0.1)}, rgba(6,10,20,0.75))`,
        boxShadow: active ? `0 0 34px ${rgba(c, 0.45)}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <div style={{fontFamily: FONT.sans, fontSize: 40, fontWeight: 800, color: c}}>{name ?? `主机 ${side}`}</div>
      {role ? <div style={{fontFamily: FONT.sans, fontSize: 18, color: COL.dim}}>{role}</div> : null}
      {sending ? (
        <div
          style={{
            marginTop: 6,
            fontFamily: FONT.mono,
            fontSize: 16,
            color: COL.data,
            border: `1px solid ${rgba(COL.data, 0.6)}`,
            borderRadius: 999,
            padding: '3px 12px',
          }}
        >
          正在发送
        </div>
      ) : null}
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * 链路（一条水平带子 + 刻度）
 * ------------------------------------------------------------------ */
export const LinkBand: React.FC<{dim?: boolean; y?: number; label?: string; children?: React.ReactNode}> = ({
  dim = false,
  y = LAYOUT.link.y,
  label,
  children,
}) => {
  const {x0, x1, h} = LAYOUT.link;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x0,
          top: y,
          width: x1 - x0,
          height: h,
          borderRadius: h / 2,
          border: `2px solid ${rgba(COL.line, dim ? 0.7 : 1)}`,
          background: 'linear-gradient(180deg, rgba(20,32,54,0.85), rgba(8,14,26,0.9))',
          overflow: 'hidden',
        }}
      >
        {/* 每 Tp/12 画一条浅刻度：正好一格 = 一帧的宽度 */}
        {new Array(11).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${((i + 1) / 12) * 100}%`,
              top: 0,
              width: 1,
              height: '100%',
              background: rgba('#ffffff', 0.06),
            }}
          />
        ))}
      </div>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: x0 - 12,
            top: y - 34,
            width: x1 - x0 + 24,
            fontFamily: FONT.mono,
            fontSize: 18,
            color: rgba(COL.dim, 0.9),
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: x0,
          top: y + h + 6,
          width: x1 - x0,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONT.mono,
          fontSize: 15,
          color: rgba(COL.dim, 0.75),
        }}
      >
        <span>主机 A 出口</span>
        <span style={{color: rgba(COL.dim, 0.5)}}>链路（距离 d，信号传播速度 v）</span>
        <span>主机 B 入口</span>
      </div>
      {children}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * 数据帧：给 head/tail 两个归一化位置，自己算矩形
 *   head = 首比特位置（领先边缘）
 *   tail = 末比特位置（落后边缘）
 * 发送过程中 tail 一直是 0，矩形从 0 宽长到 FRAME_W —— 逐比特进入链路
 * ------------------------------------------------------------------ */
export const FrameBlock: React.FC<{
  head: number;
  tail: number;
  color: string;
  label?: React.ReactNode;
  edgeLabels?: boolean;
  /** 链路泳道的 y（默认主链路；多链路对比时传自己的 y） */
  bandY?: number;
  yOffset?: number;
  height?: number;
  /** 传播方向：lr = A→B（数据帧），rl = B→A（ACK） */
  dir?: 'lr' | 'rl';
  plot?: boolean;
}> = ({
  head,
  tail,
  color,
  label,
  edgeLabels = false,
  bandY = LAYOUT.link.y,
  yOffset = 0,
  height = LAYOUT.link.h - 12,
  dir = 'lr',
  plot = true,
}) => {
  const t = clamp01(tail);
  const hd = clamp01(head);
  // 整块都已越过接收端（数据帧出链路 / ACK 回到 A）时不再画残影
  if (dir === 'lr' ? head >= 1 && tail >= 1 : head <= 0 && tail <= 0) return null;
  if (hd <= 0) return null;
  const lo = Math.min(hd, t);
  const hi = Math.max(hd, t);
  const left = linkX(lo);
  const right = linkX(hi);
  const w = Math.max(2, right - left);
  const y = bandY + 6 + yOffset;
  const leadX = dir === 'lr' ? right : left;
  // 帧块本身只有 1/12 个链路那么宽，文字塞不下 —— 窄的时候把标签放到块上方
  const insideLabel = w > 130;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left,
          top: y,
          width: w,
          height,
          borderRadius: 8,
          background: `linear-gradient(180deg, ${rgba(color, 0.95)}, ${rgba(color, 0.55)})`,
          border: `2px solid ${rgba(color, 1)}`,
          boxShadow: `0 0 22px ${rgba(color, 0.5)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.sans,
          fontSize: 17,
          fontWeight: 700,
          color: '#04070f',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {plot && insideLabel ? label : null}
      </div>
      {plot && !insideLabel && label ? (
        <div
          style={{
            position: 'absolute',
            // 居中在块上方，但不许跑出链路范围（靠边时贴边显示）
            left: Math.max(LAYOUT.link.x0, Math.min(left + w / 2 - 150, LAYOUT.link.x1 - 300)),
            top: y - 62,
            width: 300,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: 17,
            fontWeight: 600,
            color,
            textShadow: '0 1px 8px rgba(0,0,0,0.9)',
          }}
        >
          {label}
        </div>
      ) : null}
      {edgeLabels && hd > 0.02 && hd < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: leadX - 34,
            top: y - 34,
            fontFamily: FONT.mono,
            fontSize: 15,
            color,
          }}
        >
          首比特
        </div>
      ) : null}
      {edgeLabels && t > 0.02 && hi < 0.99 && hi - lo > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: (dir === 'lr' ? left : right) - 34,
            top: y + height + 6,
            fontFamily: FONT.mono,
            fontSize: 15,
            color: rgba(color, 0.85),
          }}
        >
          末比特
        </div>
      ) : null}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * 顶部知识卡 + 公式
 * ------------------------------------------------------------------ */
export const Knowledge: React.FC<{
  index: string;
  title: string;
  formula?: string;
  formulaNote?: string;
  appear?: number;
  accent?: string;
}> = ({index, title, formula, formulaNote, appear = 1, accent = COL.data}) => (
  <div style={{position: 'absolute', left: 110, top: 56, opacity: appear}}>
    <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 22,
          color: accent,
          border: `1px solid ${rgba(accent, 0.6)}`,
          borderRadius: 8,
          padding: '2px 10px',
        }}
      >
        {index}
      </span>
      <span style={{fontFamily: FONT.sans, fontSize: 46, fontWeight: 800, color: COL.text, letterSpacing: 1}}>
        {title}
      </span>
    </div>
    {formula ? (
      <div
        style={{
          marginTop: 14,
          display: 'inline-block',
          fontFamily: FONT.mono,
          fontSize: 30,
          color: COL.text,
          background: rgba(accent, 0.12),
          border: `1px solid ${rgba(accent, 0.45)}`,
          borderRadius: 10,
          padding: '8px 18px',
        }}
      >
        {formula}
        {formulaNote ? (
          <span style={{fontSize: 19, color: COL.dim, marginLeft: 14}}>{formulaNote}</span>
        ) : null}
      </div>
    ) : null}
  </div>
);

/* ------------------------------------------------------------------ *
 * 底部时间轴：统一从 sim.ts 的事件时刻生成刻度
 * ------------------------------------------------------------------ */
export const TimeAxis: React.FC<{
  x0?: number;
  x1?: number;
  y?: number;
  from: number;
  to: number;
  now?: number;
  marks?: {ms: number; label: string; color?: string}[];
  unit?: string;
  height?: number;
  /** 「t = x ms」读数相对轴的纵向位置（默认轴上方 196px；分镜里若那块区域被占用就往下挪） */
  readoutY?: number;
  /** 播放头竖线的高度（默认 150px） */
  headHeight?: number;
}> = ({
  x0 = LAYOUT.axis.x0,
  x1 = LAYOUT.axis.x1,
  y = LAYOUT.axis.y,
  from,
  to,
  now,
  marks = [],
  unit = 'ms',
  height = 0,
  readoutY,
  headHeight = 150,
}) => {
  const px = (ms: number) => x0 + ((ms - from) / (to - from)) * (x1 - x0);
  const ticks: number[] = [];
  for (let m = Math.ceil(from); m <= to; m++) ticks.push(m);
  return (
    <>
      {/* 轴 */}
      <div style={{position: 'absolute', left: x0, top: y, width: x1 - x0, height: 3, background: rgba(COL.line, 1)}} />
      {ticks.map((m) => (
        <div key={m}>
          <div
            style={{
              position: 'absolute',
              left: px(m),
              top: y - 8,
              width: 1,
              height: 8,
              background: rgba(COL.dim, 0.5),
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: px(m) - 20,
              top: y + 8,
              width: 40,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 14,
              color: rgba(COL.dim, 0.75),
            }}
          >
            {m}
          </div>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: x1 + 12,
          top: y - 10,
          fontFamily: FONT.mono,
          fontSize: 16,
          color: rgba(COL.dim, 0.8),
        }}
      >
        t / {unit}
      </div>

      {/* 已过去的时间（灰色进度） */}
      {now !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: x0,
            top: y,
            width: Math.max(0, px(Math.min(now, to)) - x0),
            height: 3,
            background: rgba(COL.data, 0.85),
          }}
        />
      ) : null}

      {/* 事件标记：轴上一个小菱形 + 轴下方分层的标签（最多三层，避免互相压住） */}
      {marks.map((mk, i) => (
        <div key={`${mk.ms}-${mk.label}`}>
          <div
            style={{
              position: 'absolute',
              left: px(mk.ms) - 7,
              top: y - 7,
              width: 14,
              height: 14,
              background: mk.color ?? COL.warn,
              transform: 'rotate(45deg)',
              boxShadow: `0 0 12px ${rgba(mk.color ?? COL.warn, 0.8)}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: px(mk.ms) - 1,
              top: y + 8,
              width: 2,
              height: 22,
              background: rgba(mk.color ?? COL.warn, 0.55),
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: px(mk.ms) - 110,
              top: y + 34 + (i % 3) * 40,
              width: 220,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 17,
              color: mk.color ?? COL.warn,
            }}
          >
            {fmtMs(mk.ms)}
            <span style={{fontFamily: FONT.sans, fontSize: 16, color: COL.dim, marginLeft: 8}}>{mk.label}</span>
          </div>
        </div>
      ))}

      {/* 当前时刻：一条短播放头 + 轴上方的读数（不跟随到画面中间，免得压住内容） */}
      {now !== undefined && now >= from && now <= to ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: px(now),
              top: y - headHeight,
              width: 2,
              height: headHeight,
              background: rgba(COL.text, 0.75),
              boxShadow: `0 0 10px ${rgba(COL.text, 0.6)}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: px(now) - 76,
              top: readoutY ?? y - 196,
              width: 152,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 22,
              fontWeight: 700,
              color: COL.text,
              background: rgba('#000000', 0.62),
              border: `1px solid ${rgba(COL.text, 0.3)}`,
              borderRadius: 8,
              padding: '3px 0',
            }}
          >
            t = {now.toFixed(1)} ms
          </div>
        </>
      ) : null}
      {height ? <div style={{position: 'absolute', left: x0, top: y + height, width: 1, height: 1}} /> : null}
    </>
  );
};

/* ------------------------------------------------------------------ *
 * 底部字幕（与旁白同步；内容来自 src/subs.ts）
 * ------------------------------------------------------------------ */
export const Subtitle: React.FC<{text: string; appear?: number}> = ({text, appear = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: 160,
      right: 160,
      bottom: 34,
      textAlign: 'center',
      opacity: appear,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        fontFamily: FONT.sans,
        fontSize: 34,
        fontWeight: 600,
        lineHeight: 1.35,
        color: '#ffffff',
        background: rgba('#000000', 0.62),
        border: `1px solid ${rgba(COL.text, 0.16)}`,
        borderRadius: 12,
        padding: '10px 26px',
        textShadow: '0 2px 10px rgba(0,0,0,0.95)',
      }}
    >
      {text}
    </span>
  </div>
);

/** 左上角小角标：说明本段的时间缩放比例（避免观众误判快慢） */
export const ScaleBadge: React.FC<{text: string; appear?: number}> = ({text, appear = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 110,
      top: 60,
      opacity: appear,
      fontFamily: FONT.mono,
      fontSize: 17,
      color: rgba(COL.dim, 0.9),
      border: `1px solid ${rgba(COL.line, 1)}`,
      borderRadius: 8,
      padding: '4px 12px',
      background: rgba(COL.panel, 0.7),
    }}
  >
    {text}
  </div>
);

/** 全屏底色 + 背景网格（所有分镜共用，作为 Main 的一层） */
export const Backdrop: React.FC<{accent?: string}> = ({accent = COL.data}) => (
  <AbsoluteFill style={{background: COL.bg}}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(1100px 700px at 24% 16%, ${rgba(accent, 0.16)} 0%, transparent 62%),
                     radial-gradient(900px 620px at 84% 86%, ${rgba(COL.hostB, 0.12)} 0%, transparent 60%)`,
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${rgba('#ffffff', 0.035)} 1px, transparent 1px),
                          linear-gradient(90deg, ${rgba('#ffffff', 0.035)} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(circle at 50% 45%, black 25%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 25%, transparent 80%)',
      }}
    />
    <AbsoluteFill
      style={{background: 'radial-gradient(circle at 50% 50%, transparent 48%, rgba(0,0,0,0.6) 100%)'}}
    />
  </AbsoluteFill>
);

/** 淡入淡出的小工具（分镜进出场用） */
export const useFade = (durFrames: number) => {
  const f = useCurrentFrame();
  return clamp01(prog(f, 0, 12) - prog(f, durFrames - 12, 12));
};

/** 秒 → 帧（分镜里写时长用，60fps） */
export const S = (sec: number) => Math.round(sec * 60);
