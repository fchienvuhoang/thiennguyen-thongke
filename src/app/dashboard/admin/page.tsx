import { Building2, Landmark, Users, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import {
  createBankAccountForOrganizationAction,
  createCustomerUserAction,
  createOrganizationUserAction,
  resetCustomerPasswordAction,
} from "@/app/actions";
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
    ["Người dùng", totalUsers, Users],
    ["Tài khoản ngân hàng", totalAccounts, Landmark],
  ];

  return (
    <>
      <PageHeader
        eyebrow="QUẢN TRỊ SAAS"
        title="Khách hàng và tài khoản đồng bộ"
        description="Quản trị viên hệ thống chỉ cấp tài khoản đăng nhập và gán tài khoản ngân hàng cho từng khách hàng."
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

      <div className="grid xl:grid-cols-2 gap-6 items-start mb-8">
        <section className="card p-6">
          <h2 className="font-semibold text-lg">Tạo khách hàng</h2>
          <p className="text-sm text-[#748078] mt-1 mb-5">
            Tạo tổ chức và tài khoản quản trị đầu tiên.
          </p>
          <form
            action={createOrganizationUserAction}
            className="grid sm:grid-cols-2 gap-4"
          >
            <div>
              <label className="label">Tên tổ chức</label>
              <input className="input" name="organizationName" required />
            </div>
            <div>
              <label className="label">Tên người dùng</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Email đăng nhập</label>
              <input className="input" type="email" name="email" required />
            </div>
            <div>
              <label className="label">Mật khẩu ban đầu</label>
              <input
                className="input"
                type="password"
                minLength={8}
                name="password"
                required
              />
            </div>
            <button className="btn btn-primary sm:col-span-2">
              Tạo tài khoản khách hàng
            </button>
          </form>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold text-lg">Gán tài khoản ngân hàng</h2>
          <p className="text-sm text-[#748078] mt-1 mb-5">
            Mỗi tài khoản ngân hàng thuộc duy nhất một khách hàng.
          </p>
          <form
            action={createBankAccountForOrganizationAction}
            className="space-y-4"
          >
            <div>
              <label className="label">Khách hàng</label>
              <select className="input" name="organizationId" required>
                <option value="">Chọn khách hàng</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Tên tài khoản</label>
                <input
                  className="input"
                  name="name"
                  required
                  placeholder="Tài khoản thiện nguyện"
                />
              </div>
              <div>
                <label className="label">Số tài khoản hoặc URL API</label>
                <input
                  className="input"
                  name="source"
                  required
                  placeholder="0572 hoặc URL có accountNo"
                />
              </div>
            </div>
            <div>
              <label className="label">Link sao kê gốc trên Thiện Nguyện</label>
              <input
                className="input"
                type="url"
                name="statementUrl"
                placeholder="https://thiennguyen.app/user/...?tab=TRANSACTIONS"
              />
            </div>
            <button className="btn btn-primary w-full">
              Gán cho khách hàng
            </button>
          </form>
        </section>
      </div>

      <section className="card p-6 mb-8">
        <h2 className="font-semibold text-lg">Tạo thêm tài khoản đăng nhập</h2>
        <p className="text-sm text-[#748078] mt-1 mb-5">
          Thêm quản trị viên hoặc thành viên vào một khách hàng hiện có.
        </p>
        <form
          action={createCustomerUserAction}
          className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 items-end"
        >
          <div>
            <label className="label">Khách hàng</label>
            <select className="input" name="organizationId" required>
              <option value="">Chọn khách hàng</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Họ tên</label>
            <input className="input" name="name" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" name="email" required />
          </div>
          <div>
            <label className="label">Mật khẩu ban đầu</label>
            <input
              className="input"
              type="password"
              name="password"
              minLength={8}
              required
            />
          </div>
          <div className="flex gap-2">
            <select className="input" name="role" defaultValue="MEMBER">
              <option value="MEMBER">Thành viên</option>
              <option value="ADMIN">Quản trị tổ chức</option>
            </select>
            <button className="btn btn-primary">Tạo</button>
          </div>
        </form>
      </section>

      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Tài khoản đăng nhập</th>
              <th>Tài khoản ngân hàng MB</th>
              <th>Trạng thái đồng bộ</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td className="align-top">
                  <p className="font-semibold">{organization.name}</p>
                  <p className="text-xs text-[#849089] mt-1">
                    {organization.slug}
                  </p>
                </td>
                <td className="align-top">
                  <div className="space-y-3 min-w-64">
                    {organization.memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="pb-3 border-b border-[#edf1ee] last:border-0 last:pb-0"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {membership.user.name}
                            </p>
                            <p className="text-xs text-[#7a867e]">
                              {membership.user.email}
                            </p>
                          </div>
                          <span className="badge badge-gray h-fit">
                            {membership.role === "ADMIN"
                              ? "Quản trị"
                              : "Thành viên"}
                          </span>
                        </div>
                        {membership.user.systemRole === "USER" && (
                          <details className="mt-2">
                            <summary className="text-xs font-medium text-[#176b46] cursor-pointer">
                              Đổi mật khẩu
                            </summary>
                            <form
                              action={resetCustomerPasswordAction}
                              className="flex gap-2 mt-2"
                            >
                              <input
                                type="hidden"
                                name="userId"
                                value={membership.user.id}
                              />
                              <input
                                className="input py-2"
                                name="password"
                                type="password"
                                minLength={8}
                                required
                                placeholder="Mật khẩu mới"
                              />
                              <button className="btn btn-soft py-2">Lưu</button>
                            </form>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="align-top">
                  <div className="space-y-3 min-w-64">
                    {organization.bankAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="pb-3 border-b border-[#edf1ee] last:border-0 last:pb-0"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-medium">{account.name}</p>
                            <p className="text-xs text-[#7a867e] mt-1">
                              Số TK: {account.accountNo}
                            </p>
                            {account.statementUrl && (
                              <a href={account.statementUrl} target="_blank" rel="noreferrer" className="text-xs text-[#176b46] hover:underline">
                                Mở sao kê gốc ↗
                              </a>
                            )}
                          </div>
                          <span
                            className={`badge h-fit ${account.syncStatus === "FAILED" ? "bg-red-50 text-red-700" : "badge-green"}`}
                          >
                            {account.syncStatus === "FAILED"
                              ? "Lỗi"
                              : account.enabled
                                ? "Hoạt động"
                                : "Đã tắt"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {!organization.bankAccounts.length && (
                      <span className="text-sm text-[#8a948e]">
                        Chưa gán tài khoản
                      </span>
                    )}
                  </div>
                </td>
                <td className="align-top">
                  <div className="space-y-2">
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
          </tbody>
        </table>
      </section>
    </>
  );
}
