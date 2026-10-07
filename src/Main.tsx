import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {Backdrop} from './components/Stage';
import {Subtitles} from './components/Subtitles';
import {NARRATION} from './narration';
import {narrationDurations} from './subs';
import {COL, FONT} from './theme';
import {SHOTS, TOTAL, shotStart} from './timeline';

export {TOTAL};

const FPS = 60;
const SHOT_SECONDS = 15;

/**
 * 主合成：背景 + 六个分镜 + 全局字幕 + 中文旁白。
 * 旁白按 src/narration.ts 的 `shot/at` 定位；音频文件由 `npm run narration` 生成到 public/narration/。
 */
export const Main: React.FC<{mute?: boolean}> = ({mute = false}) => (
  <AbsoluteFill style={{background: COL.bg, fontFamily: FONT.sans, color: COL.text}}>
    <Backdrop />

    {SHOTS.map((s, i) => (
      <Sequence key={s.id} from={shotStart(i)} durationInFrames={s.dur} name={s.id}>
        <s.C />
      </Sequence>
    ))}

    <Subtitles />

    {!mute
      ? NARRATION.map((c) => {
          const dur = narrationDurations[c.id];
          if (!dur) return null;
          const from = Math.round(((c.shot - 1) * SHOT_SECONDS + c.at) * FPS);
          return (
            <Sequence key={c.id} from={from} durationInFrames={Math.ceil(dur * FPS) + 4} name={`vo_${c.id}`}>
              <Audio src={staticFile(`narration/${c.id}.mp3`)} />
            </Sequence>
          );
        })
      : null}
  </AbsoluteFill>
);
