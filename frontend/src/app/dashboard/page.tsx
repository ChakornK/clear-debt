"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { MilestoneFeed } from "@/components/MilestoneFeed";
import { useEffect, useState } from "react";
import { BehavioralNudges } from "@/components/BehavioralNudges";
import {
  TbAnalyze,
  TbCalendarMonth,
  TbChartBar,
  TbCoin,
  TbLoader,
  TbHome,
  TbToolsKitchen2,
  TbCar,
  TbBuildingHospital,
  TbDeviceTv,
  TbShoppingBag,
  TbCreditCard,
  TbQuestionMark,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import GoogleCalendarSyncButton from "@/components/GoogleCalendarSyncButton";
import { apiFetch } from "@/lib/api";

interface DashboardData {
  debtProgress: {
    paid: number;
    total: number;
    targetDate: string;
  };
  achievement: {
    label: string;
    value: string;
  };
  upcomingEvents: Array<{
    time: string;
    cost: number;
    name: string;
    location: string;
    category?: string;
  }>;
  weeklySpending: {
    budgetLimit: number;
    weeks: Array<{ week: string; spent: number; active: boolean }>;
  };
  dailyDistribution: Array<{ day: string; spent: number; active: boolean }>;
  spendingCategories: {
    total: number;
    categories: Array<{ color: string; label: string; pct: number; amount: number; bucket?: string }>;
    bucket_data: Array<{ color: string; label: string; pct: number; amount: number }>;
    periodLimit: number;
  };
  milestone: {
    tag: string;
    title: string;
    description: string;
    primaryCTA: string;
    secondaryCTA: string;
  };
}

interface TypeConfigEntry {
  dot: string;
  Icon: IconType;
  badge: string;
  iconClass: string;
}

const TYPE_CONFIG: Record<string, TypeConfigEntry> = {
  "Housing": { dot: "bg-emerald-400", Icon: TbHome, badge: "bg-emerald-100 text-emerald-700", iconClass: "text-emerald-500" },
  "Food & Dining": { dot: "bg-orange-400", Icon: TbToolsKitchen2, badge: "bg-orange-100 text-orange-700", iconClass: "text-orange-500" },
  "Transportation": { dot: "bg-blue-400", Icon: TbCar, badge: "bg-blue-100 text-blue-700", iconClass: "text-blue-500" },
  "Healthcare": { dot: "bg-rose-400", Icon: TbBuildingHospital, badge: "bg-rose-100 text-rose-700", iconClass: "text-rose-500" },
  "Entertainment": { dot: "bg-purple-400", Icon: TbDeviceTv, badge: "bg-purple-100 text-purple-700", iconClass: "text-purple-500" },
  "Shopping": { dot: "bg-amber-400", Icon: TbShoppingBag, badge: "bg-amber-100 text-amber-700", iconClass: "text-amber-500" },
  "Debt Payments": { dot: "bg-red-400", Icon: TbCreditCard, badge: "bg-red-100 text-red-700", iconClass: "text-red-500" },
  "Other": { dot: "bg-slate-400", Icon: TbQuestionMark, badge: "bg-slate-100 text-slate-700", iconClass: "text-slate-400" },
  "default": { dot: "bg-slate-400", Icon: TbQuestionMark, badge: "bg-slate-100 text-slate-700", iconClass: "text-slate-400" },
};

const getTypeConfig = (type: string): TypeConfigEntry => TYPE_CONFIG[type] ?? TYPE_CONFIG.default;

const variants = {
  upcomingEventsCostBadge: cva("", {
    variants: {
      intents: {
        spend: "bg-green-100 text-green-600",
        none: "bg-slate-100 text-slate-500",
      },
    },
  }),
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else if (res.status === 401) {
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Failed to fetch dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <TbLoader className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!data) return null;

  const { debtProgress, achievement, upcomingEvents, weeklySpending, dailyDistribution, spendingCategories, milestone } = data;

  const debtPct = ((debtProgress.paid / debtProgress.total) * 100).toFixed(1);
  const dailyBudget = weeklySpending.budgetLimit / 7;

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white text-slate-900">
      <main className="flex flex-1 flex-col gap-6 p-6 xl:p-10">
        {/* Top Summary Section */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <BehavioralNudges />

          <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Debt Clearing Progress</h3>
                <p className="mt-1 text-3xl font-black text-slate-900">
                  ${debtProgress.paid.toLocaleString()} <span className="text-lg font-normal text-slate-400">of ${debtProgress.total.toLocaleString()}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-green-500">Goal: $0</p>
              </div>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-400" style={{ width: `${debtPct}%` }}></div>
            </div>
            <p className="text-sm text-slate-500">You&apos;re on track to be debt-free by {debtProgress.targetDate}. Keep it up!</p>
          </div>
        </section>

        {/* Main Dashboard Content */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Left Column: Upcoming Events */}
          <div className="flex flex-col gap-6 xl:col-span-2">
            <div className="flex grow flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <TbCalendarMonth className="h-5 w-5" />
                  Upcoming Events
                </h3>
                <GoogleCalendarSyncButton onSyncComplete={fetchDashboard} />
              </div>
              <div className="grow space-y-4">
                {upcomingEvents.map((event, i) => {
                  const cfg = getTypeConfig(event.category || "Other");
                  return (
                    <div key={i} className="group flex items-center gap-4 rounded-xl border border-slate-50 bg-slate-50/50 p-4 transition-all">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cfg.badge}`}>
                        <cfg.Icon className="h-6 w-6" />
                      </div>
                      <div className="flex grow items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <p className="line-clamp-1 text-sm font-bold text-slate-900">{event.name}</p>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="text-[10px] font-bold uppercase tracking-wider">{event.time}</span>
                            <span className={`h-1 w-1 rounded-full bg-slate-500`}></span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">{event.category}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">${event.cost}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${event.cost > 0 ? "text-red-400" : "text-slate-400"}`}>
                            {event.cost > 0 ? "Predicted" : "No Cost"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link href={"/calendar"} className="mt-4 flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-green-500 hover:underline">
                View Full Calendar
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right Column: Daily Distribution + Category Breakdown */}
          <div className="flex flex-col gap-6 xl:col-span-1">
            {/* Daily Cost Distribution */}
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <TbChartBar className="h-5 w-5" />
                Daily Cost Distribution
              </h3>
              <p className="mb-4 text-[10px] text-slate-400">Daily budget: ${dailyBudget.toFixed(0)}/day</p>
              <div className="flex h-32 items-end justify-between gap-1">
                {dailyDistribution.map((d, i) => {
                  const heightPct = Math.min((d.spent / dailyBudget) * 100, 100);
                  const overBudget = d.spent > dailyBudget;
                  return (
                    <div key={i} className="group flex w-full flex-col items-center gap-1">
                      {/* Spent label on hover */}
                      <div className="relative flex w-full flex-col justify-end" style={{ height: "100px" }}>
                        <span className="text-center text-[8px] font-bold text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">${d.spent}</span>
                        <div className={`w-full rounded-t ${overBudget ? "bg-red-400" : "bg-green-400"}`} style={{ height: `${heightPct}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-900">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spending Categories */}
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
                <TbCoin className="h-5 w-5" />
                Spending Categories (Last 30 Days)
              </h3>
              <div className="relative flex items-center justify-center py-4">
                {(() => {
                  const size = 128;
                  const strokeWidth = 14;
                  const radius = (size - strokeWidth) / 2;
                  const circumference = 2 * Math.PI * radius;

                  let cumulativePct = 0;
                  // Map bucket colors to specific tailwind/hex colors for SVG
                  const COLOR_MAP: Record<string, string> = {
                    "bg-emerald-400": "#34d399",
                    "bg-orange-400": "#fb923c",
                    "bg-blue-400": "#60a5fa",
                    "bg-rose-400": "#fb7185",
                    "bg-purple-400": "#c084fc",
                    "bg-amber-400": "#fbbf24",
                    "bg-red-400": "#f87171",
                    "bg-slate-400": "#94a3b8",
                  };

                  return (
                    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
                        {spendingCategories.bucket_data?.map((bucket, i) => {
                          const dashArray = circumference;
                          const dashOffset = circumference * (1 - bucket.pct / 100);
                          const rotation = (cumulativePct / 100) * 360;
                          cumulativePct += bucket.pct;

                          return (
                            <circle
                              key={i}
                              cx={size / 2}
                              cy={size / 2}
                              r={radius}
                              fill="none"
                              stroke={COLOR_MAP[bucket.color] || "#94a3b8"}
                              strokeWidth={strokeWidth}
                              strokeDasharray={dashArray}
                              strokeDashoffset={dashOffset}
                              strokeLinecap="butt"
                              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}
                            />
                          );
                        })}
                      </svg>
                      <div className="absolute text-center">
                        <p className="text-[10px] font-bold text-slate-400">TOTAL</p>
                        <p className="text-sm font-black">${spendingCategories.total.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Scrollable list of ALL categories */}
              <div className="custom-scrollbar mt-4 max-h-[240px] space-y-3 overflow-y-auto pr-2">
                {spendingCategories.categories?.map((cat, i) => {
                  return (
                    <div key={i} className="flex flex-col gap-1 border-b border-slate-50 pb-2 last:border-0">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${cat.color} inline-block`}></span>
                          <span className="font-bold text-slate-800">{cat.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900">${cat.amount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pl-4 text-[10px]">
                        <span className="font-medium uppercase text-slate-400">{cat.bucket}</span>
                        <span className="font-bold text-slate-400">{cat.pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Weekly Spending Chart */}
          <div className="flex flex-col gap-6 xl:col-span-1">
            <div className="h-full rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
                    <TbAnalyze className="h-5 w-5" />
                    Weekly Spending Analysis
                  </h3>
                  <p className="text-sm text-slate-500">Historical view vs. weekly budget limit (${weeklySpending.budgetLimit.toFixed(0)})</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-400"></span> Actual
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className="mt-1 inline-block h-1 w-4 border-t border-dashed border-red-400"></span> Limit
                  </span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="relative flex h-64 w-full items-end justify-between gap-2 px-2">
                {/* Grid lines */}
                <div className="pointer-events-none absolute inset-0 mb-6 flex flex-col justify-between">
                  <div className="w-full border-t border-slate-100"></div>
                  <div className="w-full border-t border-slate-100"></div>
                  <div className="w-full border-t border-slate-100"></div>
                  {/* Budget limit line sits at 100% of chart height */}
                  <div className="relative z-10 w-full border-t border-dashed border-red-400/50">
                    <span className="absolute -top-5 right-0 text-[10px] font-bold text-red-400">BUDGET LIMIT (${weeklySpending.budgetLimit.toFixed(0)})</span>
                  </div>
                  <div className="w-full border-t border-slate-100"></div>
                </div>

                {weeklySpending.weeks.map((bar, i) => {
                  const heightPct = Math.min((bar.spent / weeklySpending.budgetLimit) * 100, 100);
                  const overBudget = bar.spent > weeklySpending.budgetLimit;
                  return (
                    <div key={i} className="group relative flex h-full w-full flex-col items-center justify-end">
                      {/* Dollar label above bar */}
                      <span className="mb-1 text-[10px] font-bold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">${bar.spent}</span>
                      <div
                        className={`w-full rounded-t transition-all ${overBudget ? "bg-red-400" : "bg-green-400"}`}
                        style={{ height: `${heightPct}%` }}
                      ></div>
                      <span className="mt-2 text-[10px] font-bold text-slate-900">{bar.week}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Featured Milestone Card */}
          <MilestoneFeed />
        </section>
      </main>
    </div>
  );
}
