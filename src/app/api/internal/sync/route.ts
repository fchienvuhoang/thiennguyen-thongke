import { syncDueAccounts } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.SYNC_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ success: true, ...(await syncDueAccounts(5)) });
}
