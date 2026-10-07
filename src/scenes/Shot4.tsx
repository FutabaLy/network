import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COL, FONT, prog, rgba} from '../theme';
import {BDP_BIT, BDP_FRAMES, P, Tf, fmtBits, fmtBytes, fmtMs, fmtPct} from '../sim';
import {FrameBlock, Host, Knowledge, LAYOUT, LinkBand, ScaleBadge, S, TimeAxis, linkX, useSimMs} from '../components/Stage';

/**
 * 第 4 段（45–60 s）：时延带宽积。
 *
 * A 从 t = 0 开始**不停**发送：第 k 帧 tStart = k·Tf，每帧在链路里占 Tf/Tp = 1/12 条链路。
 * t = Tp = 12 ms 时链路正好被 12 个帧块填满 —— BDP_FRAMES = 12，
 * 在途比特数 = R × Tp = 8 Mb/s × 12 ms = 96 kb = 12000 B。
 */
export const SHOT4_DUR = 900; // 15 s @60fps

/** 1 ms ≈ 0.75 s：12 ms ≈ 9 s（第 10 秒链路填满），之后留 4 s 圈注 */
const SEC_PER_MS = 0.75;
const DELAY = 60; // 动画从第 1 秒开始

const LANE_Y = LAYOUT.link.y;
const BAND_H = LAYOUT.link.h;
/** 一帧从开始发送到整帧被 B 收完要 Tf + Tp，按 Tf 量化就是这么多帧同时在途 */
const WINDOW = Math.ceil((Tf + P.Tp) / Tf);
/** 每毫秒能送入链路的比特数 = R / 1000 */
const BIT_PER_MS = P.R / 1000;
/** 链路填满的准确时刻 = Tp，此时正好 BDP_FRAMES 帧在途 */
const FILL_MS = P.Tp;
/** 圈注出现的视频帧：第 1 秒 + 12 ms × 0.75 s/ms */
const HL_START = S(1 + FILL_MS * SEC_PER_MS);

const BAR_Y = 368;
const PANEL = {x: 420, w: 680, y: 600, h: 136};

/**
 * 帧块上的序号：自己画在块中央。
 * 不用 FrameBlock 的 label —— 它只在块宽 > 130px 时才画在块里，否则会飘到块上方，
 * 1 格 = 90px 的情况下会挤成一排浮字。
 */
const TileNo: React.FC<{k: number; head: number; tail: number}> = ({k, head, tail}) => {
  const lo = Math.min(Math.max(tail, 0), 1);
  const hi = Math.min(Math.max(head, 0), 1);
  const left = linkX(Math.min(lo, hi));
  const width = linkX(Math.max(lo, hi)) - left;
  if (width < 44) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: LANE_Y + 6 + (BAND_H - 12) / 2 - 9,
        width,
        textAlign: 'center',
        fontFamily: FONT.mono,
        fontSize: 15,
        fontWeight: 700,
        color: rgba('#04070f', 0.75),
      }}
    >
      {k}
    </div>
  );
};

export const Shot4: React.FC = () => {
  const f = useCurrentFrame();
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: DELAY});

  // 仍在链路里的帧：第 k 帧在 t ∈ (k·Tf, k·Tf + Tf + Tp) 内可见
  const kNow = Math.floor(t / Tf);
  const inFlight: number[] = [];
  for (let k = Math.max(0, kNow - WINDOW); k <= kNow; k++) {
    if (t > k * Tf && t < k * Tf + Tf + P.Tp) inFlight.push(k);
  }

  /** 链路里同时在途的比特数：进去的减去已经收到的 = R × min(t, Tp) */
  const bitsInFlight = BIT_PER_MS * Math.min(t, FILL_MS);
  const fill = Math.min(t / FILL_MS, 1);
  const filled = t >= FILL_MS;
  /** 已经被 B 完整收下的帧数 */
  const delivered = Math.max(0, Math.floor((t - (Tf + P.Tp)) / Tf) + 1);

  const appear = prog(f, 0, 14);
  const hl = prog(f, HL_START, 22);
  const pulse = 16 + 9 * Math.abs(Math.sin(f / 9));

  return (
    <AbsoluteFill>
      <Knowledge
        index="04"
        title="时延带宽积"
        formula={`R × Tp = ${fmtBits(P.R)}/s × ${fmtMs(P.Tp)} = ${fmtBits(BDP_BIT)} = ${fmtBytes(BDP_BIT)}`}
        formulaNote="持续发送时链路上能同时容纳的在途比特数"
        appear={appear}
      />
      <ScaleBadge text={`本段 1 ms ≈ ${SEC_PER_MS} s ｜ 示意：1 格 = 1 帧 = ${P.L} bit`} appear={appear} />

      <Host side="A" role="发送方" sending active={!filled}>
        <div style={{fontFamily: FONT.sans, fontSize: 14, color: COL.dim, marginTop: 2}}>一刻不停，每 1 ms 发一帧</div>
      </Host>
      <Host side="B" role="接收方" active={t >= P.Tp}>
        <div style={{fontFamily: FONT.sans, fontSize: 14, color: COL.dim, marginTop: 2}}>边收边放行，链路始终是满的</div>
      </Host>

      <LinkBand label={`A 持续发送：每 ${fmtMs(Tf)} 送入一帧（${P.L} bit = ${fmtBytes(P.L)}）`} />

      {/* 持续发送的帧块：首尾相接向右滑动，每块都是 1 格 = 1 帧 = FRAME_W 宽 */}
      {inFlight.map((k) => {
        const kHead = (t - k * Tf) / P.Tp;
        const kTail = (t - k * Tf - Tf) / P.Tp;
        return (
          <React.Fragment key={k}>
            <FrameBlock head={kHead} tail={kTail} color={COL.data} bandY={LANE_Y} />
            <TileNo k={k} head={kHead} tail={kTail} />
          </React.Fragment>
        );
      })}

      {/* lane 右侧状态条 */}
      <div style={{position: 'absolute', left: LAYOUT.link.x1 - 460, top: LANE_Y - 32, width: 460, textAlign: 'right'}}>
        <span
          style={{
            display: 'inline-block',
            fontFamily: FONT.mono,
            fontSize: 17,
            color: filled ? COL.good : COL.data,
            background: rgba(COL.panel, filled ? 0.9 : 0.7),
            border: `1px solid ${rgba(filled ? COL.good : COL.data, filled ? 0.95 : 0.45)}`,
            borderRadius: 999,
            padding: '3px 14px',
          }}
        >
          {filled
            ? `✓ 链路已填满：在途 ${BDP_FRAMES} 帧 = ${fmtBits(BDP_BIT)}`
            : `链路填充中：${fmtPct(fill)}`}
        </span>
      </div>

      {/* 到达侧：链路一直是满的，B 这边不停收下整帧 */}
      <div style={{position: 'absolute', left: LAYOUT.link.x1 - 320, top: LANE_Y + BAND_H + 32, width: 320, textAlign: 'right'}}>
        <span style={{fontFamily: FONT.mono, fontSize: 16, color: rgba(COL.dim, 0.9)}}>
          {`已完整到达 B：${delivered} 帧（每 ${fmtMs(Tf)} 帧）`}
        </span>
      </div>

      {/* 链路被填满：发光描边 + 尺寸线，把整条链路圈成一个 R×Tp 的量 */}
      {hl > 0 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: LAYOUT.link.x0 - 8,
              top: LANE_Y - 8,
              width: LAYOUT.link.x1 - LAYOUT.link.x0 + 16,
              height: BAND_H + 16,
              boxSizing: 'border-box',
              borderRadius: (BAND_H + 16) / 2,
              border: `3px solid ${rgba(COL.good, 0.95 * hl)}`,
              boxShadow: `0 0 ${pulse}px ${rgba(COL.good, 0.55 * hl)}`,
              opacity: hl,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: LAYOUT.link.x0,
              top: BAR_Y,
              width: LAYOUT.link.x1 - LAYOUT.link.x0,
              height: 3,
              background: rgba(COL.good, 0.9 * hl),
              boxShadow: `0 0 14px ${rgba(COL.good, 0.6 * hl)}`,
            }}
          />
          {[LAYOUT.link.x0, LAYOUT.link.x1 - 3].map((x) => (
            <div
              key={`cap-${x}`}
              style={{
                position: 'absolute',
                left: x,
                top: BAR_Y - 9,
                width: 3,
                height: 21,
                background: rgba(COL.good, 0.95 * hl),
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: LAYOUT.link.x0,
              top: 288,
              width: LAYOUT.link.x1 - LAYOUT.link.x0,
              textAlign: 'center',
              opacity: hl,
            }}
          >
            <div style={{fontFamily: FONT.mono, fontSize: 30, fontWeight: 800, color: COL.good}}>
              {`R × Tp = ${fmtBits(P.R)}/s × ${fmtMs(P.Tp)} = ${fmtBits(BDP_BIT)} = ${fmtBytes(BDP_BIT)}`}
            </div>
            <div style={{fontFamily: FONT.sans, fontSize: 19, color: COL.dim, marginTop: 6}}>
              {`= ${BDP_FRAMES} 帧 · 整条链路正好塞满（示意：1 格 = 1 帧 = ${P.L} bit）`}
            </div>
          </div>
        </>
      ) : null}

      {/* 左下：在途比特数实时读数 */}
      <div
        style={{
          position: 'absolute',
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `1px solid ${rgba(COL.line, 1)}`,
          background: rgba(COL.panel, 0.72),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + 14,
          top: PANEL.y + 10,
          fontFamily: FONT.mono,
          fontSize: 15,
          color: COL.faint,
        }}
      >
        {filled
          ? '在途数据 = 已发送 − 已到达 B（1 格 = 1 帧；两端被链路裁掉的部分不计）'
          : `在途数据 = 已发送 − 已到达 B（1 格 = 1 帧 = ${P.L} bit）`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + 14,
          top: PANEL.y + 34,
          fontFamily: FONT.mono,
          fontSize: 22,
          color: COL.text,
        }}
      >
        {`在途比特数 = ${fmtBits(P.R)}/s × ${fmtMs(Math.min(t, FILL_MS))} = ${fmtBits(bitsInFlight)}`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + 14,
          top: PANEL.y + 64,
          fontFamily: FONT.mono,
          fontSize: 17,
          color: COL.dim,
        }}
      >
        {`= ${Math.round(bitsInFlight)} bit = ${fmtBytes(bitsInFlight)} ≈ ${(bitsInFlight / P.L).toFixed(1)} 帧`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + PANEL.w - 200,
          top: PANEL.y + 86,
          width: 186,
          textAlign: 'right',
          fontFamily: FONT.mono,
          fontSize: 15,
          color: filled ? COL.good : COL.dim,
        }}
      >
        {`链路填充度 ${fmtPct(fill)}`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: PANEL.x + 14,
          top: PANEL.y + 106,
          width: PANEL.w - 28,
          height: 14,
          borderRadius: 7,
          background: rgba(COL.line, 1),
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fill * 100}%`,
            height: '100%',
            borderRadius: 7,
            background: `linear-gradient(90deg, ${COL.data}, ${COL.good})`,
            boxShadow: `0 0 14px ${rgba(COL.good, 0.5)}`,
          }}
        />
      </div>

      <TimeAxis
        from={0}
        to={16}
        marks={[{ms: FILL_MS, label: `链路被填满（${BDP_FRAMES} 帧）`, color: COL.good}]}
      />
      {/* 当前模拟时刻：固定位置自己写（播放头读数会横扫下面那块在途读数面板） */}
      <div
        style={{
          position: 'absolute',
          left: 1240,
          top: 596,
          width: 240,
          textAlign: 'center',
          fontFamily: FONT.mono,
          fontSize: 22,
          fontWeight: 700,
          color: filled ? COL.good : COL.text,
          background: rgba('#000000', 0.62),
          border: `1px solid ${rgba(filled ? COL.good : COL.text, 0.3)}`,
          borderRadius: 8,
          padding: '3px 0',
        }}
      >
        t = {t.toFixed(1)} ms
      </div>
    </AbsoluteFill>
  );
};
