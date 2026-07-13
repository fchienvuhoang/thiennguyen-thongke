export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5"><div>{eyebrow && <p className="text-[11px] font-semibold tracking-widest text-[#176b46] mb-1">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="text-sm text-[#718078] mt-1">{description}</p></div>{action}</header>;
}
