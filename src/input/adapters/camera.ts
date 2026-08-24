import type { Adapter, CameraSample } from "./types";

/**
 * Mean frame brightness. Deliberately not face detection — "blink seven times"
 * is a brightness-delta counter, which means covering the lens with a finger
 * works, and discovering that is one of the better moments in the game.
 */
export async function createCameraAdapter(): Promise<Adapter<CameraSample> & { video: HTMLVideoElement | null }> {
  const subs = new Set<(v: CameraSample) => void>();
  let last: CameraSample = { brightness: 0 };
  let raf = 0;
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const poll = () => {
      if (ctx && video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) / 255;
        }
        last = { brightness: sum / (data.length / 4) };
        for (const cb of subs) cb(last);
      }
      raf = requestAnimationFrame(poll);
    };
    poll();
  } catch {
    /* denied or unavailable. the ASCII face fallback takes over. */
  }

  return {
    video,
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy() {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      video?.remove();
      subs.clear();
    },
  };
}
