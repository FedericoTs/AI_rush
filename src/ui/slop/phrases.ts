import type { Rng } from "@/engine/rng";

/**
 * The slop phrase bank.
 *
 * Seeded from the run RNG, so microcopy varies between runs and is still
 * reproducible from a seed link. The register to aim for is not "bad writing"
 * — it is a real product's onboarding copy, over-explaining to someone who
 * never asked, with an emoji it does not need.
 */
export const SUBHEADS = [
  "Great! Let's get you verified — it only takes a moment. ✨",
  "Almost there! Just a couple more steps to secure your account. 🔒",
  "We use AI-powered validation to keep your data safe. 🚀",
  "This helps us personalise your experience. Thanks for your patience! 💜",
  "Nearly done. We really appreciate you sticking with us! 🙌",
  "Your security matters to us, so this step is required. 🛡️",
] as const;

export const BADGES = [
  "AI-Powered", "Enterprise-Grade", "SOC2 (pending)", "Bank-Level Security",
  "Zero-Trust", "Blazing Fast", "Trusted by Teams",
] as const;

export const FOOTER_LINKS = ["Privacy", "Terms", "Careers", "Careers"] as const;

export function slopSubhead(rng: Rng): string {
  return rng.pick(SUBHEADS);
}

export function slopBadge(rng: Rng): string {
  return rng.pick(BADGES);
}
