import React from 'react';
import {AbsoluteFill} from 'remotion';
import {COL, FONT, rgba} from '../theme';
import {EV, P, Tf, fmtMs} from '../sim';
import {FrameBlock, Host, Knowledge, LinkBand, ScaleBadge, TimeAxis, useSimMs} from '../components/Stage';

/** 第 2 段：传播时延 Tp = d/v。追踪首比特，并区分「正在发送」与「已经在链路上传播」。 */
export const SHOT2_DUR = 900;
const SEC_PER_MS = 0.85; // 13 ms ≈ 11 s
const ANIM_START = 0.8;

export const Shot2: React.FC = () => {
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: Math.round(ANIM_START * 60)});
  const head = t / P.Tp;
  const tail = (t - Tf) / P.Tp;
  const sending = t < EV.lastBitIn; // 还有比特没进链路
  const headAtB = t >= EV.headArriveB;
  const done = t >= EV.frameRecvB;

  return (
    <AbsoluteFill>
      <Knowledge
        index="02"
        title="传播时延"
        formula="Tp = d / v = 12 ms"
        formulaNote="一个比特从链路一端传到另一端的时间，由距离与信号传播速度决定"
      />
      <ScaleBadge text="本段时间已放大：1 ms ≈ 0.85 s" />

      <Host side="A" role="发送方" active={sending} sending={sending} />
      <Host side="B" role="接收方" active={done} />
      <LinkBand />

      {/* 数据帧：发送阶段从 0 宽长到一帧宽，之后整块向右滑到 B */}
      <FrameBlock
        head={Math.min(head, 1)}
        tail={Math.max(tail, 0)}
        color={COL.data}
        label="数据帧 8000 bit"
        edgeLabels
      />

      {/* 状态说明：正在发送 / 已在链路传播 / 接收完成 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 596,
          width: 1660,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontSize: 24,
          color: sending ? COL.data : t < EV.frameRecvB ? COL.hostA : COL.good,
        }}
      >
        {sending
          ? '① 正在发送：帧还没全部进入链路（首比特已上路）'
          : t < EV.frameRecvB
            ? '② 已全部进入链路：8000 bit 都在链路上传播'
            : '③ 末比特到达 B：整帧接收完成'}
      </div>

      {/* 关键时刻清单（放在左上空白区，避免和时间轴的播放头/标签打架） */}
      {[
        {ms: EV.lastBitIn, label: '末比特进入链路', color: COL.data},
        {ms: EV.headArriveB, label: '首比特到达 B', color: COL.hostB},
        {ms: EV.frameRecvB, label: '整帧接收完成', color: COL.good},
      ].map((e, i) => {
        const on = t >= e.ms;
        const fresh = t >= e.ms && t < e.ms + 1.2;
        return (
          <div
            key={e.label}
            style={{
              position: 'absolute',
              left: 110,
              top: 218 + i * 40,
              fontFamily: FONT.mono,
              fontSize: 22,
              color: on ? e.color : rgba(COL.faint, 0.7),
              opacity: on ? 1 : 0.45,
            }}
          >
            <span style={{display: 'inline-block', width: 18}}>{on ? '✓' : '○'}</span>
            {'第 ' + fmtMs(e.ms) + '：' + e.label}
            {fresh ? <span style={{marginLeft: 12, color: COL.warn}}>← 就是现在</span> : null}
          </div>
        );
      })}

      <TimeAxis
        from={0}
        to={14}
        now={t}
        marks={[
          {ms: EV.lastBitIn, label: '末比特进入链路', color: COL.data},
          {ms: EV.headArriveB, label: '首比特到达 B', color: COL.hostB},
          {ms: EV.frameRecvB, label: '整帧接收完成', color: COL.good},
        ]}
      />

      {/* 首比特到达时的高光 */}
      {t >= EV.headArriveB && t < EV.headArriveB + 0.6 ? (
        <AbsoluteFill style={{background: `radial-gradient(600px 400px at 78% 46%, ${rgba(COL.hostB, 0.28)}, transparent 70%)`}} />
      ) : null}
    </AbsoluteFill>
  );
};
