import Image from "next/image";

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="page-loader-mark" aria-hidden>
        <span className="page-loader-orbit" />
        <span className="page-loader-ring" />
        <span className="page-loader-gem">
          <Image
            src="/mm-dota-cup-icon.png"
            alt=""
            width={40}
            height={40}
            className="page-loader-icon"
          />
        </span>
      </div>
      <p className="eyebrow">MM Dota Cup</p>
      <p className="page-loader-text">Loading</p>
    </div>
  );
}
