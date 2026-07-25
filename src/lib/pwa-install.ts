// Small hook that exposes the beforeinstallprompt event so we can render an
// "Add to Home Screen" button on the customer page.
import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BIP | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBip = (e: Event) => { e.preventDefault(); setPrompt(e as BIP); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  return { canInstall: !!prompt, installed, install };
}
