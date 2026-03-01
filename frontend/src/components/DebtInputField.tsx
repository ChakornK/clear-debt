import { Debt, DebtType } from "@/types/types";
import { TbSquareRoundedXFilled } from "react-icons/tb";
import { MouseEventHandler } from 'react';

interface DebtInputFieldProps {
  id: string;
  debt: Debt; 
  onRemoveClick: MouseEventHandler<HTMLButtonElement>;
  onFieldChange: (id: string, field: string, value: string | number | DebtType) => void;
}

export const DebtInputField = ({ id, debt, onRemoveClick, onFieldChange }: DebtInputFieldProps) => {
  const debtTypes = Object.keys(DebtType).filter((key) => isNaN(Number(key)));

  return (
    <div className="flex flex-row gap-4 items-start">
      <div className="flex flex-col w-fit p-4 rounded-2xl gap-4 border border-green-200 bg-white shadow-sm">
        <div className="flex flex-row gap-4 flex-wrap">
          {/* name */}
          <div>
            <p className="text-sm font-semibold ml-1">Debt Name</p>
            <input
              type="text"
              value={debt.name}
              placeholder="e.g. Credit Card"
              onChange={(e) => onFieldChange(id, 'name', e.target.value)}
              className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* type */}
          <div>
            <p className="text-sm font-semibold ml-1">Debt Type</p>
            <select
              value={debt.type}
              onChange={(e) => onFieldChange(id, 'type', Number(e.target.value) as DebtType)}
              className="block appearance-none w-full border border-green-200 hover:border-green-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline mt-1"
            >
              {debtTypes.map((dt, i) => (
                <option key={i} value={i}>{dt}</option>
              ))}
            </select>
          </div>
          {/* balance */}
          <div>
            <p className="text-sm font-semibold ml-1">Amount ($)</p>
            <input
              type="number"
              min={0}
              value={debt.balance || ''}
              placeholder="5000"
              onChange={(e) => onFieldChange(id, 'balance', parseFloat(e.target.value) || 0)}
              className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* interest rate */}
          <div>
            <p className="text-sm font-semibold ml-1">Interest Rate (%)</p>
            <input
              type="number"
              min={0}
              step={0.01}
              value={debt.apr || ''}
              placeholder="18.5"
              onChange={(e) => onFieldChange(id, 'apr', parseFloat(e.target.value) || 0)}
              className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
        <div className="flex flex-row gap-4 flex-wrap">
          {/* minimum payment */}
          <div>
            <p className="text-sm font-semibold ml-1">Minimum Monthly Payment ($)</p>
            <input
              type="number"
              min={0}
              value={debt.minimum || ''}
              placeholder="25"
              onChange={(e) => onFieldChange(id, 'minimum', parseFloat(e.target.value) || 0)}
              className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* due date */}
          <div>
            <p className="text-sm font-semibold ml-1">Monthly Payment Due Date</p>
            <input
              type="number"
              min={1}
              max={28}
              value={debt.due || ''}
              placeholder="21"
              onChange={(e) => onFieldChange(id, 'due', parseInt(e.target.value) || 1)}
              className="mt-1 w-24 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
      </div>
      <button type="button" id={id} onClick={onRemoveClick} className="mt-4">
        <div className="text-red-400 hover:text-red-600 text-xl">
          <TbSquareRoundedXFilled />
        </div>
      </button>
    </div>
  );
};