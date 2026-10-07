import durations from '../audio/narration/durations.json';
import {NARRATION, SHOT_SECONDS, cueStartSec} from './narration';

/**
 * 字幕时间轴：**唯一来源**是 src/narration.ts（文案 + 起始秒），
 * 时长优先取 TTS 实测时长（audio/narration/durations.json），没生成音频时用默认值兜底。
 * 视频里的字幕层（components/Subtitles.tsx）和导出的 .srt 都从这里算，保证两者一致。
 */
const DEFAULT_DUR = 3.2; // 没有实测时长时的兜底（秒）

export const narrationDurations = durations as Record<string, number>;
export const hasNarration = Object.keys(narrationDurations).length > 0;

export type SubtitleCue = {id: string; text: string; from: number; to: number; shot: number};

const FPS = 60;

export const SUBTITLES: SubtitleCue[] = NARRATION.map((c) => {
  const start = cueStartSec(c);
  const dur = narrationDurations[c.id] ?? DEFAULT_DUR;
  return {
    id: c.id,
    text: c.text,
    shot: c.shot,
    from: Math.round(start * FPS),
    // 留 0.12s 的呼吸间隔（但不越过下一条字幕的起点）
    to: Math.round((start + dur + 0.12) * FPS),
  };
}).map((c, i, all) => {
  const next = all[i + 1];
  return next && next.from < c.to ? {...c, to: Math.max(c.from + 30, next.from - 12)} : c;
});

/** 某一帧上应该显示的字幕（没有则返回 null） */
export const subtitleAtFrame = (frame: number): SubtitleCue | null =>
  SUBTITLES.find((c) => frame >= c.from && frame < c.to) ?? null;

/** 供 scripts/make_srt.mjs 复用：把帧换成 SRT 时间戳 */
export const frameToSrtTime = (frame: number) => {
  const totalMs = Math.round((frame / FPS) * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
};

export {SHOT_SECONDS};
