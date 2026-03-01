"use client";

import { useEffect, useState } from "react";
import {
  TbFlame,
  TbTrophy,
  TbStar,
  TbBolt,
  TbPigMoney,
  TbCalendarCheck,
  TbMoodSmile,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import { apiFetch } from "@/lib/api";

interface MilestoneItem {
  title: string;
  description: string;
  time: string;
  badge: string;
  icon?: IconType;
  color?: string;
  bg?: string;
  badgeColor?: string;
}

// Badge emoji → icon/color mapping
const BADGE_CONFIG: Record<string, { icon: IconType; color: string; bg: string; badgeColor: string }> = {
  "🔥": { icon: TbFlame,        color: "text-orange-500", bg: "bg-orange-50 border-orange-200",   badgeColor: "bg-orange-100 text-orange-600" },
  "💰": { icon: TbPigMoney,     color: "text-green-500",  bg: "bg-green-50 border-green-200",     badgeColor: "bg-green-100 text-green-600" },
  "🏆": { icon: TbTrophy,       color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200",   badgeColor: "bg-yellow-100 text-yellow-600" },
  "📅": { icon: TbCalendarCheck,color: "text-blue-500",   bg: "bg-blue-50 border-blue-200",       badgeColor: "bg-blue-100 text-blue-600" },
  "⭐": { icon: TbStar,         color: "text-purple-500", bg: "bg-purple-50 border-purple-200",   badgeColor: "bg-purple-100 text-purple-600" },
  "⚡": { icon: TbBolt,         color: "text-rose-500",   bg: "bg-rose-50 border-rose-200",       badgeColor: "bg-rose-100 text-rose-600" },
  "😊": { icon: TbMoodSmile,    color: "text-teal-500",   bg: "bg-teal-50 border-teal-200",       badgeColor: "bg-teal-100 text-teal-600" },
};

const DEFAULT_CONFIG = BADGE_CONFIG["⭐"];

function getBadgeConfig(badge: string) {
  const emoji = badge.trim().charAt(0);
  return BADGE_CONFIG[emoji] ?? DEFAULT_CONFIG;
}

const FALLBACK_ITEMS: MilestoneItem[] = [
  {
    icon: TbFlame,
    color: "text-orange-500",
    bg: "bg-orange-50 border-orange-200",
    title: "7-Day Spending Streak",
    description: "You stayed under budget for 7 days in a row!",
    time: "Just now",
    badge: "🔥 Streak",
    badgeColor: "bg-orange-100 text-orange-600",
  },
  {
    icon: TbPigMoney,
    color: "text-green-500",
    bg: "bg-green-50 border-green-200",
    title: "Saved $200 This Month",
    description: "You've hit your monthly savings target early.",
    time: "2 hours ago",
    badge: "💰 Savings",
    badgeColor: "bg-green-100 text-green-600",
  },
  {
    icon: TbTrophy,
    color: "text-yellow-500",
    bg: "bg-yellow-50 border-yellow-200",
    title: "Entered Top 10%",
    description: "You're now ranked in the top 10% of savers this week.",
    time: "Yesterday",
    badge: "🏆 Rank",
    badgeColor: "bg-yellow-100 text-yellow-600",
  },
];

export function MilestoneFeed() {
  const [items, setItems] = useState<MilestoneItem[]>(FALLBACK_ITEMS);
  const [totalCount, setTotalCount] = useState(FALLBACK_ITEMS.length);

  useEffect(() => {
    apiFetch("/api/milestones")
      .then((res) => res.json())
      .then((data: { title: string; description: string; time: string; badge: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const enriched = data.map((m) => {
            const cfg = getBadgeConfig(m.badge);
            return { ...m, ...cfg };
          });
          setItems(enriched);
          setTotalCount(enriched.length);
        }
      })
      .catch(() => {
      });
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-900 p-6 text-white xl:col-span-1 flex flex-col gap-4">
      {/* Background glows */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div>
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-green-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-green-400">
            🏅 Achievement Feed
          </span>
          <h2 className="mt-2 text-xl font-black leading-tight">Your Milestones</h2>
          <p className="mt-1 text-sm text-slate-400">
            <span className="font-bold text-white">{totalCount}</span> achievements unlocked
          </p>
        </div>
      </div>

      {/* Feed — top 3 only */}
      <div className="relative flex flex-col gap-3">
        {items.map((item, i) => {
          const cfg = getBadgeConfig(item.badge);
          const Icon = item.icon ?? cfg.icon;
          const color = item.color ?? cfg.color;
          const bg = item.bg ?? cfg.bg;
          const badgeColor = item.badgeColor ?? cfg.badgeColor;

          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
            >
              {/* Icon */}
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white">{item.title}</p>
                  <span className="shrink-0 text-[10px] text-slate-500">{item.time}</span>
                </div>
                <p className="text-xs text-slate-400 leading-snug">{item.description}</p>
                <span className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeColor}`}>
                  {item.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}