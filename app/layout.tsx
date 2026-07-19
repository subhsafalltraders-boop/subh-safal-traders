import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

async function isMoneyHost() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  return host.startsWith('money.');
}

export async function generateMetadata(): Promise<Metadata> {
  const money = await isMoneyHost();
  if (money) {
    return {
      title: "Cash Calculator — Subh Safal Traders",
      description: "Cash denomination calculator",
    };
  }
  return {
    title: "SubhSafal Traders POS",
    description: "Ice Cream Distribution System",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const money = await isMoneyHost();

  const appName = money ? "Cash Calculator" : "SST Billing";
  const manifestHref = money ? "/money-manifest.json" : "/manifest.json";
  const touchIcon = money ? "/money-apple-touch-icon.png" : "/apple-touch-icon.png";
  const themeColor = money ? "#1955db" : "#0b2559";

  return (
    <html lang="en" className="light h-full antialiased">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <meta name="application-name" content={appName} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={themeColor} />
        <link rel="manifest" href={manifestHref} />
        <link rel="apple-touch-icon" href={touchIcon} />
      </head>
      <body className={`${inter.className} min-h-full w-full flex flex-col bg-background text-on-background overflow-x-hidden`}>
        <Toaster position="top-right" />
        <ServiceWorkerRegister />
        {children}
        <div id="bill-print-root"></div>
      </body>
    </html>
  );
}
