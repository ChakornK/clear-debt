import { Activity } from "react";

export const ActivityInputField = ({ value } : { value: number }) => {
    const activityCategories = ["Entertainment", "Social outing", "Eating out", "Health", "Work", "School", "Travel", "Self-care"];

    return(
      <div>
        <div className="flex flex-row gap-4">
          <div className="flex flex-col items-center text-center gap-3 bg-white p-4 rounded-xl border border-green-200">
            {/* title */}
            <input
                type="text"
                placeholder="e.g. Coffee"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 text-base p-2 border"
            />
            {/* category */}
            <div className="relative">
                <select defaultValue={value} className="block appearance-none w-full border border-green-200 hover:border-green-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline">
                    {activityCategories.map((ac, i) => (
                        <option key={i} value={i}>{ac}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                </div>
                </div>
            {/* price */}
            <input
                type="text"
                placeholder="$7"
                className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
            />
          </div>
        </div>
      </div>
    );
  }
  