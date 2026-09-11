import { isRegistrationOpen } from "@/lib/registration-status";

const SLIDE_TEXT = "Registration is closed";

function BannerCopy() {
  return (
    <div className="site-closed-banner-group">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="site-closed-banner-item">
          {SLIDE_TEXT}
        </span>
      ))}
    </div>
  );
}

export async function ClosedBanner() {
  if (await isRegistrationOpen()) return null;
  return (
    <div className="site-closed-banner" aria-label={SLIDE_TEXT}>
      <div className="site-closed-banner-track">
        <BannerCopy />
        <div className="site-closed-banner-group" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="site-closed-banner-item">
              {SLIDE_TEXT}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
