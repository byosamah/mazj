type RecordListProps = { children: React.ReactNode };

type RecordRowProps = {
  /** A StatusDot or a Chip. Always the inline-start cell. */
  mark: React.ReactNode;
  /** The row's name, and always the link. */
  lead: React.ReactNode;
  /** Each label is visible only in the stacked phone layout, where column headers do not exist. */
  meta: { label: string; value: React.ReactNode }[];
  /** Always the inline-end cell. */
  action?: React.ReactNode;
  columns?: 3 | 4 | 5;
};

/**
 * For records that are a status plus a name plus an action rather than a grid
 * of figures: the events list and the startups queue, which are its only two
 * callers (`grep -rln RecordList app/admin`).
 *
 * ⚠️ It named "booking-lookup results" and "room occupancy" as two of its four
 * examples. Both were deleted with the Rekaz dashboard on 2026-07-30.
 *
 * It STACKS below md, and that is the biggest single phone win in the redesign:
 * "Decide" currently sits in column 8 of a 52rem horizontal scroll, so the one
 * control the queue exists for is the one thing a phone cannot reach.
 */
export function RecordList({ children }: RecordListProps) {
  return <ul className="border-t border-border">{children}</ul>;
}

export function RecordRow({
  mark,
  lead,
  meta,
  action,
  columns,
}: RecordRowProps) {
  // The grid needs one track per meta cell or the columns desync from their
  // labels, so the count defaults to what was actually passed rather than to a
  // constant. `columns` exists to pin it when a list mixes row shapes and every
  // row must still line up.
  const cols = columns ?? meta.length;

  return (
    <li
      // `--cols` is supplied inline because the class itself has to be a
      // literal for the JIT to emit it. That is why the spec writes the track
      // list with a variable inside rather than interpolating the number into
      // the class name, which would compile to nothing.
      style={{ "--cols": cols } as React.CSSProperties}
      className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-border px-1 py-4 transition-colors hover:bg-card md:grid-cols-[auto_minmax(0,2fr)_repeat(var(--cols),minmax(0,1fr))_auto] md:items-baseline md:py-3"
    >
      <div>{mark}</div>
      <div className="text-14 font-medium">{lead}</div>
      {meta.map((m) => (
        <div key={m.label} className="text-13 text-subtle-foreground">
          <span className="me-1.5 text-12 text-subtle-foreground md:hidden">
            {m.label}
          </span>
          {m.value}
        </div>
      ))}
      <div className="md:text-end">{action}</div>
    </li>
  );
}
