"""Generate the two phyviz Edge voices; validate measured MP3 durations."""
import asyncio
import argparse
import hashlib
import json
from pathlib import Path

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"yunxi": "zh-CN-YunxiNeural", "xiaoxiao": "zh-CN-XiaoxiaoNeural"}
parser = argparse.ArgumentParser()
parser.add_argument("--plan", default="public/narration/plan.json")
parser.add_argument("--manifest", default="src/narration-audio.json")
args = parser.parse_args()


async def main():
    plan_path = ROOT / args.plan
    manifest_path = ROOT / args.manifest
    if not plan_path.resolve().is_relative_to(ROOT) or not manifest_path.resolve().is_relative_to(ROOT):
        raise ValueError("Narration paths must stay inside this project")
    plan = json.loads(plan_path.read_text())
    semaphore = asyncio.Semaphore(1)

    async def generate(key, voice, cue):
        fingerprint = hashlib.sha256((voice + cue["text"] + "+0%+0%+0Hz").encode()).hexdigest()[:12]
        relative = f"narration/{key}/{cue['id']}-{fingerprint}.mp3"
        output = ROOT / "public" / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        async with semaphore:
            if not output.exists():
                for attempt in range(5):
                    try:
                        temporary = output.with_suffix(".part")
                        await edge_tts.Communicate(cue["text"], voice, rate="+0%", volume="+0%", pitch="+0Hz").save(str(temporary))
                        MP3(temporary)
                        temporary.replace(output)
                        break
                    except Exception:
                        if attempt == 4:
                            raise
                        await asyncio.sleep(2)
        duration = MP3(output).info.length
        print(f"{key} {cue['id']}: {duration:.2f}s / {cue['end'] - cue['start']}s", flush=True)
        if duration > cue["end"] - cue["start"] - .2:
            raise ValueError(f"Narration exceeds phase budget: {key} {cue['id']}; shorten script, do not accelerate voice")
        return {"src": "/" + relative, "duration": round(duration, 3), "text": cue["text"]}

    audio = {}
    for key, voice in VOICES.items():
        audio[key] = await asyncio.gather(*(generate(key, voice, cue) for cue in plan["cues"]))
    manifest = {"provider": "Microsoft Edge TTS", "voices": VOICES, "rate": "+0%", "volume": "+0%", "pitch": "+0Hz", "audio": audio}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    plan["audioStatus"] = "generated"
    for i, cue in enumerate(plan["cues"]):
        cue["audio"] = {key: audio[key][i] for key in VOICES}
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n")


asyncio.run(main())
