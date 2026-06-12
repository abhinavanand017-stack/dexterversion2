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

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { NeuralCanvas } from "@/components/NeuralCanvas";
import { StatusBar } from "@/components/StatusBar";
import { TickerBar } from "@/components/TickerBar";
import { TabNav } from "@/components/TabNav";
import { useDexterState } from "@/hooks/useDexterState";

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
      { title: "DEXTER — Bio-Algorithmic Trading Engine" },
      {
        name: "description",
        content:
          "Cognitive firewall between human impulse and capital markets. Biometric-aware live trading intelligence with Angel One and Finnhub feeds.",
      },
      { property: "og:title", content: "DEXTER — Bio-Algorithmic Trading Engine" },
      {
        property: "og:description",
        content: "Biometric-aware live market intelligence for Indian equities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
  return (
    <QueryClientProvider client={queryClient}>
      <BodyAttrs />
      <NeuralCanvas />
      <div className="relative z-10 min-h-screen flex flex-col">
        <StatusBar />
        <TickerBar />
        <TabNav />
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
