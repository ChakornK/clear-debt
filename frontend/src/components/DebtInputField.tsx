import { DebtType } from "@/types/types";
import { TbSquareRoundedXFilled, TbCreditCard, TbBuildingBank, TbCar, TbSchool, TbHome, TbDots } from "react-icons/tb";
import { MouseEventHandler } from "react";

interface DebtInputFieldProps {
  id: string;
  debt: {
    id: string;
    name: string;
    type: DebtType;
    balance: number;
    apr: number;
    minimum: number;
    due: number;
    source: string;
  };
  onRemoveClick: MouseEventHandler<HTMLButtonElement>;
  onFieldChange: (id: string, field: string, value: string | number) => void;
}

const DEBT_TYPE_ICONS: Record<string, any> = {
  "Credit card": TbCreditCard,
  "Mortgage": TbHome,
  "Student loan": TbSchool,
  "Payday loan": TbBuildingBank,
  "Car loan": TbCar,
  "Other": TbDots,
};

export const DebtInputField = ({ id, debt, onRemoveClick, onFieldChange }: DebtInputFieldProps) => {
  const debtTypes = Object.keys(DebtType).filter((key) => isNaN(Number(key)));

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="group relative flex w-full flex-col gap-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <button type="button" id={id} onClick={onRemoveClick} className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-red-500">
        <TbSquareRoundedXFilled className="h-6 w-6" />
      </button>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Name */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className={labelClass}>Debt Name</label>
          <input
            type="text"
            value={debt.name}
            placeholder="e.g. Sapphire Preferred"
            onChange={(e) => onFieldChange(id, "name", e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Type */}
        <div>
          <label className={labelClass}>Debt Type</label>
          <div className="relative">
            <select value={debt.type} onChange={(e) => onFieldChange(id, "type", e.target.value)} className={`${inputClass}appearance-none pr-8`}>
              {debtTypes.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div>
          <label className={labelClass}>Current Balance</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
            <input
              type="number"
              min={0}
              value={debt.balance || ""}
              placeholder="0.00"
              onChange={(e) => onFieldChange(id, "balance", parseFloat(e.target.value) || 0)}
              className={`${inputClass}pl-7`}
            />
          </div>
        </div>

        {/* APR */}
        <div>
          <label className={labelClass}>Annual Interest (APR %)</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              step={0.01}
              value={debt.apr || ""}
              placeholder="15.99"
              onChange={(e) => onFieldChange(id, "apr", parseFloat(e.target.value) || 0)}
              className={`${inputClass}pr-8 text-right`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Minimum Payment */}
        <div>
          <label className={labelClass}>Minimum Monthly Payment</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
            <input
              type="number"
              min={0}
              value={debt.minimum || ""}
              placeholder="25.00"
              onChange={(e) => onFieldChange(id, "minimum", parseFloat(e.target.value) || 0)}
              className={`${inputClass}pl-7`}
            />
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className={labelClass}>Monthly Due Date (Day)</label>
          <div className="relative">
            <select value={debt.due} onChange={(e) => onFieldChange(id, "due", parseInt(e.target.value) || 1)} className={`${inputClass}appearance-none pr-8`}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
