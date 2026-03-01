"use client";

import { ActivityInputField } from "@/components/ActivityInputField";
import { DebtInputField } from "@/components/DebtInputField";
import CalendarButton from "@/components/CalendarButton";
import { useEffect, useState } from "react";
import { TbArrowBigRightLines } from "react-icons/tb";
import AddButton from "@/components/AddButton";
import api from "@/api/axios";
import { MouseEvent } from 'react';
import { DebtType } from "@/types/types";

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
    }
  ]);

  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, name: "", category: "Eating out", estimatedCost: 0 }
  ]);

  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Calculate amount left over
  const totalMinimumPayments = debts.reduce((sum, d) => sum + (d.minimum || 0), 0);
  const amountLeftOver = monthlyIncome - monthlyLimit - totalMinimumPayments;

  // ── DEBT HANDLERS ──────────────────────────────────

  const addDebtElement = () => {
    const newDebt: Debt = {
      id: `debt-${Date.now()}`,
      name: "",
      type: DebtType.Other,
      balance: 0,
      apr: 0,
      minimum: 0,
      due: 1,
      source: "manual",
    };
    setDebts(prev => [...prev, newDebt]);
  };

  const removeDebtElement = (event: MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.getAttribute("id");
    setDebts(prev => prev.filter(d => d.id !== id));
  };

  const onDebtFieldChange = (id: string, field: string, value: string | number | DebtType) => {
  setDebts(prev =>
    prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  // ── ACTIVITY HANDLERS ──────────────────────────────

  const addActivityElement = () => {
    const newActivity: Activity = {
      id: Date.now(),
      name: "",
      category: "Eating out",
      estimatedCost: 0,
    };
    setActivities(prev => [...prev, newActivity]);
  };

  const removeActivityElement = (id: number) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  };

  const onActivityFieldChange = (id: number, field: string, value: string | number) => {
    setActivities(prev =>
      prev.map(a => a.id === id ? { ...a, [field]: value } : a)
    );
  };

  // ── SAVE ───────────────────────────────────────────

  const onSave = async () => {
    setError("");

    // Validate debts
    const invalidDebts = debts.filter(d => !d.name || d.balance <= 0);
    if (invalidDebts.length > 0) {
      setError("Please fill in all debt fields (name and balance are required).");
      return;
    }

    setSaving(true);
    try {
      // Save debts to backend
      await api.post('/debts/save', {
        debts: debts,
        calendar_events: []
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const connectCalendar = (provider: string) => {
    // TODO: implement OAuth flow for each provider
    alert(`${provider} calendar connection coming soon.`);
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 xl:px-20 xl:py-8">
      <div>

        {/* Calendar Connection */}
        <div className="px-6 py-7 mb-6">
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold">Sync Your Schedule</p>
            <p className="text-slate-600 dark:text-slate-400 pb-4">
              Identify potential spending triggers by connecting your calendars.
            </p>
            <div className="flex flex-row gap-4 flex-wrap">
              <CalendarButton onClick={() => connectCalendar('Google')}>Connect Google Calendar</CalendarButton>
              <CalendarButton onClick={() => connectCalendar('Outlook')}>Connect Outlook Calendar</CalendarButton>
              <CalendarButton onClick={() => connectCalendar('Apple')}>Connect Apple Calendar</CalendarButton>
            </div>
          </div>
        </div>

        {/* Debt */}
        <div className="px-6 py-7 bg-white rounded-2xl shadow-sm border border-green-200 mb-6">
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-bold">Add Your Debts</p>
            <p className="text-slate-600 dark:text-slate-400">
              List your outstanding balances to calculate your payoff strategy.
            </p>
            {debts.map((d) => (
              <DebtInputField
                key={d.id}
                id={d.id}
                debt={d}
                onRemoveClick={removeDebtElement}
                onFieldChange={onDebtFieldChange}
              />
            ))}
            <AddButton onClick={addDebtElement}>Add another debt</AddButton>
          </div>
        </div>

        {/* Spending Triggers */}
        <div className="px-6 py-7 mb-6">
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold">Smart Spending Triggers</p>
            <p className="text-slate-600 dark:text-slate-400 pb-4">
              Set estimated costs for common activities detected in your calendar.
            </p>
            <div className="flex flex-row flex-wrap gap-4">
              {activities.map((a) => (
                <ActivityInputField
                  key={a.id}
                  id={a.id}
                  activity={a}
                  onFieldChange={onActivityFieldChange}
                  onRemove={removeActivityElement}
                />
              ))}
            </div>
            <AddButton onClick={addActivityElement}>Add another activity</AddButton>
          </div>
        </div>

        {/* Income & Spending Limit */}
        <div className="px-6 py-7 bg-green-50 rounded-2xl shadow-sm border border-green-400 border-dashed mb-6">
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-bold">Income & Goal</p>
            <p className="text-slate-600 dark:text-slate-400">
              Balance your lifestyle with your debt goals.
            </p>
            <div className="flex flex-row flex-wrap gap-8 items-end">
              {/* monthly income */}
              <div>
                <p className="font-semibold ml-1 mb-1">Monthly Income ($)</p>
                <input
                  type="number"
                  min={0}
                  value={monthlyIncome || ''}
                  placeholder="e.g. 4500"
                  onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  className="w-fit block rounded-md text-green-600 bg-white border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 p-2 border"
                />
              </div>
              {/* monthly spending limit */}
              <div>
                <p className="font-semibold ml-1 mb-1">Monthly Spending Limit ($)</p>
                <input
                  type="number"
                  min={0}
                  value={monthlyLimit || ''}
                  placeholder="e.g. 2800"
                  onChange={(e) => setMonthlyLimit(parseFloat(e.target.value) || 0)}
                  className="w-fit block rounded-md text-green-600 bg-white border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 p-2 border"
                />
              </div>
            </div>

            {/* breakdown */}
            {monthlyIncome > 0 && (
              <div className="flex flex-col gap-2 mt-2 text-sm text-slate-600">
                <div className="flex justify-between max-w-xs">
                  <span>Monthly Income</span>
                  <span className="font-medium text-green-700">${monthlyIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between max-w-xs">
                  <span>Spending Limit</span>
                  <span className="font-medium text-red-500">- ${monthlyLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between max-w-xs">
                  <span>Min. Debt Payments</span>
                  <span className="font-medium text-red-500">- ${totalMinimumPayments.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className={`px-5 py-6 mt-2 rounded-2xl shadow-sm ${amountLeftOver >= 0 ? 'bg-green-400' : 'bg-red-400'}`}>
              <p className="font-bold text-2xl">
                Amount left over: ${amountLeftOver.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {amountLeftOver < 0 && (
                <p className="text-white text-sm mt-1">
                  You're over budget — consider reducing spending or increasing income.
                </p>
              )}
              {amountLeftOver > 0 && (
                <p className="text-green-900 text-sm mt-1">
                  Apply this extra ${amountLeftOver.toFixed(2)}/mo to your debts to pay them off faster.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {saved && (
          <div className="px-4 py-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
            ✓ Your debts have been saved successfully.
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full mt-6 rounded-xl px-4 py-3 flex items-center justify-center gap-2 font-bold bg-green-400 hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
          <TbArrowBigRightLines />
        </button>

      </div>
    </main>
  );
}