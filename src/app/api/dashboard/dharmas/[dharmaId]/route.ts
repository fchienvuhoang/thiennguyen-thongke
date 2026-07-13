import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { updateDharma } from "@/lib/manage-dharma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dharmaId: string }> },
) {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [{ dharmaId }, body] = await Promise.all([
      context.params,
      request.json() as Promise<Record<string, unknown>>,
    ]);
    const dharma = await updateDharma(session, {
      id: dharmaId,
      name: typeof body.name === "string" ? body.name : "",
      code: typeof body.code === "string" ? body.code : "",
      aliases: typeof body.aliases === "string" ? body.aliases : "",
    });
    return Response.json(
      { data: dharma },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể cập nhật thiện pháp" },
      { status: 400 },
    );
  }
}
