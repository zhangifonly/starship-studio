import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

const publicFile = (path: string) => new URL(`./public${path}`, import.meta.url);
const narration = JSON.parse(readFileSync(new URL('./src/narration-audio.json', import.meta.url), 'utf8')) as { audio: Record<string, { src: string }[]> };
const audioAvailable = Object.values(narration.audio).every(cues => cues.every(cue => existsSync(publicFile(cue.src))));
const captureNarration = JSON.parse(readFileSync(new URL('./src/capture-audio.json', import.meta.url), 'utf8')) as { audio: Record<string, { src: string }[]> };
const captureAudioAvailable = Object.keys(captureNarration.audio).length === 2 && Object.values(captureNarration.audio).every(cues => cues.length === 5 && cues.every(cue => existsSync(publicFile(cue.src))));
const referencesAvailable = ['/references/starship-internal-structure.jpg', '/references/faa-starship-reentry-2023.pdf'].every(path => existsSync(publicFile(path)));

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.NARRATION_AUDIO_AVAILABLE': JSON.stringify(audioAvailable),
    'import.meta.env.CAPTURE_AUDIO_AVAILABLE': JSON.stringify(captureAudioAvailable),
    'import.meta.env.REFERENCE_ASSETS_AVAILABLE': JSON.stringify(referencesAvailable),
  },
  server: { port: 3016, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: id => id.includes('/three/') ? 'three' : undefined } } },
});
