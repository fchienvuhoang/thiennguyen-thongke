"use client";

import { Trash2 } from "lucide-react";
import { deleteDharmaAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function DeleteDharmaForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteDharmaAction}
      onSubmit={(event) => {
        if (!window.confirm(`Xóa thiện pháp “${name}”? Các giao dịch sẽ chuyển về Chưa phân loại.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingText="Đang xóa..." className="btn bg-red-50 text-red-700 hover:bg-red-100">
        <Trash2 size={15} /> Xóa
      </SubmitButton>
    </form>
  );
}
