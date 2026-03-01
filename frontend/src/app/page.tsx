"use client";

import { TbCalendarCheck, TbBuildingBank, TbAnalyze, TbArrowRight } from "react-icons/tb";

export default function Home() {
  const handleGetStarted = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white selection:bg-green-500/30 selection:text-green-200">
      {/* Hero Section */}
      <main className="flex-1">
        <section className="h-dvh overflow-hidden pb-12 pt-20 md:pb-24 md:pt-32 lg:pt-40">
          <div className="mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-6 lg:px-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl">ClearDebt</h1>
              <h2 className="bg-linear-to-r from-green-400 to-emerald-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl lg:text-7xl">
                Reclaim Your Freedom
              </h2>

              <p className="mt-8 max-w-2xl text-lg font-medium text-slate-400 sm:text-xl/8">
                The AI-powered command center for your debt elimination journey. Sync your bank, connect your calendar, and watch your balance hit zero.
              </p>

              <div className="mt-12 flex flex-col items-center gap-6">
                <button
                  onClick={handleGetStarted}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl bg-green-500 px-10 py-4 text-lg font-black uppercase tracking-widest text-white shadow-xl shadow-green-900/50 transition-all hover:bg-green-600 active:scale-95"
                >
                  Get Started
                  <TbArrowRight className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Background Ambient Glows */}
          <div className="absolute -top-24 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-green-500/10 blur-[120px]"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-slate-800 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-base font-black uppercase tracking-widest text-green-400">The Modern Edge</h2>
              <p className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Everything you need to beat interest rates.</p>
            </div>

            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                {[
                  {
                    name: "Ghost Budgeting",
                    description: "Neural networks scan your Google Calendar to predict upcoming spending triggers before they hit your account.",
                    icon: TbCalendarCheck,
                    color: "bg-blue-500/10 text-blue-400",
                  },
                  {
                    name: "Live Bank Link",
                    description: "Connect 12,000+ financial institutions via Plaid to track balances and interest rates in real-time.",
                    icon: TbBuildingBank,
                    color: "bg-emerald-500/10 text-emerald-400",
                  },
                  {
                    name: "Hyper-Optimization",
                    description: "Our math engine calculates the snowball and avalanche strategies down to the cent for your specific profile.",
                    icon: TbAnalyze,
                    color: "bg-purple-500/10 text-purple-400",
                  },
                ].map((feature) => (
                  <div
                    key={feature.name}
                    className="flex flex-col items-start gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-8 transition-all hover:border-slate-600"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.color}`}>
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <dt className="text-lg font-black text-white">{feature.name}</dt>
                    <dd className="text-base leading-7 text-slate-400">{feature.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
