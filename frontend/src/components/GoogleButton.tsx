"use client";

import { FcGoogle } from "react-icons/fc";

export default function GoogleButton() {
  const handleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`;
  };

  return (
    <button
      onClick={handleLogin}
      className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-100 active:scale-[0.98]"
      aria-label="Continue with Google"
    >
      <FcGoogle className="h-5 w-5" />
      <span>Continue with Google</span>
    </button>
  );
}
