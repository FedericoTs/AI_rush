import type { LevelModule } from "@/engine/types";
import { L01 } from "./L01ContinueToYourAccount";
import { L02 } from "./L02OneTimePasscode";
import { L11 } from "./L11ChooseASecurePassword";
import { L12 } from "./L12EnterYourPhoneNumber";
import { L36 } from "./L36SignIn";
import { L37 } from "./L37SetYourSecurityPin";

/**
 * The only import surface for level content. The deck reads this; nothing
 * else should reach into a level directory.
 */
export const REGISTRY: readonly LevelModule[] = [L01, L02, L11, L12, L36, L37];

export const BY_ID = new Map(REGISTRY.map((m) => [m.meta.id, m]));
