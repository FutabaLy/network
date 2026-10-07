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
 *
 * `narrationBase`：网页版必须显式传入音频目录前缀（例如 `./narration/`）。
 * 因为 `staticFile()` 在 Player（浏览器）里会解析成**域名根路径** `/narration/...`，
 * 而站点部署在子路径（如 `/network/network-delay-mv/`）下 → 会 404 没声音。
 * 渲染成片时不传，走 staticFile（相对 public/）即可。
 */
export const Main: React.FC<{mute?: boolean; narrationBase?: string}> = ({mute = false, narrationBase}) => (
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
              <Audio src={narrationBase ? `${narrationBase}${c.id}.mp3` : staticFile(`narration/${c.id}.mp3`)} />
            </Sequence>
          );
        })
      : null}
  </AbsoluteFill>
);
