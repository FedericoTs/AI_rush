import type { LevelModule } from "@/engine/types";
import { L01 } from "./L01ContinueToYourAccount";
import { L02 } from "./L02OneTimePasscode";
import { L03 } from "./L03SelectYourCountry";
import { L04 } from "./L04HowMany";
import { L05 } from "./L05AcceptOurCookies";
import { L06 } from "./L06PasswordRequirements";
import { L09 } from "./L09AlmostThere";
import { L10 } from "./L10ScrollToAccept";
import { L11 } from "./L11ChooseASecurePassword";
import { L12 } from "./L12EnterYourPhoneNumber";
import { L16 } from "./L16BackspaceUnavailable";
import { L18 } from "./L18DragToUnlock";
import { L22 } from "./L22LoadingYourDashboard";
import { L23 } from "./L23AiIsGeneratingYourCode";
import { L24 } from "./L24SelectYourPlan";
import { L25 } from "./L25TwoCursors";
import { L27 } from "./L27ConfirmYourAddress";
import { L28 } from "./L28AreYouStillThere";
import { L31 } from "./L31Mirror";
import { L32 } from "./L32NetworkConditions";
import { L33 } from "./L33ThisPageIsRotating";
import { L34 } from "./L34LevelFailedToGenerate";
import { L36 } from "./L36SignIn";
import { L37 } from "./L37SetYourSecurityPin";
import { L41 } from "./L41RankYourPriorities";
import { L42 } from "./L42ConfirmYourPassword";
import { L47 } from "./L47MatchThisColour";
import { L49 } from "./L49Careers";

/**
 * The only import surface for playable level content. Client-side only — the
 * server reads `catalog.ts` instead, which carries the metadata without
 * dragging in React components.
 */
export const REGISTRY: readonly LevelModule[] = [
  L01, L02, L03, L04, L05, L06, L09, L10, L11, L12, L16, L18, L22, L23, L24,
  L25, L27, L28, L31, L32, L33, L34, L36, L37, L41, L42, L47, L49,
];

export const BY_ID = new Map(REGISTRY.map((m) => [m.meta.id, m]));
