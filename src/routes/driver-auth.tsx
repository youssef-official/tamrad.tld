import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signInDriverByCode } from "@/lib/drivers.functions";
import { Bike, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver-auth")({
  head: () => ({
    meta: [
      { title: "دخول المندوب — تمراد" },
      { name: "description", content: "دخول المناديب برمز خاص لكل سائق." },
      { name: "theme-color", content: "#1f5f3f" },
    ],
    links: [
      { rel: "manifest", href: "/driver-manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  component: DriverAuth,
});

function DriverAuth() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const signIn = useServerFn(signInDriverByCode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password } = await signIn({ data: { code } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("تم الدخول");
      nav({ to: "/driver" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-lime/10 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Bike className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black">بوابة المندوب</h1>
          <p className="mt-1 text-sm text-muted-foreground">أدخل الرمز الذي أعطاك إياه المطعم — لا حاجة لكلمة سر.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">رمز السائق</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="مثال: R7K3M9"
              required
              dir="ltr"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-lg font-black tracking-widest outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            دخول
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          هذه الصفحة خاصة بمناديب المطاعم فقط.
        </p>
      </div>
    </div>
  );
}
