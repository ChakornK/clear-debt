import type { Metadata } from "next";
import "./globals.css";
import { GlobalProvider } from "@/contexts/GlobalContext";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ClearDebt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap" />
      </head>
      <body className="h-dvh flex">
        <GlobalProvider>
          <Navbar />
          <div className="grow overflow-auto">{children}</div>
        </GlobalProvider>
      </body>
    </html>
  );
}
