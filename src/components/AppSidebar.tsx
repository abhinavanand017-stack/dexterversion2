import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home, BarChart3, Activity, Newspaper, Search, Eye, Target, Settings, Play, X, Menu, Brain,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useDexterState } from "@/hooks/useDexterState";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/forecast", label: "Forecaster", icon: Brain },
  { to: "/optimizer", label: "Portfolio Optimizer", icon: BarChart3 },
  { to: "/biometrics", label: "Biometrics Lab", icon: Activity },
  { to: "/news", label: "Market News", icon: Newspaper },
  { to: "/funds", label: "Fund Screener", icon: Search },
  { to: "/shadow", label: "Shadow Portfolio", icon: Eye },
  { to: "/score", label: "Dexter Score", icon: Target },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const TOUR_PATH = ["/", "/biometrics", "/shadow", "/score", "/optimizer", "/news"] as const;
const TOUR_STEP_MS = 5000;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const tourActive = useDexterState((s) => s.tourActive);
  const setTour = useDexterState((s) => s.setTour);
  const [tourIdx, setTourIdx] = useState(0);

  useEffect(() => {
    if (!tourActive) return;
    navigate({ to: TOUR_PATH[tourIdx] as never });
    const t = setTimeout(() => {
      setTourIdx((i) => {
        const next = i + 1;
        if (next >= TOUR_PATH.length) { setTour(false); return 0; }
        return next;
      });
    }, TOUR_STEP_MS);
    return () => clearTimeout(t);
  }, [tourActive, tourIdx, navigate, setTour]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dexter</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <button
          onClick={() => { setTourIdx(0); setTour(!tourActive); }}
          className="flex items-center gap-2 rounded px-2 py-2 text-xs font-mono hover:bg-muted/50"
        >
          {tourActive ? <X className="h-4 w-4 text-red-400" /> : <Play className="h-4 w-4 text-amber-400" />}
          {!collapsed && <span>{tourActive ? "Exit Tour" : "Guided Pitch Tour"}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function TourProgressBar() {
  const tourActive = useDexterState((s) => s.tourActive);
  const setTour = useDexterState((s) => s.setTour);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!tourActive) return null;
  const idx = Math.max(0, TOUR_PATH.indexOf(pathname as typeof TOUR_PATH[number]));
  const pct = ((idx + 1) / TOUR_PATH.length) * 100;
  return (
    <div className="fixed top-0 inset-x-0 z-[100]">
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${pct}%`, transition: `width ${TOUR_STEP_MS}ms linear` }}
        />
      </div>
      <button
        onClick={() => setTour(false)}
        className="absolute top-2 right-2 dx-pill cursor-pointer"
      >
        Exit Tour
      </button>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav
      className="md:hidden fixed inset-x-0 z-40 flex justify-around border-t border-border bg-background/95 backdrop-blur"
      style={{ bottom: 36, height: 56 }}
    >
      {items.map((it) => {
        const active = pathname === it.to;
        return (
          <Link
            key={it.to}
            to={it.to}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]"
            style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
          >
            <it.icon className="h-5 w-5" />
            {it.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileMenuButton() {
  return (
    <span className="md:hidden">
      <Menu className="h-5 w-5" />
    </span>
  );
}
