"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, type SVGProps, useState } from "react";

import { AppVersionLabel } from "./app-version-label";
import { useAccount, useCapabilities } from "./auth-gate";
import {
  BookIcon,
  ChartIcon,
  FlaskIcon,
  HelpIcon,
  HomeIcon,
  ShieldIcon,
  SignOutIcon,
  UserIcon,
} from "./icons";
import { SyncStatusChip, useSync } from "./sync-provider";
import { useSignOut } from "./use-sign-out";

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

/** Učivo, Procvičovat and Pokrok of a server-side subject module (ADR 0015). */
function subjectDestinations(id: string): readonly Destination[] {
  const base = `/predmety/${id}`;
  return [
    { href: base, label: "Učivo", icon: BookIcon, matches: (path) => path === base },
    {
      href: `${base}/procvicovani`,
      label: "Procvičovat",
      icon: FlaskIcon,
      matches: (path) => path.startsWith(`${base}/procvicovani`),
    },
    {
      href: `${base}/pokrok`,
      label: "Pokrok",
      icon: ChartIcon,
      matches: (path) => path.startsWith(`${base}/pokrok`),
    },
  ];
}

interface SubjectArea {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** Small caption and large symbol of the subject's tile, styled like a periodic table cell. */
  readonly mark: { readonly caption: string; readonly symbol: string };
  readonly destinations: readonly Destination[];
}

/** Chemistry is the default area; other subjects own everything under /predmety/<id>. */
export const SUBJECT_AREAS: readonly SubjectArea[] = [
  {
    id: "anorganika",
    label: "Anorganika",
    href: "/",
    mark: { caption: "CZ", symbol: "An" },
    destinations: PRIMARY_DESTINATIONS,
  },
  {
    id: "matematika",
    label: "Matematika",
    href: "/predmety/matematika",
    mark: { caption: "∫", symbol: "Ma" },
    destinations: subjectDestinations("matematika"),
  },
];

export function subjectAreaFor(pathname: string): SubjectArea {
  return (
    SUBJECT_AREAS.find(
      (area) =>
        area.href !== "/" && (pathname === area.href || pathname.startsWith(`${area.href}/`)),
    ) ?? (SUBJECT_AREAS[0] as SubjectArea)
  );
}

export function SubjectMark({
  caption = "CZ",
  symbol = "An",
  size = "sm",
  muted = false,
}: Readonly<{ caption?: string; symbol?: string; size?: "sm" | "md"; muted?: boolean }>) {
  const box = size === "md" ? "h-12 w-12 rounded-[10px]" : "h-9 w-9 rounded-lg";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 grid-rows-[auto_1fr] px-1.5 py-1 font-display ${
        muted ? "bg-surface-3 text-ink-2" : "bg-accent text-on-fill"
      } ${box}`}
    >
      <span className="text-[8px] leading-none font-semibold opacity-85">{caption}</span>
      <span
        className={`self-end leading-none font-extrabold ${size === "md" ? "text-2xl" : "text-lg"}`}
      >
        {symbol}
      </span>
    </span>
  );
}

/**
 * Subject tabs at the start of the top bar. Each tab is the subject's tile and name; the
 * current one is outlined and filled, the others have a grey tile until hovered. Dimming uses
 * the muted palette, not opacity, so the inactive tab still meets WCAG AA contrast. Below the sm
 * breakpoint only the tiles show, so the bar still fits the help, profile and sign-out
 * buttons on a 360 px phone; the names stay for screen readers.
 */
function SubjectTabs({ current }: Readonly<{ current: SubjectArea }>) {
  return (
    <nav aria-label="Předmět" className="min-w-0 shrink-0">
      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {SUBJECT_AREAS.map((area) => {
          const active = area.id === current.id;
          return (
            <li key={area.id}>
              <Link
                aria-current={active ? "true" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl border p-1 font-display text-lg font-bold transition sm:pr-3 ${
                  active
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-transparent text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink"
                }`}
                href={area.href}
              >
                <SubjectMark
                  caption={area.mark.caption}
                  muted={!active}
                  symbol={area.mark.symbol}
                />
                <span className="max-sm:sr-only">{area.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
 * The single navigation frame: one sticky top bar with the subject tabs and the sync status
 * on every screen size, below it a side rail from the md breakpoint and a bottom tab bar on
 * phones.
 */
export function AppShell({
  children,
  notice,
}: Readonly<{ children: ReactNode; notice?: ReactNode }>) {
  const pathname = usePathname();
  const area = subjectAreaFor(pathname);
  const account = useAccount();
  const { canSync, isGuest } = useCapabilities();
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signOutLabel = isGuest ? "Ukončit hostovský přístup" : "Odhlásit";

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
    } catch {
      setSignOutError("Odhlášení se nepodařilo. Připojte se k síti a zkuste to znovu.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-surface/95 px-3 py-1.5 backdrop-blur sm:px-6 md:h-16 md:flex-nowrap md:px-3 md:py-0">
        <SubjectTabs current={area} />
        <AppVersionLabel />
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
          <button
            aria-label={signOutLabel}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-ink-2 hover:bg-surface-2 disabled:opacity-50 md:hidden"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            title={signOutLabel}
            type="button"
          >
            <SignOutIcon />
          </button>
        </div>
      </header>
      <div className="flex-1 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="contents md:sticky md:top-16 md:flex md:h-[calc(100dvh-4rem)] md:flex-col md:gap-2 md:border-r md:border-line md:bg-surface md:px-3 md:py-4">
          <nav
            aria-label="Hlavní navigace"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
          >
            <ul
              className={`m-0 grid list-none p-0 md:flex md:flex-col md:gap-1 ${
                area.destinations.length === 3 ? "grid-cols-3" : "grid-cols-4"
              }`}
            >
              {area.destinations.map(({ href, label, icon: Icon, matches }) => {
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
            ) : account?.curriculumSme ? (
              <Link
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-2"
                href="/admin/data"
              >
                <ShieldIcon className="text-xl" />
                Data
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
            <button
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              <SignOutIcon className="text-xl" />
              {signOutLabel}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col pb-20 md:pb-0">
          {signOutError ? (
            <p
              className="border-b border-bad/40 bg-surface px-4 py-2 text-sm text-bad"
              role="alert"
            >
              {signOutError}
            </p>
          ) : null}
          {notice}
          {canSync ? <QuarantineNotice /> : null}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
