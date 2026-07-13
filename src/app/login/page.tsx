import { Leaf } from "lucide-react";
import { loginAction } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen grid lg:grid-cols-2 bg-white">
    <section className="hidden lg:flex relative overflow-hidden bg-[#114c32] text-white p-16 flex-col justify-between">
      <div className="absolute inset-0 opacity-20" style={{backgroundImage:"radial-gradient(circle at 20% 20%, #d9a441 0, transparent 32%), radial-gradient(circle at 80% 80%, #7eb796 0, transparent 28%)"}} />
      <div className="relative flex items-center gap-3 text-xl font-semibold"><span className="grid place-items-center size-10 rounded-full bg-white/10"><Leaf size={21}/></span> Thiện Pháp</div>
      <div className="relative max-w-xl"><p className="text-[#e6c77e] text-sm font-semibold tracking-widest mb-5">MINH BẠCH TẠO NIỀM TIN</p><h1 className="text-5xl leading-tight font-semibold">Mỗi giao dịch,<br/>một thiện duyên được ghi nhận.</h1><p className="text-white/65 mt-7 leading-7 max-w-md">Đồng bộ, phân loại và theo dõi dòng tiền thiện nguyện trong một không gian quản trị thống nhất.</p></div>
      <p className="relative text-white/40 text-sm">Nền tảng quản lý thiện pháp</p>
    </section>
    <section className="grid place-items-center p-6"><div className="w-full max-w-sm">
      <div className="lg:hidden flex items-center gap-2 text-[#176b46] font-semibold mb-12"><Leaf/> Thiện Pháp</div>
      <p className="text-sm text-[#176b46] font-semibold mb-2">CHÀO MỪNG TRỞ LẠI</p><h2 className="text-3xl font-semibold mb-2">Đăng nhập quản trị</h2><p className="text-[#758078] mb-8">Nhập thông tin tài khoản được cấp.</p>
      {error && <div className="mb-5 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">Email hoặc mật khẩu không đúng.</div>}
      <form action={loginAction} className="space-y-5"><div><label className="label">Email</label><input name="email" type="email" className="input" required placeholder="admin@example.com"/></div><div><label className="label">Mật khẩu</label><input name="password" type="password" className="input" required placeholder="••••••••"/></div><button className="btn btn-primary w-full py-3">Đăng nhập</button></form>
    </div></section>
  </main>;
}
