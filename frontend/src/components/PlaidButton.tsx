"use client";

import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { TbBuildingBank, TbLoader2 } from "react-icons/tb";

interface LinkButtonProps {
  linkToken: string;
}

function LinkButton({ linkToken }: LinkButtonProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [didLink, setDidLink] = useState<boolean>(false);

  const onSuccess = useCallback(async (public_token: string) => {
    setLoading(true);
    try {
      await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      setDidLink(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  if (loading) {
    return (
      <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white opacity-50">
        <TbLoader2 className="h-4 w-4 animate-spin" />
        Linking...
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="flex cursor-pointer items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <TbBuildingBank className="h-4 w-4" />
      {didLink ? "Linked" : "Link account"}
    </button>
  );
}

export default function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function generateToken(): Promise<void> {
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/plaid/link-token", { method: "GET" });
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
