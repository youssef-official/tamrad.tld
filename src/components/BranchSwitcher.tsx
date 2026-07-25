import { useState, useRef, useEffect } from "react";
import { ChevronDown, Store, Check, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCurrentBranch } from "@/lib/useBranch";

export function BranchSwitcher() {
  const { branches, current, select } = useCurrentBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (branches.length === 0) {
    return (
      <Link
        to="/dashboard/branches"
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> أضف أول فرع
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-muted"
      >
        <Store className="h-4 w-4 text-primary" />
        <span className="max-w-[140px] truncate">{current?.name ?? "اختر فرعاً"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            الفروع
          </div>
          <div className="max-h-72 overflow-y-auto">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  select(b.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-right text-sm transition-colors ${
                  current?.id === b.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  {current?.id === b.id && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 text-right">
                  <div className="font-bold">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground" dir="ltr">
                    /{b.slug}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Link
            to="/dashboard/branches"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-border bg-muted/50 px-3 py-2 text-xs font-bold text-primary hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> إدارة الفروع
          </Link>
        </div>
      )}
    </div>
  );
}
