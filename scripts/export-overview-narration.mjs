import { writeFile, mkdir } from 'node:fs/promises';
import { overviewEvents, OVERVIEW_DURATION } from '../src/flight5-timeline.ts';

const directory = new URL('../public/narration/', import.meta.url);
await mkdir(directory, { recursive: true });
const cues = overviewEvents.map((event, i) => ({ id: `flight5-overview-${i + 1}`, start: event.start, end: overviewEvents[i + 1]?.start ?? OVERVIEW_DURATION, text: event.text }));
await writeFile(new URL('overview-plan.json', directory), JSON.stringify({ mission: 'flight-5', clock: 'overview-playback-seconds', duration: OVERVIEW_DURATION, cues }, null, 2) + '\n');
const stamp = v => `00:${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')},000`;
await writeFile(new URL('overview-subtitles.srt', directory), cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
console.log(`Exported ${cues.length} overview narration cues.`);
