import { NextResponse } from "next/server";
import { sessionIsAdmin } from "@/lib/admin-auth";
import { createSeasonAdmin } from "@/lib/seasons";

export async function POST(request: Request) {
  const { isAdmin } = await sessionIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      name?: string;
      plannedStartAt?: string | null;
      tournamentFormat?: string;
      teamCount?: number;
    };
    const season = await createSeasonAdmin({
      name: body.name ?? "",
      plannedStartAt: body.plannedStartAt
        ? new Date(body.plannedStartAt)
        : null,
      tournamentFormat: body.tournamentFormat,
      teamCount: body.teamCount,
    });
    return NextResponse.json({ ok: true, season });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create season.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
