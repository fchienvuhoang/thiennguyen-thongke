"use client";

import Link from "next/link";
import { Leaf, LogOut, Users } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function Sidebar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  return <header className="sticky top-0 z-30 border-b border-[#dfe6e1] bg-white/95 backdrop-blur">
    <div className="max-w-[1440px] mx-auto h-18 px-5 md:px-8 lg:px-10 flex items-center justify-between gap-4">
      <Link href={isAdmin ? "/dashboard/admin" : "/dashboard"} className="flex items-center gap-3"><span className="grid place-items-center size-10 rounded-xl bg-[#176b46] text-white"><Leaf size={21}/></span><div><p className="font-semibold">Thiện Pháp</p><p className="hidden sm:block text-[10px] text-[#77827b] tracking-wider">{isAdmin ? "QUẢN TRỊ HỆ THỐNG" : "QUẢN LÝ MINH BẠCH"}</p></div></Link>
      <div className="flex items-center gap-2">
        {isAdmin && <span className="hidden sm:inline-flex items-center gap-2 text-sm text-[#176b46] font-medium px-3"><Users size={16}/> Quản lý khách hàng</span>}
        <span className="hidden md:inline text-sm text-[#68756d] px-2">{name}</span>
        <form action={logoutAction}><SubmitButton pendingText={null} title="Đăng xuất" className="btn bg-[#f0f3f1] text-[#536158]"><LogOut size={16}/></SubmitButton></form>
      </div>
    </div>
  </header>;
}
