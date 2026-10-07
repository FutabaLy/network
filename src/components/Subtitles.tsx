import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COL, FONT, clamp01, prog, rgba} from '../theme';
import {subtitleAtFrame} from '../subs';

/** 全局字幕层：挂一次覆盖全片，内容来自 src/subs.ts（与导出的 .srt 同源） */
export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const cue = subtitleAtFrame(f);
  if (!cue) return null;
  const local = f - cue.from;
  const total = cue.to - cue.from;
  const opacity = clamp01(prog(local, 0, 8) - prog(local, total - 8, 8));

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 140, right: 140, bottom: 30, textAlign: 'center', opacity}}>
        <span
          style={{
            display: 'inline-block',
            fontFamily: FONT.sans,
            fontSize: 33,
            fontWeight: 600,
            lineHeight: 1.32,
            color: '#ffffff',
            background: rgba('#000000', 0.66),
            border: `1px solid ${rgba(COL.text, 0.16)}`,
            borderRadius: 12,
            padding: '9px 26px',
            textShadow: '0 2px 10px rgba(0,0,0,0.95)',
          }}
        >
          {cue.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
