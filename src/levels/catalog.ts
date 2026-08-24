import type { LevelMeta } from "@/engine/types";
import { meta as L01 } from "./L01ContinueToYourAccount/meta";
import { meta as L02 } from "./L02OneTimePasscode/meta";
import { meta as L03 } from "./L03SelectYourCountry/meta";
import { meta as L04 } from "./L04HowMany/meta";
import { meta as L05 } from "./L05AcceptOurCookies/meta";
import { meta as L06 } from "./L06PasswordRequirements/meta";
import { meta as L07 } from "./L07JustCheckingYoureHuman/meta";
import { meta as L08 } from "./L08YourDateOfBirth/meta";
import { meta as L09 } from "./L09AlmostThere/meta";
import { meta as L10 } from "./L10ScrollToAccept/meta";
import { meta as L11 } from "./L11ChooseASecurePassword/meta";
import { meta as L12 } from "./L12EnterYourPhoneNumber/meta";
import { meta as L13 } from "./L13ConfirmWithAGesture/meta";
import { meta as L14 } from "./L14PleaseConfirmVerbally/meta";
import { meta as L15 } from "./L15TypeYourFullName/meta";
import { meta as L16 } from "./L16BackspaceUnavailable/meta";
import { meta as L17 } from "./L17NotificationSettings/meta";
import { meta as L18 } from "./L18DragToUnlock/meta";
import { meta as L19 } from "./L19UploadAPhotoOfYourself/meta";
import { meta as L20 } from "./L20ConfirmYoureNearby/meta";
import { meta as L21 } from "./L21RateYourExperience/meta";
import { meta as L22 } from "./L22LoadingYourDashboard/meta";
import { meta as L23 } from "./L23AiIsGeneratingYourCode/meta";
import { meta as L24 } from "./L24SelectYourPlan/meta";
import { meta as L25 } from "./L25TwoCursors/meta";
import { meta as L26 } from "./L26EmergencyVerification/meta";
import { meta as L27 } from "./L27ConfirmYourAddress/meta";
import { meta as L28 } from "./L28AreYouStillThere/meta";
import { meta as L29 } from "./L29AdjustYourVolume/meta";
import { meta as L30 } from "./L30CompleteYourProfile/meta";
import { meta as L31 } from "./L31Mirror/meta";
import { meta as L32 } from "./L32NetworkConditions/meta";
import { meta as L33 } from "./L33ThisPageIsRotating/meta";
import { meta as L34 } from "./L34LevelFailedToGenerate/meta";
import { meta as L35 } from "./L35PleaseStandUp/meta";
import { meta as L36 } from "./L36SignIn/meta";
import { meta as L37 } from "./L37SetYourSecurityPin/meta";
import { meta as L38 } from "./L38HumanVerificationRequired/meta";
import { meta as L39 } from "./L39WhereAreYouLocated/meta";
import { meta as L40 } from "./L40ConfirmQuantity/meta";
import { meta as L41 } from "./L41RankYourPriorities/meta";
import { meta as L42 } from "./L42ConfirmYourPassword/meta";
import { meta as L43 } from "./L43SelectYourSeats/meta";
import { meta as L44 } from "./L44DisplaySettings/meta";
import { meta as L45 } from "./L45AddSomeTags/meta";
import { meta as L46 } from "./L46ChooseYourDates/meta";
import { meta as L47 } from "./L47MatchThisColour/meta";
import { meta as L48 } from "./L48NotificationPreferences/meta";
import { meta as L49 } from "./L49Careers/meta";

/**
 * Level metadata, with no components attached.
 *
 * Route handlers need tier and par to rescore a submitted event log, and the
 * level components are client modules — importing those on the server yields
 * a client reference with no `meta` on it. Keeping the catalogue pure is what
 * lets the server hold the authoritative copy of what a level is worth.
 */
export const CATALOG: readonly LevelMeta[] = [
  L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13, L14, L15, L16, L17,
  L18, L19, L20, L21, L22, L23, L24, L25, L26, L27, L28, L29, L30, L31, L32, L33, L34,
  L35, L36, L37, L38, L39, L40, L41, L42, L43, L44, L45, L46, L47, L48, L49,
];

export const META_BY_ID = new Map(CATALOG.map((m) => [m.id, m]));

/**
 * How many levels `docs/LEVELS.md` describes: forty-eight, numbered.
 *
 * The catalogue holds one more than that. L49 is the secret — it has no number
 * in the document because it is not supposed to be in a list at all — so it is
 * counted separately everywhere the two numbers are shown together. A build
 * count of 49/48 would read as a bug, and it would be giving the secret away
 * on the front page.
 */
export const LEVELS_WRITTEN = 48;

/** The numbered ones, which is what "built" means on the front page. */
export const LEVELS_BUILT = CATALOG.filter((m) => m.unlock?.kind !== "secret").length;

/** Written, not yet built. Zero, as of the Phase 5 content push. */
export const LEVELS_UNBUILT = Math.max(0, LEVELS_WRITTEN - LEVELS_BUILT);

/** Catalogue order, which is id order, which is roughly the order they were built. */
export const ALL_LEVEL_IDS: readonly string[] = CATALOG.map((m) => m.id);

/**
 * Read a `?level=` selection off the URL.
 *
 * `all` is the whole catalogue in order; anything else is a comma-separated
 * list of ids, kept in the order given so a hand-written link can build its
 * own little run. Unknown ids are dropped rather than rejected — a stale link
 * to a level that was renumbered should still play the rest of what it names.
 *
 * Returns null when there is no selection at all, which is what tells the play
 * route to deal an ordinary five-minute run instead.
 */
export function parseLevelSelection(raw: string | undefined): string[] | null {
  if (!raw) return null;
  if (raw.toLowerCase() === "all") return [...ALL_LEVEL_IDS];

  const ids = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((id, i, all) => META_BY_ID.has(id) && all.indexOf(id) === i);

  return ids.length > 0 ? ids : null;
}
