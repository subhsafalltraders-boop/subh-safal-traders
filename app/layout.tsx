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
        {/* Boot splash: pure HTML/CSS, no JS DOM manipulation at all, so it
            paints instantly and never shows a blank white flash between the
            OS-level PWA splash and the app's real content.

            IMPORTANT: an earlier version of this removed the splash node
            with a raw `el.remove()` script. That's a React app crash bug —
            this div is part of React's rendered tree (it's JSX), so
            deleting it directly from outside React means React's virtual
            DOM still believes the node exists. The next time React
            re-renders anything in <body> (a toast, a tab switch, any state
            update anywhere in the app), it tries to reconcile against a DOM
            node that's no longer there and throws
            "NotFoundError: Failed to execute 'removeChild'/'insertBefore' on
            'Node'" — which is exactly the crash that started happening on
            /billing on phones after that change shipped. Never manually
            remove/replace a node that React also renders.

            Fixed by doing the hide with CSS only (an animation that fades
            opacity to 0 and disables pointer-events), never touching the
            DOM node itself. The node stays in the tree forever, just
            invisible after ~2.5s — completely safe for React to co-exist
            with. */}
        <div
          id="boot-splash"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            background: '#0b2559',
            animation: 'boot-splash-fade 0.3s ease-out 2.2s forwards',
          }}
        >
          <img
            src="/icon-192.png"
            alt=""
            width={88}
            height={88}
            style={{ borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
          />
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.25)',
              borderTopColor: '#ffffff',
              animation: 'boot-splash-spin 0.8s linear infinite',
            }}
          />
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes boot-splash-spin { to { transform: rotate(360deg); } }
                @keyframes boot-splash-fade { to { opacity: 0; visibility: hidden; pointer-events: none; } }
              `,
            }}
          />
        </div>
        <Toaster position="top-right" />
        <ServiceWorkerRegister />
        {children}
        <div id="bill-print-root"></div>
      </body>
    </html>
  );
}
