import React from 'react';
import {SHOT1_DUR, Shot1} from './scenes/Shot1';
import {SHOT2_DUR, Shot2} from './scenes/Shot2';
import {SHOT3_DUR, Shot3} from './scenes/Shot3';
import {SHOT4_DUR, Shot4} from './scenes/Shot4';
import {SHOT5_DUR, Shot5} from './scenes/Shot5';
import {SHOT6_DUR, Shot6} from './scenes/Shot6';

export type ShotDef = {
  id: string;
  /** 这一段的标题（用于调试界面里的章节按钮） */
  title: string;
  C: React.FC;
  dur: number;
};

/** 六个分镜，每段 15 秒 = 900 帧 @60fps */
export const SHOTS: ShotDef[] = [
  {id: 'shot1', title: '01 发送时延', C: Shot1, dur: SHOT1_DUR},
  {id: 'shot2', title: '02 传播时延', C: Shot2, dur: SHOT2_DUR},
  {id: 'shot3', title: '03 带宽与传播速度', C: Shot3, dur: SHOT3_DUR},
  {id: 'shot4', title: '04 时延带宽积', C: Shot4, dur: SHOT4_DUR},
  {id: 'shot5', title: '05 停止等待', C: Shot5, dur: SHOT5_DUR},
  {id: 'shot6', title: '06 滑动窗口与利用率', C: Shot6, dur: SHOT6_DUR},
];

export const SHOT_STARTS = SHOTS.map((_, i) => SHOTS.slice(0, i).reduce((s, x) => s + x.dur, 0));
export const shotStart = (i: number) => SHOT_STARTS[i];
export const TOTAL = SHOTS.reduce((s, x) => s + x.dur, 0);
/** 每个分镜在整片中的秒数区间（调试界面用） */
export const SHOT_RANGES = SHOTS.map((s, i) => ({
  id: s.id,
  title: s.title,
  from: SHOT_STARTS[i],
  to: SHOT_STARTS[i] + s.dur,
}));
