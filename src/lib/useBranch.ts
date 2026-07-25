import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useMe } from "./useMe";

export type Branch = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  is_active: boolean;
  logo_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  theme?: Record<string, unknown> | null;
};

const KEY = (tenantId: string) => `tamrad:branch:${tenantId}`;

function readSelected(tenantId: string | null | undefined): string | null {
  if (!tenantId || typeof window === "undefined") return null;
  return localStorage.getItem(KEY(tenantId));
}

export function setSelectedBranch(tenantId: string, branchId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(tenantId), branchId);
  window.dispatchEvent(new CustomEvent("tamrad:branch-changed", { detail: { tenantId, branchId } }));
}

export function useBranches() {
  const { data: me } = useMe();
  const tenantId = me?.tenantId ?? null;

  const query = useQuery({
    queryKey: ["branches", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("branches" as any) as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  return { tenantId, branches: query.data ?? [], isLoading: query.isLoading };
}

export function useCurrentBranch() {
  const { tenantId, branches, isLoading } = useBranches();
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelected(tenantId));

  useEffect(() => {
    setSelectedId(readSelected(tenantId));
  }, [tenantId]);

  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail as { tenantId: string; branchId: string };
      if (detail?.tenantId === tenantId) setSelectedId(detail.branchId);
    }
    window.addEventListener("tamrad:branch-changed", onChange);
    return () => window.removeEventListener("tamrad:branch-changed", onChange);
  }, [tenantId]);

  // Auto-pick first branch if none selected
  useEffect(() => {
    if (!tenantId || branches.length === 0) return;
    if (!selectedId || !branches.find((b) => b.id === selectedId)) {
      const first = branches[0];
      setSelectedBranch(tenantId, first.id);
      setSelectedId(first.id);
    }
  }, [tenantId, branches, selectedId]);

  const current = branches.find((b) => b.id === selectedId) ?? branches[0] ?? null;

  const select = useCallback(
    (id: string) => {
      if (tenantId) setSelectedBranch(tenantId, id);
    },
    [tenantId],
  );

  return { tenantId, branches, current, branchId: current?.id ?? null, select, isLoading };
}
