import { GENRES, PLATFORMS, SCOPE_TIERS, TOPICS } from "../game/types";
import { PLATFORM_CATALOG } from "../game/data/platforms";
import { toMarketView } from "../game/market";
import { researchTrendFit, validateConcept } from "../game/conception";
import { useConceptionStore } from "../state/conceptionStore";
import { useLoopStore } from "../state/loopStore";

/** "double-a" → "Double A", "rpg" → "Rpg" (labels stay data-driven). */
function label(id: string): string {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const GENRE_LABELS: Record<string, string> = { rpg: "RPG" };
const TIER_LABELS: Record<string, string> = { "double-a": "Double-A", aaa: "AAA" };

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        selected
          ? "border-amber-400 bg-amber-400/15 text-amber-300"
          : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
        {title}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">{hint}</span>}
      </h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

const OVERALL_STYLE: Record<string, string> = {
  hot: "bg-emerald-400/15 text-emerald-300 border-emerald-400",
  warm: "bg-amber-400/15 text-amber-300 border-amber-400",
  cool: "bg-sky-400/15 text-sky-300 border-sky-400",
};

export default function ConceptionScreen() {
  const draft = useConceptionStore((s) => s.draft);
  const store = useConceptionStore();
  const ipCatalog = useLoopStore((s) => s.state.studio.ipCatalog);
  const marketSim = useLoopStore((s) => s.state.market);
  const greenlight = useLoopStore((s) => s.greenlight);

  const problems = validateConcept(draft, ipCatalog);
  const research =
    draft.genres.length > 0 && draft.topic !== null
      ? researchTrendFit(draft.genres, draft.topic, toMarketView(marketSim))
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Conceive</p>
        <h1 className="text-3xl font-bold">New project</h1>
      </header>

      <input
        type="text"
        value={draft.title}
        onChange={(e) => store.setTitle(e.target.value)}
        placeholder="Project title…"
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400"
      />

      <Section title="Basis">
        <Chip
          selected={draft.basis.kind === "new-ip"}
          onClick={() => store.setBasis({ kind: "new-ip" })}
        >
          New IP
        </Chip>
        {ipCatalog.length === 0 ? (
          <Chip selected={false} disabled onClick={() => {}}>
            Sequel — ship something first
          </Chip>
        ) : (
          ipCatalog.map((ip) => (
            <Chip
              key={ip.id}
              selected={draft.basis.kind === "sequel" && draft.basis.ipId === ip.id}
              onClick={() => store.setBasis({ kind: "sequel", ipId: ip.id })}
            >
              Sequel to {ip.name} (pedigree {ip.pedigree})
            </Chip>
          ))
        )}
      </Section>

      <Section title="Genre" hint="pick one, or two for a hybrid">
        {GENRES.map((genre) => (
          <Chip
            key={genre}
            selected={draft.genres.includes(genre)}
            disabled={!draft.genres.includes(genre) && draft.genres.length >= 2}
            onClick={() => store.toggleGenre(genre)}
          >
            {GENRE_LABELS[genre] ?? label(genre)}
          </Chip>
        ))}
      </Section>

      <Section title="Topic">
        {TOPICS.map((topic) => (
          <Chip key={topic} selected={draft.topic === topic} onClick={() => store.setTopic(topic)}>
            {label(topic)}
          </Chip>
        ))}
      </Section>

      <Section title="Platforms">
        {PLATFORMS.map((platform) => (
          <Chip
            key={platform}
            selected={draft.platforms.includes(platform)}
            onClick={() => store.togglePlatform(platform)}
          >
            {PLATFORM_CATALOG[platform].name}
          </Chip>
        ))}
      </Section>

      <Section title="Scope / budget tier">
        {SCOPE_TIERS.map((tier) => (
          <Chip key={tier} selected={draft.scopeTier === tier} onClick={() => store.setScopeTier(tier)}>
            {TIER_LABELS[tier] ?? label(tier)}
          </Chip>
        ))}
      </Section>

      {research && (
        <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Market research
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${OVERALL_STYLE[research.overall]}`}
            >
              {research.overall}
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {research.readings.map((r) => (
              <li key={r.subject} className="flex justify-between gap-4">
                <span className="text-zinc-300">{label(r.subject.split(" ")[0]!)}</span>
                <span className="text-zinc-500">{r.comment}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-600">
            Partial signal only — research buys direction, not certainty.
          </p>
        </section>
      )}

      <footer className="space-y-2 border-t border-zinc-800 pt-4">
        {problems.length > 0 && (
          <ul className="text-sm text-zinc-500">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => {
            greenlight(draft);
            store.reset();
          }}
          className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 transition-opacity hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Greenlight
        </button>
      </footer>
    </div>
  );
}
