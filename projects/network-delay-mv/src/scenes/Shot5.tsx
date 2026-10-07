import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COL, FONT, prog, rgba} from '../theme';
import {CYCLE, EV, Tf, U_STOPWAIT, fmtMs, fmtPct} from '../sim';
import {FrameBlock, Host, Knowledge, LAYOUT, LinkBand, ScaleBadge, useSimMs} from '../components/Stage';

/** 第 5 段：停止等待协议。发 1 ms、等 24 ms —— 利用率只有 4%。 */
export const SHOT5_DUR = 900; // 15s @60fps
const SEC_PER_MS = 0.3; // 1 ms ≈ 0.3 s → 25 ms ≈ 7.5 s，8.3 s 后留给公式与结论
const ANIM_START = 0.8; // 动画在第 0.8 秒开始

/* 时间轴 / 状态条的几何（0..AXIS_TO 毫秒） */
const AXIS_X0 = LAYOUT.axis.x0;
const AXIS_X1 = LAYOUT.axis.x1;
const AXIS_TO = 26; // 覆盖 0..26 ms
const BAR_Y = 690; // A 的状态条：放在链路下方、时间轴上方
const BAR_H = 26;
const px = (ms: number) => AXIS_X0 + (ms / AXIS_TO) * (AXIS_X1 - AXIS_X0);

/**
 * A 的状态条：蓝色 = 正在发送（0..Tf），灰色 = 等待 ACK（Tf..CYCLE）。
 * 位置和宽度全部由 Tf / CYCLE 算出来，不写死数字。
 */
const HostAStatusBar: React.FC<{t: number}> = ({t}) => {
  const xSend0 = px(EV.sendStart);
  const xSend1 = px(EV.lastBitIn);
  const xWait1 = px(EV.ackArriveA);
  const sending = t < EV.lastBitIn;
  const waiting = t >= EV.lastBitIn && t < EV.ackArriveA;
  const live = Math.max(0, px(Math.min(t, AXIS_TO)) - xSend0);
  return (
    <>
      {/* 状态条标题：标题在左，当前状态在中，不和右侧结论卡抢位置 */}
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0,
          top: BAR_Y - 44,
          fontFamily: FONT.sans,
          fontSize: 22,
          color: COL.text,
        }}
      >
        A 的状态条
      </div>
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0 + 170,
          top: BAR_Y - 42,
          fontFamily: FONT.sans,
          fontSize: 19,
          color: COL.dim,
        }}
      >
        蓝 = 发送中，灰 = 空闲等待
      </div>
      {/* 当前状态由状态条本身 + 下方图例 + 主机 A 的角标共同表达，这里不再重复一行文字 */}

      {/* 灰色：等待区 Tf..CYCLE（= 24 ms） */}
      <div
        style={{
          position: 'absolute',
          left: xSend1,
          top: BAR_Y,
          width: Math.max(0, xWait1 - xSend1),
          height: BAR_H,
          background: rgba(COL.wait, 0.8),
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
        }}
      />
      {/* 蓝色：发送区 0..Tf（= 1 ms） */}
      <div
        style={{
          position: 'absolute',
          left: xSend0,
          top: BAR_Y,
          width: Math.max(0, xSend1 - xSend0),
          height: BAR_H,
          background: rgba(COL.data, 0.85),
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
          boxShadow: sending ? `0 0 20px ${rgba(COL.data, 0.7)}` : 'none',
        }}
      />

      {/* 已过去的模拟时间：半透明白色覆盖 */}
      <div
        style={{
          position: 'absolute',
          left: xSend0,
          top: BAR_Y,
          width: live,
          height: BAR_H,
          background: rgba('#ffffff', 0.12),
          pointerEvents: 'none',
        }}
      />
      {/* 播放头 */}
      {t >= EV.sendStart && t <= AXIS_TO ? (
        <div
          style={{
            position: 'absolute',
            left: px(t),
            top: BAR_Y - 12,
            width: 3,
            height: BAR_H + 24,
            background: COL.text,
            boxShadow: `0 0 12px ${rgba(COL.text, 0.85)}`,
          }}
        />
      ) : null}

      {/* 两段的分界时刻：Tf = 1 ms（发完了，只能等） */}
      <div
        style={{
          position: 'absolute',
          left: xSend1 - 1,
          top: BAR_Y - 4,
          width: 2,
          height: BAR_H + 12,
          background: rgba(COL.text, 0.5),
        }}
      />
      {/* 两个区间的时长图例（数值来自 sim.ts），单独成行，不和时间轴刻度挤在一起 */}
      <div
        style={{
          position: 'absolute',
          left: AXIS_X0,
          top: BAR_Y + BAR_H + 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: FONT.mono,
          fontSize: 20,
        }}
      >
        <span style={{display: 'inline-block', width: 26, height: 12, background: rgba(COL.data, 0.85), borderRadius: 3}} />
        <span style={{color: COL.data}}>{`发送 ${fmtMs(Tf)}`}</span>
        <span
          style={{
            display: 'inline-block',
            width: 26,
            height: 12,
            background: rgba(COL.wait, 0.8),
            borderRadius: 3,
            marginLeft: 26,
          }}
        />
        <span style={{color: COL.wait}}>{`等待 ${fmtMs(CYCLE - Tf)}`}</span>
        <span style={{marginLeft: 30, fontFamily: FONT.sans, fontSize: 19, color: rgba(COL.dim, 0.95)}}>
          {'A 一直等到第 25 ms 才收到 ACK'}
        </span>
      </div>
    </>
  );
};

/**
 * 和全片 TimeAxis 同一套画法，但收在本段自己的坐标里：
 * 播放头只画竖线，「t = xx ms」放在轴下方，避免压住链路里的帧。
 */
const MsAxis: React.FC<{
  t: number;
  marks: {
    ms: number;
    /** 贴着轴的数字上方的一行短说明 */
    short: string;
    /** 上方的详细说明 */
    label: string;
    color?: string;
    labelAlign?: 'l' | 'r';
    labelTop?: number;
  }[];
}> = ({t, marks}) => {
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
      {/* 已经过去的时间 */}
      <div style={{position: 'absolute', left: AXIS_X0, top: 812, width: Math.max(0, px(now) - AXIS_X0), height: 3, background: rgba(COL.data, 0.85)}} />
      {/* 事件标记 */}
      {marks.map((mk) => {
        const on = t >= mk.ms;
        const c = mk.color ?? COL.warn;
        const right = mk.labelAlign === 'r';
        return (
          <div key={`${mk.ms}-${mk.label}`}>
            <div style={{position: 'absolute', left: px(mk.ms), top: 700, width: 2, height: 100, background: rgba(c, on ? 0.55 : 0.2)}} />
            {/* 数字 + 短说明紧贴轴上方（数字在前，短说明在后，避免和左侧图例重叠） */}
            <div
              style={{
                position: 'absolute',
                left: px(mk.ms) - 70,
                top: 766,
                width: 140,
                textAlign: 'center',
                fontFamily: FONT.mono,
                fontSize: 16,
                fontWeight: 700,
                color: on ? c : rgba(c, 0.4),
              }}
            >
              {fmtMs(mk.ms)}
            </div>
            <div
              style={{
                position: 'absolute',
                left: px(mk.ms) - 90,
                top: 785,
                width: 180,
                textAlign: 'center',
                fontFamily: FONT.sans,
                fontSize: 15,
                color: on ? COL.dim : rgba(COL.dim, 0.45),
              }}
            >
              {mk.short}
            </div>
            {/* 详细说明放在上方预留的空白处（不需要 180 宽的可以靠右对齐，避免互相撞） */}
            <div
              style={{
                position: 'absolute',
                left: right ? px(mk.ms) - 180 : px(mk.ms) - 90,
                top: mk.labelTop ?? 560,
                width: 180,
                textAlign: 'center',
                fontFamily: FONT.sans,
                fontSize: 15,
                lineHeight: 1.3,
                color: on ? COL.dim : rgba(COL.dim, 0.45),
              }}
            >
              {mk.label}
            </div>
          </div>
        );
      })}
      {/* 播放头：只画竖线（轴上有刻度数字，画面上不再重复一个读数气泡，避免压到刻度） */}
      {t >= 0 && t <= AXIS_TO ? (
        <div
          style={{
            position: 'absolute',
            left: px(now),
            top: 664,
            width: 2,
            height: 148,
            background: COL.text,
            boxShadow: `0 0 12px ${rgba(COL.text, 0.8)}`,
          }}
        />
      ) : null}
    </>
  );
};

export const Shot5: React.FC = () => {
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: Math.round(ANIM_START * 60)});

  /* 数据帧：0 开始逐比特进入链路，1 ms 全部进入，之后整块滑向 B */
  const head = t / EV.headArriveB; // 首比特位置（Tp = 12 ms 走完全程）
  const tail = (t - Tf) / EV.headArriveB; // 末比特位置（发送中裁到 0）

  const sending = t < EV.lastBitIn;
  const headAtB = t >= EV.headArriveB; // 12 ms 首比特到达 B
  const recvDone = t >= EV.frameRecvB; // 13 ms 整帧接收完成 → 立即回 ACK
  const ackSentAt = EV.frameRecvB; // ACK 从 B 发出的时刻
  const ackAtA = t >= EV.ackArriveA; // 25 ms ACK 回到 A

  /* ACK：反向传播。head/tail 仍是「距 A 的归一化位置」；
     本题忽略 ACK 的发送时延，所以它是一块固定宽度的小方块（约 0.6 格） */
  const ackHeadRaw = 1 - (t - ackSentAt) / EV.headArriveB;
  const ackHead = Math.min(1, Math.max(0, ackHeadRaw));
  const ackTail = Math.min(1, Math.max(0, ackHeadRaw - 0.05)); // 宽约 0.6 格
  const ackOn = t < EV.ackArriveA && ackHeadRaw > -0.2 && ackTail < 1;

  /* 动画结束（t = 25 ms，即视频第 8.3 秒）后出现的结论 */
  const c1 = prog((t - EV.ackArriveA) * SEC_PER_MS * 60, 0, 16);
  const c2 = prog((t - EV.ackArriveA) * SEC_PER_MS * 60, 10, 16);
  /* 公式卡在动画开始后不久就出现（第 0.3 秒 → 第 0.75 秒） */
  const formulaIn = prog(t * SEC_PER_MS * 60, 18, 28);

  return (
    <AbsoluteFill>
      {/* 13 ms：B 收完立即回 ACK —— 这一刻要有明显的动作（铺在最底层，不遮住主机文字） */}
      {t >= ackSentAt && t < ackSentAt + 1.6 ? (
        <>
          <AbsoluteFill
            style={{
              background: `radial-gradient(620px 420px at 82% 44%, ${rgba(COL.ack, 0.22)}, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: LAYOUT.hostB.x - 30,
              top: LAYOUT.hostB.y - 30,
              width: LAYOUT.hostB.w + 60,
              height: LAYOUT.hostB.h + 60,
              borderRadius: 26,
              border: `3px solid ${rgba(COL.ack, 0.85)}`,
              opacity: 1 - prog((t - ackSentAt) * SEC_PER_MS * 60, 0, 22),
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: LAYOUT.hostB.x - 40,
              top: LAYOUT.hostB.y - 78,
              width: LAYOUT.hostB.w + 80,
              textAlign: 'center',
              fontFamily: FONT.sans,
              fontSize: 24,
              fontWeight: 700,
              color: COL.ack,
            }}
          >
            收完整帧，立即回 ACK
          </div>
        </>
      ) : null}

      <Knowledge
        index="05"
        title="停止等待协议"
        formulaNote={`发一帧 → 等一个确认。一个周期 = Tf + 2Tp = ${fmtMs(Tf)} + ${fmtMs(2 * EV.headArriveB)} = ${fmtMs(CYCLE)}`}
      />
      <ScaleBadge text="本段：1 ms ≈ 0.3 s（25 ms ≈ 7.5 s）" />

      <Host side="A" role="发送方" active={sending || ackAtA} sending={sending}>
        {!sending ? (
          <div
            style={{
              marginTop: 6,
              fontFamily: FONT.mono,
              fontSize: 16,
              color: ackAtA ? COL.good : COL.wait,
              border: `1px solid ${rgba(ackAtA ? COL.good : COL.wait, 0.6)}`,
              borderRadius: 999,
              padding: '3px 12px',
            }}
          >
            {ackAtA ? '收到 ACK，可以发下一帧' : '等待 ACK'}
          </div>
        ) : null}
      </Host>
      <Host side="B" role="接收方" active={recvDone} />

      <LinkBand />

      {/* 数据帧：0→1 ms 逐比特进入链路，1→13 ms 整块滑到 B */}
      <FrameBlock
        head={Math.min(head, 1)}
        tail={Math.max(tail, 0)}
        color={COL.data}
        label="数据帧 8000 bit"
        edgeLabels
      />

      {/* ACK：13→25 ms 从 B 反向传播回 A（宽度固定，忽略 ACK 发送时延） */}
      {ackOn && recvDone ? (
        <FrameBlock head={ackHead} tail={ackTail} color={COL.ack} dir="rl" plot={false} />
      ) : null}
      {ackOn && recvDone ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(ackHead, ackTail) * (LAYOUT.link.x1 - LAYOUT.link.x0) + LAYOUT.link.x0 - 24,
            top: LAYOUT.link.y - 34,
            width: 90,
            textAlign: 'center',
            fontFamily: FONT.mono,
            fontSize: 17,
            color: COL.ack,
          }}
        >
          ACK
        </div>
      ) : null}

      {/* 12 ms：首比特到达 B */}
      {headAtB && t < EV.frameRecvB + 2 ? (
        <div
          style={{
            position: 'absolute',
            left: LAYOUT.link.x1 - 12,
            top: LAYOUT.link.y - 74,
            textAlign: 'right',
            width: 300,
            fontFamily: FONT.sans,
            fontSize: 20,
            color: COL.hostB,
          }}
        >
          {`${fmtMs(EV.headArriveB)} 首比特到达 B`}
        </div>
      ) : null}

      {/* A 的状态条：蓝 1 ms + 灰 24 ms */}
      <HostAStatusBar t={t} />

      <MsAxis
        t={t}
        marks={[
          {ms: EV.frameRecvB, short: '收到整帧，立即回 ACK', label: 'B 收完整帧，发出 ACK', color: COL.ack},
          {
            ms: EV.ackArriveA,
            short: 'ACK 回到 A',
            label: 'ACK 走完反向链路回到 A',
            color: COL.data,
            labelAlign: 'r',
          },
        ]}
      />

      {/* 公式卡：利用率 U = Tf / (Tf + 2Tp) = 1/25 = 4% */}
      <div
        style={{
          position: 'absolute',
          left: 1000,
          top: 158,
          width: 810,
          textAlign: 'right',
          opacity: formulaIn,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontFamily: FONT.mono,
            fontSize: 27,
            color: COL.text,
            background: rgba(COL.warn, 0.12),
            border: `1px solid ${rgba(COL.warn, 0.45)}`,
            borderRadius: 10,
            padding: '10px 18px',
          }}
        >
          {`U = Tf / (Tf + 2Tp) = ${fmtMs(Tf)} / ${fmtMs(CYCLE)} = 1/25 = `}
          <span style={{color: COL.warn, fontWeight: 700}}>{fmtPct(U_STOPWAIT)}</span>
        </div>
        <div style={{marginTop: 10, fontFamily: FONT.sans, fontSize: 20, color: COL.dim}}>
          {`一个周期的 ${fmtMs(Tf)} 在发数据，另外 ${fmtMs(CYCLE - Tf)} 里链路是空的`}
        </div>
      </div>

      {/* 结论两行：放在轴刻度以下的空白带（y ≥ 840），不压链路、状态条、时间轴与刻度 */}
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 840,
          width: 910,
          opacity: c1,
          transform: `translateY(${(1 - c1) * 14}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontSize: 27,
            fontWeight: 700,
            color: COL.warn,
            background: rgba(COL.warn, 0.1),
            border: `1px solid ${rgba(COL.warn, 0.4)}`,
            borderRadius: 10,
            padding: '8px 18px',
          }}
        >
          每发一帧就要等一个 RTT 多一点
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 904,
          width: 910,
          opacity: c2,
          transform: `translateY(${(1 - c2) * 14}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontSize: 27,
            fontWeight: 700,
            color: COL.warn,
            background: rgba(COL.warn, 0.1),
            border: `1px solid ${rgba(COL.warn, 0.4)}`,
            borderRadius: 10,
            padding: '8px 18px',
          }}
        >
          传播时延越长，利用率越低
        </span>
      </div>
    </AbsoluteFill>
  );
};
