import { NextResponse } from "next/server";
import { sessionIsAdmin } from "@/lib/admin-auth";
import { endSeasonArchive } from "@/lib/seasons";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await sessionIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const season = await endSeasonArchive(id);
    return NextResponse.json({ ok: true, season });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not archive season.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
