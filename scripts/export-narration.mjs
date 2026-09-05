import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { LAUNCH_DURATION, launchPhases } from '../src/launch-timeline.ts';

let generated;
try { generated = JSON.parse(await readFile('src/narration-audio.json', 'utf8')); } catch { /* First generation has no audio manifest yet. */ }
const cues = launchPhases.map((phase, i) => ({
  id: `phase-${String(i + 1).padStart(2, '0')}`, title: phase.name,
  start: phase.start, end: launchPhases[i + 1]?.start ?? LAUNCH_DURATION,
  text: phase.narration, locale: 'zh-CN', audio: generated && Object.values(generated.audio).every(voice => voice[i]?.text === phase.narration) ? Object.fromEntries(Object.entries(generated.audio).map(([voice, files]) => [voice, files[i]])) : null,
}));
function timestamp(seconds) { return `00:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')},000`; }
await mkdir('public/narration', { recursive: true });
await writeFile('public/narration/plan.json', JSON.stringify({ duration: LAUNCH_DURATION, kind: 'illustrative-flight', audioStatus: cues.every(cue => cue.audio) ? 'generated' : 'generation-required', cues }, null, 2));
await writeFile('public/narration/subtitles.srt', cues.map((cue, i) => `${i + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}\n`).join('\n'));
console.log(`Exported ${cues.length} Chinese narration cues and SRT subtitles (${LAUNCH_DURATION}s).`);
