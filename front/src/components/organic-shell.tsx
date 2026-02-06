"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/", label: "ホーム" },
  { href: "/books/new", label: "書籍登録" },
  { href: "/stats", label: "統計レポート" },
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
};

type OrganicShellProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  contentTestId: string;
  headerSearchPlaceholder?: string;
  children: ReactNode;
};

export const OrganicShell = ({
  title,
  subtitle,
  action,
  contentTestId,
  headerSearchPlaceholder = "思考を検索...",
  children,
}: OrganicShellProps) => {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <aside className="hidden w-80 shrink-0 flex-col bg-[color:var(--background-soft)] px-6 py-6 lg:flex">
        <div className="mb-10 flex items-center gap-4 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[32px] bg-[color:var(--accent)] text-xl font-black text-white shadow-[0_10px_20px_rgba(129,178,154,0.35)]">
            L
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">LeafLog</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/45">
              Organic Output
            </p>
          </div>
        </div>

        <p className="mb-5 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--foreground)]/40">
          Menu
        </p>

        <nav className="flex-1 overflow-y-auto pr-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "mb-2 flex w-full items-center justify-between rounded-[28px] bg-[color:var(--accent)] px-6 py-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(129,178,154,0.28)]"
                    : "mb-2 flex w-full items-center justify-between rounded-[28px] px-6 py-4 text-sm font-semibold text-[color:var(--foreground)]/74 transition hover:bg-white/45"
                }
              >
                <span>{item.label}</span>
                <span className="text-xs opacity-60">›</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 rounded-[28px] border border-[color:var(--border)] bg-white/70 p-4 text-xs text-[color:var(--foreground)]/72">
          <p>localStorage / Playwright E2E</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="h-24 shrink-0 bg-white/50 px-4 backdrop-blur-sm md:px-10">
          <div className="flex h-full items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4 md:gap-8">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold capitalize">{title}</h1>
                {subtitle && (
                  <p className="truncate text-xs font-medium text-[color:var(--foreground)]/58">
                    {subtitle}
                  </p>
                )}
              </div>
              <div className="hidden min-w-[260px] items-center gap-3 rounded-full bg-[color:var(--background)] px-5 py-3 md:flex lg:min-w-[320px]">
                <span className="text-sm opacity-45">⌕</span>
                <input
                  type="text"
                  readOnly
                  value=""
                  placeholder={headerSearchPlaceholder}
                  className="w-full bg-transparent text-sm placeholder:text-[color:var(--foreground)]/45 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-5">
              {action && <div className="flex items-center gap-2">{action}</div>}
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[color:var(--background)]"
                aria-label="通知"
              >
                <span className="text-lg opacity-65">•</span>
              </button>
              <div className="hidden h-8 w-px bg-[color:var(--foreground)]/12 md:block" />
              <div className="hidden items-center gap-3 md:flex">
                <div className="text-right">
                  <p className="text-xs font-bold leading-none">Single User</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--foreground)]/45">
                    MVP
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[20px] bg-[color:var(--background-soft)] text-xs font-bold">
                  KU
                </div>
              </div>
            </div>
          </div>
        </header>

        <main data-testid={contentTestId} className="flex-1 overflow-y-auto px-4 pb-10 md:px-10">
          <div className="mx-auto max-w-6xl space-y-6 py-4">
            <div className="flex gap-2 lg:hidden">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={`mobile-${item.href}`}
                    href={item.href}
                    className={
                      active
                        ? "rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-bold text-white"
                        : "rounded-full border border-[color:var(--border)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]/78"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {children}
          </div>
        </main>

        <footer className="hidden h-16 shrink-0 items-center justify-between bg-[#3d405b] px-10 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45 md:flex">
          <div>© 2026 LeafLog Organic Design</div>
          <div className="flex items-center gap-6">
            <span className="cursor-default hover:text-white/85">プライバシー</span>
            <span className="cursor-default hover:text-white/85">利用規約</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
