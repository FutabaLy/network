/**
 * 复核成片：用 ffprobe 读容器/轨道信息，再抽出几个关键时间点的画面确认没渲染错。
 *
 *   node scripts/verify_mp4.mjs [文件路径]
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] ?? 'network-delay.mp4';
if (!fs.existsSync(file)) {
  console.log('找不到文件：' + file);
  process.exit(1);
}

const probe = (args) => execFileSync('ffprobe', args, {encoding: 'utf8'}).trim();
const dur = Number(probe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]));
const size = fs.statSync(file).size;
const streams = probe([
  '-v', 'error',
  '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,bit_rate',
  '-of', 'default=noprint_wrappers=1',
  file,
]).split('\n');

console.log(`文件      : ${file}`);
console.log(`大小      : ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log(`时长      : ${dur.toFixed(3)} s（期望 90.000 s）`);
console.log(`偏差      : ${(dur - 90).toFixed(3)} s`);
console.log('轨道      :');
for (const line of streams) console.log('  ' + line);

// 抽帧：六个分镜各抽一张，确认画面不是黑帧/错帧
const frames = [
  ['1.0', 'shot1'],
  ['26.0', 'shot2'],
  ['38.0', 'shot3'],
  ['55.0', 'shot4'],
  ['68.0', 'shot5'],
  ['88.0', 'shot6'],
];
fs.mkdirSync('out/verify', {recursive: true});
for (const [t, name] of frames) {
  const out = `out/verify/${name}.png`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', t, '-i', file, '-frames:v', '1', out], {
    encoding: 'utf8',
  });
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`抽帧 ${t.padStart(5)}s → ${out}  ${kb} KB`);
}
console.log('\n抽帧文件在 out/verify/，逐张看过即可。');
