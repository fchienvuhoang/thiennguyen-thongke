import { Leaf } from "lucide-react";
import { googleAuthConfigured } from "@/lib/google-auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const googleEnabled = googleAuthConfigured();
  const errorMessage = error?.startsWith("google_")
    ? error === "google_not_invited"
      ? "Email Google này chưa được thêm vào tổ chức. Hãy liên hệ quản trị tổ chức."
      : error === "google_not_configured"
        ? "Đăng nhập Google chưa được cấu hình trên hệ thống."
        : "Không thể đăng nhập bằng Google. Vui lòng thử lại."
    : error
      ? "Không thể đăng nhập. Vui lòng thử lại."
      : null;
  return <main className="min-h-screen grid lg:grid-cols-2 bg-white">
    <section className="hidden lg:flex relative overflow-hidden bg-[#114c32] text-white p-16 flex-col justify-between">
      <div className="absolute inset-0 opacity-20" style={{backgroundImage:"radial-gradient(circle at 20% 20%, #d9a441 0, transparent 32%), radial-gradient(circle at 80% 80%, #7eb796 0, transparent 28%)"}} />
      <div className="relative flex items-center gap-3 text-xl font-semibold"><span className="grid place-items-center size-10 rounded-full bg-white/10"><Leaf size={21}/></span> Thiện Pháp</div>
      <div className="relative max-w-xl"><p className="text-[#e6c77e] text-sm font-semibold tracking-widest mb-5">MINH BẠCH TẠO NIỀM TIN</p><h1 className="text-5xl leading-tight font-semibold">Mỗi giao dịch,<br/>một thiện duyên được ghi nhận.</h1><p className="text-white/65 mt-7 leading-7 max-w-md">Đồng bộ, phân loại và theo dõi dòng tiền thiện nguyện trong một không gian quản trị thống nhất.</p></div>
      <div className="relative text-sm"><p className="text-white/40">Nền tảng quản lý thiện pháp</p><p className="text-white/70 mt-2">Liên hệ hỗ trợ: Chiến Vũ - <a className="text-[#e6c77e] hover:underline" href="tel:0988236750">0988236750</a> (Zalo)</p></div>
    </section>
    <section className="grid place-items-center p-6"><div className="w-full max-w-sm">
      <div className="lg:hidden flex items-center gap-2 text-[#176b46] font-semibold mb-12"><Leaf/> Thiện Pháp</div>
      <p className="text-sm text-[#176b46] font-semibold mb-2">CHÀO MỪNG TRỞ LẠI</p><h2 className="text-3xl font-semibold mb-2">Đăng nhập quản trị</h2><p className="text-[#758078] mb-8">Sử dụng Gmail đã được thêm vào tổ chức.</p>
      {errorMessage && <div className="mb-5 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{errorMessage}</div>}
      {googleEnabled ? <a href="/api/auth/google" className="btn w-full py-3 border border-[#d8e0da] bg-white text-[#26332c] hover:bg-[#f5f7f4]"><svg viewBox="0 0 24 24" aria-hidden="true" className="size-5"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>Đăng nhập bằng Google</a> : <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-sm">Google SSO chưa được cấu hình.</div>}
      <p className="lg:hidden text-center text-sm text-[#718078] mt-8">Liên hệ hỗ trợ: Chiến Vũ - <a className="font-semibold text-[#176b46]" href="tel:0988236750">0988236750</a> (Zalo)</p>
    </div></section>
  </main>;
}
