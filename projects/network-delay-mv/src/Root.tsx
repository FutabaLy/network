import React from 'react';
import {Composition} from 'remotion';
import {Main} from './Main';
import {TOTAL} from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NetDelay"
    component={Main}
    durationInFrames={TOTAL}
    fps={60}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
