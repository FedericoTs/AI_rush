import type { LevelModule } from "@/engine/types";
import { L01 } from "./L01ContinueToYourAccount";
import { L02 } from "./L02OneTimePasscode";
import { L04 } from "./L04HowMany";
import { L05 } from "./L05AcceptOurCookies";
import { L11 } from "./L11ChooseASecurePassword";
import { L12 } from "./L12EnterYourPhoneNumber";
import { L16 } from "./L16BackspaceUnavailable";
import { L18 } from "./L18DragToUnlock";
import { L22 } from "./L22LoadingYourDashboard";
import { L27 } from "./L27ConfirmYourAddress";
import { L28 } from "./L28AreYouStillThere";
import { L36 } from "./L36SignIn";
import { L37 } from "./L37SetYourSecurityPin";
import { L42 } from "./L42ConfirmYourPassword";

/**
 * The only import surface for playable level content. Client-side only — the
 * server reads `catalog.ts` instead, which carries the metadata without
 * dragging in React components.
 */
export const REGISTRY: readonly LevelModule[] = [
  L01, L02, L04, L05, L11, L12, L16, L18, L22, L27, L28, L36, L37, L42,
];

export const BY_ID = new Map(REGISTRY.map((m) => [m.meta.id, m]));
