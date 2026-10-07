import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COL, FONT, prog, rgba} from '../theme';
import {CYCLE, GBN_WMAX, P, SEQ_COUNT, SR_WMAX, Tf, WMIN, fmtMs, fmtPct, utilization} from '../sim';
import {Knowledge, LAYOUT, ScaleBadge, useSimMs} from '../components/Stage';

/**
 * 第 6 段：滑动窗口。上下两条时间轴对比「窗口 16」与「窗口 25」，
 * 再由序号空间推出 GBN / SR 的窗口上限。
 */
export const SHOT6_DUR = 900; // 15s @60fps
const SEC_PER_MS = 0.3; // 1 ms ≈ 0.3 s → 25 ms ≈ 7.5 s
const ANIM_START = 0.6; // 动画在第 0.6 秒开始

/* 两条时间轴共用的几何：都覆盖 0..26 ms，和正片里的 25 ms 周期对齐 */
const AXIS_X0 = LAYOUT.axis.x0;
const AXIS_X1 = LAYOUT.axis.x1;
const AXIS_TO = 26;
const px = (ms: number) => AXIS_X0 + (ms / AXIS_TO) * (AXIS_X1 - AXIS_X0);
/** 每帧在时间轴上占的宽度：Tf = 1 ms ⇒ 一格 */
const CELL_W = (AXIS_X1 - AXIS_X0) * (Tf / AXIS_TO);

/** 上条：16 帧（SR 的上限）；下条：25 帧（Wmin，刚好不用等） */
const W16 = SR_WMAX;
const W25 = WMIN;
const U16 = utilization(W16);
const U25 = utilization(W25);

/**
 * 一条「窗口时间轴」：基线 + W 个相邻的 1 ms 小格。
 * 已经发出去的格子是亮蓝（正在发的这一格有光晕），还没发的是暗底；
 * 发送结束到 CYCLE 之间的空档画成灰色「空闲」区间。
 */
const WindowStrip: React.FC<{
  y: number;
  W: number;
  t: number;
  accent: string;
  title: string;
  /** 名称行后面跟的一句灰字（例如「不是最小窗口」） */
  sub?: string;
  /** 发送结束后对空闲区间的注释 */
  idleNote?: string;
  /** 25 ms 处第 0 帧的 ACK 回来时的附注 */
  ackNote: string;
  /** 附注文字的左边界与宽度（避开上下相邻 lane 的文字） */
  ackNoteLeft: number;
  ackNoteWidth: number;
  /** 状态行文字；不传就整行不渲染（上条 lane 用空闲区间自带说明） */
  stateText?: string;
}> = ({y, W, t, accent, title, sub, idleNote, ackNote, ackNoteLeft, ackNoteWidth, stateText}) => {
  const sent = Math.max(0, Math.min(W, Math.floor(t))); // 已经发完的帧数
  const sendingNow = t >= 0 && t < W * Tf - 1e-9;
  const idleFrom = W * Tf; // 发完 W 帧的时刻
  const idleOn = W < WMIN && t >= idleFrom;
  const keepGoing = W >= WMIN && t >= W; // 窗口够大：ACK 回来立刻接着发
  return (
    <>
      {/* 名称行：标题 + 利用率（利用率由 utilization(W) 算出来），整行在小格上方，绝不重叠 */}
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0,
          top: y - 72,
          display: 'flex',
          alignItems: 'baseline',
          gap: 20,
        }}
      >
        <span style={{fontFamily: FONT.sans, fontSize: 28, fontWeight: 800, color: COL.text}}>{title}</span>
        {sub ? <span style={{fontFamily: FONT.sans, fontSize: 19, color: COL.dim}}>{sub}</span> : null}
        <span style={{fontFamily: FONT.mono, fontSize: 24, fontWeight: 700, color: accent}}>
          {`利用率 ${fmtPct(utilization(W))}`}
        </span>
      </div>

      {/* 尚未发送的底槽 */}
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0,
          top: y - 35,
          width: AXIS_X1 - AXIS_X0,
          height: 35,
          borderRadius: 8,
          background: rgba(COL.line, 0.35),
          border: `1px solid ${rgba(COL.line, 1)}`,
        }}
      />

      {/* W 个 1 ms 的相邻小格：0..W×Tf，一帧一格，连续发送 */}
      {new Array(W).fill(0).map((_, i) => {
        const on = i < sent;
        const head = sendingNow && i === sent;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px(i * Tf) + 1,
              top: y - 34,
              width: CELL_W - 2,
              height: 33,
              borderRadius: 5,
              background: on
                ? `linear-gradient(180deg, ${rgba(accent, 0.95)}, ${rgba(accent, 0.55)})`
                : head
                  ? rgba(accent, 0.35)
                  : rgba(COL.line, 0.5),
              border: `1px solid ${on ? rgba(accent, 1) : rgba(COL.line, 1)}`,
              boxShadow: on ? `0 0 14px ${rgba(accent, 0.45)}` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT.mono,
              fontSize: 12,
              color: on ? '#04070f' : rgba(COL.dim, 0.7),
              overflow: 'hidden',
            }}
          >
            {i}
          </div>
        );
      })}

      {/* 空闲区间：发完 W 帧之后链路空着（只有 W < Wmin 才会出现） */}
      {W < WMIN ? (
        <div
          style={{
            position: 'absolute',
            left: px(idleFrom),
            top: y - 34,
            width: Math.max(0, px(CYCLE) - px(idleFrom)),
            height: 33,
            borderRadius: 6,
            background: rgba(COL.wait, idleOn ? 0.75 : 0.3),
            border: `1px dashed ${rgba(COL.wait, 0.9)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.sans,
            fontSize: 19,
            fontWeight: 600,
            color: '#ffffff',
          }}
        >
          {idleNote}
        </div>
      ) : null}

      {/* 25 ms 标记：竖线压在轴上；说明文字放到轴下方的空白处，不压住任何东西 */}
      <div
        style={{
          position: 'absolute',
          left: px(CYCLE),
          top: y - 40,
          width: 2,
          height: 46,
          background: rgba(COL.ack, 0.9),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: ackNoteLeft,
          top: y + 30,
          width: ackNoteWidth,
          fontFamily: FONT.sans,
          fontSize: 19,
          lineHeight: 1.2,
          color: COL.ack,
        }}
      >
        {`${fmtMs(CYCLE)} ${ackNote}`}
      </div>
      {keepGoing ? (
        <div
          style={{
            position: 'absolute',
            left: px(CYCLE) + 2,
            top: y + 10,
            width: 140,
            height: 7,
            background: accent,
            borderRadius: 4,
            boxShadow: `0 0 14px ${rgba(accent, 0.8)}`,
          }}
        />
      ) : null}

      {/* 基线与刻度（和全片时间轴同一套坐标） */}
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0,
          top: y,
          width: AXIS_X1 - AXIS_X0,
          height: 2,
          background: rgba(COL.line, 1),
        }}
      />
      {[0, 5, 10, 15, 20, 25].map((m) => (
        <div key={`tick${m}`}>
          <div style={{position: 'absolute', left: px(m), top: y, width: 1, height: 7, background: rgba(COL.dim, 0.45)}} />
          <div
            style={{
              position: 'absolute',
              left: px(m) - 30,
              top: y + 9,
              width: 60,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 13,
              color: rgba(COL.dim, 0.7),
            }}
          >
            {m}
          </div>
        </div>
      ))}

      {/* 状态行：现在正在发生什么（整行排在小格和轴线下方） */}
      {stateText ? (
        <div
          style={{
            position: 'absolute',
            left: AXIS_X0,
            top: y + 50,
            width: 1300,
            fontFamily: FONT.sans,
            fontSize: 20,
            color: idleOn || keepGoing ? accent : rgba(COL.dim, 0.95),
          }}
        >
          {stateText}
        </div>
      ) : null}
    </>
  );
};

/** 结论卡（GBN / SR 的窗口上限） */
const ConclusionCard: React.FC<{
  idx: string;
  left: number;
  width: number;
  y: number;
  color: string;
  appear: number;
  children: React.ReactNode;
}> = ({idx, left, width, y, color, appear, children}) => (
  <div
    style={{
      position: 'absolute',
      left,
      top: y,
      width,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 16}px)`,
      background: rgba(COL.panel, 0.92),
      border: `1px solid ${rgba(color, 0.55)}`,
      borderLeft: `6px solid ${color}`,
      borderRadius: 12,
      padding: '9px 20px',
      boxSizing: 'border-box',
    }}
  >
    <span style={{fontFamily: FONT.mono, fontSize: 18, color, marginRight: 14}}>{idx}</span>
    <span style={{fontFamily: FONT.sans, fontSize: 22, fontWeight: 700, color: COL.text}}>{children}</span>
  </div>
);

/**
 * 本段自己的总时间轴：和全片 TimeAxis 同一套画法（0..26 ms，每 1 ms 一格刻度），
 * 但**不带会飘到画面中间的时刻气泡**——播放头只画竖线、读数放到右上角，
 * 免得压住下面两条窗口 lane 的小格。
 */
const ShotAxis: React.FC<{t: number}> = ({t}) => {
  const now = Math.min(t, AXIS_TO);
  return (
    <>
      <div style={{position: 'absolute', left: AXIS_X0, top: 812, width: AXIS_X1 - AXIS_X0, height: 3, background: rgba(COL.line, 1)}} />
      {new Array(AXIS_TO + 1).fill(0).map((_, m) => (
        <div key={m}>
          <div style={{position: 'absolute', left: px(m), top: 804, width: 1, height: 8, background: rgba(COL.dim, 0.5)}} />
          <div
            style={{
              position: 'absolute',
              left: px(m) - 20,
              top: 820,
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
      <div style={{position: 'absolute', left: AXIS_X1 + 12, top: 802, fontFamily: FONT.mono, fontSize: 16, color: rgba(COL.dim, 0.8)}}>
        t / ms
      </div>
      <div style={{position: 'absolute', left: AXIS_X0, top: 812, width: Math.max(0, px(now) - AXIS_X0), height: 3, background: rgba(COL.data, 0.85)}} />
      {t >= 0 && t <= AXIS_TO ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: px(now),
              top: 700,
              width: 2,
              height: 112,
              background: COL.text,
              boxShadow: `0 0 12px ${rgba(COL.text, 0.8)}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 1560,
              top: 776,
              width: 300,
              textAlign: 'right',
              fontFamily: FONT.mono,
              fontSize: 21,
              fontWeight: 700,
              color: COL.text,
            }}
          >
            {`t = ${t.toFixed(1)} ms`}
          </div>
        </>
      ) : null}
    </>
  );
};

export const Shot6: React.FC = () => {
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: Math.round(ANIM_START * 60)});

  const sent16 = Math.max(0, Math.min(W16, Math.floor(t)));
  const sent25 = Math.max(0, Math.min(W25, Math.floor(t)));
  const idle16 = t >= W16 * Tf && t < CYCLE; // 窗口 16：16..25 ms 空闲等待
  const cont25 = t >= W25 * Tf; // 窗口 25：25 ms 第一帧 ACK 回来，接着发第 26 帧

  /* 动画结束（t = 25 ms，即视频第 8.1 秒）后弹出结论卡 */
  const e = (t - CYCLE) * SEC_PER_MS * 60;
  const c1 = prog(e, 0, 16);
  const c2 = prog(e, 26, 16);

  return (
    <AbsoluteFill>
      <Knowledge
        index="06"
        title="滑动窗口 · GBN 与 SR"
        formula="U = min(1, W × Tf / (Tf + 2Tp))"
        formulaNote={`Wmin = ⌈(Tf + 2Tp) / Tf⌉ = ${WMIN}`}
      />
      <ScaleBadge text="本段：1 ms ≈ 0.3 s（25 ms ≈ 7.5 s）" />

      {/* 右上角读数：周期拆分与利用率计算式 */}
      <div
        style={{
          position: 'absolute',
          right: 110,
          top: 112,
          width: 360,
          textAlign: 'right',
          fontFamily: FONT.mono,
          fontSize: 19,
          lineHeight: 1.7,
          color: COL.dim,
        }}
      >
        <div>{`Tf + 2Tp = ${fmtMs(Tf)} + ${fmtMs(CYCLE - Tf)} = ${fmtMs(CYCLE)}`}</div>
        <div>
          {`U(${W16}) = ${fmtPct(U16)}　`}
          <span style={{color: COL.good, fontWeight: 700}}>{`U(${W25}) = ${fmtPct(U25)}`}</span>
        </div>
      </div>

      {/* 上条：窗口 W = 16（= SR 的最大发送窗口）：发 16 ms，空等 9 ms */}
      <WindowStrip
        y={460}
        W={W16}
        t={t}
        accent={COL.warn}
        title={`窗口 W = ${W16} 帧（SR 的上限）`}
        sub="不是最小窗口"
        idleNote={`空闲 ${fmtMs(CYCLE - W16 * Tf)}`}
        ackNote="第 0 帧的 ACK 才回到 A"
        ackNoteLeft={1030}
        ackNoteWidth={440}
      />

      {/* 下条：窗口 W = 25（= Wmin）：发到 25 ms 时 ACK 刚好回来，马上接着发 */}
      <WindowStrip
        y={646}
        W={W25}
        t={t}
        accent={COL.good}
        title={`窗口 W = ${W25} 帧（最小窗口 Wmin）`}
        sub="刚好不用等"
        ackNote="第 0 帧的 ACK 回来"
        ackNoteLeft={420}
        ackNoteWidth={440}
        stateText={
          cont25
            ? `ACK 一回来就继续发送：链路一直没有空闲，利用率 ${fmtPct(U25)}`
            : `已连发 ${sent25} / ${W25} 帧：整整 ${fmtMs(W25 * Tf)} 毫秒链路都在传数据`
        }
      />

      {/* 本段总时间轴（0..26 ms，轴线在 812） */}
      <ShotAxis t={t} />

      {/* 结论 1：GBN 的窗口上限（放在轴线以下的空白区，不压轴、刻度、t/ms） */}
      <ConclusionCard idx="GBN" left={420} width={1030} y={830} color={COL.good} appear={c1}>
        {`最大发送窗口 = 2^${P.seqBits} − 1 = ${GBN_WMAX}`}
        <span style={{marginLeft: 12, fontFamily: FONT.mono, fontSize: 19, color: COL.good}}>
          {`→ 利用率最高 ${fmtPct(utilization(GBN_WMAX))}`}
        </span>
      </ConclusionCard>

      {/* 结论 2：SR 的窗口上限 + 序号空间副注（一起放进卡里，不和轴线抢位置） */}
      <ConclusionCard idx="SR" left={420} width={960} y={888} color={COL.warn} appear={c2}>
        {`接收窗口最大 ${SR_WMAX} → 发送窗口最多 ${SR_WMAX}`}
        <span style={{marginLeft: 12, fontFamily: FONT.mono, fontSize: 19, color: COL.warn}}>
          {`→ 最高 ${fmtPct(utilization(SR_WMAX))}`}
        </span>
        <span style={{marginLeft: 14, fontFamily: FONT.mono, fontSize: 18, color: COL.dim}}>
          {`｜帧序号 ${P.seqBits} 位，共 ${SEQ_COUNT} 个序号`}
        </span>
      </ConclusionCard>

    </AbsoluteFill>
  );
};
