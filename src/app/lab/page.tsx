import Link from "next/link";
import { LabForm } from "./LabForm";
import { Gallery } from "./Gallery";
import { labGallery, type LabSort } from "@/lib/db";
import s from "./lab.module.css";
import g from "./gallery.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Lab",
  description:
    "Describe a level. If it gets built, your handle goes on it — in the game and on the share card of everyone it destroys.",
};

const SORTS: ReadonlyArray<{ id: LabSort; label: string }> = [
  { id: "top", label: "Top" },
  { id: "new", label: "New" },
  { id: "shipped", label: "Shipped" },
];

/**
 * Where the next levels come from.
 *
 * Fourteen levels is about nine runs before repetition shows. This game dies
 * of content starvation unless the expensive, creative part — the ideas —
 * comes from the people playing it.
 */
export default async function Lab({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: raw } = await searchParams;
  const sort: LabSort = SORTS.some((x) => x.id === raw) ? (raw as LabSort) : "top";
  const cards = await labGallery(sort);

  return (
    <main className={s.shell}>
      <div className={s.head}>
        <h1>
          The <i>Lab</i>
        </h1>
        <div className={s.sp} />
        <Link className={s.back} href="/">
          ← back
        </Link>
      </div>

      <p className={s.lede}>
        You think you can do worse? Describe a level. If it gets built, your handle goes on it —
        in the game, in the index, and on the share card of everyone it destroys.
      </p>

      <p className={s.aside}>
        We made this form usable on purpose, so you would actually finish it.
      </p>

      <LabForm />

      <ul className={s.rules}>
        <li>
          <b>It has to look normal first.</b> A screenshot of the first second should look like a
          boring form. Weird from frame one is a puzzle, not a joke.
        </li>
        <li>
          <b>It has to be beatable.</b> Under a minute, with an escape a player can actually find.
          A level nobody can solve is not cruel, it is broken.
        </li>
        <li>
          <b>Someone has to be able to name what went wrong.</b> &ldquo;It made me ___.&rdquo; If
          the failure is just &ldquo;it was confusing&rdquo;, there is nothing to post about.
        </li>
        <li>
          A human reads these on Fridays. Approved ideas appear here with your name on them;
          rejected ones say why, because quietly ignoring a good idea is how this stops working.
        </li>
      </ul>

      {/*
        * The wall.
        *
        * Below the form rather than above it, deliberately: the form is the
        * thing this page exists to get filled in, and a gallery at the top
        * turns a submission page into a browsing page. Somebody who scrolls
        * this far has either already submitted or come back on purpose, and
        * both of those people are here to read other people's ideas.
        */}
      <section className={s.form} id="gallery">
        <div className={s.head}>
          <h2 className={s.galleryHead}>What people sent</h2>
          <div className={s.sp} />
          <div className={g.tabs}>
            {SORTS.map((x) => (
              <Link
                key={x.id}
                className={`${g.tab} ${x.id === sort ? g.tabOn : ""}`}
                href={x.id === "top" ? "/lab#gallery" : `/lab?sort=${x.id}#gallery`}
                scroll={false}
              >
                {x.label}
              </Link>
            ))}
          </div>
        </div>

        <p className={s.fine}>
          Votes are a signal, not a mandate. A 400-vote idea that is mechanically the same as a
          level we already shipped does not get built, and the card says so — silently ignoring the
          top-voted idea is how this kind of thing stops working.
        </p>

        <Gallery cards={cards} sort={sort} />
      </section>
    </main>
  );
}
