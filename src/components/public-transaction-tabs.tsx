"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

type TransactionType = "CREDIT" | "DEBIT";

const tabs: { label: string; type?: TransactionType }[] = [
  { label: "Tất cả" },
  { label: "Thu", type: "CREDIT" },
  { label: "Chi", type: "DEBIT" },
];

export function PublicTransactionTabs({
  activeType,
}: {
  activeType?: TransactionType;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function href(type?: TransactionType) {
    return type ? `${pathname}?type=${type}` : pathname;
  }

  useEffect(() => {
    for (const tab of tabs) {
      router.prefetch(tab.type ? `${pathname}?type=${tab.type}` : pathname);
    }
  }, [pathname, router]);

  return (
    <div className="flex items-center gap-2" aria-busy={isPending}>
      {isPending && (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#718078]">
          <LoaderCircle className="animate-spin" size={15} /> Đang tải
        </span>
      )}
      {tabs.map((tab) => {
        const active = activeType === tab.type;
        return (
          <button
            key={tab.label}
            type="button"
            disabled={isPending || active}
            className={`btn ${active ? "btn-primary" : "btn-soft"} disabled:cursor-wait disabled:opacity-70`}
            onClick={() =>
              startTransition(() => {
                router.push(href(tab.type), { scroll: false });
              })
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
