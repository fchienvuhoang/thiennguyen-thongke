"use client";

import { Check, Circle, LoaderCircle } from "lucide-react";

export type DharmaProgressStage =
  | "saving"
  | "reclassifying"
  | "refreshing";

export function DharmaOperationProgress({
  stage,
  savingLabel,
}: {
  stage: DharmaProgressStage;
  savingLabel: string;
}) {
  const steps = [
    savingLabel,
    "Đối chiếu từ khóa và phân loại lại giao dịch",
    "Cập nhật danh sách, tổng tiền và số lượng",
  ];
  const current = { saving: 0, reclassifying: 1, refreshing: 2 }[stage];

  return (
    <div
      className="sm:col-span-2 rounded-2xl border border-[#cfe1d7] bg-gradient-to-br from-[#f3f8f5] to-white p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#176b46]">
          <LoaderCircle size={17} className="animate-spin" />
          Đang xử lý · Bước {current + 1}/3
        </div>
        <span className="text-xs text-[#718078]">
          {Math.round(((current + 1) / 3) * 100)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#dfeae4] overflow-hidden mt-3">
        <div
          className="h-full rounded-full bg-[#2d8a5f] transition-all duration-500"
          style={{ width: `${((current + 1) / 3) * 100}%` }}
        />
      </div>
      <div className="space-y-2.5 mt-4">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 text-sm ${
              index <= current ? "text-[#1f4936]" : "text-[#98a39c]"
            }`}
          >
            {index < current ? (
              <span className="size-5 rounded-full bg-[#dcefe4] text-[#176b46] grid place-items-center">
                <Check size={13} strokeWidth={3} />
              </span>
            ) : index === current ? (
              <LoaderCircle size={20} className="animate-spin text-[#2d8a5f]" />
            ) : (
              <Circle size={20} className="text-[#cbd4ce]" />
            )}
            <span className={index === current ? "font-medium" : ""}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
