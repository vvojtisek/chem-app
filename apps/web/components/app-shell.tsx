"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { useAccount, useCapabilities } from "./auth-gate";
import { BookIcon, ChartIcon, FlaskIcon, HelpIcon, HomeIcon, ShieldIcon, UserIcon } from "./icons";
import { SyncStatusChip, useSync } from "./sync-provider";

interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly matches: (pathname: string) => boolean;
}

export const PRIMARY_DESTINATIONS: readonly Destination[] = [
  { href: "/", label: "Domů", icon: HomeIcon, matches: (path) => path === "/" },
  {
    href: "/procvicovani",
    label: "Procvičovat",
    icon: FlaskIcon,
    matches: (path) => path.startsWith("/procvicovani") || path.startsWith("/flashcards"),
  },
  {
    href: "/uceni/prvky",
    label: "Učivo",
    icon: BookIcon,
    matches: (path) => path.startsWith("/uceni"),
  },
  { href: "/pokrok", label: "Pokrok", icon: ChartIcon, matches: (path) => path === "/pokrok" },
];

export function BrandMark({ size = "sm" }: Readonly<{ size?: "sm" | "md" }>) {
  const box = size === "md" ? "h-12 w-12 rounded-[10px]" : "h-9 w-9 rounded-lg";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 grid-rows-[auto_1fr] bg-accent px-1.5 py-1 font-display text-on-fill ${box}`}
    >
      <span className="text-[8px] leading-none font-semibold opacity-85">CZ</span>
      <span
        className={`self-end leading-none font-extrabold ${size === "md" ? "text-2xl" : "text-lg"}`}
      >
        An
      </span>
    </span>
  );
}

function AccountBadge() {
  const account = useAccount();
  const { isGuest } = useCapabilities();
  if (isGuest) {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full border border-line bg-surface-2 px-3 text-sm font-semibold text-ink-2">
        Host · jen pro čtení
      </span>
    );
  }
  if (account?.role === "tester") {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full border border-warn/40 bg-warn-soft px-3 text-sm font-semibold text-warn">
        Testovací účet
      </span>
    );
  }
  return null;
}

function QuarantineNotice() {
  const sync = useSync();
  if (!sync.quarantineMessage) return null;
  return (
    <p className="border-b border-warn/40 bg-warn-soft px-4 py-2 text-sm text-warn" role="status">
      {sync.quarantineMessage}
    </p>
  );
}

/**
 * The single navigation frame: a side rail from the md breakpoint, a bottom tab bar on
 * phones, and one sticky top bar that carries the sync status on every screen size.
 */
export function AppShell({
  children,
  notice,
}: Readonly<{ children: ReactNode; notice?: ReactNode }>) {
  const pathname = usePathname();
  const account = useAccount();
  const { canSync } = useCapabilities();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="contents md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-2 md:border-r md:border-line md:bg-surface md:px-3 md:py-4">
        <Link
          className="hidden items-center gap-3 rounded-lg px-2 pb-3 font-display text-lg font-bold text-ink md:flex"
          href="/"
        >
          <BrandMark />
          Anorganika
        </Link>
        <nav
          aria-label="Hlavní navigace"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        >
          <ul className="m-0 grid list-none grid-cols-4 p-0 md:flex md:flex-col md:gap-1">
            {PRIMARY_DESTINATIONS.map(({ href, label, icon: Icon, matches }) => {
              const active = matches(pathname);
              return (
                <li key={href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-[15px] ${
                      active
                        ? "text-accent-strong md:bg-accent-soft md:font-bold"
                        : "text-ink-3 hover:text-ink md:text-ink-2 md:hover:bg-surface-2"
                    }`}
                    href={href}
                  >
                    <span
                      className={`grid h-7 w-12 place-items-center rounded-full text-[22px] md:h-auto md:w-auto md:text-xl ${
                        active ? "bg-accent-soft md:bg-transparent" : ""
                      }`}
                    >
                      <Icon />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden md:mt-auto md:grid md:gap-1 md:border-t md:border-line md:pt-3">
          <Link
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-2"
            href="/napoveda"
          >
            <HelpIcon className="text-xl" />
            Nápověda
          </Link>
          {account?.role === "admin" ? (
            <Link
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-2"
              href="/admin"
            >
              <ShieldIcon className="text-xl" />
              Správa
            </Link>
          ) : null}
          <Link
            aria-label="Profil"
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-surface-2"
            href="/ucet"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-sm font-bold text-ink"
            >
              {(account?.username ?? "?").slice(0, 1).toLocaleUpperCase("cs-CZ")}
            </span>
            <span className="grid min-w-0 leading-tight">
              <span className="truncate text-sm font-semibold text-ink">
                {account?.role === "guest" ? "Host" : (account?.username ?? "")}
              </span>
              <span className="text-xs text-ink-3">Profil a nastavení</span>
            </span>
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <Link
            className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-ink md:hidden"
            href="/"
          >
            <BrandMark />
            {/* On the narrowest phones the sync status needs the room; the name stays for screen readers. */}
            <span className="max-[24rem]:sr-only">Anorganika</span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <AccountBadge />
            {canSync ? <SyncStatusChip /> : null}
            <Link
              aria-label="Nápověda"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-ink-2 hover:bg-surface-2 md:hidden"
              href="/napoveda"
            >
              <HelpIcon />
            </Link>
            <Link
              aria-label="Profil"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-ink-2 hover:bg-surface-2 md:hidden"
              href="/ucet"
            >
              <UserIcon />
            </Link>
          </div>
        </header>
        {notice}
        {canSync ? <QuarantineNotice /> : null}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
