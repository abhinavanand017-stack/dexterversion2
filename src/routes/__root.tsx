import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { NeuralCanvas } from "@/components/NeuralCanvas";
import { StatusBar } from "@/components/StatusBar";
import { TickerBar } from "@/components/TickerBar";
import { AppSidebar, MobileTabBar, TourProgressBar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DemoBanner } from "@/components/DemoBanner";
import { Footer } from "@/components/Footer";
import { CircuitBreakerOverlay } from "@/components/CircuitBreakerOverlay";
import { useDexterState } from "@/hooks/useDexterState";
import { useDemoSequence } from "@/hooks/useDemoSequence";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold dx-grad-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The route you're looking for isn't on the tape.
        </p>
        <Link to="/dashboard" className="dx-pill dx-pill-ok inline-block mt-6">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center dx-glass p-8">
        <h1 className="text-xl font-semibold">Engine fault</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A subsystem crashed. The circuit breaker is holding your positions.
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="dx-pill mt-6 cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dexter — Bio-Algorithmic Trading Engine" },
      {
        name: "description",
        content:
          "A cognitive firewall between human impulse and capital markets. Real-time biometric risk control for NSE/BSE traders.",
      },
      { property: "og:title", content: "Dexter — The Cognitive Firewall for Indian Markets" },
      {
        property: "og:description",
        content:
          "Bio-algorithmic trading that reads your biometrics and protects your portfolio from your own impulses.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/favicon.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/favicon.png" },
      { name: "theme-color", content: "#0a0a1a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body data-mode="full" data-arousal="low">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function BodyAttrs() {
  const { uiMode, arousalLevel } = useDexterState();
  useEffect(() => {
    document.body.dataset.mode = uiMode;
    document.body.dataset.arousal = arousalLevel;
  }, [uiMode, arousalLevel]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useDemoSequence();
  return (
    <QueryClientProvider client={queryClient}>
      <BodyAttrs />
      <NeuralCanvas />
      <TourProgressBar />
      <SidebarProvider>
        <div className="relative z-10 flex min-h-screen w-full">
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <DemoBanner />
            <div className="flex items-center gap-2">
              <SidebarTrigger className="ml-2 hidden md:inline-flex" />
              <div className="flex-1 min-w-0"><StatusBar /></div>
            </div>
            <TickerBar />
            <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <MobileTabBar />
      <Footer />
      <CircuitBreakerOverlay />
      <Toaster theme="dark" position="top-right" richColors />
    </QueryClientProvider>
  );
}
