import React, {useEffect, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Main} from '../src/Main';
import {COL, FONT, rgba} from '../src/theme';
import {SHOT_RANGES, TOTAL} from '../src/timeline';

const Q = new URLSearchParams(window.location.search);
const UI = Q.get('ui') === '1';
const FULL = Q.get('full') === '1';
const TOTAL_SEC = TOTAL / 60;

const fmt = (frame: number) => {
  const s = Math.floor(frame / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#cfd9ee',
  border: `1px solid ${rgba(COL.line, 1)}`,
  borderRadius: 8,
  padding: '6px 14px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const App: React.FC = () => {
  const ref = useRef<PlayerRef>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFrame = ({detail}: {detail: {frame: number}}) => setFrame(detail.frame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('frameupdate', onFrame);
    return () => {
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('frameupdate', onFrame);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = shellRef.current as (HTMLDivElement & {webkitRequestFullscreen?: () => void}) | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };

  const current = SHOT_RANGES.find((s) => frame >= s.from && frame < s.to) ?? SHOT_RANGES[0];

  const player = (
    <div
      style={{position: 'relative', width: isFullscreen ? 'min(100%, 177.78vh)' : '100%'}}
      title="双击全屏"
      onDoubleClick={toggleFullscreen}
    >
      <Player
        ref={ref}
        component={Main}
        inputProps={{}}
        durationInFrames={TOTAL}
        fps={60}
        compositionWidth={1920}
        compositionHeight={1080}
        controls={UI}
        loop
        clickToPlay
        acknowledgeRemotionLicense
        style={{width: '100%', display: 'block'}}
      />
    </div>
  );

  if (FULL) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div ref={shellRef} style={{position: 'relative', width: 'min(100vw, 177.78vh)'}} onDoubleClick={toggleFullscreen}>
          {player}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COL.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 20px 36px',
        boxSizing: 'border-box',
        color: COL.text,
      }}
    >
      <div style={{width: '100%', maxWidth: 'min(1280px, 158vh)'}}>
        <div
          ref={shellRef}
          style={
            isFullscreen
              ? {
                  width: '100vw',
                  height: '100vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#000',
                }
              : {
                  position: 'relative',
                  width: '100%',
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: `1px solid ${rgba(COL.line, 1)}`,
                  background: '#000',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
                }
          }
        >
          {player}
        </div>

        {isFullscreen ? null : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 12,
              fontSize: 13,
              color: COL.dim,
            }}
          >
            <span>
              计算机网络 · 时延与信道利用率 ｜ 全长 {fmt(TOTAL)}（{TOTAL_SEC.toFixed(0)} 秒 / 60fps）｜
              当前：{current.title} · {fmt(frame)}
            </span>
            <span style={{display: 'flex', gap: 8}}>
              <button type="button" style={ghostBtn} onClick={() => ref.current?.seekTo(0)}>
                回到开头
              </button>
              <button type="button" style={ghostBtn} onClick={toggleFullscreen}>
                放大 ⤢
              </button>
            </span>
          </div>
        )}

        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12}}>
          {SHOT_RANGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ref.current?.seekTo(s.from)}
              style={{
                ...ghostBtn,
                borderColor: current.id === s.id ? COL.data : rgba(COL.line, 1),
                color: current.id === s.id ? COL.data : '#cfd9ee',
              }}
            >
              {s.title} · {fmt(s.from)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
