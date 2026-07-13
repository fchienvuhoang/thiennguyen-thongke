"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";

export function PendingLink({
  href,
  className,
  children,
  pendingText = "Đang tải...",
}: {
  href: string;
  className?: string;
  children: ReactNode;
  pendingText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (pending) return;
    startTransition(() => router.push(href));
  }

  return (
    <a
      href={href}
      className={`${className || ""} ${pending ? "pointer-events-none opacity-65" : ""}`}
      onClick={navigate}
      aria-busy={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin shrink-0" size={15} />
          {pendingText}
        </>
      ) : (
        children
      )}
    </a>
  );
}
