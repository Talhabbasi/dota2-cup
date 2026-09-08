import { revalidatePublicPages } from "@/lib/page-cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = process.env.NEXTAUTH_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
