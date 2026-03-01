import type { Metadata } from "next";
import "./globals.css";
import { GlobalProvider } from "@/contexts/GlobalContext";
import { Navbar } from "@/components/Navbar";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "ClearDebt",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasToken = cookieStore.has("auth_token");

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap" />
      </head>
      <body className="flex h-dvh bg-white selection:bg-green-100 selection:text-green-900">
        <GlobalProvider>
          {hasToken && <Navbar />}
          <div className="grow overflow-auto">{children}</div>
        </GlobalProvider>
      </body>
    </html>
  );
}
