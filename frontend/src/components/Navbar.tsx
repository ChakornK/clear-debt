"use client";

import { GlobalContext } from "@/contexts/GlobalContext";
import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect } from "react";
import { apiFetch, clearAuthToken, setAuthToken } from "@/lib/api";
import {
  TbAdjustments,
  TbAdjustmentsFilled,
  TbCalendarMonth,
  TbCalendarMonthFilled,
  TbLayoutDashboard,
  TbLayoutDashboardFilled,
  TbLogout,
} from "react-icons/tb";

const routes = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: TbLayoutDashboard,
    iconSelected: TbLayoutDashboardFilled,
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

const navLink = cva("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition", {
  variants: {
    intent: {
      selected: "bg-green-600/10 text-green-900",
      unselected: "hover:bg-neutral-200/50",
      danger: "bg-red-600/10 text-red-900",
    },
  },
});

export const Navbar = () => {
  const { userData, setUserData } = useContext(GlobalContext);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // URL token cleanup (initial login redirect)
    const urlToken = searchParams.get("token");
    if (urlToken) {
      // Clean URL after current tick to ensure apiFetch has read it
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

        if (pathname !== "/") {
          router.push("/");
        }
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
    <nav className="w-2xs flex shrink-0 flex-col items-stretch gap-2 bg-neutral-100 p-4 text-slate-900">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-14 w-14 overflow-clip rounded-full bg-neutral-200">
          {userData.picture && <img src={userData.picture} alt="" className="h-full w-full" />}
        </div>
        <div className="*:leading-tight">
          <p className="text-sm font-semibold">Hello,</p>
          <p className="text-lg font-bold">{userData.given_name}</p>
        </div>
      </div>

      {routes.map((route) => (
        <Link key={route.name} href={route.path} className={navLink({ intent: pathname === route.path ? "selected" : "unselected" })}>
          {pathname === route.path ?
            <route.iconSelected />
          : <route.icon />}
          <p>{route.name}</p>
        </Link>
      ))}
      <div className="grow"></div>

      <button onClick={handleLogout} className={navLink({ intent: "danger" })}>
        <TbLogout />
        <p>Logout</p>
      </button>
    </nav>
  );
};
