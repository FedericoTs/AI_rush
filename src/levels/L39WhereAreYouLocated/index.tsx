"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

interface Place {
  country: string;
  regions: ReadonlyArray<{ name: string; cities: readonly string[] }>;
}

const WORLD: readonly Place[] = [
  { country: "Italy", regions: [
    { name: "Lazio", cities: ["Rome", "Tivoli"] },
    { name: "Veneto", cities: ["Venice", "Verona"] },
  ] },
  { country: "Japan", regions: [
    { name: "Kanto", cities: ["Tokyo", "Yokohama"] },
    { name: "Kansai", cities: ["Osaka", "Kyoto"] },
  ] },
  { country: "Peru", regions: [
    { name: "Cusco", cities: ["Cusco", "Pisac"] },
    { name: "Lima", cities: ["Lima", "Callao"] },
  ] },
];

const TARGET = { country: "Japan", region: "Kansai", city: "Kyoto" } as const;

/** Which country a city belongs to. The reverse lookup, firing at the worst moment. */
export function countryOfCity(city: string): string | null {
  for (const p of WORLD) for (const r of p.regions) if (r.cities.includes(city)) return p.country;
  return null;
}

/** Declared out here: a component created during render remounts every time. */
function Select({
  label, value, options, onPick, testid,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onPick: (v: string) => void;
  testid: string;
}) {
  return (
    <label className={s.row}>
      <span>{label}</span>
      <select
        className={s.select}
        value={value}
        data-testid={testid}
        onChange={(e) => onPick(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Two bugs that compound, both of them real.
 *
 * 1. The child list populates from the **previous** parent value — always one
 *    selection behind. Pick Japan and the region list still shows Italy's.
 * 2. Picking a **city** overwrites the **country** with the country that city
 *    belongs to. A helpful reverse-lookup, firing at exactly the wrong time.
 *
 * The honest solve is the thing everyone who has fought a broken address form
 * does by instinct: select each dropdown **twice**, because the second
 * selection reads the now-correct list. And the writeback stops being a bug the
 * moment you use it deliberately — set the city first and let it fill the
 * country in for you, which makes the fastest route through this level
 * backwards.
 *
 * The one-behind list is the level's own state rather than a graph edge: it is
 * a stale *read*, not a value moving another value. The writeback is a real
 * `writeback` edge in shape, and `solveOrder` on that graph says city-then-
 * country — the fast solve, stated by the machinery.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [country, setCountry] = useState<string>(WORLD[0]!.country);
  const [region, setRegion] = useState<string>("");
  const [city, setCity] = useState<string>("");
  /* What the child lists were built from: always the *previous* parent. */
  const [regionSource, setRegionSource] = useState<string>(WORLD[0]!.country);
  const [citySource, setCitySource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const regionsOf = (c: string) => WORLD.find((p) => p.country === c)?.regions ?? [];
  const citiesOf = (r: string) =>
    WORLD.flatMap((p) => p.regions).find((x) => x.name === r)?.cities ?? [];

  const chooseCountry = (next: string) => {
    /* The list refreshes to whatever was selected *before* this one. */
    setRegionSource(country);
    setCountry(next);
    setError(null);
    sfx.blip();
  };

  const chooseRegion = (next: string) => {
    setCitySource(region);
    setRegion(next);
    setError(null);
    sfx.blip();
  };

  const chooseCity = (next: string) => {
    setCity(next);
    /* The writeback. Helpful, and catastrophically mistimed. */
    const owner = countryOfCity(next);
    if (owner) {
      setRegionSource(country);
      setCountry(owner);
    }
    setError(null);
    sfx.blip();
  };

  const confirm = () => {
    if (country === TARGET.country && region === TARGET.region && city === TARGET.city) {
      onSolve();
      return;
    }
    setError("We couldn't verify this address. Showing results for: Antarctica.");
    onFail("wrong-place");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Address · Bank-Level Security</SlopBadge>
      <SlopHeading>Where Are You Located? 🌍</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.want}>
        Deliver to: <b>{TARGET.city}, {TARGET.region}, {TARGET.country}</b>
      </div>

      <Select
        label="Country"
        value={country}
        options={WORLD.map((p) => p.country)}
        onPick={chooseCountry}
        testid="sel-country"
      />
      <Select
        label="Region"
        value={region}
        options={regionsOf(regionSource).map((r) => r.name)}
        onPick={chooseRegion}
        testid="sel-region"
      />
      <Select
        label="City"
        value={city}
        options={citiesOf(citySource)}
        onPick={chooseCity}
        testid="sel-city"
      />

      <SlopCta onClick={confirm}>Confirm Address</SlopCta>
      <SlopError>{error}</SlopError>
      <SlopHint>
        Lists are kept in sync automatically. Selecting a city will helpfully update your country. ✨
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L39: LevelModule = { meta, Component };
