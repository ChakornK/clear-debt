import { DebtType } from "@/types/types";
import { TbSquareRoundedXFilled } from "react-icons/tb";
import { MouseEventHandler } from 'react';

interface DebtInputFieldProps {
  id: string,
  onRemoveClick: MouseEventHandler<HTMLButtonElement>,
  onChange: any
}

export const DebtInputField = ({ id, onRemoveClick, onChange } : DebtInputFieldProps) => {
  const debtTypes = Object.keys(DebtType).filter(
    (key) => isNaN(Number(key))
  );

    return(
      <div className="flex flex-row gap-4">
        <div>
        <div className="flex flex-col w-fit p-4 rounded-2xl gap-4 border border-green-200">
          <div className="flex flex-row gap-4">
          {/* name */}
          <div>
            <p className="text-sm font-semibold ml-1">Debt Name</p>
            <input
              type="text"
              name="name"
              placeholder="e.g. Credit Card"
              onChange={onChange}
              className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* type */}
          <div>
            <p className="text-sm font-semibold ml-1">Debt Type</p>
            <select name="type" defaultValue={debtTypes[0]} onChange={onChange} className="block appearance-none w-full border border-green-200 hover:border-green-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline">
              {debtTypes.map((dt, i) => (
                  <option key={i} value={i}>{dt}</option>
              ))}
            </select>
          </div>
          {/* balance */}
          <div>
            <p className="text-sm font-semibold ml-1">Amount ($)</p>
            <input
                type="text"
                name="balance"
                placeholder="5,000"
                onChange={onChange}
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* interest rate */}
          <div>
            <p className="text-sm font-semibold ml-1">Interest Rate (%)</p>
            <input
                type="text"
                name="apr"
                placeholder="18.5"
                onChange={onChange}
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
        <div className="flex flex-row gap-4">
          {/* minimum payment */}
          <div>
            <p className="text-sm font-semibold ml-1">Minimum Monthly Payment ($)</p>
            <input
                type="text"
                name="minimum"
                placeholder="25"
                onChange={onChange}
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
          {/* due date */}
          <div>
            <p className="text-sm font-semibold ml-1">Monthly Payment Due Date</p>
            <input
                type="number"
                name="due"
                min={1}
                max={28}
                placeholder="21"
                onChange={onChange}
                className="mt-1 w-fit block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
        </div> 
        </div>
        <button type="button" id={id} onClick={onRemoveClick}>
          <div className="text-red-400">
            <TbSquareRoundedXFilled />
          </div>
        </button>
      </div>
    );
  }
