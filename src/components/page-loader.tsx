export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="page-loader-mark" aria-hidden>
        <span className="page-loader-orbit" />
        <span className="page-loader-ring" />
        <span className="page-loader-gem">◈</span>
      </div>
      <p className="eyebrow">MM Dota Cup</p>
      <p className="page-loader-text">Loading</p>
    </div>
  );
}
