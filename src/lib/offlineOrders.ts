// Tiny IndexedDB helper for the driver's active orders — offline-first cache.
// Falls back silently to localStorage when IDB is unavailable.

const DB_NAME = "tamrad-driver";
const STORE = "active_orders";
const VERSION = 1;
const LS_KEY = "tamrad:driver:active_orders";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function saveActiveOrders(orders: any[]): Promise<void> {
  const db = await openDb();
  if (!db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(orders)); } catch { /* ignore */ }
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const s = tx.objectStore(STORE);
    s.clear();
    for (const o of orders) s.put(o);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadActiveOrders(): Promise<any[]> {
  const db = await openDb();
  if (!db) {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

// Queue of status updates made while offline; drained on reconnect.
const PENDING_KEY = "tamrad:driver:pending_actions";
export type PendingAction = { id: string; orderId: string; status: string; at: number };

export function getPending(): PendingAction[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}
export function addPending(a: Omit<PendingAction, "id" | "at">): PendingAction {
  const item = { ...a, id: crypto.randomUUID(), at: Date.now() };
  const list = getPending(); list.push(item);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  return item;
}
export function removePending(id: string) {
  const list = getPending().filter((p) => p.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

export function useOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
