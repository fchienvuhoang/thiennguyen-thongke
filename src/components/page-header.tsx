export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"><div>{eyebrow && <p className="text-xs font-semibold tracking-widest text-[#176b46] mb-2">{eyebrow}</p>}<h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="text-[#718078] mt-2">{description}</p></div>{action}</header>;
}
