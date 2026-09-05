import { useEffect, useRef, useState } from 'react';
import { launchPhases, phaseAt } from './launch-timeline';
import manifest from './narration-audio.json';

export type Narrator = keyof typeof manifest.audio;

export function useNarration(enabled: boolean, playing: boolean, time: number, rate: number, seekVersion: number, voice: Narrator) {
  const audio = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const phase = phaseAt(time), cue = manifest.audio[voice][phase];
  const latest = useRef({ enabled, playing, time, rate, phase });
  latest.current = { enabled, playing, time, rate, phase };
  const sync = useRef<(force?: boolean) => void>(() => {});

  useEffect(() => {
    const element = audio.current!;
    let disposed = false, pending = false, broken = false;
    setFailed(false); setLoading(enabled);
    const synchronize = (force = false) => {
      if (disposed) return;
      const state = latest.current;
      const offset = Math.max(0, state.time - launchPhases[state.phase].start);
      element.playbackRate = state.rate; element.preservesPitch = true;
      const target = Math.min(offset, element.duration || cue.duration);
      if (element.readyState >= 1 && Math.abs(element.currentTime - target) > (force ? .05 : .45)) element.currentTime = target;
      if (!state.enabled || !state.playing || document.hidden || offset >= cue.duration || broken) { element.pause(); return; }
      if (element.readyState < 3 || !element.paused || pending) return;
      pending = true;
      void element.play().catch(error => {
        if (!disposed && error.name !== 'AbortError') { broken = true; setFailed(true); setLoading(false); }
      }).finally(() => { pending = false; });
    };
    sync.current = synchronize;
    let timeout = 0;
    const error = () => { if (!disposed) { broken = true; element.pause(); setFailed(true); setLoading(false); } };
    const ready = () => { if (!disposed) { window.clearTimeout(timeout); setLoading(false); synchronize(true); } };
    const waiting = () => {
      if (!disposed && latest.current.enabled && !broken) {
        setLoading(true); window.clearTimeout(timeout); timeout = window.setTimeout(error, 12000);
      }
    };
    if (enabled) timeout = window.setTimeout(error, 12000);
    const visibility = () => synchronize(true);
    element.addEventListener('canplay', ready); element.addEventListener('waiting', waiting); element.addEventListener('error', error);
    document.addEventListener('visibilitychange', visibility);
    if (enabled) { element.src = cue.src; element.load(); }
    else { element.pause(); element.removeAttribute('src'); element.load(); }
    return () => {
      disposed = true; element.pause(); sync.current = () => {};
      window.clearTimeout(timeout);
      element.removeEventListener('canplay', ready); element.removeEventListener('waiting', waiting); element.removeEventListener('error', error);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, cue.src, cue.duration]);
  useEffect(() => { sync.current(); }, [time, playing, rate]);
  useEffect(() => { sync.current(true); }, [seekVersion]);
  return { audio, failed, loading };
}
