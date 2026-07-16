"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyTransaction = {
  transactionTime: string;
  displayName: string | null;
  narrative: string;
  amount: number;
};

function cleanCell(value: string) {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

export function CopyTransactionsButton({
  transactions,
}: {
  transactions: CopyTransaction[];
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyForExcel() {
    const text = transactions
      .map((item, index) =>
        [
          index + 1,
          formatDateTime(item.transactionTime),
          cleanCell(item.displayName || ""),
          cleanCell(item.narrative),
          item.amount,
        ].join("\t"),
      )
      .join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <button
      type="button"
      className="btn btn-soft inline-flex items-center gap-2"
      onClick={copyForExcel}
      disabled={!transactions.length}
      title="Sao chép các dòng đang hiển thị để dán vào Excel"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Đã sao chép" : "Sao chép cho Excel"}
    </button>
  );
}
