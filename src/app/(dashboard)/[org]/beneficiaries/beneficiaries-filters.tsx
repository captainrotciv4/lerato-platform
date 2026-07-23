"use client";

import { useRouter, usePathname } from "next/navigation";

const AGE_CATEGORIES = ["U7-U9", "U10-U12", "U13-U15", "U18"];

interface Props {
  schools: string[];
  areas: string[];
  current: { q?: string; category?: string; school?: string; area?: string; status?: string };
}

export function BeneficiaryFilters({ schools, areas, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function update(key: string, value: string) {
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    if (current.category) params.set("category", current.category);
    if (current.school) params.set("school", current.school);
    if (current.area) params.set("area", current.area);
    if (current.status) params.set("status", current.status);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}` as any);
  }

  function clearAll() {
    const params = new URLSearchParams();
    if (current.q) params.set("q", current.q);
    router.push(`${pathname}?${params.toString()}` as any);
  }

  const hasFilters = !!(current.category || current.school || current.area || current.status);

  const selectCls =
    "text-sm rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]";

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
      <select value={current.category ?? ""} onChange={(e) => update("category", e.target.value)} className={selectCls}>
        <option value="">All ages</option>
        {AGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select value={current.school ?? ""} onChange={(e) => update("school", e.target.value)} className={selectCls}>
        <option value="">All schools</option>
        {schools.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {areas.length > 0 && (
        <select value={current.area ?? ""} onChange={(e) => update("area", e.target.value)} className={selectCls}>
          <option value="">All areas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      <select value={current.status ?? ""} onChange={(e) => update("status", e.target.value)} className={selectCls}>
        <option value="">All statuses</option>
        <option value="Fully Registered">Fully Registered</option>
        <option value="Incomplete">Incomplete</option>
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm px-2 py-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
