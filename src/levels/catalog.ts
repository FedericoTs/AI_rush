import type { LevelMeta } from "@/engine/types";
import { meta as L01 } from "./L01ContinueToYourAccount/meta";
import { meta as L02 } from "./L02OneTimePasscode/meta";
import { meta as L11 } from "./L11ChooseASecurePassword/meta";
import { meta as L12 } from "./L12EnterYourPhoneNumber/meta";
import { meta as L36 } from "./L36SignIn/meta";
import { meta as L37 } from "./L37SetYourSecurityPin/meta";

/**
 * Level metadata, with no components attached.
 *
 * Route handlers need tier and par to rescore a submitted event log, and the
 * level components are client modules — importing those on the server yields
 * a client reference with no `meta` on it. Keeping the catalogue pure is what
 * lets the server hold the authoritative copy of what a level is worth.
 */
export const CATALOG: readonly LevelMeta[] = [L01, L02, L11, L12, L36, L37];

export const META_BY_ID = new Map(CATALOG.map((m) => [m.id, m]));
