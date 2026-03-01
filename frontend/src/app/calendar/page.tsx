"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { TbChevronLeft, TbChevronRight, TbRefresh, TbFileText, TbCreditCard, TbPin, TbReportMoney, TbCalendarEvent, TbList, TbPlus } from "react-icons/tb";
import type { IconType } from "react-icons";

type EventType = "subscription" | "bill" | "expense" | "default";

interface CalendarEvent {
  date: string;
  type: EventType;
  label: string;
  amount: number;
}

interface EventData {
  events: CalendarEvent[];
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
}

// TODO: replace with real data
const data: EventData = {
  events: [
    { date: "2026-02-05", type: "subscription", label: "Netflix", amount: 15.99 },
    { date: "2026-02-07", type: "bill", label: "Electric Bill", amount: 94.5 },
    { date: "2026-02-07", type: "subscription", label: "Spotify", amount: 9.99 },
    { date: "2026-02-12", type: "expense", label: "Car Insurance", amount: 120.0 },
    { date: "2026-02-15", type: "expense", label: "Study Group", amount: 15.0 },
    { date: "2026-02-15", type: "expense", label: "Team Lunch", amount: 25.0 },
    { date: "2026-02-15", type: "expense", label: "Grocery Run", amount: 85.0 },
    { date: "2026-02-20", type: "subscription", label: "iCloud Storage", amount: 2.99 },
  ],
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

const TYPE_CONFIG: Record<EventType, TypeConfigEntry> = {
  subscription: { dot: "bg-emerald-400", Icon: TbRefresh, badge: "bg-emerald-100 text-emerald-700", iconClass: "text-emerald-500" },
  bill: { dot: "bg-blue-400", Icon: TbFileText, badge: "bg-blue-100 text-blue-700", iconClass: "text-blue-500" },
  expense: { dot: "bg-amber-400", Icon: TbCreditCard, badge: "bg-amber-100 text-amber-700", iconClass: "text-amber-500" },
  default: { dot: "bg-slate-400", Icon: TbPin, badge: "bg-slate-100 text-slate-700", iconClass: "text-slate-400" },
};

const POPOVER_WIDTH = 320;
const POPOVER_MARGIN = 8;
const SCREEN_PADDING = 12;
const ARROW_SIZE = 8;

const getTypeConfig = (type: string): TypeConfigEntry => TYPE_CONFIG[type as EventType] ?? TYPE_CONFIG.default;

function buildEventMap(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((map, ev) => {
    (map[ev.date] ??= []).push(ev);
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

function EventPopover({ anchor, events, year, month, day, onClose }: PopoverProps) {
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
            <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <cfg.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cfg.iconClass}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{ev.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>{ev.type}</span>
                  <span>${ev.amount.toFixed(2)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600">
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
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const eventMap = useMemo(() => buildEventMap(data.events), []);

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
    const events = eventMap[toDateStr(year, month, day)] ?? [];
    if (!events.length) return;
    if (popover?.day === day) {
      setPopover(null);
      return;
    }
    setPopover({ day, anchor: e.currentTarget });
  }

  const startWeekday = firstWeekday(year, month);
  const totalDays = daysInMonth(year, month);
  const prevTail = Array.from({ length: startWeekday }, (_, i) => daysInPrevMonth(year, month) - startWeekday + 1 + i);
  const currDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const totalCells = prevTail.length + totalDays;
  const nextCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextHead = Array.from({ length: nextCount }, (_, i) => i + 1);

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthEvents = data.events.filter((ev) => ev.date.startsWith(monthPrefix));
  const totalEstimated = monthEvents.reduce((s, ev) => s + ev.amount, 0);
  const uniqueDays = new Set(monthEvents.map((e) => e.date)).size;

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

          <div className="grid min-h-[335px] grow grid-cols-7">
            {prevTail.map((day) => (
              <div key={`prev-${day}`} className="border-b border-r border-slate-100 bg-slate-50/50 p-4 text-slate-300">
                {day}
              </div>
            ))}

            {currDays.map((day, idx) => {
              const events = eventMap[toDateStr(year, month, day)] ?? [];
              const isSelected = popover?.day === day;
              return (
                <div
                  key={`curr-${day}`}
                  onClick={(e) => handleDayClick(day, e)}
                  className={[
                    "relative border-b border-slate-100 p-4 font-medium transition-colors",
                    events.length ? "cursor-pointer" : "cursor-default",
                    idx < currDays.length - 1 ? "border-r" : "",
                    isSelected ? "bg-green-50"
                    : events.length ? "hover:bg-slate-50"
                    : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={isSelected ? "font-bold text-green-600" : ""}>{day}</span>
                  {events.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {events.slice(0, 4).map((ev, i) => (
                        <div key={i} className={`size-1.5 rounded-full ${getTypeConfig(ev.type).dot}`} />
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
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <TbReportMoney className="h-5 w-5 text-green-600" />
              <h4 className="font-bold">Total Estimated</h4>
            </div>
            <p className="text-3xl font-black">${totalEstimated.toFixed(2)}</p>
            <p className="mt-1 text-sm text-slate-500">
              For {MONTH_NAMES[month - 1]} {year}
            </p>
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

      {popover && selectedEvents.length > 0 && (
        <EventPopover anchor={popover.anchor} events={selectedEvents} year={year} month={month} day={popover.day} onClose={closePopover} />
      )}
    </>
  );
}
