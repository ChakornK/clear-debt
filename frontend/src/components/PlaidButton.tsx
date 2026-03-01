"use client";

import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { TbBuildingBank, TbLoader2 } from "react-icons/tb";
import { apiFetch } from "@/lib/api";

interface LinkButtonProps {
  linkToken: string;
}

function LinkButton({ linkToken }: LinkButtonProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [didLink, setDidLink] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<string>("");

  const onSuccess = useCallback(async (public_token: string) => {
    setLoading(true);
    setSyncProgress("Exchanging tokens...");
    try {
      await apiFetch("/api/plaid/exchange", {
        method: "POST",
        body: JSON.stringify({ public_token }),
      });
      setDidLink(true);

      // Start historical sync
      setSyncing(true);
      setSyncProgress("Loading history...");
      const res = await apiFetch("/api/plaid/sync-history");
      if (res.ok) {
        const data = await res.json();
        setSyncProgress(`Synced ${data.total_synced} transactions!`);
      } else {
        setSyncProgress("Sync failed, but account linked.");
      }
    } catch (err) {
      console.error(err);
      setSyncProgress("Link failed.");
    } finally {
      setLoading(false);
      setTimeout(() => setSyncing(false), 3000);
    }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  if (loading || syncing) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white opacity-50">
          <TbLoader2 className="h-4 w-4 animate-spin" />
          {loading ? "Linking..." : "Syncing..."}
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{syncProgress}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => open()}
        disabled={!ready}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TbBuildingBank className="h-4 w-4" />
        {didLink ? "Account Linked" : "Link bank account"}
      </button>
      {syncProgress && !loading && !syncing && <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">{syncProgress}</p>}
    </div>
  );
}

export default function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateToken(): Promise<void> {
      try {
        const response = await apiFetch("/api/plaid/link-token");

        if (response.status === 401) {
          setError("Please login first to link your bank account.");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to get link token");
        }

        const data = await response.json();

        setLinkToken(data.link_token);
      } catch {
        setError("Failed to initialise Plaid.");
      } finally {
        setLoading(false);
      }
    }
    generateToken();
  }, []);

  if (loading) {
    return (
      <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white opacity-50">
        <TbLoader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </button>
    );
  }

  if (error || !linkToken) {
    return <p className="text-sm text-red-500">{error ?? "Unable to load Plaid."}</p>;
  }

  return <LinkButton linkToken={linkToken} />;
}
