import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "./useMe";

export type CustomerAddress = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  label: string;
  full_address: string;
  city: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AddressInput = {
  label: string;
  full_address: string;
  city?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
};

export function useAddresses(tenantId: string | null = null) {
  const { data: me } = useMe();
  const userId = me?.user.id ?? null;

  return useQuery({
    queryKey: ["customer-addresses", userId, tenantId],
    enabled: !!userId,
    queryFn: async () => {
      let query = (supabase.from("customer_addresses" as any) as any)
        .select("*")
        .eq("user_id", userId!)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      query = tenantId ? query.eq("tenant_id", tenantId) : query.is("tenant_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CustomerAddress[];
    },
  });
}

export function useAddressMutations(tenantId: string | null = null) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const userId = me?.user.id ?? null;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["customer-addresses", userId, tenantId] });

  const create = useMutation({
    mutationFn: async (input: AddressInput) => {
      if (!userId) throw new Error("غير مسجل الدخول");
      const { data, error } = await (supabase.from("customer_addresses" as any) as any)
        .insert({ ...input, user_id: userId, tenant_id: tenantId })
        .select("*")
        .single();
      if (error) throw error;
      return data as CustomerAddress;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: AddressInput & { id: string }) => {
      let query = (supabase.from("customer_addresses" as any) as any).update(input).eq("id", id);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      let query = (supabase.from("customer_addresses" as any) as any).delete().eq("id", id);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      let query = (supabase.from("customer_addresses" as any) as any)
        .update({ is_default: true })
        .eq("id", id);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, setDefault };
}
