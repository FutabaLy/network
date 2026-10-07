/**
 * 把 TTS 生成的旁白 mp3 同步到 public/narration/。
 * Remotion 的 staticFile() 只能读 public/ 下的文件，而 TTS 脚本把音频放在 audio/narration/。
 *
 *   node scripts/sync_narration.mjs
 */
import fs from 'node:fs';

const src = 'audio/narration';
const dst = 'public/narration';

if (!fs.existsSync(src)) {
  console.log('没有 audio/narration 目录，先跑 npm run narration:tts');
  process.exit(0);
}

fs.mkdirSync(dst, {recursive: true});
const files = fs.readdirSync(src).filter((f) => f.endsWith('.mp3'));
let total = 0;
for (const f of files) {
  fs.copyFileSync(`${src}/${f}`, `${dst}/${f}`);
  total += fs.statSync(`${dst}/${f}`).size;
}
console.log(`已同步 ${files.length} 个旁白 mp3 → ${dst}/（合计 ${(total / 1024).toFixed(0)} KB）`);
