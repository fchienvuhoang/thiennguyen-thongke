"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { DharmaTotalsPanel } from "@/components/dharma-totals-panel";
import { TransactionsPanel } from "@/components/transactions-panel";
import { money } from "@/lib/format";

type Account = {
  id: string;
  accountNo: string;
  name: string;
  income: number;
  expense: number;
  transactionCount: number;
  unmatched: number;
};

type Dharma = {
  id: string;
  bankAccountId: string;
  name: string;
  code: string;
  aliases: string[];
  publicSlug: string;
  incomeCount: number;
  incomeAmount: number;
  transactionCount: number;
};

type InitialFilters = {
  tab: string;
  type: "ALL" | "CREDIT" | "DEBIT";
  account: string;
  page: number;
};

export function DashboardDataPanels({
  accounts,
  dharmas,
  organizationSlug,
  initialAccountId,
  initialFilters,
}: {
  accounts: Account[];
  dharmas: Dharma[];
  organizationSlug: string;
  initialAccountId: string;
  initialFilters: InitialFilters;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.some((account) => account.id === initialAccountId)
      ? initialAccountId
      : accounts[0]?.id || "",
  );
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );

  function selectAccount(accountId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("account", accountId);
    url.searchParams.set("tab", "all");
    url.searchParams.delete("page");
    url.hash = "";
    window.history.replaceState(null, "", url);
    setSelectedAccountId(accountId);
  }

  const cards = selectedAccount
    ? [
        [
          "Tổng thu",
          money.format(selectedAccount.income),
          ArrowDownLeft,
          "bg-[#e7f3ed] text-[#176b46]",
        ],
        [
          "Tổng chi",
          money.format(selectedAccount.expense),
          ArrowUpRight,
          "bg-[#fff0e9] text-[#ad5b36]",
        ],
        [
          "Số dư thu − chi",
          money.format(selectedAccount.income - selectedAccount.expense),
          ReceiptText,
          "bg-[#edf1f7] text-[#48617e]",
        ],
        [
          "Chưa phân loại",
          selectedAccount.unmatched.toLocaleString("vi-VN"),
          TriangleAlert,
          "bg-[#fff1d7] text-[#9a6412]",
        ],
      ] as const
    : [];

  return (
    <>
      <section className="card px-4 py-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#68756d]">
          Tài khoản nguồn đang xem
        </p>
        {accounts.length ? (
          <div
            className="flex gap-2 overflow-x-auto mt-2 pb-0.5"
            role="tablist"
            aria-label="Tài khoản nguồn dùng chung"
          >
            {accounts.map((account) => (
              <button
                type="button"
                role="tab"
                aria-selected={selectedAccountId === account.id}
                key={account.id}
                onClick={() => selectAccount(account.id)}
                className={`btn py-2.5 whitespace-nowrap border ${
                  selectedAccountId === account.id
                    ? "btn-primary border-[#176b46]"
                    : "bg-white text-[#33483c] border-[#d8e0da]"
                }`}
              >
                <span>{account.name}</span>
                <span className="text-xs opacity-75">TK {account.accountNo}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#7a867e] mt-2">Chưa có tài khoản nguồn.</p>
        )}
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {cards.map(([label, value, Icon, color]) => (
          <div className="card px-4 py-3 flex items-center gap-3" key={label}>
            <div className={`size-9 shrink-0 rounded-xl grid place-items-center ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[#718078] text-xs">{label}</p>
              <p className="text-lg font-semibold leading-tight mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </section>

      <DharmaTotalsPanel
        accounts={accounts}
        dharmas={dharmas}
        organizationSlug={organizationSlug}
        selectedAccountId={selectedAccountId}
      />

      <TransactionsPanel
        key={selectedAccountId}
        accounts={accounts}
        dharmas={dharmas}
        initialFilters={{
          ...initialFilters,
          account: selectedAccountId,
          ...(selectedAccountId === initialAccountId
            ? {}
            : { tab: "all", page: 1 }),
        }}
        initialCounts={{
          all: selectedAccount?.transactionCount || 0,
          unmatched: selectedAccount?.unmatched || 0,
        }}
      />
    </>
  );
}
