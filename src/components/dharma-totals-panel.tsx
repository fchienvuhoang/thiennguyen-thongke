"use client";

import { EditDharmaModal } from "@/components/edit-dharma-modal";
import { PublicLink } from "@/components/public-link";
import { money } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  accountNo: string;
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
};

export function DharmaTotalsPanel({
  accounts,
  dharmas,
  organizationSlug,
  selectedAccountId,
}: {
  accounts: Account[];
  dharmas: Dharma[];
  organizationSlug: string;
  selectedAccountId: string;
}) {
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const visibleDharmas = dharmas.filter(
    (dharma) => dharma.bankAccountId === selectedAccountId,
  );
  const accountStats = visibleDharmas.reduce(
    (total, dharma) => ({
      count: total.count + dharma.incomeCount,
      amount: total.amount + dharma.incomeAmount,
    }),
    { count: 0, amount: 0 },
  );

  return (
    <section id="thien-phap" className="card mb-5 scroll-mt-24">
      <div className="px-4 py-3 border-b border-[#e3e9e5]">
        <h2 className="font-semibold text-lg">Tổng thu các thiện pháp</h2>
        <p className="text-sm text-[#7a867e] mt-1">
          Tổng hợp từ các giao dịch CREDIT đã được phân loại.
        </p>
      </div>

      {selectedAccount ? (
        <>
          <div className="px-4 py-3 bg-[#f7faf8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dce6e0]">
            <p className="text-sm text-[#68756d]">
              {visibleDharmas.length} thiện pháp thuộc tài khoản{" "}
              <strong className="text-[#244b37]">
                {selectedAccount.accountNo}
              </strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-gray">
                {accountStats.count.toLocaleString("vi-VN")} giao dịch thu
              </span>
              <span className="badge badge-green">
                Tổng thu {money.format(accountStats.amount)}
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thiện pháp</th>
                  <th>Mã chính</th>
                  <th>Mã phụ</th>
                  <th>Giao dịch</th>
                  <th className="text-right">Tổng thu</th>
                  <th>Link công khai</th>
                  <th>Quản lý</th>
                </tr>
              </thead>
              <tbody>
                {visibleDharmas.map((dharma) => (
                  <tr key={dharma.id}>
                    <td className="font-medium">{dharma.name}</td>
                    <td>
                      <span className="badge badge-green">{dharma.code}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {dharma.aliases.length ? (
                          dharma.aliases.map((alias) => (
                            <span key={alias} className="badge badge-gray">
                              {alias}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#9aa39d]">—</span>
                        )}
                      </div>
                    </td>
                    <td>{dharma.incomeCount}</td>
                    <td className="text-right font-semibold text-[#176b46] whitespace-nowrap">
                      {money.format(dharma.incomeAmount)}
                    </td>
                    <td>
                      <PublicLink
                        compact
                        href={`/minh-bach/${organizationSlug}/${dharma.publicSlug}`}
                      />
                    </td>
                    <td>
                      <EditDharmaModal
                        dharma={{
                          id: dharma.id,
                          name: dharma.name,
                          code: dharma.code,
                          aliases: dharma.aliases,
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {!visibleDharmas.length && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#7a867e]">
                      Chưa có thiện pháp cho tài khoản này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-center py-10 text-sm text-[#7a867e]">
          Chưa có tài khoản nguồn.
        </p>
      )}
    </section>
  );
}
