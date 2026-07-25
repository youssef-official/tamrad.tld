import { useEffect, useState } from "react";
import { Download, Share, Plus, Store } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa-install";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if ((window.navigator as any).standalone === true) return true; // iOS
  // start_url of the installed app carries ?src=pwa
  if (new URLSearchParams(window.location.search).get("src") === "pwa") return true;
  return false;
}

/**
 * Blocking install gate for the customer storefront.
 * The restaurant page only renders when running as an installed app
 * (standalone). Otherwise the visitor gets a full-screen prompt to
 * install the restaurant's PWA (logo + name), with iOS instructions.
 */
export function InstallAppGate({
  name,
  logoUrl,
  primary,
  children,
}: {
  name: string;
  logoUrl?: string | null;
  primary: string;
  children: React.ReactNode;
}) {
  const install = useInstallPrompt();
  const [standalone, setStandalone] = useState<boolean | null>(null);
  const [ios] = useState(isIOS);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  useEffect(() => {
    if (install.installed) setStandalone(true);
  }, [install.installed]);

  // Avoid a flash of the gate before we know the display mode.
  if (standalone === null) {
    return <div className="min-h-screen bg-white" />;
  }

  if (standalone) return <>{children}</>;

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-gradient-to-b from-white to-neutral-100">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        {/* Logo */}
        <div
          className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] border-4 bg-white shadow-2xl"
          style={{ borderColor: primary + "30", boxShadow: `0 20px 50px -12px ${primary}40` }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-12 w-12" style={{ color: primary }} />
          )}
        </div>

        <h1 className="mt-6 text-3xl font-black text-neutral-900">{name}</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
          صفحة هذا المطعم تعمل كتطبيق فقط.
          <br />
          ثبّت التطبيق على جهازك للطلب والمتابعة.
        </p>

        {/* Install action */}
        {install.canInstall ? (
          <button
            onClick={() => install.install()}
            className="mt-8 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98]"
            style={{ background: primary, boxShadow: `0 12px 30px -8px ${primary}80` }}
          >
            <Download className="h-5 w-5" />
            تثبيت التطبيق
          </button>
        ) : ios ? (
          <button
            onClick={() => setShowIosTip(true)}
            className="mt-8 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98]"
            style={{ background: primary, boxShadow: `0 12px 30px -8px ${primary}80` }}
          >
            <Share className="h-5 w-5" />
            خطوات التثبيت على iPhone
          </button>
        ) : (
          <div className="mt-8 w-full max-w-xs rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-600">
            من قائمة المتصفح <span className="font-black text-neutral-900">⋮</span> اختر{" "}
            <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b> ثم افتح الأيقونة الجديدة.
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: primary }} />
          تجربة أسرع — بدون متصفح — إشعارات بالطلبات
        </div>
      </div>

      <div className="pb-6 text-center text-[11px] text-neutral-400">مدعوم من منصة تمراد</div>

      {/* iOS instructions sheet */}
      {showIosTip && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setShowIosTip(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-center text-lg font-black">تثبيت «{name}» على iPhone</h3>
            <ol className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white"
                  style={{ background: primary }}
                >
                  1
                </span>
                <div>
                  افتح الصفحة في متصفح <b>سفاري</b> ثم اضغط زر <b>المشاركة</b>
                  <Share className="mx-1 inline h-4 w-4" /> في الأسفل.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white"
                  style={{ background: primary }}
                >
                  2
                </span>
                <div>
                  مرّر لأسفل واختر <b>«إضافة إلى الشاشة الرئيسية»</b>
                  <Plus className="mx-1 inline h-4 w-4" />.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-white"
                  style={{ background: primary }}
                >
                  3
                </span>
                <div>
                  اضغط <b>«إضافة»</b> — ستظهر أيقونة المطعم على شاشتك، افتحها من هناك.
                </div>
              </li>
            </ol>
            <button
              onClick={() => setShowIosTip(false)}
              className="mt-6 w-full rounded-xl py-3 text-sm font-black text-white"
              style={{ background: primary }}
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
