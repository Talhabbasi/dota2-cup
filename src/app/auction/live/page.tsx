import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — live board now lives at /auction. */
export default function LiveAuctionRedirect() {
  redirect("/auction");
}
