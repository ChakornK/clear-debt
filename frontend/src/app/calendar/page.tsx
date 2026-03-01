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
  TbTrash,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import Modal from "@/components/Modal";
import { apiFetch } from "@/lib/api";

type EventType =
  | "Housing"
  | "Food & Dining"
  | "Transportation"
  | "Healthcare"
  | "Entertainment"
  | "Shopping"
  | "Debt Payments"
  | "Income"
  | "Other"
  | "default";

interface CalendarEvent {
  date: string;
  type: string;
  label: string;
  amount: number;
  is_income?: boolean;
  source?: "manual" | "transaction" | "generated";
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
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

const TYPE_CONFIG: Record<string, TypeConfigEntry> = {
  "Housing": { dot: "bg-emerald-400", Icon: TbHome, badge: "bg-emerald-500/20 text-emerald-400", iconClass: "text-emerald-500" },
  "Food & Dining": { dot: "bg-orange-400", Icon: TbToolsKitchen2, badge: "bg-orange-500/20 text-orange-400", iconClass: "text-orange-500" },
  "Transportation": { dot: "bg-blue-400", Icon: TbCar, badge: "bg-blue-500/20 text-blue-400", iconClass: "text-blue-500" },
  "Healthcare": { dot: "bg-rose-400", Icon: TbBuildingHospital, badge: "bg-rose-500/20 text-rose-400", iconClass: "text-rose-500" },
  "Entertainment": { dot: "bg-purple-400", Icon: TbDeviceTv, badge: "bg-purple-500/20 text-purple-400", iconClass: "text-purple-500" },
  "Shopping": { dot: "bg-amber-400", Icon: TbShoppingBag, badge: "bg-amber-500/20 text-amber-400", iconClass: "text-amber-500" },
  "Debt Payments": { dot: "bg-red-400", Icon: TbCreditCard, badge: "bg-red-500/20 text-red-400", iconClass: "text-red-500" },
  "Income": { dot: "bg-green-400", Icon: TbReportMoney, badge: "bg-green-500/20 text-green-400", iconClass: "text-green-500" },
  "Other": { dot: "bg-slate-400", Icon: TbQuestionMark, badge: "bg-slate-700 text-slate-400", iconClass: "text-slate-400" },
  "default": { dot: "bg-slate-400", Icon: TbQuestionMark, badge: "bg-slate-700 text-slate-400", iconClass: "text-slate-400" },
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

// ── EXPENSE TYPES ──────────────────────────────────────────────────────────────

export interface AddExpenseFields {
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
  "Income",
  "Other",
];

function AddExpenseForm({
  date,
  initialValues,
  onChange,
  showDelete,
  onDelete,
}: {
  date: string;
  initialValues?: Partial<AddExpenseFields>;
  onChange: (fields: AddExpenseFields) => void;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const [fields, setFields] = useState<AddExpenseFields>({
    label: initialValues?.label ?? "",
    amount: initialValues?.amount ?? "",
    type: initialValues?.type ?? "Other",
    date: initialValues?.date ?? date,
  });

  function update<K extends keyof AddExpenseFields>(key: K, value: AddExpenseFields[K]): void {
    const next = { ...fields, [key]: value };
    setFields(next);
    onChange(next);
  }

  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

  return (
    <div className="space-y-6">
      <div>
        <label className={labelClass}>Description</label>
        <input
          type="text"
          className={inputClass}
          value={fields.label}
          onChange={(e) => update("label", e.target.value)}
          placeholder="What's the expense for?"
        />
      </div>

      <div>
        <label className={labelClass}>Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-7 pr-3 text-sm text-white focus:border-green-500 focus:outline-none"
            value={fields.amount}
            onChange={(e) => update("amount", e.target.value)}
            placeholder="0.00"
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
                  isActive ? `${cfg.badge} border-transparent` : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300",
                ].join(" ")}
              >
                <cfg.Icon className="h-3.5 w-3.5" />
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {showDelete && (
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
        >
          <TbTrash className="h-4 w-4" /> Delete Expense
        </button>
      )}
    </div>
  );
}

// ── POPOVER ────────────────────────────────────────────────────────────────────

function EventPopover({ anchor, events, year, month, day, onClose, onAddExpense, onEditEvent, onDeleteEvent }: PopoverProps) {
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
      className="z-9999 rounded-2xl border border-green-700 bg-slate-800 p-5 shadow-2xl ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow */}
      <div
        style={arrowStyle}
        className={["bg-slate-800 border-green-700 rotate-45", pos?.arrowSide === "top" ? "border-l border-t" : "border-r border-b"].join(" ")}
      />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-white">{dateLabel}</h3>
        <span className="rounded bg-green-500/20 px-2 py-1 text-[10px] font-bold uppercase text-green-400">
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
              className={`flex items-start gap-3 rounded-xl border p-3 ${ev.is_income ? "border-green-700 bg-green-900/20" : "border-slate-700 bg-slate-900/20"}`}
            >
              <cfg.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ev.is_income ? "text-green-400" : cfg.iconClass}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{ev.label}</p>
                  {ev.is_income && <span className="shrink-0 rounded bg-green-500 px-1 py-0.5 text-[8px] font-bold uppercase text-white">Income</span>}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>{ev.type}</span>
                  <span className={ev.is_income ? "font-bold text-green-400" : ""}>
                    {ev.is_income ? "+" : ""}${ev.amount.toFixed(2)}
                  </span>
                </p>
              </div>
              {/* Edit button */}
              <button
                onClick={() => {
                  onEditEvent(ev);
                  onClose();
                }}
                className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-700"
              >
                Edit
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Expense button */}
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

// ── MAIN CALENDAR ─────────────────────────────────────────────────────────────

export default function Calendar() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-indexed for Date object
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  // Add modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [pendingExpense, setPendingExpense] = useState<AddExpenseFields | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editFields, setEditFields] = useState<AddExpenseFields | null>(null);

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
    setMonth((m) => (m === 0 ? 11 : m - 1));
    if (month === 0) setYear((y) => y - 1);
    setPopover(null);
  }
  function nextMonth(): void {
    setMonth((m) => (m === 11 ? 0 : m + 1));
    if (month === 11) setYear((y) => y + 1);
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

  // ── ADD ──────────────────────────────────────────────────────────────────────
  function handleAddExpense(date: string): void {
    setModalDate(date);
    setPendingExpense(null);
    setModalOpen(true);
  }

  async function handleAddConfirm() {
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

  // ── EDIT ─────────────────────────────────────────────────────────────────────
  function handleEditEvent(event: CalendarEvent): void {
    setEditingEvent(event);
    setEditFields({
      label: event.label,
      amount: String(event.amount),
      type: (event.type as Exclude<EventType, "default">) || "Other",
      date: event.date.split("T")[0],
    });
    setEditModalOpen(true);
  }

  async function handleEditConfirm() {
    if (!editingEvent || !editFields) return;
    try {
      // Delete old event
      await apiFetch("/api/calendar/delete", {
        method: "POST",
        body: JSON.stringify({ date: editingEvent.date, label: editingEvent.label }),
      });
      // Save updated event
      await apiFetch("/api/calendar", {
        method: "POST",
        body: JSON.stringify([
          {
            date: editFields.date,
            type: editFields.type,
            label: editFields.label,
            amount: parseFloat(editFields.amount) || 0,
          },
        ]),
      });
      fetchEvents();
    } catch (err) {
      console.error("Failed to edit event", err);
    }
    setEditModalOpen(false);
    setEditingEvent(null);
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  async function handleDeleteEvent(event: CalendarEvent): Promise<void> {
    try {
      await apiFetch("/api/calendar/delete", {
        method: "POST",
        body: JSON.stringify({ date: event.date, label: event.label }),
      });
      fetchEvents();
    } catch (err) {
      console.error("Failed to delete event", err);
    }
    setEditModalOpen(false);
    setEditingEvent(null);
  }

  // ── CALENDAR GRID ────────────────────────────────────────────────────────────
  const today = useMemo(() => new Date(), []);

  const days = useMemo(() => {
    const daysArr: { day: number; month: number; year: number }[] = [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInCurrentMonth = lastDayOfMonth.getDate();
    const firstWeekdayOfMonth = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

    // Days from previous month
    const daysInPrev = new Date(year, month, 0).getDate();
    for (let i = firstWeekdayOfMonth - 1; i >= 0; i--) {
      daysArr.push({ day: daysInPrev - i, month: month === 0 ? 11 : month - 1, year: month === 0 ? year - 1 : year });
    }

    // Days in current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      daysArr.push({ day: i, month: month, year: year });
    }

    // Days from next month
    const remainingCells = 42 - daysArr.length; // Ensure 6 rows (6 * 7 = 42 cells)
    for (let i = 1; i <= remainingCells; i++) {
      daysArr.push({ day: i, month: month === 11 ? 0 : month + 1, year: month === 11 ? year + 1 : year });
    }
    return daysArr;
  }, [year, month]);

  const monthEvents = events.filter((ev) => {
    const eventDate = new Date(ev.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });

  const monthSpendingTotal = monthEvents.filter((e) => !e.is_income).reduce((s, ev) => s + ev.amount, 0);
  const monthIncomeTotal = monthEvents.filter((e) => e.is_income).reduce((s, ev) => s + ev.amount, 0);
  const monthPredictedTotal = monthSpendingTotal; // Placeholder for now

  return (
    <>
      <div className="flex h-screen flex-col bg-slate-900 text-white">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-800/50 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-700/50 p-1">
              <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-slate-600">
                <TbChevronLeft />
              </button>
              <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-slate-600">
                <TbChevronRight />
              </button>
            </div>
            <h1 className="text-xl font-bold">
              {MONTH_NAMES[month]} {year}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const d = new Date();
                setYear(d.getFullYear());
                setMonth(d.getMonth());
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold shadow-sm transition hover:bg-slate-700"
            >
              Today
            </button>
          </div>
        </header>

        {/* Days header */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-800/20 font-bold uppercase tracking-wider text-slate-400">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="py-2 text-center text-[10px]">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-7 overflow-hidden">
          {days.map((d, i) => {
            const isToday = d.year === today.getFullYear() && d.month === today.getMonth() && d.day === today.getDate();
            const isCurrentMonth = d.month === month;
            const dayEvents = eventMap[toDateStr(d.year, d.month + 1, d.day)] || []; // Adjust month for toDateStr
            const incomeEvents = dayEvents.filter((ev) => ev.is_income);
            const spendingEvents = dayEvents.filter((ev) => !ev.is_income);

            const incomeTotal = incomeEvents.reduce((acc, ev) => acc + ev.amount, 0);
            const spendingTotal = spendingEvents.reduce((acc, ev) => acc + ev.amount, 0);

            return (
              <div
                key={i}
                className={`group relative flex flex-col border-b border-r border-slate-800 p-2 transition-colors
                ${!isCurrentMonth ? "bg-slate-900/30 text-slate-600" : "bg-slate-900"}
                hover:bg-slate-800/50
              `}
                onClick={(e) => {
                  setPopover({ day: d.day, anchor: e.currentTarget });
                }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                  ${isToday ? "bg-green-500 text-white" : ""}
                `}
                >
                  {d.day}
                </div>

                {/* Event indicators */}
                <div className="mt-1 flex-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev, idx) => {
                    const cfg = getTypeConfig(ev.type);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-tight
                        ${ev.is_income ? "bg-green-500/10 text-green-400" : "bg-slate-800 text-slate-300"}
                      `}
                      >
                        {!ev.is_income && <div className={`h-1 w-1 shrink-0 rounded-full ${cfg.dot}`} />}
                        <span className="truncate">{ev.label}</span>
                        <span className="ml-auto shrink-0">${ev.amount}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && <div className="text-right text-[8px] font-bold text-slate-500">+{dayEvents.length - 3} more</div>}
                </div>

                {/* Day totals */}
                <div className="mt-auto flex justify-between gap-1 text-[9px] font-black uppercase">
                  {incomeTotal > 0 && <span className="text-green-400">+${incomeTotal}</span>}
                  {spendingTotal > 0 && <span className="text-red-400">-${spendingTotal}</span>}
                </div>

                {/* Add button hover */}
                <div className="absolute right-2 top-2 hidden scale-90 transform transition-all group-hover:block">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
                    <TbPlus className="h-3 w-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom info: Monthly totals */}
        <div className="flex h-20 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-800 px-10 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
          <div className="flex gap-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Spending</span>
              <span className="text-2xl font-black text-red-400">${monthSpendingTotal.toLocaleString()}</span>
            </div>
            <div className="flex flex-col border-l border-slate-700 pl-10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Predicted for Month</span>
              <span className="text-2xl font-black text-slate-300">${monthPredictedTotal.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="mx-2 h-10 w-px bg-slate-700" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Month Outlook</span>
              <span className={`text-xl font-black ${monthSpendingTotal < 2000 ? "text-green-400" : "text-amber-400"}`}>
                {monthSpendingTotal < 2000 ? "WELL UNDER BUDGET" : "WATCHING CAREFULLY"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Day popover */}
      {popover && (
        <EventPopover
          anchor={popover.anchor}
          events={popover ? (eventMap[toDateStr(year, month + 1, popover.day)] ?? []) : []}
          year={year}
          month={month + 1}
          day={popover.day}
          onClose={closePopover}
          onAddExpense={handleAddExpense}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {/* Add Expense modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Expense"
        confirmText="Add Expense"
        cancelText="Cancel"
        onConfirm={handleAddConfirm}
        onCancel={() => setModalOpen(false)}
      >
        <AddExpenseForm date={modalDate} onChange={(fields) => setPendingExpense(fields)} />
      </Modal>

      {/* Edit Expense modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Expense"
        confirmText="Save Changes"
        cancelText="Cancel"
        onConfirm={handleEditConfirm}
        onCancel={() => setEditModalOpen(false)}
      >
        {editingEvent && editFields && (
          <AddExpenseForm
            date={editFields.date}
            initialValues={editFields}
            onChange={(fields) => setEditFields(fields)}
            showDelete
            onDelete={() => handleDeleteEvent(editingEvent)}
          />
        )}
      </Modal>
    </>
  );
}
