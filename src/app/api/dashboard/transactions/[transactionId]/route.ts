import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { classifyTransaction } from "@/lib/classify-transaction";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string }> },
) {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.systemRole === "SUPER_ADMIN")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { transactionId } = await context.params;
    const body = (await request.json()) as { dharmaId?: unknown };
    const dharmaId = typeof body.dharmaId === "string" ? body.dharmaId : "";
    await classifyTransaction(session, transactionId, dharmaId);
    return Response.json(
      { success: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể phân loại" },
      { status: 400 },
    );
  }
}
