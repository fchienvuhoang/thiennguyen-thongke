import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export default async function DharmasPage() {
  const session = await requireSession();
  redirect(session.systemRole === "SUPER_ADMIN" ? "/dashboard/admin" : "/dashboard#thien-phap");
}
