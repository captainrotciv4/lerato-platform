// Client-side only — IndexedDB-backed queue for offline drafts.

export type OperationType = "BENEFICIARY_REGISTER" | "ROLLCALL";

export interface QueuedRecord {
  id: string;
  type: OperationType;
  org: string;
  branchId?: string;
  label: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

const DB_NAME = "lerato-offline";
const STORE   = "queue";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function enqueue(
  record: Omit<QueuedRecord, "id" | "createdAt">
): Promise<string> {
  const db  = await openDB();
  const id  = crypto.randomUUID();
  const full: QueuedRecord = { ...record, id, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(full);
    tx.oncomplete = () => resolve(id);
    tx.onerror    = () => reject(tx.error);
  });
}

export async function listQueue(org?: string): Promise<QueuedRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedRecord[];
      resolve(org ? all.filter((r) => r.org === org) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function countQueue(org?: string): Promise<number> {
  const all = await listQueue(org);
  return all.length;
}
