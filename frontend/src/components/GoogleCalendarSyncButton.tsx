"use client";

import { useState } from "react";
import { TbRefresh, TbLoader2, TbCheck } from "react-icons/tb";
import { apiFetch } from "@/lib/api";

interface GoogleCalendarSyncButtonProps {
  onSyncComplete?: () => void;
}

export default function GoogleCalendarSyncButton({ onSyncComplete }: GoogleCalendarSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setSynced(false);
    try {
      const res = await apiFetch("/api/google-calendar/sync", {
        method: "POST",
      });

      if (res.ok) {
        setSynced(true);
        if (onSyncComplete) {
          onSyncComplete();
        }
        setTimeout(() => setSynced(false), 3000);
      } else if (res.status === 401) {
        setError("Re-authentication required.");
      } else {
        const data = await res.json();
        setError(data.detail || "Sync failed");
      }
    } catch (err) {
      setError("Network error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all active:scale-95 ${
          synced ? "bg-green-600" : "bg-blue-500 hover:bg-blue-600"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ?
          <TbLoader2 className="h-4 w-4 animate-spin" />
        : synced ?
          <TbCheck className="h-4 w-4" />
        : <TbRefresh className="h-4 w-4" />}
        {loading ?
          "Syncing..."
        : synced ?
          "Synced!"
        : "Sync Google Calendar"}
      </button>
      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
    </div>
  );
}
