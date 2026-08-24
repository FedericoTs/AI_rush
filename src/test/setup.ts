/* jsdom has no rAF pacing, no WebAudio and no sensors. Levels and the engine
   are written against injectable seams precisely so tests never need them —
   this file only fills the gaps jsdom leaves in the DOM itself. */

if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!globalThis.HTMLElement.prototype.setPointerCapture) {
  globalThis.HTMLElement.prototype.setPointerCapture = () => {};
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {};
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
}
