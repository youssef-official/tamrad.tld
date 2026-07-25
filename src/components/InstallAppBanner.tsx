import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa-install";

const DISMISS_KEY = "tamrad:install-banner-dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Install-as-app banner shown at the top of a restaurant storefront.
 * - Chrome/Android: uses beforeinstallprompt (one tap).
 * - iOS Safari: shows a short "Share → Add to Home Screen" tip.
 * - Hidden if already installed or dismissed by the user.
 */
export function InstallAppBanner({
  primary,
  restaurantName,
}: {
  primary: string;
  restaurantName: string;
}) {
  const install = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setStandalone(isStandalone());
    setIos(isIOS());
  }, []);

  if (standalone || dismissed || install.installed) return null;

  const canShow = install.canInstall || ios;
  if (!canShow) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-3 py-2.5 shadow-sm"
        style={{ background: primary + "10", borderColor: primary + "30" }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: primary }}
        >
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black" style={{ color: primary }}>
            ثبّت {restaurantName} كتطبيق
          </div>
          <div className="truncate text-[11px] text-neutral-600">
            وصول أسرع، إشعارات، تجربة مثل التطبيق الأصلي.
          </div>
        </div>
        <button
          onClick={() => (install.canInstall ? install.install() : setShowIosTip(true))}
          className="rounded-full px-3 py-1.5 text-xs font-bold text-white"
          style={{ background: primary }}
        >
          ثبّت
        </button>
        <button onClick={dismiss} aria-label="إغلاق" className="p-1 text-neutral-500">
          <X className="h-4 w-4" />
        </button>
      </div>

      {showIosTip && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setShowIosTip(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setShowIosTip(false)}>
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-black">تثبيت التطبيق على iPhone</h3>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style={{ background: primary }}>1</span>
                <div>
                  اضغط زر <b>المشاركة</b>
                  <Share className="mx-1 inline h-4 w-4" />
                  في شريط سفاري.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style={{ background: primary }}>2</span>
                <div>
                  اختر <b>إضافة إلى الشاشة الرئيسية</b>
                  <Plus className="mx-1 inline h-4 w-4" />.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style={{ background: primary }}>3</span>
                <div>اضغط <b>إضافة</b> — ستجد أيقونة التطبيق على شاشتك الرئيسية.</div>
              </li>
            </ol>
            <button
              onClick={() => setShowIosTip(false)}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: primary }}
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
