"use client";

import { FormEvent, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type TransactionType = "CREDIT" | "DEBIT";

export function PublicDateFilter({
  activeType,
  fromDate,
  toDate,
}: {
  activeType?: TransactionType;
  fromDate?: string;
  toDate?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(fromDate || "");
  const [to, setTo] = useState(toDate || "");

  function filteredHref(nextFrom?: string, nextTo?: string) {
    const params = new URLSearchParams();
    if (activeType) params.set("type", activeType);
    if (nextFrom && nextTo) {
      params.set("from", nextFrom);
      params.set("to", nextTo);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let nextFrom = from || to;
    let nextTo = to || from;
    if (!nextFrom || !nextTo) {
      startTransition(() => router.push(filteredHref(), { scroll: false }));
      return;
    }
    if (nextFrom > nextTo) [nextFrom, nextTo] = [nextTo, nextFrom];
    setFrom(nextFrom);
    setTo(nextTo);
    startTransition(() =>
      router.push(filteredHref(nextFrom, nextTo), { scroll: false }),
    );
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    startTransition(() => router.push(filteredHref(), { scroll: false }));
  }

  return (
    <form
      className="p-4 border-b border-[#e3e9e5] bg-[#f7faf8]"
      onSubmit={applyFilter}
      aria-busy={isPending}
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div>
          <p className="text-sm font-semibold text-[#33483c]">Lọc theo ngày</p>
          <p className="text-xs text-[#7a867e] mt-1">
            Chỉ chọn một ô để lọc đúng một ngày, hoặc chọn cả hai để lọc theo
            khoảng.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
          <label className="text-xs font-medium text-[#536158]">
            <span className="block mb-1">Từ ngày</span>
            <input
              className="input py-2 w-auto"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="text-xs font-medium text-[#536158]">
            <span className="block mb-1">Đến ngày</span>
            <input
              className="input py-2 w-auto"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              disabled={isPending}
            />
          </label>
          <button className="btn btn-primary py-2" disabled={isPending}>
            {isPending && <LoaderCircle size={15} className="animate-spin" />}
            Áp dụng
          </button>
          {(fromDate || toDate) && (
            <button
              type="button"
              className="btn btn-soft py-2"
              onClick={clearFilter}
              disabled={isPending}
            >
              Tất cả ngày
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
