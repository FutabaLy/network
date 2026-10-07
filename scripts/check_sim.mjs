/**
 * 数值自检：把全片用到的每个数字/时刻重算一遍，确认动画模型与题目参数一致。
 *
 *   node scripts/check_sim.mjs
 *
 * 覆盖：Tf、Tp、时延带宽积、RTT、周期、Wmin、GBN/SR 窗口、利用率，
 *       以及「一帧在链路中的位置」在关键时刻（0 / Tf / Tp / Tp+Tf）是否落在正确位置。
 */
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

fs.mkdirSync('out', {recursive: true});

await build({
  stdin: {
    contents: `
      import {
        P, Tf, BDP_BIT, BDP_BYTE, BDP_FRAMES, RTT, CYCLE, SEQ_COUNT, GBN_WMAX, SR_WMAX,
        WMIN, U_STOPWAIT, utilization, frameSpan, frameArrived, headArrived, EV, fmtBits, fmtBytes, fmtPct,
      } from './src/sim';

      let fail = 0;
      const eq = (name, got, want, tol = 1e-9) => {
        const ok = Math.abs(got - want) <= tol;
        if (!ok) fail++;
        console.log((ok ? '  ok  ' : ' FAIL ') + name.padEnd(34) + ' = ' + got + (ok ? '' : '   期望 ' + want));
      };
      const truth = (name, cond, extra = '') => {
        if (!cond) fail++;
        console.log((cond ? '  ok  ' : ' FAIL ') + name.padEnd(34) + (extra ? ' ' + extra : ''));
      };

      console.log('— 统一参数 —');
      eq('带宽 R (bit/s)', P.R, 8e6);
      eq('帧长 L (bit)', P.L, 8000);
      eq('Tp (ms)', P.Tp, 12);
      eq('发送时延 Tf = L/R (ms)', Tf, 1);
      eq('时延带宽积 R×Tp (bit)', BDP_BIT, 96000);
      eq('时延带宽积 (B)', BDP_BYTE, 12000);
      eq('链路可容纳帧数', BDP_FRAMES, 12);
      eq('RTT = 2Tp (ms)', RTT, 24);
      eq('周期 Tf+2Tp (ms)', CYCLE, 25);
      eq('序号空间 2^5', SEQ_COUNT, 32);
      eq('GBN 最大窗口', GBN_WMAX, 31);
      eq('SR 最大窗口', SR_WMAX, 16);
      eq('Wmin = ceil(25/1)', WMIN, 25);
      eq('停止等待利用率', U_STOPWAIT, 0.04);
      eq('U(W=16)', utilization(16), 0.64);
      eq('U(W=25)', utilization(25), 1);
      eq('U(W=31) 封顶', utilization(31), 1);
      console.log('        ' + fmtBits(BDP_BIT) + ' = ' + fmtBytes(BDP_BIT) + '，利用率 ' + fmtPct(U_STOPWAIT) + ' / ' + fmtPct(utilization(16)));

      console.log('— 关键时刻 —');
      eq('EV.lastBitIn (ms)', EV.lastBitIn, 1);
      eq('EV.headArriveB (ms)', EV.headArriveB, 12);
      eq('EV.frameRecvB (ms)', EV.frameRecvB, 13);
      eq('EV.ackArriveA (ms)', EV.ackArriveA, 25);

      console.log('— 一帧在链路中的位置（0=A 出口，1=B 入口）—');
      const at = (t) => frameSpan(t, 0);
      truth('t=0：还没进入链路', at(0).head === 0 && at(0).tail < 0, 'head=' + at(0).head.toFixed(4));
      truth('t=0.5ms：只进了一半（首比特在 1/24）', Math.abs(at(0.5).head - 1 / 24) < 1e-9 && at(0.5).tail < 0,
        'head=' + at(0.5).head.toFixed(4));
      truth('t=1ms：末比特刚进入链路（tail=0），首比特在 1/12',
        Math.abs(at(1).head - 1 / 12) < 1e-9 && Math.abs(at(1).tail) < 1e-9);
      truth('t=12ms：首比特到达 B（head=1）', headArrived(12, 0) && Math.abs(at(12).head - 1) < 1e-9);
      truth('t=12ms：整帧还没收完', !frameArrived(12, 0));
      truth('t=13ms：末比特到达 B，整帧收完', frameArrived(13, 0) && Math.abs(at(13).tail - 1) < 1e-9);
      truth('t=13ms：链路里已没有该帧', at(13).tail >= 1);

      console.log('— 持续发送时链路上的帧数（第 4 段：12 帧填满）—');
      const inflight = (t) => {
        let n = 0;
        for (let k = 0; k < 40; k++) {
          const s = frameSpan(t, k * Tf);
          if (s.head > 0 && s.tail < 1) n++; // 还有比特在链路里
        }
        return n;
      };
      truth('t=12ms 时在途 12 帧（链路刚好填满）', inflight(12) === 12, '实测 ' + inflight(12));
      truth('t=6ms 时在途 6 帧', inflight(6) === 6, '实测 ' + inflight(6));
      truth('t=13ms 时在途 12 帧（稳态）', inflight(13) === 12, '实测 ' + inflight(13));

      console.log('');
      console.log(fail === 0 ? '全部通过（' + '参数/时刻/位置/在途帧数' + '）' : '有 ' + fail + ' 项不通过');
      if (fail) process.exitCode = 1;
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'out/_check_sim.mjs',
  loader: {'.tsx': 'tsx', '.ts': 'ts', '.json': 'json'},
  jsx: 'automatic',
  logLevel: 'error',
  banner: {js: "import {createRequire} from 'module'; const require = createRequire(import.meta.url);"},
});

await import(pathToFileURL(path.resolve('out/_check_sim.mjs')).href + '?t=' + Date.now());
