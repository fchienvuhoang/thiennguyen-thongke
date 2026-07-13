import { Building2, Landmark, Users, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import {
  CreateCustomerButton,
  EditCustomerButton,
} from "@/components/admin-customer-modals";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const session = await requireSession();
  if (session.systemRole !== "SUPER_ADMIN") redirect("/dashboard");
  const organizations = await prisma.organization.findMany({
    include: {
      memberships: { include: { user: true }, orderBy: { role: "asc" } },
      bankAccounts: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const totalAccounts = organizations.reduce(
    (sum, organization) => sum + organization.bankAccounts.length,
    0,
  );
  const totalUsers = organizations.reduce(
    (sum, organization) => sum + organization.memberships.length,
    0,
  );
  const cards: [string, number, LucideIcon][] = [
    ["Khách hàng", organizations.length, Building2],
    ["Tài khoản đăng nhập", totalUsers, Users],
    ["Tài khoản ngân hàng", totalAccounts, Landmark],
  ];

  return (
    <>
      <PageHeader
        eyebrow="QUẢN TRỊ SAAS"
        title="Khách hàng và tài khoản đồng bộ"
        description="Mỗi khách hàng gồm hồ sơ tổ chức, tài khoản đăng nhập chính và các tài khoản ngân hàng MB được gán."
        action={<CreateCustomerButton />}
      />

      <section className="grid sm:grid-cols-3 gap-4 mb-7">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="card p-5">
            <Icon className="text-[#176b46]" size={21} />
            <p className="text-sm text-[#748078] mt-4">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
        ))}
      </section>

      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Tài khoản đăng nhập</th>
              <th>Tài khoản ngân hàng MB</th>
              <th>Đồng bộ gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td className="align-top min-w-56">
                  <EditCustomerButton customer={organization} />
                </td>
                <td className="align-top min-w-64">
                  <div className="space-y-3">
                    {organization.memberships.map((membership) => (
                      <div key={membership.id}>
                        <p className="font-medium">{membership.user.name}</p>
                        <p className="text-xs text-[#7a867e]">
                          {membership.user.email}
                        </p>
                        <span className="badge badge-gray mt-1">
                          {membership.role === "ADMIN"
                            ? "Quản trị khách hàng"
                            : "Thành viên"}
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="align-top min-w-64">
                  <div className="space-y-3">
                    {organization.bankAccounts.map((account) => (
                      <div key={account.id}>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-[#7a867e] mt-1">
                          Số TK: {account.accountNo}
                        </p>
                        <span
                          className={`badge mt-1 ${account.syncStatus === "FAILED" ? "bg-red-50 text-red-700" : account.enabled ? "badge-green" : "badge-gray"}`}
                        >
                          {account.syncStatus === "FAILED"
                            ? "Lỗi"
                            : account.enabled
                              ? "Hoạt động"
                              : "Đã tắt"}
                        </span>
                      </div>
                    ))}
                    {!organization.bankAccounts.length && (
                      <span className="text-sm text-[#8a948e]">
                        Chưa gán tài khoản
                      </span>
                    )}
                  </div>
                </td>
                <td className="align-top min-w-48">
                  <div className="space-y-3">
                    {organization.bankAccounts.map((account) => (
                      <div key={account.id}>
                        <p className="text-sm">{account.accountNo}</p>
                        <p className="text-xs text-[#7a867e]">
                          {account.lastSyncedAt
                            ? dateTime.format(account.lastSyncedAt)
                            : "Chưa đồng bộ"}
                        </p>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {!organizations.length && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[#7a867e]">
                  Chưa có khách hàng. Bấm “Tạo khách hàng” để bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
