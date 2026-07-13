"use client";

import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

export function PublicLink({ href, compact = false }: { href: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <div className={`flex items-center gap-2 ${compact ? "mt-4" : ""}`}>
    <Link href={href} target="_blank" className={`${compact ? "text-xs" : "text-sm"} text-[#176b46] font-medium hover:underline inline-flex items-center gap-1.5`}><ExternalLink size={compact ? 13 : 15}/> Xem trang công khai</Link>
    <button type="button" onClick={copy} title="Sao chép link" className="grid place-items-center size-8 rounded-lg bg-[#eaf3ee] text-[#176b46]">{copied ? <Check size={14}/> : <Copy size={14}/>}</button>
  </div>;
}
