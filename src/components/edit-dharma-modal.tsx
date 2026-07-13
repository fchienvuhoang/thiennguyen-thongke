"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Pencil, X } from "lucide-react";
import {
  DharmaOperationProgress,
  type DharmaProgressStage,
} from "@/components/dharma-operation-progress";
import { DeleteDharmaForm } from "@/components/delete-dharma-form";

type Progress = "idle" | DharmaProgressStage;

export function EditDharmaModal({
  dharma,
}: {
  dharma: { id: string; name: string; code: string; aliases: string[] };
}) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Progress>("idle");
  const [error, setError] = useState("");
  const busy = progress !== "idle";
  const buttonLabel = {
    idle: "Lưu thay đổi",
    saving: "Đang lưu thay đổi...",
    reclassifying: "Đang phân loại lại giao dịch...",
    refreshing: "Đang cập nhật giao diện...",
  }[progress];

  function showModal() {
    setError("");
    setProgress("idle");
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setProgress("saving");
    try {
      const updateResponse = await fetch(`/api/dashboard/dharmas/${dharma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          code: String(formData.get("code") || ""),
          aliases: String(formData.get("aliases") || ""),
        }),
      });
      const updated = (await updateResponse.json()) as { error?: string };
      if (!updateResponse.ok)
        throw new Error(updated.error || "Không thể lưu thay đổi");

      setProgress("reclassifying");
      const reclassifyResponse = await fetch(
        `/api/dashboard/dharmas/${dharma.id}/reclassify`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        },
      );
      const reclassified = (await reclassifyResponse.json()) as { error?: string };
      if (!reclassifyResponse.ok)
        throw new Error(
          reclassified.error || "Đã lưu nhưng chưa thể phân loại lại giao dịch",
        );

      setProgress("refreshing");
      window.setTimeout(() => {
        window.history.replaceState(null, "", "/dashboard#thien-phap");
        window.location.reload();
      }, 100);
    } catch (submitError) {
      setProgress("idle");
      setError(
        submitError instanceof DOMException && submitError.name === "TimeoutError"
          ? "Xử lý quá 30 giây. Vui lòng thử lại."
          : submitError instanceof Error
            ? submitError.message
            : "Không thể lưu thay đổi",
      );
    }
  }

  return (
    <>
      <button type="button" className="btn btn-soft py-1.5" onClick={showModal}>
        <Pencil size={14} /> Sửa
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng"
            disabled={busy}
            className="absolute inset-0 bg-[#10251b]/55 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="card relative z-10 w-full max-w-xl shadow-2xl overflow-hidden">
            <header className="flex items-center justify-between bg-white px-5 py-3 border-b border-[#e3e9e5]">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#8a641e]">QUẢN LÝ THIỆN PHÁP</p>
                <h2 className="font-semibold mt-0.5">Sửa {dharma.name}</h2>
              </div>
              <button type="button" disabled={busy} className="grid place-items-center size-8 rounded-lg hover:bg-[#edf1ee] disabled:opacity-40" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleSubmit} className="grid gap-3 p-5">
              <div><label className="label">Tên thiện pháp</label><input className="input" name="name" required disabled={busy} defaultValue={dharma.name} /></div>
              <div><label className="label">Mã chính</label><input className="input" name="code" required disabled={busy} defaultValue={dharma.code} /></div>
              <div><label className="label">Mã phụ</label><input className="input" name="aliases" disabled={busy} defaultValue={dharma.aliases.join(", ")} /></div>
              {busy && (
                <DharmaOperationProgress
                  stage={progress as DharmaProgressStage}
                  savingLabel="Lưu thông tin và bộ từ khóa mới"
                />
              )}
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full">
                {busy && <LoaderCircle size={16} className="animate-spin" />}
                {buttonLabel}
              </button>
            </form>
            {!busy && (
              <div className="px-5 py-3 border-t border-[#e3e9e5] bg-[#fafbfa] flex justify-end">
                <DeleteDharmaForm id={dharma.id} name={dharma.name} />
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
