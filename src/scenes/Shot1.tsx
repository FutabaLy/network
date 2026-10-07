import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COL, FONT, prog, rgba} from '../theme';
import {P, Tf} from '../sim';
import {FrameBlock, Host, Knowledge, LinkBand, ScaleBadge, TimeAxis, useSimMs} from '../components/Stage';

/** 第 1 段：发送时延 Tf = L/R。把「逐比特送入链路」放大到看得清。 */
export const SHOT1_DUR = 900; // 15s @60fps
const SEC_PER_MS = 6; // 本段放大：1 ms ≈ 6 s
const ANIM_START = 1.0; // 动画在第 1 秒开始
const LAYOUT_Y_HINT = 300; // 「送入链路」提示的位置

export const Shot1: React.FC = () => {
  const f = useCurrentFrame();
  const t = useSimMs({secPerMs: SEC_PER_MS, ms0: 0, delay: Math.round(ANIM_START * 60)});
  // 发送过程中：末比特在链路入口（tail=0），首比特往前走
  const head = t / P.Tp;
  const tail = (t - Tf) / P.Tp;
  const sentAll = t >= Tf;
  const appear = prog(f, 0, 14);

  return (
    <AbsoluteFill>
      <Knowledge
        index="01"
        title="发送时延"
        formula="Tf = L / R = 8000 bit ÷ 8 Mb/s = 1 ms"
        formulaNote="L = 1000 B = 8000 bit，R = 8 Mb/s"
        appear={appear}
      />
      <ScaleBadge text="本段时间已放大：1 ms ≈ 6 s" />

      <Host side="A" role="发送方" active={!sentAll} sending={!sentAll} />
      <Host side="B" role="接收方" />
      <LinkBand />

      {/* 正在被送入链路的数据帧：从 0 宽长到一帧宽 */}
      <FrameBlock
        head={Math.min(head, 1)}
        tail={Math.max(tail, 0)}
        color={COL.data}
        label="数据帧 · 8000 bit"
        edgeLabels
      />

      {/* 发送端「把比特推入链路」的提示 */}
      {!sentAll ? (
        <div
          style={{
            position: 'absolute',
            left: 366,
            top: LAYOUT_Y_HINT,
            fontFamily: FONT.sans,
            fontSize: 20,
            color: COL.data,
          }}
        >
          送入链路 →
        </div>
      ) : null}

      <TimeAxis from={0} to={1} now={t} marks={[{ms: 1, label: '末比特进入链路', color: COL.data}]} />
    </AbsoluteFill>
  );
};
