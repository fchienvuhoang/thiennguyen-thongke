"use client";

import { LoaderCircle, Plus, Users, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { createCustomerUserAction } from "@/app/actions";
import { DharmaOperationProgress } from "@/components/dharma-operation-progress";
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
  disableClose = false,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  disableClose?: boolean;
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
        disabled={disableClose}
      />
      <section className="card relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-3 border-b border-[#e3e9e5]">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" disabled={disableClose} className="grid place-items-center size-8 rounded-lg hover:bg-[#edf1ee] disabled:opacity-40" onClick={onClose}>
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
  const [dharmaProgress, setDharmaProgress] = useState<
    "idle" | "creating" | "reclassifying" | "refreshing"
  >("idle");
  const [dharmaError, setDharmaError] = useState("");
  const dharmaBusy = dharmaProgress !== "idle";
  const progressMessage = {
    idle: "Tạo thiện pháp",
    creating: "Bước 1/3 · Đang lưu thiện pháp vào cơ sở dữ liệu...",
    reclassifying: "Bước 2/3 · Đang quét và phân loại lại giao dịch...",
    refreshing: "Bước 3/3 · Đang cập nhật danh sách và số liệu...",
  }[dharmaProgress];
  const progressStage = {
    idle: "saving",
    creating: "saving",
    reclassifying: "reclassifying",
    refreshing: "refreshing",
  } as const;

  async function handleCreateDharma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setDharmaError("");
    setDharmaProgress("creating");
    try {
      const createResponse = await fetch("/api/dashboard/dharmas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          bankAccountId: String(formData.get("bankAccountId") || ""),
          name: String(formData.get("name") || ""),
          code: String(formData.get("code") || ""),
          aliases: String(formData.get("aliases") || ""),
        }),
      });
      const created = (await createResponse.json()) as {
        data?: { id: string };
        error?: string;
      };
      if (!createResponse.ok || !created.data)
        throw new Error(created.error || "Không thể tạo thiện pháp");

      setDharmaProgress("reclassifying");
      const reclassifyResponse = await fetch(
        `/api/dashboard/dharmas/${created.data.id}/reclassify`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        },
      );
      const reclassified = (await reclassifyResponse.json()) as {
        data?: { scanned: number; updated: number };
        error?: string;
      };
      if (!reclassifyResponse.ok)
        throw new Error(
          reclassified.error || "Đã tạo thiện pháp nhưng chưa thể phân loại lại",
        );

      setDharmaProgress("refreshing");
      window.setTimeout(() => {
        window.history.replaceState(null, "", "/dashboard#thien-phap");
        window.location.reload();
      }, 100);
    } catch (error) {
      setDharmaProgress("idle");
      setDharmaError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "Xử lý quá 30 giây. Vui lòng thử lại."
          : error instanceof Error
            ? error.message
            : "Không thể tạo thiện pháp",
      );
    }
  }

  function openDharmaModal() {
    setDharmaError("");
    setDharmaProgress("idle");
    setDharmaOpen(true);
  }
  return (
    <>
      <button type="button" className="btn btn-soft" onClick={openDharmaModal}>
        <Plus size={16} /> Thêm thiện pháp
      </button>
      <button type="button" className="btn btn-soft" onClick={() => setMembersOpen(true)}>
        <Users size={16} /> Thành viên
      </button>

      <Modal title="Thêm thiện pháp" open={dharmaOpen} disableClose={dharmaBusy} onClose={() => setDharmaOpen(false)}>
        <form onSubmit={handleCreateDharma} className="grid sm:grid-cols-2 gap-3 p-5">
          <select className="input" name="bankAccountId" required disabled={dharmaBusy}>
            <option value="">Chọn tài khoản</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} — {account.accountNo}</option>
            ))}
          </select>
          <input className="input" name="name" required disabled={dharmaBusy} placeholder="Tên thiện pháp" />
          <input className="input" name="code" required disabled={dharmaBusy} placeholder="Mã chính" />
          <input className="input" name="aliases" disabled={dharmaBusy} placeholder="Mã phụ, cách nhau dấu phẩy" />
          {dharmaBusy && (
            <DharmaOperationProgress
              stage={progressStage[dharmaProgress]}
              savingLabel="Lưu thiện pháp mới vào cơ sở dữ liệu"
            />
          )}
          {dharmaError && (
            <div className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {dharmaError}
            </div>
          )}
          <button type="submit" disabled={dharmaBusy} className="btn btn-primary sm:col-span-2">
            {dharmaBusy && <LoaderCircle size={16} className="animate-spin" />}
            {progressMessage}
          </button>
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
