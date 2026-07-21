"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, CloudUpload } from "lucide-react";
import { countQueue } from "@/lib/offline/queue";

export function OfflineBadge({ org }: { org: string }) {
  const [online,  setOnline]  = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    const refresh = () => countQueue(org).then(setPending).catch(() => {});
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [org]);

  if (online && pending === 0) return null;

  return (
    <Link
      href={`/${org}/sync` as any}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        !online
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
      }`}
    >
      {!online ? <WifiOff className="h-3 w-3" /> : <CloudUpload className="h-3 w-3" />}
      {!online && <span>Offline</span>}
      {pending > 0 && <span>{pending} pending</span>}
    </Link>
  );
}
