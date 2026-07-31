import { Eyebrow } from "./Eyebrow";
import { mark, type Tone } from "./StatusDot";

type MetricProps = {
  label: string;
  /** 🔴 `null` renders the WORDS "Not counted", never a 0. A zero we invented is a number somebody repeats down a phone. */
  value: number | null;
  note?: string;
  /** Adds a mark beside the LABEL. It never recolours the figure. */
  tone?: Tone;
  /** Renders nothing at all when the value is 0. See below, this is load-bearing. */
  suppressZero?: boolean;
};

/**
 * A single figure with its label, its qualifier and, when it needs one, a
 * status mark beside the label rather than a repainted number.
 *
 * Replaces a t-shirt-sized 30px figure at weight 600: a size NOT in the closed
 * set, at a weight Thmanyah does not ship. Laid out by the parent in
 * `grid gap-8 sm:grid-cols-3` or `flex flex-wrap gap-x-12 gap-y-6`.
 *
 * 🔴 `suppressZero` returns null, i.e. the tile DISAPPEARS. It is load-bearing
 * on "Email never sent" and on "Expiring in 30 days": a tile that is always
 * present, reading 0 on almost every visit, is a tile the eye stops reading, so
 * the one day it reads 3 it is invisible too. Do NOT regularise those rows into
 * three equal always-visible tiles. That is the most natural move when
 * introducing a status palette and it reintroduces exactly the habituation the
 * suppression prevents.
 */
export function Metric({
  label,
  value,
  note,
  tone,
  suppressZero = false,
}: MetricProps) {
  if (suppressZero && value === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* A bare mark rather than a StatusDot, and it is not an exception to
            the hue-always-carries-a-word rule: the word is the Eyebrow sitting
            8px to its right, in the same flex row. A StatusDot here would print
            the label twice. The mark sits beside the LABEL and never recolours
            the figure, because a repainted number reads as a different number. */}
        {tone && <span aria-hidden className={mark(tone)} />}
        <Eyebrow size={11}>{label}</Eyebrow>
      </div>
      {value === null ? (
        <p className="mt-1.5 text-14 text-subtle-foreground">Not counted</p>
      ) : (
        <p className="mt-1.5 text-32 font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
          {value}
        </p>
      )}
      {note && <p className="mt-1 text-12 text-subtle-foreground">{note}</p>}
    </div>
  );
}
