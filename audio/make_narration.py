#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
按 src/narration.ts 逐条合成中文旁白音频，并输出实测时长表。

主路径：edge-tts（zh-CN-XiaoxiaoNeural, --rate=+12%）→ audio/narration/<id>.mp3
退路  ：Windows 本地语音 SAPI（Microsoft Huihui Desktop）→ wav → ffmpeg 转 mp3
产物  ：audio/narration/<id>.mp3 + audio/narration/durations.json（UTF-8 无 BOM）

用法：
    python audio/make_narration.py                # 自动：先 edge-tts，失败退 SAPI
    python audio/make_narration.py --engine sapi  # 强制走本地 SAPI
    python audio/make_narration.py --engine edge  # 只用 edge-tts（不回退）
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

# ---------------------------------------------------------------- 配置

ROOT = Path(__file__).resolve().parent.parent
NARRATION_TS = ROOT / "src" / "narration.ts"
OUT_DIR = ROOT / "audio" / "narration"
DUR_JSON = OUT_DIR / "durations.json"

VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "+12%"

SAPI_VOICE = "Microsoft Huihui Desktop"  # Windows 本地中文语音
SAPI_RATE = 1  # SAPI Rate 取值 -10..10，+1 约等于略快于常速

SHOT_SECONDS = 15.0
WARN_END = 14.5  # 分镜内结束秒超过这个值 → 旁白塞不下

EDGE_TIMEOUT = 90  # 单条 edge-tts 超时（秒）


def log(msg: str = "") -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- 解析 narration.ts

CUE_RE = re.compile(
    r"""\{\s*
        id\s*:\s*(?P<q1>['"])(?P<id>.*?)(?P=q1)\s*,\s*
        shot\s*:\s*(?P<shot>\d+)\s*,\s*
        at\s*:\s*(?P<at>[0-9.]+)\s*,\s*
        text\s*:\s*(?P<q2>['"])(?P<text>.*?)(?P=q2)\s*
        \}""",
    re.VERBOSE | re.DOTALL,
)


def parse_narration(path: Path = NARRATION_TS) -> list[dict]:
    """从 src/narration.ts 里把 NARRATION 数组的每条 {id, shot, at, text} 抠出来。"""
    if not path.is_file():
        raise SystemExit(f"[ERROR] 找不到旁白稿：{path}")
    src = path.read_text(encoding="utf-8")

    # 只取 NARRATION 数组那一段，避免误伤别处的对象字面量
    m = re.search(r"NARRATION\s*(?::[^=]*)?=\s*\[(.*?)\n\s*\];", src, re.DOTALL)
    body = m.group(1) if m else src

    cues: list[dict] = []
    for hit in CUE_RE.finditer(body):
        text = hit.group("text")
        # 还原 TS 字符串里可能出现的转义
        text = text.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\").replace("\\n", " ")
        cues.append(
            {
                "id": hit.group("id"),
                "shot": int(hit.group("shot")),
                "at": float(hit.group("at")),
                "text": text.strip(),
            }
        )

    if not cues:
        raise SystemExit(f"[ERROR] 没能从 {path} 解析出任何旁白条目，请检查文件格式。")

    # 校验 id 唯一
    seen: set[str] = set()
    for c in cues:
        if c["id"] in seen:
            raise SystemExit(f"[ERROR] 旁白 id 重复：{c['id']}")
        seen.add(c["id"])
    return cues


# ---------------------------------------------------------------- 时长测量

def ffprobe_duration(path: Path) -> float:
    """用 ffprobe 量真实时长（秒，3 位小数）。"""
    ffprobe = shutil.which("ffprobe") or "ffprobe"
    cmd = [
        ffprobe, "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=duration:format=duration",
        "-of", "json",
        str(path),
    ]
    try:
        raw = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
        info = json.loads(raw or "{}")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"ffprobe 调用失败：{exc}") from exc

    cands: list[float] = []
    for st in info.get("streams", []) or []:
        try:
            cands.append(float(st.get("duration")))
        except (TypeError, ValueError):
            pass
    try:
        cands.append(float(info.get("format", {}).get("duration")))
    except (TypeError, ValueError):
        pass

    cands = [c for c in cands if c and c > 0]
    if not cands:
        raise RuntimeError("ffprobe 没能取到时长")
    return round(cands[0], 3)


# ---------------------------------------------------------------- TTS 主路径：edge-tts

def synth_edge(cue: dict, out_mp3: Path) -> bool:
    """edge-tts 合成一条；成功返回 True。"""
    if out_mp3.exists():
        out_mp3.unlink()
    cmd = [
        sys.executable, "-m", "edge_tts",
        "--voice", VOICE,
        "--rate", RATE,
        "--text", cue["text"],
        "--write-media", str(out_mp3),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=EDGE_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False
    except OSError:
        return False

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip().splitlines()
        if err:
            log(f"      edge-tts: {err[-1][:160]}")
        return False
    # 输出文件必须真实存在且有内容（失败时可能留下 0 字节）
    return out_mp3.is_file() and out_mp3.stat().st_size > 1024


# ---------------------------------------------------------------- 退路：Windows SAPI

# 注意：模板里全是 PowerShell 的花括号，所以用 @@X@@ 占位而不是 str.format
SAPI_PS1 = """\
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [IO.File]::ReadAllText('@@TXT@@', [Text.Encoding]::UTF8)
$wav  = '@@WAV@@'
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$chosen = $null
foreach ($v in $synth.GetInstalledVoices()) {
    if ($v.Enabled -and $v.VoiceInfo.Name -eq '@@VOICE@@') { $chosen = $v.VoiceInfo.Name; break }
}
if (-not $chosen) {
    foreach ($v in $synth.GetInstalledVoices()) {
        if ($v.Enabled -and $v.VoiceInfo.Culture.Name -like 'zh-CN*') { $chosen = $v.VoiceInfo.Name; break }
    }
}
if (-not $chosen) { throw 'no zh-CN voice installed' }
$synth.SelectVoice($chosen)
$synth.Rate = @@RATE@@
$synth.SetOutputToWaveFile($wav)
$synth.Speak($text)
$synth.Dispose()
Write-Output $chosen
"""


def render_sapi_ps1(txt: Path, wav: Path) -> str:
    """把占位符换掉（避免 str.format 和 PowerShell 花括号打架）。"""
    return (SAPI_PS1
            .replace("@@TXT@@", str(txt))
            .replace("@@WAV@@", str(wav))
            .replace("@@VOICE@@", SAPI_VOICE)
            .replace("@@RATE@@", str(SAPI_RATE)))


def _powershell() -> str:
    for name in ("powershell.exe", "powershell", "pwsh"):
        p = shutil.which(name)
        if p:
            return p
    raise RuntimeError("找不到 powershell")


def synth_sapi(cue: dict, out_mp3: Path) -> bool:
    """Windows 本地语音合成 wav，再用 ffmpeg 转 mp3；成功返回 True。"""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        log("      SAPI: 找不到 ffmpeg，无法转 mp3")
        return False

    with tempfile.TemporaryDirectory(prefix="dsh_sapi_") as td:
        tmp = Path(td)
        txt, wav, ps1 = tmp / "line.txt", tmp / "line.wav", tmp / "say.ps1"

        txt.write_text(cue["text"], encoding="utf-8")
        ps1.write_text(
            render_sapi_ps1(txt, wav),
            encoding="utf-8-sig",  # 带 BOM，Windows PowerShell 5.1 才认中文
        )

        try:
            proc = subprocess.run(
                [_powershell(), "-NoProfile", "-NonInteractive",
                 "-ExecutionPolicy", "Bypass", "-File", str(ps1)],
                capture_output=True, text=True, timeout=180,
            )
        except Exception as exc:  # noqa: BLE001
            log(f"      SAPI: {exc}")
            return False
        if proc.returncode != 0 or not wav.is_file():
            msg = (proc.stderr or proc.stdout or "").strip().splitlines()
            log(f"      SAPI: {(msg[-1] if msg else 'fail')[:160]}")
            return False

        # 校验 wav 有实际音频
        try:
            with wave.open(str(wav), "rb") as w:
                if w.getnframes() <= 0:
                    log("      SAPI: 生成的 wav 是空的")
                    return False
        except Exception:  # noqa: BLE001
            return False

        if out_mp3.exists():
            out_mp3.unlink()
        conv = subprocess.run(
            [ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
             "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "4", str(out_mp3)],
            capture_output=True, text=True, timeout=180,
        )
        if conv.returncode != 0 or not out_mp3.is_file():
            log(f"      ffmpeg: {(conv.stderr or '').strip()[:160]}")
            return False
    return out_mp3.stat().st_size > 1024


# ---------------------------------------------------------------- 报表

def fmt(v: float, w: int = 6, p: int = 3) -> str:
    return f"{v:.{p}f}".rjust(w)


def report(rows: list[dict]) -> bool:
    """打印明细表 + 分镜汇总；有超时条目返回 True。"""
    log("")
    log("=" * 74)
    log(" 逐条旁白实测时长（end = at + 实测时长，相对本分镜起点）")
    log("=" * 74)
    log(f"{'id':<8}{'shot':>4}{'at(s)':>8}{'dur(s)':>10}{'end(s)':>9}   状态")
    log("-" * 74)
    any_warn = False
    for r in rows:
        end = round(r["at"] + r["dur"], 3)
        flag = ""
        if end > SHOT_SECONDS:
            flag = f"WARN 超出分镜 {end - SHOT_SECONDS:.3f}s"
            any_warn = True
        elif end > WARN_END:
            flag = f"WARN 逼近分镜上限 +{end - WARN_END:.3f}s"
            any_warn = True
        log(f"{r['id']:<8}{r['shot']:>4}{fmt(r['at'], 8)}{fmt(r['dur'], 10)}{fmt(end, 9)}   {flag}")

    log("")
    log("=" * 74)
    log(f" 按分镜汇总（每段 {SHOT_SECONDS:.0f}s）")
    log("=" * 74)
    log(f"{'shot':>4}{'条数':>6}{'旁白合计(s)':>13}{'末条结束(s)':>13}{'余量(s)':>10}   状态")
    log("-" * 74)
    shots = sorted({r["shot"] for r in rows})
    for shot in shots:
        grp = [r for r in rows if r["shot"] == shot]
        total = round(sum(r["dur"] for r in grp), 3)
        last_end = round(max(r["at"] + r["dur"] for r in grp), 3)
        margin = round(SHOT_SECONDS - last_end, 3)
        flag = "OK"
        if last_end > SHOT_SECONDS:
            flag = f"WARN 溢出 {-margin:.3f}s"
        elif last_end > WARN_END:
            flag = f"WARN 余量不足 {margin:.3f}s"
        log(f"{shot:>4}{len(grp):>6}{fmt(total, 13)}{fmt(last_end, 13)}{fmt(margin, 10)}   {flag}")

    log("")
    log(f"共 {len(rows)} 条旁白，{len(shots)} 个分镜。WARN 阈值：分镜内结束秒 > {WARN_END}s")
    log("=" * 74)
    return any_warn


# ---------------------------------------------------------------- main

def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass

    ap = argparse.ArgumentParser(description="合成中文旁白并输出实测时长")
    ap.add_argument("--engine", choices=["auto", "edge", "sapi"], default="auto",
                    help="auto=先 edge-tts 失败退 SAPI；edge=只用 edge-tts；sapi=强制本地语音")
    args = ap.parse_args()

    if not shutil.which("ffprobe"):
        log("[WARN] PATH 里没有 ffprobe，无法量时长。")

    cues = parse_narration()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    log(f"[i] 解析 {NARRATION_TS.relative_to(ROOT)}：{len(cues)} 条旁白")
    log(f"[i] 输出目录：{OUT_DIR}")

    engine = args.engine
    rows: list[dict] = []

    for cue in cues:
        out_mp3 = OUT_DIR / f"{cue['id']}.mp3"
        log("")
        log(f"[{cue['id']}] shot {cue['shot']} @ {cue['at']}s  「{cue['text']}」")

        ok = False
        used = engine

        if engine in ("auto", "edge"):
            ok = synth_edge(cue, out_mp3)
            used = "edge-tts"
            if not ok:
                if engine == "edge":
                    log("      edge-tts 合成失败（--engine edge，不回退）")
                else:
                    log("      edge-tts 失败 → 回退 Windows 本地语音 SAPI")

        if not ok and engine in ("auto", "sapi"):
            used = "sapi"
            ok = synth_sapi(cue, out_mp3)
            if not ok:
                log(f"      [ERROR] {cue['id']} 两条路都失败，跳过（该条不进 durations.json）")
                continue

        try:
            dur = ffprobe_duration(out_mp3)
        except Exception as exc:  # noqa: BLE001
            log(f"      [ERROR] 量时长失败：{exc}，跳过")
            continue

        size_kb = out_mp3.stat().st_size / 1024
        end = round(cue["at"] + dur, 3)
        warn = "  <== WARN 结束秒 " + f"{end:.3f} > {WARN_END}" if end > WARN_END else ""
        log(f"      OK [{used}] {dur:.3f}s  size={size_kb:.1f}KB  end={end:.3f}s{warn}")
        rows.append({**cue, "dur": dur, "engine": used})

    if not rows:
        log("\n[ERROR] 一条都没生成成功，不写 durations.json")
        return 1

    # 写 durations.json（UTF-8 无 BOM，key 顺序按旁白顺序）
    durations = {r["id"]: round(r["dur"], 3) for r in rows}
    DUR_JSON.write_text(
        json.dumps(durations, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",  # Python 的 utf-8 不写 BOM
    )

    # 立刻自检：回读 + 校验 BOM / 合法性
    raw = DUR_JSON.read_bytes()
    assert not raw.startswith(b"\xef\xbb\xbf"), "durations.json 带了 BOM"
    with DUR_JSON.open(encoding="utf-8") as fh:
        back = json.load(fh)
    assert back == durations, "durations.json 回读不一致"
    log("")
    log(f"[i] 已写 {DUR_JSON.relative_to(ROOT)}：{len(durations)} 条，UTF-8 无 BOM，JSON 校验通过")

    engines = sorted({r["engine"] for r in rows})
    log(f"[i] TTS 路径：{' + '.join(engines)}")

    any_warn = report(rows)

    log("")
    log("[SUMMARY] " + ("有分镜旁白超过 14.5s，需要删字" if any_warn
                         else "所有分镜旁白都在 14.5s 以内，OK"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
