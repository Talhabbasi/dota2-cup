const ITEMS = [
  "All prediction details are still being worked on",
  "They will be fixed once the tournament ends",
  "Results, kills, man of the match, and most kills",
] as const;

function TickerCopy({ hidden = false }: { hidden?: boolean }) {
  return (
    <span className="news-ticker-copy" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </span>
  );
}

/** Sliding notice under the site header. */
export function NewsTicker() {
  return (
    <div className="news-ticker" role="region" aria-label="Cup updates">
      <span className="news-ticker-label">Update</span>
      <div className="news-ticker-viewport">
        <div className="news-ticker-track">
          <TickerCopy />
          <TickerCopy hidden />
        </div>
      </div>
    </div>
  );
}
