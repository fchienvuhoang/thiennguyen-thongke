import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reclassifyAccount } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ dharmaId: string }> },
) {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.systemRole === "SUPER_ADMIN")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { dharmaId } = await context.params;
    const dharma = await prisma.dharma.findFirst({
      where: { id: dharmaId, organizationId: session.organizationId },
      select: { bankAccountId: true },
    });
    if (!dharma) throw new Error("Không tìm thấy thiện pháp");
    const result = await reclassifyAccount(dharma.bankAccountId);
    return Response.json(
      { data: result },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể phân loại lại giao dịch",
      },
      { status: 400 },
    );
  }
}
