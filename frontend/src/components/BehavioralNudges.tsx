"use client";

import { useEffect, useState } from "react";
import { TbBrain, TbTrendingUp, TbTrendingDown, TbAlertTriangle, TbBulb } from "react-icons/tb";
import { apiFetch } from "@/lib/api";

interface Nudge {
  type: "warning" | "insight" | "tip" | "win";
  message: string;
}

const NUDGE_CONFIG = {
  warning: { icon: TbAlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-200" },
  insight: { icon: TbTrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-200" },
  tip: { icon: TbBulb, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-200" },
  win: { icon: TbTrendingDown, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", text: "text-green-200" },
};

const FALLBACK: Nudge = { type: "warning", message: "You tend to spend 40% more on weekends — heads up this Saturday." };

export function BehavioralNudges() {
  const [nudge, setNudge] = useState<Nudge>(FALLBACK);

  useEffect(() => {
    apiFetch("/api/nudges")
      .then((res) => res.json())
      .then((data: Nudge[]) => {
        if (Array.isArray(data) && data.length > 0) setNudge(data[0]);
      })
      .catch(() => {});
  }, []);

  const cfg = NUDGE_CONFIG[nudge.type];

  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-800 bg-slate-800 p-6 shadow-sm">
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900">
            <TbBrain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Behavioral Nudge</h3>
            <p className="text-xs text-slate-400">Based on your spending patterns</p>
          </div>
        </div>

        <div className={`flex items-start gap-3 rounded-xl border p-3 ${cfg.bg}`}>
          <cfg.icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} />
          <p className={`text-xs font-medium leading-snug ${(cfg as any).text}`}>{nudge.message}</p>
        </div>
      </div>
    </div>
  );
}
