import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <div className="min-h-screen"><Sidebar name={session.name} isAdmin={session.systemRole === "SUPER_ADMIN"}/><main><div className="max-w-[1440px] mx-auto p-5 md:p-8 lg:p-10">{children}</div></main></div>;
}
