/**
 * 中文旁白稿（同时也是字幕与音轨的**唯一数据源**）。
 *
 * - `shot`：第几个分镜（1..6）
 * - `at`  ：在这一个分镜内的第几秒开始播（秒，分镜 15 秒一段）
 * - `text`：旁白原文；字幕直接用它，音频由 audio/make_narration.py 按条生成
 *
 * 生成流程：npm run narration → audio/narration/shotN_i.mp3 + durations.json（实测时长）
 *           npm run subs      → subtitles/narration.srt
 */
export type Cue = {id: string; shot: number; at: number; text: string};

export const SHOT_SECONDS = 15;
export const SHOT_COUNT = 6;

export const NARRATION: Cue[] = [
  // 1. 发送时延
  {id: 's1_1', shot: 1, at: 0.6, text: '先看发送时延。'},
  {id: 's1_2', shot: 1, at: 2.6, text: '一帧 8000 比特，带宽 8 兆比特每秒。'},
  {id: 's1_3', shot: 1, at: 6.4, text: '发完这一帧需要 1 毫秒，这就是发送时延。'},
  {id: 's1_4', shot: 1, at: 10.0, text: '发送时延等于帧长除以带宽。'},

  // 2. 传播时延
  {id: 's2_1', shot: 2, at: 0.5, text: '再看传播时延。'},
  {id: 's2_2', shot: 2, at: 2.4, text: '第 0 毫秒开始发送，第 1 毫秒末比特才进入链路。'},
  {id: 's2_3', shot: 2, at: 6.6, text: '第 12 毫秒，首比特到达主机 B。'},
  {id: 's2_4', shot: 2, at: 9.8, text: '第 13 毫秒末比特到达，整帧接收完成。'},

  // 3. 带宽与传播速度
  {id: 's3_1', shot: 3, at: 0.5, text: '把带宽提高四倍会怎样？'},
  {id: 's3_2', shot: 3, at: 3.0, text: '带宽越大，每秒送入链路的比特越多。'},
  {id: 's3_3', shot: 3, at: 6.6, text: '发送时延变短，同样的帧更早进入链路。'},
  {id: 's3_4', shot: 3, at: 10.2, text: '但传播速度不变，Tp 仍是 12 毫秒。'},

  // 4. 时延带宽积
  {id: 's4_1', shot: 4, at: 0.5, text: '如果 A 一直不停地发送呢？'},
  {id: 's4_2', shot: 4, at: 3.4, text: '链路上同时在传播的比特数，叫时延带宽积。'},
  {id: 's4_3', shot: 4, at: 7.6, text: '8 兆比特每秒乘 12 毫秒，等于 96 千比特。'},
  {id: 's4_4', shot: 4, at: 11.0, text: '即 12000 字节，等于 12 帧。'},

  // 5. 停止等待
  {id: 's5_1', shot: 5, at: 0.5, text: '停止等待：发一帧，等一个确认。'},
  {id: 's5_2', shot: 5, at: 3.6, text: '第 13 毫秒 B 收完，立即回 ACK。'},
  {id: 's5_3', shot: 5, at: 7.0, text: '第 25 毫秒 ACK 回到 A，其间 24 毫秒都在等。'},
  {id: 's5_4', shot: 5, at: 11.6, text: '利用率 1/25，只有 4%。'},

  // 6. 滑动窗口与 GBN / SR
  {id: 's6_1', shot: 6, at: 0.3, text: '滑动窗口允许连续发送多帧。'},
  {id: 's6_2', shot: 6, at: 3.2, text: '窗口 16 时，第 16 毫秒就停下等确认。'},
  {id: 's6_3', shot: 6, at: 7.1, text: '窗口 25 时确认刚好回来，不用停。'},
  {id: 's6_4', shot: 6, at: 10.6, text: 'GBN 最大 31，SR 只有 16。'},
];

export const cuesOfShot = (shot: number) => NARRATION.filter((c) => c.shot === shot);
/** 这一条字幕在整片中的起始秒 */
export const cueStartSec = (c: Cue) => (c.shot - 1) * SHOT_SECONDS + c.at;
