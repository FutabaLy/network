import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COL, FONT, prog, rgba} from '../theme';
import {P, Tf, fmtBits, fmtBytes, fmtMs} from '../sim';
import {
  FrameBlock,
  Host,
  Knowledge,
  LAYOUT,
  LinkBand,
  ScaleBadge,
  S,
  TimeAxis,
  linkX,
  useSimMs,
} from '../components/Stage';

/**
 * 第 3 段（30–45 s）：带宽与传播速度。
 *
 * 两条链路泳道 = **同一对主机、同一段链路**（距离 d 与传播速度 v 完全相同），
 * 只有发送速率不同：上 lane R_low = 2 Mb/s，下 lane R = 8 Mb/s（题目值）。
 * 两条 lane 都从 t = 0 ms 开始发同一帧：
 *   Tf_low = L / R_low = 8000 bit ÷ 2000 bit/ms = 4 ms → 整帧到达 B = Tf_low + Tp = 16 ms
 *   Tf     = L / R     = 8000 bit ÷ 8000 bit/ms = 1 ms → 整帧到达 B = Tf     + Tp = 13 ms
 * 首比特到达 B 都是 Tp = 12 ms（传播速度不变），差别全在「多久把整帧推入链路」。
 */
export const SHOT3_DUR = 900; // 15 s @60fps

/** 1 ms ≈ 0.62 s：16 ms ≈ 10.9 s，第 1 秒开始，后面留 3 s 给结论标注 */
const SEC_PER_MS = 0.62;
const DELAY = 60; // 动画从第 1 秒开始

/** 低带宽 lane：R_low = 2 Mb/s（题目 R = 8 Mb/s 的 1/4）。Tf_low 由 L / R_low 算出，不写死 */
const R_LOW = 2e6; // bit/s
/** 8000 bit ÷ 2000 bit/ms = 4 ms */
const TF_LOW = P.L / (R_LOW / 1000);
/** 末比特进入链路的时刻 + 传播时延 = 整帧到达 B 的时刻 */
const ARRIVE_LOW = TF_LOW + P.Tp; // 4 + 12 = 16 ms
const ARRIVE_HIGH = Tf + P.Tp; // 1 + 12 = 13 ms

const LANE_LOW_Y = 358;
const LANE_HIGH_Y = 492;
const BAND_H = LAYOUT.link.h;
/** 每帧画 8 格 = 每 1000 bit 一条竖纹：帧块越短 → 竖纹越密（高带宽 lane 更密集） */
const DIVISIONS = 8;

const PANEL = {x: 420, w: 780, y: 582, h: 218};

/** 比特密度示意：竖纹锚在末比特（发送中钳在 0，之后随帧一起向右滑） */
const BitStripes: React.FC<{
  head: number;
  tail: number;
  bandY: number;
  tfMs: number;
  divisions: number;
}> = ({head, tail, bandY, tfMs, divisions}) => {
  const lo = Math.max(tail, 0);
  const hi = Math.min(head, 1);
  if (hi <= 0) return null;
  const step = tfMs / P.Tp / divisions;
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < divisions; i++) {
    const pos = lo + i * step;
    if (pos >= hi || pos >= 1) break;
    lines.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: linkX(pos),
          top: bandY + 6,
          width: 1,
          height: BAND_H - 12,
          background: rgba('#04070f', 0.55),
        }}
      />,
    );
  }
  return <>{lines}</>;
};

/**
 * lane 的实时状态：写在 LinkBand 那行标签的右半段（标签文字左对齐、很短，不会碰头）。
 * 这一行是空着的安全区：播放头读数在 y+40（轴下方），事件标牌在 y−226 处。
 */
const LaneStatus: React.FC<{y: number; text: string; color: string}> = ({y, text, color}) => (
  <div
    style={{
      position: 'absolute',
      left: LAYOUT.link.x1 - 490,
      top: y,
      width: 400,
      textAlign: 'right',
      whiteSpace: 'nowrap',
      fontFamily: FONT.mono,
      fontSize: 16,
      color,
    }}
  >
    {text}
  </div>
);

/** 对比表的一行：整帧到达 B 后整行点亮 */
const CompareRow: React.FC<{y: number; color: string; title: string; line1: string; line2: string; on: boolean}> = ({
  y,
  color,
  title,
  line1,
  line2,
  on,
}) => (
  <div
    style={{
      position: 'absolute',
      left: PANEL.x + 14,
      top: y,
      width: PANEL.w - 28,
      height: 66,
      boxSizing: 'border-box',
      borderRadius: 10,
      border: `1px solid ${rgba(color, on ? 0.9 : 0.28)}`,
      background: rgba(color, on ? 0.11 : 0.05),
      boxShadow: on ? `0 0 12px ${rgba(color, 0.22)}` : 'none',
      padding: '5px 14px',
    }}
  >
    <div style={{fontFamily: FONT.mono, fontSize: 16, color}}>
      {on ? '✓ ' : ''}
      {title}
    </div>
    <div style={{fontFamily: FONT.mono, fontSize: 16, color: COL.text, marginTop: 3}}>{line1}</div>
    <div style={{fontFamily: FONT.mono, fontSize: 16, color: COL.dim, marginTop: 2}}>{line2}</div>
  </div>
);

export const Shot3: React.FC = () => {
  const f = useCurrentFrame();
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: DELAY});

  // 两条 lane 从同一时刻 0 开始发送同一帧：head 相同（同一段链路、同一个 v），tail 由各自 Tf 决定
  const head = t / P.Tp;
  const tailLow = (t - TF_LOW) / P.Tp;
  const tailHigh = (t - Tf) / P.Tp;

  const headArrivedB = t >= P.Tp;
  const lowArrived = t >= ARRIVE_LOW;
  const highArrived = t >= ARRIVE_HIGH;

  const appear = prog(f, 0, 14);
  /** 后 3 秒的结论标注 */
  const conclusion = prog(f, S(11.6), 26);

  /** lane 的实时状态：发送中 → 整帧已进链路 → 首比特到 B → 整帧到达 B（时刻由该 lane 的 Tf 决定） */
  const statusOf = (tfMs: number, arriveMs: number, arrived: boolean) =>
    arrived
      ? `✓ 整帧到达 B ${fmtMs(arriveMs)}`
      : headArrivedB
        ? '首比特已到 B · 末比特在途'
        : t >= tfMs
          ? '整帧已进链路 · 首比特未到 B'
          : '发送中 · 首比特未到 B';

  return (
    <AbsoluteFill>
      <Knowledge
        index="03"
        title="带宽与传播速度"
        formula="Tf = L / R"
        formulaNote={`· R 越大 → Tf 越短；传播速度 v 不变 → Tp 仍是 ${fmtMs(P.Tp)}`}
        appear={appear}
      />
      <ScaleBadge text={`本段 1 ms ≈ ${SEC_PER_MS} s（两条 lane 共用同一比例）`} appear={appear} />

      {/* 两条 lane 接的是同一对主机：左侧、右侧各画一个「并联」括号 */}
      <div
        style={{
          position: 'absolute',
          left: 392,
          top: LANE_LOW_Y + BAND_H / 2,
          width: 2,
          height: LANE_HIGH_Y - LANE_LOW_Y,
          background: rgba(COL.dim, 0.45),
        }}
      />
      {[LANE_LOW_Y, LANE_HIGH_Y].map((y) => (
        <div
          key={`bl-${y}`}
          style={{
            position: 'absolute',
            left: 392,
            top: y + BAND_H / 2,
            width: 26,
            height: 2,
            background: rgba(COL.dim, 0.45),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 1546,
          top: LANE_LOW_Y + BAND_H / 2,
          width: 2,
          height: LANE_HIGH_Y - LANE_LOW_Y,
          background: rgba(COL.dim, 0.45),
        }}
      />
      {[LANE_LOW_Y, LANE_HIGH_Y].map((y) => (
        <div
          key={`br-${y}`}
          style={{
            position: 'absolute',
            left: 1502,
            top: y + BAND_H / 2,
            width: 46,
            height: 2,
            background: rgba(COL.dim, 0.45),
          }}
        />
      ))}

      <Host side="A" role="发送方" active={!lowArrived} sending={t < TF_LOW}>
        <div style={{fontFamily: FONT.sans, fontSize: 14, color: COL.dim, marginTop: 2}}>同一台主机发两条链路</div>
      </Host>
      <Host side="B" role="接收方" active={headArrivedB}>
        <div style={{fontFamily: FONT.sans, fontSize: 14, color: COL.dim, marginTop: 2}}>两条链路汇入同一台主机</div>
      </Host>

      {/* 上 lane：低带宽 R = 2 Mb/s */}
      <LinkBand y={LANE_LOW_Y} label={`低带宽 R = ${fmtBits(R_LOW)}/s → Tf = ${fmtMs(TF_LOW)} · 占链路 ${TF_LOW}/${P.Tp}（稀疏）`} />
      {!lowArrived ? (
        <FrameBlock
          head={head}
          tail={tailLow}
          color={COL.data}
          label={`数据帧 · ${P.L} bit`}
          bandY={LANE_LOW_Y}
        />
      ) : null}
      <BitStripes head={head} tail={tailLow} bandY={LANE_LOW_Y} tfMs={TF_LOW} divisions={DIVISIONS} />
      <LaneStatus
        y={LANE_LOW_Y - 32}
        text={statusOf(TF_LOW, ARRIVE_LOW, lowArrived)}
        color={lowArrived ? COL.good : COL.data}
      />
      {lowArrived ? (
        <div
          style={{
            position: 'absolute',
            left: LAYOUT.link.x1 - 252,
            top: LANE_LOW_Y + 12,
            width: 238,
            height: 38,
            borderRadius: 10,
            border: `1px dashed ${rgba(COL.good, 0.85)}`,
            background: rgba(COL.good, 0.14),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.mono,
            fontSize: 16,
            color: COL.good,
          }}
        >
          {`✓ ${P.L} bit 已送达 B`}
        </div>
      ) : null}

      {/* 下 lane：高带宽 R = 8 Mb/s（题目值） */}
      <LinkBand y={LANE_HIGH_Y} label={`高带宽 R = ${fmtBits(P.R)}/s → Tf = ${fmtMs(Tf)} · 占链路 ${Tf}/${P.Tp}（密集）`} />
      {!highArrived ? (
        // 高带宽 lane 的帧块只有 1/12 条链路宽：不挂 label，免得它按 FrameBlock 的规则飘到块上方
        <FrameBlock head={head} tail={tailHigh} color={COL.data} bandY={LANE_HIGH_Y} />
      ) : null}
      <BitStripes head={head} tail={tailHigh} bandY={LANE_HIGH_Y} tfMs={Tf} divisions={DIVISIONS} />
      <LaneStatus
        y={LANE_HIGH_Y - 32}
        text={statusOf(Tf, ARRIVE_HIGH, highArrived)}
        color={highArrived ? COL.good : COL.data}
      />
      {highArrived ? (
        <div
          style={{
            position: 'absolute',
            left: LAYOUT.link.x1 - 252,
            top: LANE_HIGH_Y + 12,
            width: 238,
            height: 38,
            borderRadius: 10,
            border: `1px dashed ${rgba(COL.good, 0.85)}`,
            background: rgba(COL.good, 0.14),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.mono,
            fontSize: 16,
            color: COL.good,
          }}
        >
          {`✓ ${P.L} bit 已送达 B`}
        </div>
      ) : null}

      {/* 左下：同一帧在两条 lane 上的账，整帧到达 B 后整行点亮 */}
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
          padding: '8px 14px 0',
        }}
      >
        <div style={{fontFamily: FONT.mono, fontSize: 15, color: COL.faint}}>
          {`竖纹 = 每 1000 bit 一格（两条 lane 相同）· 同一帧 L = ${P.L} bit = ${fmtBytes(P.L)}`}
        </div>
        <div style={{fontFamily: FONT.mono, fontSize: 17, color: headArrivedB ? COL.warn : COL.dim, marginTop: 4}}>
          {headArrivedB
            ? `t = ${fmtMs(P.Tp)}：两条链路的首比特同时到达 B —— 传播速度 v 不变，Tp 不变`
            : `同样 ${P.L} bit：低带宽占链路 ${TF_LOW}/${P.Tp}，高带宽只占 ${Tf}/${P.Tp} → 比特更密集`}
        </div>
        <div style={{fontFamily: FONT.mono, fontSize: 15, color: COL.faint, marginTop: 4}}>
          距离 d 与传播速度 v 不变，只改变带宽 R
        </div>
      </div>
      <CompareRow
        y={PANEL.y + 78}
        color={lowArrived ? COL.good : COL.data}
        title={`低带宽 lane：R_low = ${fmtBits(R_LOW)}/s`}
        line1={`Tf = L / R_low = ${P.L} bit ÷ ${fmtBits(R_LOW)}/s = ${fmtMs(TF_LOW)}`}
        line2={`整帧到达 B = Tf + Tp = ${fmtMs(TF_LOW)} + ${fmtMs(P.Tp)} = ${fmtMs(ARRIVE_LOW)}`}
        on={lowArrived}
      />
      <CompareRow
        y={PANEL.y + 148}
        color={highArrived ? COL.good : COL.data}
        title={`高带宽 lane：R = ${fmtBits(P.R)}/s`}
        line1={`Tf = L / R = ${P.L} bit ÷ ${fmtBits(P.R)}/s = ${fmtMs(Tf)}`}
        line2={`整帧到达 B = Tf + Tp = ${fmtMs(Tf)} + ${fmtMs(P.Tp)} = ${fmtMs(ARRIVE_HIGH)}`}
        on={highArrived}
      />

      {/* 后 3 秒的结论 */}
      <div
        style={{
          position: 'absolute',
          left: 940,
          top: 150,
          width: 600,
          boxSizing: 'border-box',
          opacity: conclusion,
          transform: `translateY(${(1 - conclusion) * 18}px)`,
          borderRadius: 14,
          border: `1px solid ${rgba(COL.good, 0.55)}`,
          background: rgba(COL.panel, 0.88),
          boxShadow: `0 0 30px ${rgba(COL.good, 0.25)}`,
          padding: '14px 20px',
        }}
      >
        <div style={{fontFamily: FONT.mono, fontSize: 16, color: COL.good, letterSpacing: 2}}>结论</div>
        <div style={{fontFamily: FONT.sans, fontSize: 27, fontWeight: 800, color: COL.text, marginTop: 6}}>
          带宽↑ → 发送时延↓，但传播时延不变
        </div>
        <div style={{fontFamily: FONT.sans, fontSize: 26, fontWeight: 700, color: COL.good, marginTop: 6}}>
          整帧到达时间 = Tf + Tp，会提前
        </div>
        <div style={{fontFamily: FONT.mono, fontSize: 16, color: COL.dim, marginTop: 8}}>
          {`Tp 只由距离 d 与传播速度 v 决定：${fmtMs(ARRIVE_LOW)} → ${fmtMs(ARRIVE_HIGH)} 提前了 ${fmtMs(TF_LOW - Tf)}`}
        </div>
      </div>

      <TimeAxis
        from={0}
        to={16}
        marks={[
          {ms: ARRIVE_HIGH, label: '高带宽整帧到达 B', color: COL.data},
          {ms: ARRIVE_LOW, label: '低带宽整帧到达 B', color: COL.data},
        ]}
      />
      {/* 当前模拟时刻：自己写一块固定位置的读数（播放头读数会横扫下面那块对比表） */}
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
          color: COL.text,
          background: rgba('#000000', 0.62),
          border: `1px solid ${rgba(COL.text, 0.3)}`,
          borderRadius: 8,
          padding: '3px 0',
        }}
      >
        t = {t.toFixed(1)} ms
      </div>
    </AbsoluteFill>
  );
};
