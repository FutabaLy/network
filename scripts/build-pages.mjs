/**
 * 构建 GitHub Pages 产物：一个仓库一个站点，根是门户页，每个项目挂在子路径下。
 *
 *   dist/
 *     index.html              门户页（项目卡片索引，按 projects.json 生成）
 *     <项目目录>/              各项目的网页实时版（Vite 产物，base: './' 所以放子路径也能跑）
 *
 *   node scripts/build-pages.mjs
 *
 * 依赖各项目自己的 `npm run web:build`，所以各项目要先 `npm i`（CI 里是 npm ci）。
 */
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync('projects.json', 'utf8'));
const out = path.resolve('dist');

fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});

for (const p of cfg.projects) {
  const dir = path.join('projects', p.dir);
  if (!fs.existsSync(dir)) {
    console.error(`跳过：找不到 ${dir}`);
    continue;
  }
  console.log(`\n=== 构建 ${p.dir} ===`);
  execSync('npm run web:build', {cwd: dir, stdio: 'inherit'});

  const built = path.join(dir, 'dist');
  if (!fs.existsSync(built)) {
    console.error(`失败：${dir}/dist 不存在`);
    process.exitCode = 1;
    continue;
  }
  const target = path.join(out, p.dir);
  fs.mkdirSync(target, {recursive: true});
  fs.cpSync(built, target, {recursive: true});
  console.log(`→ dist/${p.dir}/`);
}

/* ------------------------------------------------ 门户页 */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cards = cfg.projects
  .map(
    (p) => `
      <a class="card" href="./${esc(p.dir)}/">
        <div class="title">${esc(p.title)}</div>
        <div class="desc">${esc(p.desc)}</div>
        <div class="tags">${(p.tags ?? []).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}
        <div class="go">打开 →</div>
      </a>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(cfg.siteTitle)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 64px 24px 80px;
    background: #05080f; color: #eef3ff;
    font-family: 'Noto Sans SC', 'PingFang SC', system-ui, sans-serif;
    background-image:
      radial-gradient(900px 600px at 20% 10%, rgba(56,189,248,.14), transparent 60%),
      radial-gradient(700px 500px at 85% 85%, rgba(167,139,250,.12), transparent 60%),
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: auto, auto, 80px 80px, 80px 80px;
  }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 40px; margin: 0 0 10px; letter-spacing: 1px; }
  .sub { color: #9fb0cc; font-size: 16px; line-height: 1.7; margin: 0 0 36px; }
  .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
  .card {
    display: block; text-decoration: none; color: inherit;
    border: 1px solid #1e2b45; border-left: 6px solid #38bdf8; border-radius: 14px;
    background: linear-gradient(180deg, rgba(56,189,248,.10), rgba(6,10,20,.72));
    padding: 20px 22px; transition: transform .12s ease, box-shadow .12s ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(0,0,0,.5); }
  .title { font-size: 21px; font-weight: 800; margin-bottom: 10px; }
  .desc { font-size: 14px; color: #b9c6de; line-height: 1.75; }
  .tags { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .tags span { font-size: 12px; color: #9fb0cc; border: 1px solid #24334f; border-radius: 999px; padding: 3px 10px; }
  .note { margin-top: 12px; font-size: 12px; color: #63748f; font-family: ui-monospace, monospace; }
  .go { margin-top: 16px; font-size: 14px; color: #38bdf8; font-weight: 700; }
  footer { margin-top: 44px; color: #4d5c75; font-size: 13px; line-height: 1.8; }
  a.plain { color: #8ab4ff; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>${esc(cfg.siteTitle)}</h1>
    <p class="sub">${cfg.siteDesc}</p>
    <div class="grid">${cards}
    </div>
    <footer>
      源码在 <a class="plain" href="${esc(cfg.repo ?? '')}">${esc((cfg.repo ?? '').replace('https://', ''))}</a>；
      每个项目都自带 README（怎么跑、怎么导出、验证结果）。
    </footer>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`\n门户页 → dist/index.html（${cfg.projects.length} 个项目）`);
