"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { dateTime, money } from "@/lib/format";

type Account = { id: string; accountNo: string };
type Dharma = {
  id: string;
  name: string;
  bankAccountId: string;
  transactionCount: number;
};
type Transaction = {
  id: string;
  bankAccountId: string;
  dharmaId: string | null;
  type: "CREDIT" | "DEBIT";
  amount: number;
  transactionTime: string;
  narrative: string;
  displayName: string | null;
  refId: string | null;
  manuallyClassified: boolean;
  classifiedByEmail: string | null;
  classifiedAt: string | null;
  bankAccount: { accountNo: string };
  classificationLogs: Array<{
    id: string;
    source: "AUTO_SYNC" | "AUTO_RECLASSIFY" | "MANUAL";
    actorEmail: string | null;
    previousDharmaName: string | null;
    newDharmaName: string | null;
    createdAt: string;
  }>;
};
type ApiResult = {
  data: Transaction[];
  meta: {
    tab: string;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  counts: {
    all: number;
    unmatched: number;
    byDharma: Record<string, number>;
  };
};
type Filters = {
  tab: string;
  type: "ALL" | "CREDIT" | "DEBIT";
  account: string;
  page: number;
};

function queryString(filters: Filters) {
  const params = new URLSearchParams({ tab: filters.tab });
  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.account) params.set("account", filters.account);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function TransactionsPanel({
  accounts,
  dharmas,
  initialFilters,
  initialCounts,
}: {
  accounts: Account[];
  dharmas: Dharma[];
  initialFilters: Partial<Filters>;
  initialCounts: { all: number; unmatched: number };
}) {
  const validInitialTab =
    initialFilters.tab === "unmatched" ||
    initialFilters.tab === "all" ||
    dharmas.some((dharma) => dharma.id === initialFilters.tab)
      ? initialFilters.tab || "all"
      : "all";
  const [filters, setFilters] = useState<Filters>({
    tab: validInitialTab,
    type:
      initialFilters.type === "CREDIT" || initialFilters.type === "DEBIT"
        ? initialFilters.type
        : "ALL",
    account: initialFilters.account || "",
    page: Math.max(1, initialFilters.page || 1),
  });
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const interacted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = queryString(filters);
    if (interacted.current) {
      window.history.replaceState(null, "", `/dashboard?${query}#giao-dich`);
    }
    fetch(`/api/dashboard/transactions?${query}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return null;
        }
        const payload = (await response.json()) as ApiResult & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Không thể tải giao dịch");
        return payload;
      })
      .then((payload) => {
        if (payload) setResult(payload);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError")
          return;
        setError(fetchError instanceof Error ? fetchError.message : "Không thể tải giao dịch");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, revision]);

  function changeFilters(next: Partial<Filters>) {
    interacted.current = true;
    setLoading(true);
    setError("");
    setFilters((current) => ({ ...current, ...next }));
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const type = String(formData.get("type") || "ALL") as Filters["type"];
    const account = String(formData.get("account") || "");
    changeFilters({ type, account, page: 1 });
  }

  async function handleClassification(
    event: FormEvent<HTMLFormElement>,
    transactionId: string,
  ) {
    event.preventDefault();
    const dharmaId = String(new FormData(event.currentTarget).get("dharmaId") || "");
    setAssigningId(transactionId);
    setError("");
    try {
      const response = await fetch(`/api/dashboard/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ dharmaId }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể phân loại giao dịch");
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (classificationError) {
      setError(
        classificationError instanceof Error
          ? classificationError.message
          : "Không thể phân loại giao dịch",
      );
    } finally {
      setAssigningId(null);
    }
  }

  const counts = result?.counts || {
    all: initialCounts.all,
    unmatched: initialCounts.unmatched,
    byDharma: Object.fromEntries(
      dharmas.map((dharma) => [dharma.id, dharma.transactionCount]),
    ),
  };
  const transactions = result?.data || [];
  const meta = result?.meta || {
    tab: filters.tab,
    page: filters.page,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  };

  return (
    <section id="giao-dich" className="card scroll-mt-24">
      <div className="px-4 py-3 border-b border-[#e3e9e5]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Các giao dịch</h2>
            <p className="text-sm text-[#7a867e] mt-1">
              {loading && !result
                ? "Đang tải dữ liệu..."
                : `${meta.total.toLocaleString("vi-VN")} kết quả · trang ${meta.page}/${meta.totalPages}.`}
            </p>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={handleFilter}>
            <select className="input w-auto" name="type" defaultValue={filters.type}>
              <option value="ALL">Tất cả thu/chi</option>
              <option value="CREDIT">Khoản thu</option>
              <option value="DEBIT">Khoản chi</option>
            </select>
            <select className="input w-auto" name="account" defaultValue={filters.account}>
              <option value="">Mọi tài khoản</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.accountNo}</option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? <><LoaderCircle size={15} className="animate-spin" /> Đang tải...</> : "Lọc"}
            </button>
          </form>
        </div>
        <nav className="flex gap-2 overflow-x-auto mt-5 pb-1" aria-label="Phân loại giao dịch">
          <button
            type="button"
            disabled={loading}
            onClick={() => changeFilters({ tab: "all", page: 1 })}
            className={`btn py-2 whitespace-nowrap ${filters.tab === "all" ? "btn-primary" : "btn-soft"}`}
          >
            {loading && filters.tab === "all" && <LoaderCircle size={15} className="animate-spin" />}
            Tất cả <span className="text-xs opacity-75">{counts.all.toLocaleString("vi-VN")}</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => changeFilters({ tab: "unmatched", page: 1 })}
            className={`btn py-2 whitespace-nowrap border border-[#efc56f] ${filters.tab === "unmatched" ? "bg-[#d99a24] text-white" : "bg-[#fff1d7] text-[#8a590d]"}`}
          >
            {loading && filters.tab === "unmatched" ? <LoaderCircle size={15} className="animate-spin" /> : <TriangleAlert size={15} />}
            Chưa phân loại <span className="text-xs opacity-80">{counts.unmatched.toLocaleString("vi-VN")}</span>
          </button>
          {dharmas.map((dharma) => (
            <button
              type="button"
              disabled={loading}
              key={dharma.id}
              onClick={() => changeFilters({ tab: dharma.id, page: 1 })}
              className={`btn py-2 whitespace-nowrap ${filters.tab === dharma.id ? "btn-primary" : "btn-soft"}`}
            >
              {loading && filters.tab === dharma.id && <LoaderCircle size={15} className="animate-spin" />}
              {dharma.name}
              <span className="text-xs opacity-75">{(counts.byDharma[dharma.id] || 0).toLocaleString("vi-VN")}</span>
            </button>
          ))}
        </nav>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
      <div className={`table-wrap transition-opacity ${loading && result ? "opacity-55" : "opacity-100"}`} aria-busy={loading}>
        <table>
          <thead><tr><th>Thời gian / Loại</th><th>Nội dung</th><th>Thiện pháp / Phân loại thủ công</th><th className="text-right">Số tiền</th></tr></thead>
          <tbody>
            {loading && !result ? (
              <tr><td colSpan={4} className="text-center py-12 text-[#7a867e]"><LoaderCircle className="animate-spin inline mr-2" size={18} />Đang tải giao dịch...</td></tr>
            ) : transactions.length ? transactions.map((transaction) => {
              const options = dharmas.filter((dharma) => dharma.bankAccountId === transaction.bankAccountId);
              return (
                <tr key={transaction.id}>
                  <td className="whitespace-nowrap">
                    <p>{dateTime.format(new Date(transaction.transactionTime))}</p>
                    <span className={`badge mt-2 ${transaction.type === "CREDIT" ? "badge-green" : "bg-red-50 text-red-700"}`}>{transaction.type === "CREDIT" ? "THU" : "CHI"}</span>
                    <span className="text-xs text-[#7a867e] ml-2">TK {transaction.bankAccount.accountNo}</span>
                  </td>
                  <td className="max-w-xl">
                    <p className="line-clamp-2">{transaction.narrative}</p>
                    <p className="text-xs text-[#8a948e] mt-1">{transaction.displayName || transaction.refId}</p>
                  </td>
                  <td>
                    <form onSubmit={(event) => handleClassification(event, transaction.id)} className="flex gap-2 min-w-72">
                      <select className="input py-2" name="dharmaId" defaultValue={transaction.dharmaId || ""} disabled={assigningId === transaction.id}>
                        <option value="">Chưa phân loại</option>
                        {options.map((dharma) => <option key={dharma.id} value={dharma.id}>{dharma.name}</option>)}
                      </select>
                      <button className="btn btn-soft py-2" disabled={assigningId !== null || loading}>
                        {assigningId === transaction.id ? <><LoaderCircle size={15} className="animate-spin" /> Đang gán...</> : "Gán"}
                      </button>
                    </form>
                    <div className="mt-2">
                      {transaction.manuallyClassified ? (
                        <span className="badge badge-green">Thủ công · {transaction.classifiedByEmail || "Tài khoản cũ"}</span>
                      ) : transaction.dharmaId ? (
                        <span className="badge badge-gray">Hệ thống tự động gán</span>
                      ) : (
                        <span className="badge badge-amber">Hệ thống chưa nhận diện</span>
                      )}
                      {transaction.classifiedAt && <span className="block text-[11px] text-[#7a867e] mt-1">{dateTime.format(new Date(transaction.classifiedAt))}</span>}
                    </div>
                    {transaction.classificationLogs.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-[#176b46] font-medium">Lịch sử phân loại ({transaction.classificationLogs.length} gần nhất)</summary>
                        <div className="mt-2 space-y-2 border-l-2 border-[#dfe6e1] pl-3">
                          {transaction.classificationLogs.map((log) => (
                            <div key={log.id}>
                              <p className="font-medium">{log.source === "MANUAL" ? `Thủ công · ${log.actorEmail || "Không rõ tài khoản"}` : "Hệ thống tự động"}</p>
                              <p className="text-[#68756d]">{log.previousDharmaName || "Chưa phân loại"} → {log.newDharmaName || "Chưa phân loại"}</p>
                              <p className="text-[#8a948e]">{dateTime.format(new Date(log.createdAt))}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className={`text-right font-semibold whitespace-nowrap ${transaction.type === "CREDIT" ? "text-[#176b46]" : "text-red-700"}`}>
                    {transaction.type === "CREDIT" ? "+" : "−"}{money.format(transaction.amount)}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={4} className="text-center py-12 text-[#7a867e]">Không có giao dịch phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {meta.totalPages > 1 && (
        <div className="p-4 border-t border-[#e3e9e5] flex items-center justify-between gap-3">
          <button type="button" className="btn btn-soft py-2" disabled={loading || meta.page <= 1} onClick={() => changeFilters({ page: meta.page - 1 })}>← Trang trước</button>
          <span className="text-sm text-[#68756d]">{loading && <LoaderCircle size={14} className="animate-spin inline mr-2" />}Trang {meta.page} / {meta.totalPages}</span>
          <button type="button" className="btn btn-soft py-2" disabled={loading || meta.page >= meta.totalPages} onClick={() => changeFilters({ page: meta.page + 1 })}>Trang sau →</button>
        </div>
      )}
    </section>
  );
}
