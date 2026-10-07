/**
 * 由 src/narration.ts（文案与时间点）+ audio/narration/durations.json（实测时长）
 * 生成两样东西，保证永远同源、不会手写过期：
 *
 *   1. subtitles/narration.srt   字幕文件（与画面里的字幕层同一份数据）
 *   2. docs/narration.md         可读版中文旁白稿（含每条实测时长与分镜余量）
 *
 *   npm run subs
 *
 * 实现上先用 esbuild 把 TS 数据导出成 JSON，再在本脚本里拼文本 —— 避免嵌套模板字符串的转义地狱。
 */
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

fs.mkdirSync('out', {recursive: true});

await build({
  stdin: {
    contents: [
      "import fs from 'node:fs';",
      "import {SUBTITLES, hasNarration, frameToSrtTime} from './src/subs';",
      "import {NARRATION, SHOT_SECONDS} from './src/narration';",
      "import {SHOT_RANGES} from './src/timeline';",
      "import durations from './audio/narration/durations.json';",
      "fs.writeFileSync('out/_subsdata.json', JSON.stringify({",
      '  subtitles: SUBTITLES, narration: NARRATION, shotSeconds: SHOT_SECONDS,',
      '  shotRanges: SHOT_RANGES.map((s) => ({title: s.title})), durations, hasNarration,',
      '}, null, 1));',
    ].join('\n'),
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'out/_subsdata.mjs',
  loader: {'.tsx': 'tsx', '.ts': 'ts', '.json': 'json'},
  jsx: 'automatic',
  logLevel: 'error',
  banner: {js: "import {createRequire} from 'module'; const require = createRequire(import.meta.url);"},
});

await import(pathToFileURL(path.resolve('out/_subsdata.mjs')).href + '?t=' + Date.now());

const data = JSON.parse(fs.readFileSync('out/_subsdata.json', 'utf8'));
const {subtitles, narration, shotSeconds, shotRanges, durations, hasNarration} = data;

/* ---------------------------------------------------------------- 1. SRT */
const srtTime = (frame) => {
  const totalMs = Math.round((frame / 60) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(totalMs / 3600000))}:${p(Math.floor((totalMs % 3600000) / 60000))}:${p(
    Math.floor((totalMs % 60000) / 1000),
  )},${p(totalMs % 1000, 3)}`;
};

const srt = subtitles
  .map((c, i) => `${i + 1}\n${srtTime(c.from)} --> ${srtTime(c.to)}\n${c.text}\n`)
  .join('\n');
fs.mkdirSync('subtitles', {recursive: true});
fs.writeFileSync('subtitles/narration.srt', srt, 'utf8');

/* --------------------------------------------------- 2. 旁白稿（markdown） */
const d = (id) => durations[id] ?? 0;
const f2 = (n) => n.toFixed(3);
const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

const lines = [];
lines.push('# 中文旁白稿 · 计算机网络：时延与信道利用率', '');
lines.push(`本片共 **6 个分镜 × ${shotSeconds} 秒 = 90 秒**，旁白 **${narration.length} 条**。`);
lines.push('本文件由 `npm run subs` 自动生成；改稿请改 `src/narration.ts` 后重跑 `npm run narration && npm run subs`。', '');
lines.push('| 项目 | 说明 |', '| --- | --- |');
lines.push('| 文案唯一来源 | `src/narration.ts` 的 `NARRATION` |');
lines.push(`| 音频产物 | \`audio/narration/<id>.mp3\`（${narration.length} 条） |`);
lines.push('| 实测时长 | `audio/narration/durations.json`（ffprobe 实测，3 位小数） |');
lines.push('| 音色 / 语速 | `zh-CN-XiaoxiaoNeural`（edge-tts）+ `--rate=+12%`，24 kHz 单声道 mp3 |');
lines.push('| 口径 | 「时间点」= 分镜内相对秒；「全片」= (分镜号−1)×15 + 时间点；「结束」= 时间点 + 实测时长 |', '', '---', '');

const summary = [];
for (let shot = 1; shot <= 6; shot++) {
  const cues = narration.filter((c) => c.shot === shot);
  if (!cues.length) continue;
  const title = (shotRanges[shot - 1]?.title ?? `分镜 ${shot}`).replace(/^\d+\s*/, '');
  const total = cues.reduce((s, c) => s + d(c.id), 0);
  const lastEnd = Math.max(...cues.map((c) => c.at + d(c.id)));
  const margin = shotSeconds - lastEnd;
  const state = margin < 0 ? '❌ 溢出分镜' : margin < 0.5 ? '⚠️ 余量不足' : '✅ 余量充足';

  lines.push(`## 分镜 ${shot} · ${(shot - 1) * shotSeconds}–${shot * shotSeconds} s ｜ ${title}`, '');
  lines.push('| 时间点 | 全片 | 文案 | 实测时长 | 结束（分镜内） |', '| ---: | ---: | --- | ---: | ---: |');
  for (const c of cues) {
    const end = c.at + d(c.id);
    lines.push(
      `| ${f2(c.at)} s | ${mmss((shot - 1) * shotSeconds + c.at)} | ${c.text} | ${f2(d(c.id))} s | ${f2(end)} s${
        end > shotSeconds ? ' ⚠️' : ''
      } |`,
    );
  }
  lines.push('', `**本段**：${cues.length} 条，旁白合计 **${f2(total)} s** / ${shotSeconds} s，末条结束 **${f2(lastEnd)} s**，余量 **${f2(margin)} s** —— ${state}`, '');
  summary.push({shot, title, n: cues.length, total, lastEnd, margin, state});
}

const allTotal = summary.reduce((s, x) => s + x.total, 0);
lines.push('---', '', '## 分镜汇总', '');
lines.push('| 分镜 | 条数 | 旁白合计 | 末条结束 | 余量 | 状态 |', '| --- | ---: | ---: | ---: | ---: | --- |');
for (const s of summary) {
  lines.push(`| ${s.shot} ${s.title} | ${s.n} | ${f2(s.total)} s | ${f2(s.lastEnd)} s | ${f2(s.margin)} s | ${s.state} |`);
}
lines.push('', `全片旁白合计 **${f2(allTotal)} s**（占 90 s 的 ${((allTotal / 90) * 100).toFixed(1)}%）。`, '');
fs.writeFileSync('docs/narration.md', lines.join('\n'), 'utf8');

/* ---------------------------------------------------------------- 汇报 */
console.log(`SRT   : ${subtitles.length} 条 cue → subtitles/narration.srt（用实测时长：${hasNarration}）`);
console.log(`旁白稿: ${narration.length} 条 → docs/narration.md（合计 ${f2(allTotal)} s）`);
for (const s of summary) {
  console.log(`  分镜 ${s.shot}  ${s.n} 条  合计 ${f2(s.total)} s  末条 ${f2(s.lastEnd)} s  余量 ${f2(s.margin)} s  ${s.state}`);
}
