"use client";

import { Plus, Users, X } from "lucide-react";
import { useState } from "react";
import {
  createCustomerUserAction,
  createDharmaAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  accounts: { id: string; name: string; accountNo: string }[];
  members: {
    id: string;
    role: "ADMIN" | "MEMBER";
    user: { name: string; email: string; googleSubject: string | null };
  }[];
  canManageMembers: boolean;
};

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
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
        <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-3 border-b border-[#e3e9e5]">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="grid place-items-center size-8 rounded-lg hover:bg-[#edf1ee]" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function OrganizationManagementModals({
  accounts,
  members,
  canManageMembers,
}: Props) {
  const [dharmaOpen, setDharmaOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-soft" onClick={() => setDharmaOpen(true)}>
        <Plus size={16} /> Thêm thiện pháp
      </button>
      <button type="button" className="btn btn-soft" onClick={() => setMembersOpen(true)}>
        <Users size={16} /> Thành viên
      </button>

      <Modal title="Thêm thiện pháp" open={dharmaOpen} onClose={() => setDharmaOpen(false)}>
        <form action={createDharmaAction} className="grid sm:grid-cols-2 gap-3 p-5">
          <select className="input" name="bankAccountId" required>
            <option value="">Chọn tài khoản</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} — {account.accountNo}</option>
            ))}
          </select>
          <input className="input" name="name" required placeholder="Tên thiện pháp" />
          <input className="input" name="code" required placeholder="Mã chính" />
          <input className="input" name="aliases" placeholder="Mã phụ, cách nhau dấu phẩy" />
          <SubmitButton pendingText="Đang tạo..." className="btn btn-primary sm:col-span-2">Tạo thiện pháp</SubmitButton>
        </form>
      </Modal>

      <Modal title="Thành viên tổ chức" open={membersOpen} onClose={() => setMembersOpen(false)}>
        <div className="divide-y divide-[#e3e9e5]">
          <div className="p-5 space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f7f4] px-4 py-2.5">
                <div><p className="font-medium text-sm">{member.user.name}</p><p className="text-xs text-[#718078]">{member.user.email}</p></div>
                <div className="flex gap-1"><span className="badge badge-gray">{member.role === "ADMIN" ? "Quản trị" : "Thành viên"}</span><span className={`badge ${member.user.googleSubject ? "badge-green" : "badge-gray"}`}>{member.user.googleSubject ? "Đã liên kết" : "Chưa đăng nhập"}</span></div>
              </div>
            ))}
          </div>
          {canManageMembers && (
            <form action={createCustomerUserAction} className="grid sm:grid-cols-2 gap-3 p-5">
              <input className="input" name="name" required placeholder="Tên thành viên" />
              <input className="input" type="email" name="email" required placeholder="email@gmail.com" />
              <select className="input" name="role" defaultValue="MEMBER"><option value="MEMBER">Thành viên</option><option value="ADMIN">Quản trị tổ chức</option></select>
              <SubmitButton pendingText="Đang thêm..." className="btn btn-primary">Thêm tài khoản SSO</SubmitButton>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
