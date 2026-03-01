"use client";

import { GlobalContext } from "@/contexts/GlobalContext";
import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext } from "react";
import { TbAdjustments, TbAdjustmentsFilled, TbCalendarMonth, TbCalendarMonthFilled, TbLayoutDashboard, TbLayoutDashboardFilled } from "react-icons/tb";

const routes = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: TbLayoutDashboard,
    iconFilled: TbLayoutDashboardFilled,
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: TbCalendarMonth,
    iconFilled: TbCalendarMonthFilled,
  },
  {
    name: "Setup",
    href: "/setup",
    icon: TbAdjustments,
    iconFilled: TbAdjustmentsFilled,
  },
];

const navLink = cva("flex items-center gap-2 rounded-md p-2", {
  variants: {
    intent: {
      selected: "bg-green-600/10 text-green-900",
      unselected: "hover:bg-neutral-200/50",
    },
  },
});

export const Navbar = () => {
  const {
    userData: { name, picture },
  } = useContext(GlobalContext);

  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="w-2xs flex shrink-0 flex-col items-stretch gap-2 bg-neutral-100 p-4 text-slate-900">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-14 w-14 overflow-clip rounded-full bg-neutral-200">{picture && <img src={picture} alt="" className="h-full w-full" />}</div>
        <div className="*:leading-tight">
          <p className="text-sm font-semibold">Hello,</p>
          <p className="text-lg font-bold">{name}</p>
        </div>
      </div>

      {routes.map((route) => (
        <Link key={route.name} href={route.href} className={navLink({ intent: pathname === route.href ? "selected" : "unselected" })}>
          {pathname === route.href ?
            <route.iconFilled />
          : <route.icon />}
          <p>{route.name}</p>
        </Link>
      ))}
    </nav>
  );
};
