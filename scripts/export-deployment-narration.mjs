import { mkdir, writeFile } from 'node:fs/promises';
import { deploymentPhases, DEPLOYMENT_DURATION } from '../src/deployment-state.ts';

const directory = new URL('../public/narration/', import.meta.url);
await mkdir(directory, { recursive: true });
const cues = deploymentPhases.map((phase, i) => ({ id: `deployment-${i + 1}`, start: phase.start, end: deploymentPhases[i + 1]?.start ?? DEPLOYMENT_DURATION, text: phase.text }));
await writeFile(new URL('deployment-plan.json', directory), JSON.stringify({ mission: 'orbital-deployment-concept', clock: 'demonstration-seconds', duration: DEPLOYMENT_DURATION, cues }, null, 2) + '\n');
const stamp = v => `00:${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')},000`;
await writeFile(new URL('deployment-subtitles.srt', directory), cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
console.log(`Exported ${cues.length} deployment narration cues.`);
