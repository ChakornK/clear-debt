"use client";

import { ActivityInputField } from "@/components/ActivityInputField";
import { DebtInputField } from "@/components/DebtInputField";
import { useEffect, useState, useMemo } from "react";
import { TbArrowRight, TbArrowLeft, TbCheck, TbCalendarCheck, TbWallet, TbPigMoney, TbCreditCard, TbCoin, TbLoader, TbBuildingBank } from "react-icons/tb";
import AddButton from "@/components/AddButton";
import { apiFetch } from "@/lib/api";
import { DebtType } from "@/types/types";
import GoogleCalendarSyncButton from "@/components/GoogleCalendarSyncButton";
import PlaidLinkButton from "@/components/PlaidButton";
import { useRouter } from "next/navigation";

interface Debt {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  minimum: number;
  due: number;
  source: string;
}

interface Activity {
  id: number;
  name: string;
  category: string;
  estimatedCost: number;
}

const STEPS = [
  { id: 1, title: "Sync Schedule", icon: TbCalendarCheck },
  { id: 2, title: "Connect Banks", icon: TbBuildingBank },
  { id: 3, title: "Add Debts", icon: TbCreditCard },
  { id: 4, title: "Spending Triggers", icon: TbCoin },
  { id: 5, title: "Income & Goals", icon: TbWallet },
];

export default function Setup() {
  const [debts, setDebts] = useState<Debt[]>([
    {
      id: "debt-default",
      name: "",
      type: DebtType["Credit card"],
      balance: 0,
      apr: 0,
      minimum: 0,
      due: 1,
      source: "manual",
    },
  ]);

  const [activities, setActivities] = useState<Activity[]>([{ id: 1, name: "", category: "Food & Dining", estimatedCost: 0 }]);

  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);
  const [savingsPct, setSavingsPct] = useState<number>(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"onboarding" | "edit">("onboarding");
  const [step, setStep] = useState(1);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await apiFetch("/api/user/setup");
        if (res.ok) {
          const data = await res.json();
          if (data.has_completed_setup) {
            setMode("edit");
            document.cookie = "onboarding_complete=1; path=/; max-age=31536000";
          }
          if (data.debts?.length > 0) setDebts(data.debts);
          if (data.activities?.length > 0) setActivities(data.activities);
          if (data.monthly_income) setMonthlyIncome(data.monthly_income);
          if (data.monthly_limit) setMonthlyLimit(data.monthly_limit);
          if (data.savings_pct) setSavingsPct(data.savings_pct);
        }
      } catch (err) {
        console.error("Failed to fetch setup data", err);
      } finally {
        setLoading(false);
      }
    };

    if (document.cookie.includes("onboarding_complete=1")) {
      setMode("edit");
    }

    fetchUserData();
  }, []);

  const totalMinimumPayments = useMemo(() => debts.reduce((sum, d) => sum + (d.minimum || 0), 0), [debts]);

  const amountLeftOver = monthlyIncome - monthlyLimit - totalMinimumPayments;
  const toSavings = amountLeftOver > 0 ? (amountLeftOver * savingsPct) / 100 : 0;
  const toDebt = amountLeftOver > 0 ? amountLeftOver - toSavings : 0;

  const addDebtElement = () => {
    setDebts((prev) => [
      ...prev,
      {
        id: `debt-${Date.now()}`,
        name: "",
        type: DebtType.Other,
        balance: 0,
        apr: 0,
        minimum: 0,
        due: 1,
        source: "manual",
      },
    ]);
  };

  const removeDebtElement = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.getAttribute("id");
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const onDebtFieldChange = (id: string, field: string, value: string | number) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const addActivityElement = () => {
    setActivities((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        category: "Food & Dining",
        estimatedCost: 0,
      },
    ]);
  };

  const removeActivityElement = (id: number) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const onActivityFieldChange = (id: number, field: string, value: string | number) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const validateStep = (s: number) => {
    if (s === 3) {
      // Debts
      for (const debt of debts) {
        if (!debt.name.trim()) return "Every debt must have a name.";
        if (debt.balance <= 0) return `Balance for "${debt.name}" must be greater than 0.`;
        if (debt.apr < 0 || debt.apr > 100) return `APR for "${debt.name}" must be between 0% and 100%.`;
        if (debt.minimum < 0) return `Minimum payment for "${debt.name}" cannot be negative.`;
        if (debt.minimum > debt.balance) return `Minimum payment for "${debt.name}" cannot exceed its balance.`;
      }
    }

    if (s === 4) {
      // Spending Triggers
      for (const activity of activities) {
        if (!activity.name.trim()) return "Every spending trigger needs a name.";
        if (activity.estimatedCost < 0) return `Estimated cost for "${activity.name}" cannot be negative.`;
      }
    }

    if (s === 5) {
      // Income & Goals
      if (monthlyIncome <= 0) return "Please enter a valid monthly net income.";
      if (monthlyLimit < 0) return "Monthly spending limit cannot be negative.";
      if (monthlyLimit > monthlyIncome) return "Spending limit cannot exceed your total income.";
      if (amountLeftOver < 0) return "Your expenses and debt minimums exceed your income. Please adjust your limits.";
    }

    return null;
  };

  const handleNextStep = (next: number) => {
    setError("");
    setShowErrors(false);

    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      setShowErrors(true);
      return;
    }

    setStep(next);
  };

  const router = useRouter();

  const onSave = async () => {
    setError("");
    setShowErrors(false);

    // Validate all steps in edit mode
    for (let i = 3; i <= 5; i++) {
      // Start validation from Debts (new step 3)
      const validationError = validateStep(i);
      if (validationError) {
        setError(validationError);
        setShowErrors(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setSaving(true);
    try {
      await apiFetch("/api/debts/save", {
        method: "POST",
        body: JSON.stringify({
          debts,
          calendar_events: activities.map((a) => ({
            date: new Date().toISOString().split("T")[0], // placeholder for generic trigger
            type: a.category,
            label: a.name,
            amount: a.estimatedCost,
          })),
          monthly_income: monthlyIncome,
          monthly_limit: monthlyLimit,
          savings_pct: savingsPct,
        }),
      });

      document.cookie = "onboarding_complete=1; path=/; max-age=31536000";
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (mode === "onboarding") {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <TbLoader className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  const isStepVisible = (s: number) => mode === "edit" || step === s;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-900">
      {/* Header section restricted width */}
      <div className="mx-auto max-w-4xl px-6 pt-12 md:pt-16">
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">{mode === "onboarding" ? "Tailor Your Journey" : "Adjust Your Setup"}</h1>
          <p className="mt-2 text-lg text-slate-500">
            {mode === "onboarding" ?
              "Let's configure your financial engine for maximum debt-clearing speed."
            : "Update your income, debts, or spending triggers as your life changes."}
          </p>
        </div>

        {/* Progress Bar (Only show in onboarding) */}
        {mode === "onboarding" && (
          <div className="mb-12">
            <div className="flex items-center justify-between px-2">
              {STEPS.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${step >= s.id ? "border-green-500 bg-green-500 text-white" : "border-slate-200 bg-white text-slate-400"}`}
                  >
                    {step > s.id ?
                      <TbCheck className="h-6 w-6" />
                    : <s.icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${step >= s.id ? "text-green-600" : "text-slate-400"}`}>{s.title}</span>
                </div>
              ))}
            </div>
            {error && mode === "onboarding" && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-bold text-red-600">{error}</div>
            )}
            <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="absolute left-0 h-full bg-green-500 transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8">
          {/* Step 1: Calendar */}
          {isStepVisible(1) && (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                  <TbCalendarCheck className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black">1. Sync with Google Calendar</h2>
                  <p className="text-balance text-sm text-slate-500">We use your calendar to predict spending events before they happen.</p>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <GoogleCalendarSyncButton onSyncComplete={() => {}} />
              </div>

              {mode === "onboarding" && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => handleNextStep(2)}
                    className="group flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                  >
                    Continue to Bank Sync
                    <TbArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Plaid */}
          {isStepVisible(2) && (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <TbBuildingBank className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black">2. Connect Your Bank Accounts</h2>
                  <p className="text-balance text-sm text-slate-500">Securely link your accounts to track live balances and transaction data.</p>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <PlaidLinkButton />
              </div>

              {mode === "onboarding" && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
                  >
                    <TbArrowLeft className="h-5 w-5" /> Back
                  </button>
                  <button
                    onClick={() => handleNextStep(3)}
                    className="group flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                  >
                    Continue to Debts
                    <TbArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Debts */}
          {isStepVisible(3) && (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                    <TbCreditCard className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">3. Your Outstanding Debts</h2>
                    <p className="text-sm text-slate-500">List all balances you wish to eliminate.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {debts.map((d) => (
                  <DebtInputField key={d.id} id={d.id} debt={d} onRemoveClick={removeDebtElement} onFieldChange={onDebtFieldChange} showErrors={showErrors} />
                ))}
                <div className="flex justify-center">
                  <AddButton onClick={addDebtElement}>Add another debt source</AddButton>
                </div>
              </div>

              {mode === "onboarding" && (
                <div className="mt-12 flex items-center justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
                  >
                    <TbArrowLeft className="h-5 w-5" /> Back
                  </button>
                  <button
                    onClick={() => handleNextStep(4)}
                    className="group flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3.5 font-bold text-white transition-all hover:bg-slate-800"
                  >
                    Define Triggers
                    <TbArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Spending Triggers */}
          {isStepVisible(4) && (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                  <TbCoin className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black">4. Smart Spending Triggers</h2>
                  <p className="text-sm text-slate-500">Estimates for activities found in your calendar.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {activities.map((a) => (
                  <ActivityInputField
                    key={a.id}
                    id={a.id}
                    activity={a}
                    onFieldChange={onActivityFieldChange}
                    onRemove={removeActivityElement}
                    showErrors={showErrors}
                  />
                ))}
                <div className="flex justify-center">
                  <AddButton onClick={addActivityElement}>Add another trigger</AddButton>
                </div>
              </div>

              {mode === "onboarding" && (
                <div className="mt-12 flex items-center justify-between">
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
                  >
                    <TbArrowLeft className="h-5 w-5" /> Back
                  </button>
                  <button
                    onClick={() => handleNextStep(5)}
                    className="group flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                  >
                    Set Income & Goals
                    <TbArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Income & Split */}
          {isStepVisible(5) && (
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-500">
                  <TbWallet className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black">5. Income & Allocation Goal</h2>
                  <p className="text-sm text-slate-500">Determine how your surplus funds are distributed.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Monthly Net Income</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        value={monthlyIncome || ""}
                        placeholder="0.00"
                        onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                        className={`w-full rounded-2xl border border-slate-200 bg-white px-8 py-4 text-2xl font-black text-slate-900 outline-none transition-colors focus:border-green-400 focus:ring-4 focus:ring-green-50 ${showErrors && monthlyIncome <= 0 ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Strict Monthly Limit</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        value={monthlyLimit || ""}
                        placeholder="0.00"
                        onChange={(e) => setMonthlyLimit(parseFloat(e.target.value) || 0)}
                        className={`w-full rounded-2xl border border-slate-200 bg-white px-8 py-4 text-2xl font-black text-slate-900 outline-none transition-colors focus:border-green-400 focus:ring-4 focus:ring-green-50 ${showErrors && (monthlyLimit < 0 || monthlyLimit > monthlyIncome) ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}`}
                      />
                    </div>
                    <p className="mt-2 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Excludes debt minimums</p>
                  </div>

                  {monthlyIncome > 0 && (
                    <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-500">Total Min. Payments</span>
                        <span className="font-bold text-slate-900">-${totalMinimumPayments.toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-slate-200" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-widest text-slate-900">Leftover Flow</span>
                        <span className={`text-xl font-black ${amountLeftOver >= 0 ? "text-green-500" : "text-red-500"}`}>
                          ${amountLeftOver.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* DOUBLE SLIDER ALLOCATOR */}
                <div className="flex flex-col gap-8 rounded-2xl border border-slate-100 bg-white p-8">
                  <div className="text-center">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Split Allocation</p>
                    <h3 className="text-sm font-black text-slate-900">Where should your leftover flow go?</h3>
                  </div>

                  {amountLeftOver <= 0 ?
                    <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm italic text-slate-400">
                      Please enter a monthly income and limit to see splitting options.
                    </div>
                  : <div className="flex flex-col gap-10">
                      <div className="relative pt-6">
                        {/* Custom visual track */}
                        <div className="absolute top-8 flex h-4 w-full overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-blue-400 transition-all" style={{ width: `${savingsPct}%` }} />
                          <div className="h-full flex-1 bg-emerald-400 transition-all" />
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={savingsPct}
                          onChange={(e) => setSavingsPct(Number(e.target.value))}
                          className="absolute left-0 top-8 h-4 w-full cursor-pointer appearance-none bg-transparent accent-white"
                          style={{ WebkitAppearance: "none" }}
                        />
                        <style jsx>{`
                          input[type="range"]::-webkit-slider-thumb {
                            -webkit-appearance: none;
                            height: 28px;
                            width: 28px;
                            border-radius: 50%;
                            background: white;
                            box-shadow:
                              0 4px 6px -1px rgb(0 0 0 / 0.1),
                              0 2px 4px -2px rgb(0 0 0 / 0.1);
                            border: 4px solid #1e293b;
                            cursor: pointer;
                            margin-top: -6px;
                            position: relative;
                            z-index: 20;
                          }
                          input[type="range"]::-moz-range-thumb {
                            height: 28px;
                            width: 28px;
                            border-radius: 50%;
                            background: white;
                            box-shadow:
                              0 4px 6px -1px rgb(0 0 0 / 0.1),
                              0 2px 4px -2px rgb(0 0 0 / 0.1);
                            border: 4px solid #1e293b;
                            cursor: pointer;
                            z-index: 20;
                          }
                        `}</style>

                        <div className="mt-10 flex justify-between px-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Savings</span>
                            <span className="text-lg font-black">{savingsPct}%</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Debt Acceleration</span>
                            <span className="text-lg font-black">{100 - savingsPct}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-blue-50 p-5 text-center transition-all hover:scale-105">
                          <TbPigMoney className="mx-auto mb-2 h-6 w-6 text-blue-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">To Savings</p>
                          <p className="text-2xl font-black text-blue-600">${toSavings.toFixed(0)}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-5 text-center transition-all hover:scale-105">
                          <TbCoin className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Extra Debt Repayment</p>
                          <p className="text-2xl font-black text-emerald-600">${toDebt.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              {mode === "onboarding" && (
                <div className="mt-12 flex items-center justify-between">
                  <button
                    onClick={() => setStep(4)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
                  >
                    <TbArrowLeft className="h-5 w-5" /> Back
                  </button>
                  <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-10 py-4 font-black uppercase tracking-widest text-white shadow-lg shadow-green-200 transition-all hover:bg-green-600 active:scale-95 disabled:opacity-50"
                  >
                    {saving ?
                      <TbLoader className="h-5 w-5 animate-spin" />
                    : "Blast Off"}
                    <TbCheck className="h-6 w-6" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Action Bar (Mode: Edit) */}
        {mode === "edit" && (
          <div className="sticky bottom-8 mt-12 flex flex-col gap-4">
            {error && (
              <div className="mx-auto w-full max-w-sm animate-bounce rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-600">
                {error}
              </div>
            )}
            {saved && (
              <div className="mx-auto w-full max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-600">
                Setup saved successfully!
              </div>
            )}
            <button
              onClick={onSave}
              disabled={saving}
              className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-5 text-lg font-black text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
            >
              {saving ?
                <TbLoader className="h-6 w-6 animate-spin" />
              : "Save changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
