import type { SupabaseClient } from "@supabase/supabase-js";

type WalletTxnRow = { amount_iqd: number; type: string };

/** Same formula as public.get_wallet_balance (credits − debits). */
export function sumWalletBalanceFromTxns(txns: WalletTxnRow[]): number {
  return txns.reduce(
    (s, t) => s + (t.type === "credit" ? t.amount_iqd : -t.amount_iqd),
    0,
  );
}

/** Per-tenant balance for checkout; falls back to client-side sum if RPC is missing. */
export async function fetchTenantWalletBalance(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<number> {
  const { data, error } = await (supabase.rpc as any)("get_wallet_balance", {
    _tenant_id: tenantId,
    _user_id: userId,
  });
  if (!error && data != null) return data as number;

  const { data: txns, error: txErr } = await supabase
    .from("wallet_transactions")
    .select("amount_iqd, type")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (txErr) throw txErr;
  return sumWalletBalanceFromTxns((txns ?? []) as WalletTxnRow[]);
}
