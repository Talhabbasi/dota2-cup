import Image from "next/image";
import { CUP_ICON_PATH, CUP_NAME } from "@/lib/brand";

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="page-loader-mark" aria-hidden>
        <span className="page-loader-orbit" />
        <span className="page-loader-ring" />
        <span className="page-loader-gem">
          <Image
            src={CUP_ICON_PATH}
            alt=""
            width={40}
            height={40}
            sizes="40px"
            className="page-loader-icon"
          />
        </span>
      </div>
      <p className="eyebrow">{CUP_NAME}</p>
      <p className="page-loader-text">Loading</p>
    </div>
  );
}
