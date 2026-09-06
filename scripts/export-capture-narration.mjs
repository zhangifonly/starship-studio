import { writeFile, mkdir } from 'node:fs/promises';
import { capturePhases, CAPTURE_DURATION } from '../src/mission-data.ts';

const directory = new URL('../public/narration/', import.meta.url);
await mkdir(directory, { recursive: true });
const cues = capturePhases.map((phase, i) => ({ id: `flight5-capture-${i + 1}`, start: phase.start, end: phase.end, text: phase.narration }));
await writeFile(new URL('capture-plan.json', directory), JSON.stringify({ mission: 'flight-5', clock: 'reconstruction-seconds', duration: CAPTURE_DURATION, cues }, null, 2) + '\n');
const stamp = value => `00:00:${String(value).padStart(2, '0')},000`;
await writeFile(new URL('capture-subtitles.srt', directory), cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
console.log(`Exported ${cues.length} capture narration cues.`);
