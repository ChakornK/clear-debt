"use client";

import { ActivityInputField } from "@/components/ActivityInputField";
import { DebtInputField } from "@/components/DebtInputField";
import PrimaryButton from "@/components/PrimaryButton";
import { useState } from "react";
import { TbSquareRoundedPlusFilled } from "react-icons/tb";

export default function Setup() {
  const [debt, setDebt] = useState([{ key: 1 }]);
  const [activities, setActivities] = useState([ { key: 1, value: 2 } ]);

  const addDebtElement = () => {
    const newKey = debt.length + 1;
    const newDebt = { key: newKey };
    setDebt(prevDebt => [...prevDebt, newDebt]);
  }

  const addActivityElement = () => {
    const newKey = activities.length + 1;
    const newActivity = { key: newKey, value: 2 };
    setActivities(prevActivities => [...prevActivities, newActivity]);
  }

  const func = () => {
    console.log("Button clicked");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 xl:px-20 xl:py-8">
      <div>
      {/* Calendar Connection */}
      <div className="px-6 py-7">
        <div className="flex flex-col gap-2 mb-6">
          {/* title */}
          <p className="text-2xl font-bold">Sync Your Schedule</p>
          {/* subtext */}
          <p className="text-slate-600 dark:text-slate-400 pb-4">Identify potential spending triggers by connecting your calendars.</p>
          {/* connect calendar buttons */}
          <div className="flex flex-row gap-4">
            <PrimaryButton onClick={func}>Connect Google Calendar</PrimaryButton>
            <PrimaryButton onClick={func}>Connect Outlook Calendar</PrimaryButton>
            <PrimaryButton onClick={func}>Connect Apple Calender</PrimaryButton>
          </div>
        </div>
      </div>
      
      {/* Debt */}
      <div className="px-6 py-7 bg-white rounded-2xl shadow-sm border border-green-200">
        <div className="flex flex-col gap-2 mb-6">
          {/* title */}
          <p className="text-2xl font-bold">Add Your Debts</p>
          {/* subtext */}
          <p className="text-slate-600 dark:text-slate-400 pb-4">List your outstanding balances to calculate your payoff strategy.</p>
          {/* debt input fields */}
          {debt.map((d) => (
            <DebtInputField key={d.key} />
          ))}
          {/* add button */}
          <button type="button" onClick={addDebtElement} className="mt-6 flex items-center gap-2 font-bold text-green-400">
            <div className="flex flex-row gap-2 items-center">
              <div className="text-green-400">
                <TbSquareRoundedPlusFilled />
              </div>
              <p>Add another debt</p>
            </div>
          </button>
        </div>
      </div>

      {/* Spending Triggers */}
      <div className="px-6 py-7">
        <div className="flex flex-col gap-2 mb-6">
          {/* title */}
          <p className="text-2xl font-bold">Smart Spending Triggers</p>
          {/* subtext */}
          <p className="text-slate-600 dark:text-slate-400 pb-4">Set estimated costs for common activities detected in your calendar.</p>
          {/* activity input fields */}
          <div className="flex flex-row gap-4">
            {activities.map((a) => (
            <ActivityInputField key={a.key} value={a.value} />
          ))}
          </div>
          {/* add button */}
          <button type="button" onClick={addActivityElement} className="mt-6 flex items-center gap-2 font-bold text-green-400">
            <div className="flex flex-row gap-2 items-center">
              <div className="text-green-400">
                <TbSquareRoundedPlusFilled />
              </div>
              <p>Add another activity</p>
            </div>
          </button>
        </div>
      </div>

      {/* Income & Spending Limit */}
      <div className="px-6 py-7 bg-green-50 rounded-2xl shadow-sm border border-green-400 border-dashed">
        <div className="flex flex-col gap-2 mb-6">
          {/* title */}
          <p className="text-2xl font-bold">Income & Goal</p>
          {/* subtext */}
          <p className="text-slate-600 dark:text-slate-400 pb-4">Balance your lifestyle with your debt goals.</p>
          {/* monthly income */}
          <p className="font-semibold ml-1">Monthly Income ($)</p>
            <input
                type="text"
                placeholder="e.g. 4500"
                className="mt-1 block rounded-md text-green-600 bg-white border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 p-2 border"
            />
        </div>
      </div>

      {/* Save Button */}
      </div>
    </main>
  );
}
