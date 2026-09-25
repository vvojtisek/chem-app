# Known limitations for the current release candidate

## Curriculum

- The release gate covers six shipped families: elements, named groups,
  alternate group mnemonics, nomenclature, preparation/production products,
  and individual production routes. The latest run reports 118/118 elements
  reviewed; 0/8 groups, 0/8 alternate mnemonics, 0/469 nomenclature records,
  0/77 products, and 0/116 routes reviewed. The 678 outstanding records block
  curriculum release. One unbalanced source equation is held out. See
  [curriculum credits](content-credits.md) and the review ledgers under
  `docs/exec-plans/active/`.
- Equation validation proves supported syntax and atom balance, not that each
  reaction is chemically plausible or that its conditions are correct.
- The equation parser intentionally supports a documented subset of chemical
  notation. Unsupported charges, phases, coordination, nested groups, and
  structural formulas are not inferred.

## Accounts and progress

- Rank and correctness use client-reported answers. They are personal learning
  indicators, not independently verified scores.
- Resetting progress starts a new active generation but retains old immutable
  server events for daily upload quota accounting. It does not erase account
  data; self-service account deletion is not available in this version.
- Progress export/import is not implemented. Browser storage loss can remove
  unsynchronized attempts and local custom cards.
- Offline account access uses the last verified browser marker. It cannot
  authenticate a new device or confirm a password/session while disconnected.

## Compatibility and release operations

- Automated browser coverage uses desktop and mobile Chromium. It does not
  replace testing on physical iPad/Safari, assistive technology, or other
  supported browsers. No moderated usability sessions or screen-reader review
  have been completed yet, and no performance budget has been signed off.
- Playwright runs axe-core WCAG 2.0/2.1/2.2 A and AA checks on login,
  registration, the home page, all four learning modes, dashboard, and profile
  in desktop and mobile Chromium. These scans passed, but they do not certify
  WCAG conformance or replace manual keyboard, focus-visibility, contrast
  review in context, or screen-reader testing.
- A chemistry content release remains blocked until every shipped curriculum
  record passes `pnpm content:release-check`. That command validates the
  authoring data and reports current SME coverage by content family.
- Public operation also requires a completed privacy notice, DNS/firewall/TLS
  configuration, working SMTP delivery, backup restoration checks, and the
  scheduled purge job. See [deployment runbook](deployment.md) and the
  [privacy notice checklist](privacy-notice-release-checklist.md).
