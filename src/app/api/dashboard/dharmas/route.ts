import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createDharma } from "@/lib/manage-dharma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const dharma = await createDharma(session, {
      bankAccountId:
        typeof body.bankAccountId === "string" ? body.bankAccountId : "",
      name: typeof body.name === "string" ? body.name : "",
      code: typeof body.code === "string" ? body.code : "",
      aliases: typeof body.aliases === "string" ? body.aliases : "",
    });
    return Response.json(
      { data: dharma },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo thiện pháp" },
      { status: 400 },
    );
  }
}
