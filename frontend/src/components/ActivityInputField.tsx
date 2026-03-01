import { TbSquareRoundedXFilled } from "react-icons/tb";

interface ActivityInputFieldProps {
  id: number;
  activity: {
    id: number;
    name: string;
    category: string;
    estimatedCost: number;
  };
  onFieldChange: (id: number, field: string, value: string | number) => void;
  onRemove: (id: number) => void;
}

export const ActivityInputField = ({ id, activity, onFieldChange, onRemove }: ActivityInputFieldProps) => {
  const activityCategories = [
    "Entertainment", "Social outing", "Eating out",
    "Health", "Work", "School", "Travel", "Self-care"
  ];

  return (
    <div className="flex flex-col items-center text-center gap-3 bg-white p-4 rounded-xl border border-green-200 shadow-sm relative">
      {/* remove button */}
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xl"
        >
        <TbSquareRoundedXFilled />
      </button>
      {/* activity name */}
      <input
        type="text"
        value={activity.name}
        placeholder="e.g. Coffee"
        onChange={(e) => onFieldChange(id, 'name', e.target.value)}
        className="mt-1 block rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 text-base p-2 border w-full"
      />
      {/* category */}
      <div className="relative w-full">
        <select
          value={activity.category}
          onChange={(e) => onFieldChange(id, 'category', e.target.value)}
          className="block appearance-none w-full border border-green-200 hover:border-green-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
        >
          {activityCategories.map((ac, i) => (
            <option key={i} value={ac}>{ac}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      {/* estimated cost */}
      <div className="w-full">
        <p className="text-xs text-slate-500 mb-1">Estimated Cost ($)</p>
        <input
          type="number"
          min={0}
          value={activity.estimatedCost || ''}
          placeholder="7"
          onChange={(e) => onFieldChange(id, 'estimatedCost', parseFloat(e.target.value) || 0)}
          className="mt-1 block w-full rounded-md border-green-200 shadow-sm focus:border-green-400 focus:ring-green-400 sm:text-sm p-2 border"
        />
      </div>
    </div>
  );
};