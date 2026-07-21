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
        {/* Boot splash: pure HTML/CSS, no JS or data fetch required, so it
            paints instantly and never shows a blank white flash between the
            OS-level PWA splash and the app's real content. It removes itself
            the moment the page finishes loading, with a hard safety-net
            timeout so it can NEVER get stuck on screen forever even if
            something goes wrong — this app's only users going forward are
            non-technical, so a frozen splash screen would be a dead end for
            them with no way to recover except force-closing the app. */}
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
                #boot-splash { opacity: 1; transition: opacity 0.25s ease-out; }
                #boot-splash.boot-splash-hide { opacity: 0; pointer-events: none; }
              `,
            }}
          />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function hideSplash() {
                  var el = document.getElementById('boot-splash');
                  if (!el) return;
                  el.classList.add('boot-splash-hide');
                  setTimeout(function () { el.remove(); }, 300);
                }
                if (document.readyState === 'complete') {
                  hideSplash();
                } else {
                  window.addEventListener('load', hideSplash);
                }
                // Safety net: never let the splash stay stuck on screen,
                // no matter what happens with loading.
                setTimeout(hideSplash, 4000);
              })();
            `,
          }}
        />
        <Toaster position="top-right" />
        <ServiceWorkerRegister />
        {children}
        <div id="bill-print-root"></div>
      </body>
    </html>
  );
}
