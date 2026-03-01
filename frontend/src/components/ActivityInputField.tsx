import { TbSquareRoundedXFilled } from "react-icons/tb";
import { TbHome, TbToolsKitchen2, TbCar, TbBuildingHospital, TbDeviceTv, TbShoppingBag, TbCreditCard, TbQuestionMark, TbReportMoney } from "react-icons/tb";

const TYPE_CONFIG: Record<string, { dot: string; Icon: any; badge: string; iconClass: string }> = {
  "Housing": { dot: "bg-emerald-400", Icon: TbHome, badge: "bg-emerald-500/10 text-emerald-400", iconClass: "text-emerald-400" },
  "Food & Dining": { dot: "bg-orange-400", Icon: TbToolsKitchen2, badge: "bg-orange-500/10 text-orange-400", iconClass: "text-orange-400" },
  "Transportation": { dot: "bg-blue-400", Icon: TbCar, badge: "bg-blue-500/10 text-blue-400", iconClass: "text-blue-400" },
  "Healthcare": { dot: "bg-rose-400", Icon: TbBuildingHospital, badge: "bg-rose-500/10 text-rose-400", iconClass: "text-rose-400" },
  "Entertainment": { dot: "bg-purple-400", Icon: TbDeviceTv, badge: "bg-purple-500/10 text-purple-400", iconClass: "text-purple-400" },
  "Shopping": { dot: "bg-amber-400", Icon: TbShoppingBag, badge: "bg-amber-500/10 text-amber-400", iconClass: "text-amber-400" },
  "Debt Payments": { dot: "bg-red-400", Icon: TbCreditCard, badge: "bg-red-500/10 text-red-400", iconClass: "text-red-400" },
  "Income": { dot: "bg-green-400", Icon: TbReportMoney, badge: "bg-green-500/10 text-green-400", iconClass: "text-green-400" },
  "Other": { dot: "bg-slate-400", Icon: TbQuestionMark, badge: "bg-slate-500/10 text-slate-400", iconClass: "text-slate-400" },
};

const activityCategories = ["Housing", "Food & Dining", "Transportation", "Healthcare", "Entertainment", "Shopping", "Debt Payments", "Income", "Other"];

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
  showErrors?: boolean;
}

export const ActivityInputField = ({ id, activity, onFieldChange, onRemove, showErrors }: ActivityInputFieldProps) => {
  const currentCategory = activity.category || "Other";
  const CatIcon = TYPE_CONFIG[currentCategory]?.Icon || TbQuestionMark;
  const badgeClass = TYPE_CONFIG[currentCategory]?.badge || TYPE_CONFIG["Other"].badge;

  return (
    <div className="relative flex w-full flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-sm transition-all hover:border-slate-600">
      <button type="button" onClick={() => onRemove(id)} className="absolute right-4 top-4 text-slate-500 transition-colors hover:text-red-400">
        <TbSquareRoundedXFilled className="h-6 w-6" />
      </button>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Activity Name</label>
          <input
            type="text"
            value={activity.name}
            placeholder="e.g. Coffee"
            onChange={(e) => onFieldChange(id, "name", e.target.value)}
            className={`w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-500/10 ${showErrors && !activity.name ? "border-red-500/20 bg-red-500/10 focus:ring-red-500/5 text-red-100" : ""}`}
          />
        </div>

        <div className="w-1/3 min-w-[120px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Amount ($)</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">$</span>
            <input
              type="number"
              min={0}
              value={activity.estimatedCost || ""}
              placeholder="0.00"
              onChange={(e) => onFieldChange(id, "estimatedCost", parseFloat(e.target.value) || 0)}
              className={`w-full rounded-xl border border-slate-700 bg-slate-800 py-2 pl-7 pr-3 text-sm text-white outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-500/10 ${showErrors && activity.estimatedCost < 0 ? "border-red-500/20 bg-red-500/10 focus:ring-red-500/5 text-red-100" : ""}`}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Category</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {activityCategories.map((cat) => {
            const cfg = TYPE_CONFIG[cat];
            const isActive = activity.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onFieldChange(id, "category", cat)}
                className={[
                  "flex justify-start items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                  isActive ? `${cfg.badge} border-transparent` : "border-slate-700 bg-slate-800/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300",
                ].join(" ")}
              >
                <cfg.Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
