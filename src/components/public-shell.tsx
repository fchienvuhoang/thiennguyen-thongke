import Link from "next/link";
import { Leaf } from "lucide-react";

export function PublicShell({ children, organizationName, homeHref }: { children: React.ReactNode; organizationName: string; homeHref: string }) {
  return <div className="min-h-screen bg-[#f5f7f4]">
    <header className="bg-[#123f2c] text-white"><div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-4"><Link href={homeHref} className="flex items-center gap-3"><span className="grid place-items-center size-10 rounded-xl bg-white/10"><Leaf size={21}/></span><div><p className="font-semibold">{organizationName}</p><p className="text-[10px] tracking-widest text-white/55">MINH BẠCH THIỆN PHÁP</p></div></Link><span className="badge bg-white/10 text-white">Dữ liệu công khai</span></div></header>
    <main className="max-w-6xl mx-auto px-5 py-8 md:py-12">{children}</main>
    <footer className="max-w-6xl mx-auto px-5 py-8 text-center text-xs text-[#7a867e] border-t border-[#dfe6e1]">Dữ liệu được đồng bộ từ tài khoản thiện nguyện minh bạch và cập nhật tự động.</footer>
  </div>;
}
