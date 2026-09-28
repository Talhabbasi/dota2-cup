import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sessionIsAdmin } from "@/lib/admin-auth";
import { revalidatePublicPages } from "@/lib/page-cache";
import { setActiveSeason } from "@/lib/seasons";

export async function POST(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  const { isAdmin } = await sessionIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { seasonId } = await context.params;
  if (!seasonId?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing season." }, { status: 400 });
  }

  try {
    const season = await setActiveSeason(seasonId.trim());
    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/seasons");
    revalidatePublicPages();
    return NextResponse.json({ ok: true, season });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not set active season.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
