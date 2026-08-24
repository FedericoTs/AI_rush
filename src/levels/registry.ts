import type { LevelModule } from "@/engine/types";
import { L01 } from "./L01ContinueToYourAccount";
import { L02 } from "./L02OneTimePasscode";
import { L11 } from "./L11ChooseASecurePassword";
import { L12 } from "./L12EnterYourPhoneNumber";
import { L36 } from "./L36SignIn";
import { L37 } from "./L37SetYourSecurityPin";

/**
 * The only import surface for playable level content. Client-side only — the
 * server reads `catalog.ts` instead, which carries the metadata without
 * dragging in React components.
 */
export const REGISTRY: readonly LevelModule[] = [L01, L02, L11, L12, L36, L37];

export const BY_ID = new Map(REGISTRY.map((m) => [m.meta.id, m]));
