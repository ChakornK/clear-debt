"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  TbChevronLeft,
  TbChevronRight,
  TbHome,
  TbToolsKitchen2,
  TbCar,
  TbBuildingHospital,
  TbDeviceTv,
  TbShoppingBag,
  TbCreditCard,
  TbQuestionMark,
  TbReportMoney,
  TbCalendarEvent,
  TbPlus,
  TbList,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import Modal from "@/components/Modal";
import { apiFetch } from "@/lib/api";

type EventType = "Housing" | "Food & Dining" | "Transportation" | "Healthcare" | "Entertainment" | "Shopping" | "Debt Payments" | "Other" | "default";

interface CalendarEvent {
  date: string;
  type: string;
  label: string;
  amount: number;
  is_income?: boolean;
}

interface TypeConfigEntry {
  dot: string;
  Icon: IconType;
  badge: string;
  iconClass: string;
}

interface PopoverPosition {
  top: number;
  left: number;
  arrowLeft: number;
  arrowSide: "top" | "bottom";
}

interface PopoverState {
  day: number;
  anchor: HTMLElement;
}

interface PopoverProps {
  anchor: HTMLElement;
  events: CalendarEvent[];
  year: number;
  month: number;
  day: number;
  onClose: () => void;
  onAddExpense: (date: string) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

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

const POPOVER_WIDTH = 320;
const POPOVER_MARGIN = 8;
const SCREEN_PADDING = 12;
const ARROW_SIZE = 8;

const getTypeConfig = (type: string): TypeConfigEntry => TYPE_CONFIG[type as EventType] ?? TYPE_CONFIG.default;

function buildEventMap(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((map, ev) => {
    const d = ev.date.split("T")[0];
    (map[d] ??= []).push(ev);
    return map;
  }, {});
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
function daysInPrevMonth(year: number, month: number): number {
  return new Date(year, month - 1, 0).getDate();
}

function calcPopoverPosition(cellRect: DOMRect, popoverHeight: number): PopoverPosition {
  const vw = window.innerWidth;
  const scrollY = window.scrollY;

  const spaceBelow = window.innerHeight - cellRect.bottom;
  const spaceAbove = cellRect.top;
  const placeBelow = spaceBelow >= popoverHeight + POPOVER_MARGIN || spaceBelow >= spaceAbove;

  let top = placeBelow ? cellRect.bottom + scrollY + POPOVER_MARGIN : cellRect.top + scrollY - popoverHeight - POPOVER_MARGIN;

  top = Math.max(scrollY + SCREEN_PADDING, top);

  const cellCentreX = cellRect.left + cellRect.width / 2;
  let left = cellCentreX - POPOVER_WIDTH / 2;
  left = Math.max(SCREEN_PADDING, Math.min(left, vw - POPOVER_WIDTH - SCREEN_PADDING));

  const arrowCentreInPopover = cellCentreX - left;
  const arrowLeft = Math.max(ARROW_SIZE + 4, Math.min(arrowCentreInPopover, POPOVER_WIDTH - ARROW_SIZE - 4));

  return { top, left, arrowLeft, arrowSide: placeBelow ? "top" : "bottom" };
}

interface AddExpenseFields {
  label: string;
  amount: string;
  type: Exclude<EventType, "default">;
  date: string;
}

const EXPENSE_TYPES: Exclude<EventType, "default">[] = [
  "Housing",
  "Food & Dining",
  "Transportation",
  "Healthcare",
  "Entertainment",
  "Shopping",
  "Debt Payments",
  "Other",
];

function AddExpenseForm({ date, onChange }: { date: string; onChange: (fields: AddExpenseFields) => void }) {
  const [fields, setFields] = useState<AddExpenseFields>({ label: "", amount: "", type: "Other", date });

  function update<K extends keyof AddExpenseFields>(key: K, value: AddExpenseFields[K]): void {
    const next = { ...fields, [key]: value };
    setFields(next);
    onChange(next);
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-100";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Date</label>
        <input type="date" value={fields.date} onChange={(e) => update("date", e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Label</label>
        <input type="text" placeholder="e.g. Grocery Run" value={fields.label} onChange={(e) => update("label", e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={fields.amount}
            onChange={(e) => update("amount", e.target.value)}
            className={`${inputClass}pl-7`}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Type</label>
        <div className="grid grid-cols-2 gap-2">
          {EXPENSE_TYPES.map((t) => {
            const cfg = TYPE_CONFIG[t];
            const isActive = fields.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => update("type", t)}
                className={[
                  "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                  isActive ? `${cfg.badge} border-transparent` : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                <cfg.Icon className="h-3.5 w-3.5" />
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventPopover({ anchor, events, year, month, day, onClose, onAddExpense }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPosition | null>(null);

  const reposition = useCallback(() => {
    if (!anchor || !popoverRef.current) return;
    const cellRect = anchor.getBoundingClientRect();
    const popoverHeight = popoverRef.current.offsetHeight;
    setPos(calcPopoverPosition(cellRect, popoverHeight));
  }, [anchor]);

  useEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [reposition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && anchor && !anchor.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchor, onClose]);

  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const boxStyle: React.CSSProperties =
    pos ?
      { position: "absolute", top: pos.top, left: pos.left, width: POPOVER_WIDTH }
    : { position: "absolute", visibility: "hidden", top: 0, left: 0, width: POPOVER_WIDTH };

  const arrowBoxSize = ARROW_SIZE * 2;
  const arrowStyle: React.CSSProperties =
    pos ?
      {
        position: "absolute",
        width: arrowBoxSize,
        height: arrowBoxSize,
        left: pos.arrowLeft - ARROW_SIZE,
        ...(pos.arrowSide === "top" ? { top: -ARROW_SIZE } : { bottom: -ARROW_SIZE }),
      }
    : { display: "none" };

  return createPortal(
    <div
      ref={popoverRef}
      style={boxStyle}
      className="z-9999 rounded-2xl border border-green-200 bg-white p-5 shadow-2xl ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow diamond */}
      <div
        style={arrowStyle}
        className={["bg-white border-green-200 rotate-45", pos?.arrowSide === "top" ? "border-l border-t" : "border-r border-b"].join(" ")}
      />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{dateLabel}</h3>
        <span className="rounded bg-green-100 px-2 py-1 text-[10px] font-bold uppercase text-green-700">
          {events.length} Event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Event list */}
      <div className="space-y-3">
        {events.map((ev, i) => {
          const cfg = getTypeConfig(ev.type);
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border p-3 ${ev.is_income ? "border-green-200 bg-green-50" : "border-slate-100 bg-slate-50"}`}
            >
              <cfg.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ev.is_income ? "text-green-500" : cfg.iconClass}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{ev.label}</p>
                  {ev.is_income && <span className="shrink-0 rounded bg-green-500 px-1 py-0.5 text-[8px] font-bold uppercase text-white">Income</span>}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>{ev.type}</span>
                  <span className={ev.is_income ? "font-bold text-green-600" : ""}>
                    {ev.is_income ? "+" : ""}${ev.amount.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          onAddExpense(toDateStr(year, month, day));
          onClose();
        }}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
      >
        <TbPlus className="h-4 w-4" />
        Add Expense
      </button>
    </div>,
    document.body,
  );
}

export default function Calendar() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // State for the Add Expense modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalDate, setModalDate] = useState<string>("");
  const [pendingExpense, setPendingExpense] = useState<AddExpenseFields | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await apiFetch("/api/calendar");
      if (res.ok) {
        const json = await res.json();
        setEvents(json.events);
      }
    } catch (err) {
      console.error("Failed to fetch calendar events", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const eventMap = useMemo(() => buildEventMap(events), [events]);

  function prevMonth(): void {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
    setPopover(null);
  }
  function nextMonth(): void {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
    setPopover(null);
  }

  const closePopover = useCallback((): void => setPopover(null), []);

  function handleDayClick(day: number, e: React.MouseEvent<HTMLDivElement>): void {
    if (popover?.day === day) {
      setPopover(null);
      return;
    }
    setPopover({ day, anchor: e.currentTarget });
  }

  // Opens the modal pre-filled with the clicked day's date
  function handleAddExpense(date: string): void {
    setModalDate(date);
    setPendingExpense(null);
    setModalOpen(true);
  }

  async function handleModalConfirm() {
    if (!pendingExpense) return;
    try {
      await apiFetch("/api/calendar", {
        method: "POST",
        body: JSON.stringify([
          {
            date: pendingExpense.date,
            type: pendingExpense.type,
            label: pendingExpense.label,
            amount: parseFloat(pendingExpense.amount) || 0,
          },
        ]),
      });
      fetchEvents();
    } catch (err) {
      console.error("Failed to add expense", err);
    }
    setModalOpen(false);
  }

  function handleModalCancel(): void {
    setModalOpen(false);
  }

  const startWeekday = firstWeekday(year, month);
  const totalDays = daysInMonth(year, month);
  const prevTail = Array.from({ length: startWeekday }, (_, i) => daysInPrevMonth(year, month) - startWeekday + 1 + i);
  const currDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const totalCells = prevTail.length + totalDays;
  const nextCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextHead = Array.from({ length: nextCount }, (_, i) => i + 1);

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthEvents = events.filter((ev) => ev.date.startsWith(monthPrefix));
  const totalSpending = monthEvents.filter((e) => !e.is_income).reduce((s, ev) => s + ev.amount, 0);
  const totalIncome = monthEvents.filter((e) => e.is_income).reduce((s, ev) => s + ev.amount, 0);
  const uniqueDays = new Set(monthEvents.map((e) => e.date.split("T")[0])).size;

  const selectedEvents: CalendarEvent[] = popover ? (eventMap[toDateStr(year, month, popover.day)] ?? []) : [];

  return (
    <>
      <main className="min-h-dvh mx-auto flex max-w-7xl flex-col items-stretch bg-white p-6 text-slate-900 lg:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Financial Calendar</h1>
            <p className="text-slate-500">Manage your scheduled expenses and subscriptions</p>
          </div>
          <div className="justify-center-safe flex w-64 items-center rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
            <button className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-slate-100" onClick={prevMonth}>
              <TbChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-0 shrink grow whitespace-nowrap text-center font-bold">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-slate-100" onClick={nextMonth}>
              <TbChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex grow flex-col items-stretch overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="py-4 text-center text-xs font-bold uppercase text-slate-500">
                {d}
              </div>
            ))}
          </div>

          <div className="min-h-83.75 grid grow grid-cols-7">
            {prevTail.map((day) => (
              <div key={`prev-${day}`} className="border-b border-r border-slate-100 bg-slate-50/50 p-4 text-slate-300">
                {day}
              </div>
            ))}

            {currDays.map((day, idx) => {
              const dayEvents = eventMap[toDateStr(year, month, day)] ?? [];
              const isSelected = popover?.day === day;
              return (
                <div
                  key={`curr-${day}`}
                  onClick={(e) => handleDayClick(day, e)}
                  className={[
                    "relative cursor-pointer border-b border-r border-slate-100 p-4 font-medium transition-colors",
                    isSelected ? "bg-green-50" : "hover:bg-slate-50",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={isSelected ? "font-bold text-green-600" : ""}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 4).map((ev, i) => (
                        <div key={i} className={`size-1.5 rounded-full ${ev.is_income ? "bg-green-400" : getTypeConfig(ev.type).dot}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {nextHead.map((day, idx) => (
              <div key={`next-${day}`} className={`bg-slate-50/50 p-4 text-slate-300 ${idx < nextHead.length - 1 ? "border-r border-slate-100" : ""}`}>
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Summary Bar */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <TbReportMoney className="h-5 w-5 text-green-600" />
              <h4 className="font-bold">Monthly Income</h4>
            </div>
            <p className="text-3xl font-black text-green-600">+${totalIncome.toFixed(2)}</p>
            <p className="mt-1 text-sm text-slate-500">
              For {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <TbCreditCard className="h-5 w-5 text-rose-600" />
              <h4 className="font-bold">Monthly Spending</h4>
            </div>
            <p className="text-3xl font-black text-rose-600">-${totalSpending.toFixed(2)}</p>
            <p className="mt-1 text-sm text-slate-500">Estimated & Actual</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <TbCalendarEvent className="h-5 w-5 text-slate-400" />
              <h4 className="font-bold">Events This Month</h4>
            </div>
            <p className="text-3xl font-black text-slate-700">{monthEvents.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              Across {uniqueDays} day{uniqueDays !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="hidden rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:block">
            <div className="mb-2 flex items-center gap-3">
              <TbList className="h-5 w-5 text-slate-400" />
              <h4 className="font-bold">Legend</h4>
            </div>
            <div className="ml-1 mt-1 space-y-1.5">
              {(Object.entries(TYPE_CONFIG) as [EventType, TypeConfigEntry][])
                .filter(([k]) => k !== "default")
                .map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className={`size-2 rounded-full ${cfg.dot}`} />
                    <span className="capitalize">{type}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>

      {popover && (
        <EventPopover
          anchor={popover.anchor}
          events={selectedEvents}
          year={year}
          month={month}
          day={popover.day}
          onClose={closePopover}
          onAddExpense={handleAddExpense}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Expense"
        confirmText="Add Expense"
        cancelText="Cancel"
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      >
        <AddExpenseForm date={modalDate} onChange={(fields) => setPendingExpense(fields)} />
      </Modal>
    </>
  );
}
