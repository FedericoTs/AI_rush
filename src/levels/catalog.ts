import type { LevelMeta } from "@/engine/types";
import { meta as L01 } from "./L01ContinueToYourAccount/meta";
import { meta as L02 } from "./L02OneTimePasscode/meta";
import { meta as L04 } from "./L04HowMany/meta";
import { meta as L05 } from "./L05AcceptOurCookies/meta";
import { meta as L11 } from "./L11ChooseASecurePassword/meta";
import { meta as L12 } from "./L12EnterYourPhoneNumber/meta";
import { meta as L16 } from "./L16BackspaceUnavailable/meta";
import { meta as L18 } from "./L18DragToUnlock/meta";
import { meta as L22 } from "./L22LoadingYourDashboard/meta";
import { meta as L27 } from "./L27ConfirmYourAddress/meta";
import { meta as L28 } from "./L28AreYouStillThere/meta";
import { meta as L36 } from "./L36SignIn/meta";
import { meta as L37 } from "./L37SetYourSecurityPin/meta";
import { meta as L42 } from "./L42ConfirmYourPassword/meta";

/**
 * Level metadata, with no components attached.
 *
 * Route handlers need tier and par to rescore a submitted event log, and the
 * level components are client modules — importing those on the server yields
 * a client reference with no `meta` on it. Keeping the catalogue pure is what
 * lets the server hold the authoritative copy of what a level is worth.
 */
export const CATALOG: readonly LevelMeta[] = [
  L01, L02, L04, L05, L11, L12, L16, L18, L22, L27, L28, L36, L37, L42,
];

export const META_BY_ID = new Map(CATALOG.map((m) => [m.id, m]));
