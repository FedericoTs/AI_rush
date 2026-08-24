/**
 * The slice of Capacitor this project actually touches.
 *
 * `@capacitor/haptics` and `@capacitor/motion` are **not** dependencies of this
 * repository, on purpose: a website should not need a native mobile SDK
 * installed in order to type-check, and `npm install` for a contributor who
 * only ever opens the web app should not pull two iOS/Android plugins.
 *
 * These ambient declarations describe the small surface `src/native/index.ts`
 * uses so that file stays type-checked without them. TypeScript prefers real
 * module resolution over an ambient declaration, so on a machine that *has*
 * installed the plugins — the one building the app — the genuine types win and
 * any drift between this and reality shows up there as an error rather than a
 * runtime surprise.
 */

declare module "@capacitor/cli" {
  /* Only the keys `capacitor.config.ts` sets. The real type is far wider; a
     key added here that Capacitor does not have would be caught the first time
     the apps are built, which is the machine that has the real package. */
  export interface CapacitorConfig {
    appId: string;
    appName: string;
    webDir: string;
    server?: { url?: string; cleartext?: boolean; androidScheme?: string };
    ios?: {
      backgroundColor?: string;
      contentInset?: "automatic" | "scrollableAxes" | "never" | "always";
      scrollEnabled?: boolean;
    };
    android?: { backgroundColor?: string; webContentsDebuggingEnabled?: boolean };
    plugins?: Record<string, Record<string, unknown>>;
  }
}

declare module "@capacitor/haptics" {
  export interface HapticsPlugin {
    vibrate(options: { duration: number }): Promise<void>;
  }
  export const Haptics: HapticsPlugin;
}

declare module "@capacitor/motion" {
  export interface AccelListenerEvent {
    accelerationIncludingGravity: { x: number; y: number; z: number };
  }
  export interface OrientationListenerEvent {
    alpha: number;
    beta: number;
    gamma: number;
  }
  export interface PluginListenerHandle {
    remove(): Promise<void>;
  }
  export interface MotionPlugin {
    addListener(
      event: "accel",
      cb: (e: AccelListenerEvent) => void,
    ): Promise<PluginListenerHandle>;
    addListener(
      event: "orientation",
      cb: (e: OrientationListenerEvent) => void,
    ): Promise<PluginListenerHandle>;
  }
  export const Motion: MotionPlugin;
}
