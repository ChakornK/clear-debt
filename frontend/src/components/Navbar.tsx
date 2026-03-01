"use client";

import { GlobalContext } from "@/contexts/GlobalContext";
import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { apiFetch, clearAuthToken } from "@/lib/api";
import {
  TbAdjustments,
  TbAdjustmentsFilled,
  TbCalendarMonth,
  TbCalendarMonthFilled,
  TbLayoutDashboard,
  TbLayoutDashboardFilled,
  TbLogout,
  TbMessageCircle,
  TbMessageCircleFilled,
  TbChevronLeft,
  TbChevronRight,
} from "react-icons/tb";

const routes = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: TbLayoutDashboard,
    iconSelected: TbLayoutDashboardFilled,
  },
  {
    name: "Chat",
    path: "/chat",
    icon: TbMessageCircle,
    iconSelected: TbMessageCircleFilled,
  },
  {
    name: "Calendar",
    path: "/calendar",
    icon: TbCalendarMonth,
    iconSelected: TbCalendarMonthFilled,
  },
  {
    name: "Setup",
    path: "/setup",
    icon: TbAdjustments,
    iconSelected: TbAdjustmentsFilled,
  },
];

const navLink = cva("flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition relative group", {
  variants: {
    intent: {
      selected: "bg-green-600/10 text-green-900",
      unselected: "hover:bg-neutral-200/50",
      danger: "bg-red-600/10 text-red-900 hover:bg-red-600/20",
    },
  },
});

export const Navbar = () => {
  const { userData, setUserData } = useContext(GlobalContext);
  const [collapsed, setCollapsed] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }, 500);
    }

    apiFetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => setUserData(data))
      .catch((err) => {
        console.error("Failed to fetch user data", err);
        clearAuthToken();
        if (pathname !== "/") router.push("/");
      });
  }, [searchParams]);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout");
    } finally {
      clearAuthToken();
      window.location.href = "/";
    }
  };

  return (
    <nav
      className={`relative flex shrink-0 flex-col items-stretch gap-1 overflow-visible bg-neutral-100 p-4 text-slate-900 transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-2xs"}
      `}
    >
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mb-6 flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800"
          title="Expand sidebar"
        >
          <TbChevronRight className="text-base" />
        </button>
      )}

      {/* Header: avatar + name */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-clip rounded-full bg-neutral-200">
          {userData.picture && <img src={userData.picture} alt="" className="h-full w-full" />}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-lg font-bold">{userData.given_name}</p>
          </div>
        )}

        {/* Collapse toggle */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800"
            title="Collapse sidebar"
          >
            <TbChevronLeft className="text-base" />
          </button>
        )}
      </div>

      {/* Nav links */}
      {routes.map((route) => {
        const isSelected = pathname === route.path;
        return (
          <Link key={route.name} href={route.path} className={navLink({ intent: isSelected ? "selected" : "unselected" })}>
            <span className="shrink-0 text-xl">
              {isSelected ?
                <route.iconSelected />
              : <route.icon />}
            </span>
            {!collapsed && <p>{route.name}</p>}

            {/* Tooltip on hover when collapsed */}
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-sm text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {route.name}
              </span>
            )}
          </Link>
        );
      })}

      <div className="grow" />

      {/* Logout */}
      <button onClick={handleLogout} className={navLink({ intent: "danger" })}>
        <span className="shrink-0 text-xl">
          <TbLogout />
        </span>
        {!collapsed && <p>Logout</p>}

        {collapsed && (
          <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-sm text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Logout
          </span>
        )}
      </button>
    </nav>
  );
};
