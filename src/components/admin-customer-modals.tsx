"use client";

import { Landmark, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  createBankAccountForOrganizationAction,
  createOrganizationUserAction,
  updateCustomerAction,
} from "@/app/actions";

type Customer = {
  id: string;
  name: string;
  slug: string;
  memberships: {
    id: string;
    role: "ADMIN" | "MEMBER";
    user: { id: string; name: string; email: string };
  }[];
  bankAccounts: {
    id: string;
    name: string;
    accountNo: string;
    statementUrl: string | null;
    enabled: boolean;
  }[];
};

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-[#10251b]/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className="card relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <header className="sticky top-0 bg-white z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-[#e3e9e5]">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            className="grid place-items-center size-9 rounded-lg hover:bg-[#edf1ee]"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function CreateCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={18} /> Tạo khách hàng
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo khách hàng"
      >
        <form action={createOrganizationUserAction} className="p-6 space-y-5">
          <p className="text-sm text-[#718078]">
            Tạo đồng thời hồ sơ khách hàng và tài khoản đăng nhập quản trị.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Tên khách hàng / tổ chức</label>
              <input className="input" name="organizationName" required />
            </div>
            <div>
              <label className="label">Tên người đăng nhập</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Email đăng nhập</label>
              <input className="input" type="email" name="email" required />
            </div>
            <p className="sm:col-span-2 text-sm text-[#718078]">Người quản trị đăng nhập bằng Gmail này qua Google SSO.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button className="btn btn-primary">Tạo khách hàng</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const primaryMembership =
    customer.memberships.find((item) => item.role === "ADMIN") ||
    customer.memberships[0];
  return (
    <>
      <button
        type="button"
        className="group text-left"
        onClick={() => setOpen(true)}
      >
        <span className="inline-flex items-center gap-2 font-semibold group-hover:text-[#176b46]">
          {customer.name} <Pencil size={14} />
        </span>
        <span className="block text-xs text-[#849089] mt-1">
          {customer.slug} · Bấm để sửa
        </span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Sửa khách hàng: ${customer.name}`}
      >
        {primaryMembership && (
          <form action={updateCustomerAction} className="p-6 space-y-4">
            <input type="hidden" name="organizationId" value={customer.id} />
            <input
              type="hidden"
              name="userId"
              value={primaryMembership.user.id}
            />
            <h3 className="font-semibold">Thông tin và đăng nhập</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Tên khách hàng / tổ chức</label>
                <input
                  className="input"
                  name="organizationName"
                  defaultValue={customer.name}
                  required
                />
              </div>
              <div>
                <label className="label">Tên người đăng nhập</label>
                <input
                  className="input"
                  name="name"
                  defaultValue={primaryMembership.user.name}
                  required
                />
              </div>
              <div>
                <label className="label">Email đăng nhập</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  defaultValue={primaryMembership.user.email}
                  required
                />
              </div>
              <p className="sm:col-span-2 text-sm text-[#718078]">Tài khoản sử dụng Google SSO, không có mật khẩu riêng trong hệ thống.</p>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary">Lưu thông tin</button>
            </div>
          </form>
        )}

        <div className="p-6 border-t border-[#e3e9e5]">
          <div className="flex items-center gap-2 mb-4">
            <Landmark size={18} className="text-[#176b46]" />
            <h3 className="font-semibold">Tài khoản ngân hàng MB</h3>
          </div>
          <div className="space-y-2 mb-5">
            {customer.bankAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-[#f5f7f4] px-4 py-3"
              >
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-[#718078]">
                    Số tài khoản: {account.accountNo}
                  </p>
                </div>
                <span className={`badge ${account.enabled ? "badge-green" : "badge-gray"}`}>
                  {account.enabled ? "Hoạt động" : "Đã tắt"}
                </span>
              </div>
            ))}
            {!customer.bankAccounts.length && (
              <p className="text-sm text-[#8a948e]">Chưa gán tài khoản nào.</p>
            )}
          </div>
          <form
            action={createBankAccountForOrganizationAction}
            className="grid sm:grid-cols-2 gap-4"
          >
            <input type="hidden" name="organizationId" value={customer.id} />
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
            <div className="sm:col-span-2">
              <label className="label">Link sao kê gốc trên Thiện Nguyện</label>
              <input
                className="input"
                type="url"
                name="statementUrl"
                placeholder="https://thiennguyen.app/user/...?tab=TRANSACTIONS"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button className="btn btn-soft">
                <Plus size={17} /> Gán tài khoản ngân hàng
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
