"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AppNavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  tab: string;
  subTab?: string;
};

export type AppNavigationGroup = {
  label: string;
  items: AppNavigationItem[];
};

type AppNavigationProps = {
  groups: AppNavigationGroup[];
  activeItemId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  brand: React.ReactNode;
  userEmail: string;
  userRole: string;
  onNavigate: (item: AppNavigationItem) => void;
  onToggleCollapsed: () => void;
  onMobileOpenChange: (open: boolean) => void;
  onSignOut: () => void;
};

function NavigationItems({
  groups,
  activeItemId,
  collapsed = false,
  onNavigate,
}: Pick<AppNavigationProps, "groups" | "activeItemId" | "onNavigate"> & { collapsed?: boolean }) {
  return (
    <nav aria-label="Primary navigation" className="app-navigation-list">
      {groups.map((group) => (
        <section key={group.label} className="app-navigation-group" aria-label={group.label}>
          {!collapsed ? <h2 className="app-navigation-group-label">{group.label}</h2> : null}
          <div className="grid gap-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeItemId;

              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  onClick={() => onNavigate(item)}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "app-navigation-item",
                    collapsed ? "app-navigation-item-collapsed" : "app-navigation-item-expanded",
                    active && "app-navigation-item-active",
                  )}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export function AppNavigation({
  groups,
  activeItemId,
  collapsed,
  mobileOpen,
  brand,
  userEmail,
  userRole,
  onNavigate,
  onToggleCollapsed,
  onMobileOpenChange,
  onSignOut,
}: AppNavigationProps) {
  const userLabel = userEmail ? userEmail.split("@")[0] : "KSS User";

  const handleNavigate = (item: AppNavigationItem) => {
    onNavigate(item);
    onMobileOpenChange(false);
  };

  return (
    <>
      <aside
        className="app-sidebar hidden lg:flex"
        data-collapsed={collapsed}
        aria-label="Application navigation"
      >
        <div className="app-sidebar-inner">
          <div className={cn("app-sidebar-brand", collapsed && "app-sidebar-brand-collapsed")}>
            {brand}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">KSS Roadways</p>
                <p className="mt-0.5 truncate text-xs text-fg-muted">Fleet Management</p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="app-sidebar-collapse"
            >
              <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
            </Button>
          </div>

          <NavigationItems groups={groups} activeItemId={activeItemId} collapsed={collapsed} onNavigate={handleNavigate} />

          <div className="app-sidebar-account">
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{userLabel}</p>
                <p className="mt-0.5 truncate text-xs text-fg-muted">{userRole}</p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onSignOut}
              aria-label={`Sign out (${userRole})`}
              title={`Sign out (${userRole})`}
              className="ml-auto text-fg-muted hover:text-danger"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogContent
          layout="inspector"
          size="md"
          showClose={false}
          className="app-mobile-navigation !max-w-none !w-[min(88vw,360px)] sm:!w-[min(32rem,calc(100vw-2rem))] lg:hidden"
        >
          <header className="app-mobile-navigation-header">
            <div className="flex min-w-0 items-center gap-3">
              {brand}
              <div className="min-w-0">
                <DialogTitle className="truncate">KSS Roadways</DialogTitle>
                <DialogDescription className="truncate">{userLabel} · {userRole}</DialogDescription>
              </div>
            </div>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close navigation">
                <X aria-hidden="true" className="size-4" />
              </Button>
            </DialogClose>
          </header>
          <div className="kss-dialog-body app-mobile-navigation-body">
            <NavigationItems groups={groups} activeItemId={activeItemId} onNavigate={handleNavigate} />
          </div>
          <footer className="app-mobile-navigation-footer">
            <Button type="button" variant="outline" onClick={onSignOut} className="w-full justify-start">
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppNavigationTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={onClick}
      aria-label="Open navigation menu"
      aria-haspopup="dialog"
    >
      <Menu aria-hidden="true" />
    </Button>
  );
}
