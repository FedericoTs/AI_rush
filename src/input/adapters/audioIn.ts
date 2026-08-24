import type { Adapter, AudioSample } from "./types";

/**
 * Microphone level, smoothed.
 *
 * The stream is torn down on destroy, without exception. A run that leaves the
 * mic hot is a bug we would hear about publicly, and rightly.
 */
export async function createAudioInAdapter(): Promise<Adapter<AudioSample>> {
  const subs = new Set<(v: AudioSample) => void>();
  let last: AudioSample = { rms: 0 };
  let raf = 0;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor!();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const poll = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      last = { rms: last.rms * 0.7 + Math.min(1, rms * 4) * 0.3 };
      for (const cb of subs) cb(last);
      raf = requestAnimationFrame(poll);
    };
    poll();
  } catch {
    /* denied or unavailable. the level renders its fallback; nothing breaks. */
  }

  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      subs.clear();
    },
  };
}
