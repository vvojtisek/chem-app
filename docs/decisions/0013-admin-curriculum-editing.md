# ADR 0013: Edit curriculum datasets from the admin console

- Status: Proposed
- Date: 2026-10-09
- Decision owners: Product owner and engineering
- Affects: `docs/architecture.md` (curriculum data flow), `docs/chemistry-content.md`
  (review workflow), `apps/api/AGENTS.md` (chemistry boundary)

## Context

The product owner wants administrators to add, modify and remove curriculum
datasets, such as chemical equations, from the admin console, and to mark each
item as validated by a chemistry SME.

How curriculum works today (main @ 2b8de54):

- The only source of truth is the JSON under `content/data/`, edited in Git.
  `pnpm content:validate` (run in CI) checks schema, IDs, formula parsing,
  atom balance, lowest-ratio coefficients, aliases and review fingerprints.
- The web app imports the data at build time through `@inorganic/content`
  (`runtime`, `preparation-production`, `balancing-reactions`, nomenclature
  snapshot). Learners get it inside the PWA bundle and use it offline. The API
  stores no curriculum; attempts reference it only by `question_id` and
  `content_version`.
- SME validation already exists per record: `status: reviewed`, `reviewedBy`
  (a `chemistry-sme` entry in `content/data/reviewers.json`), `reviewedAt` and
  `reviewFingerprint`. Changing a reviewed field fails validation with
  `stale_review_fingerprint`, so an edit reopens review.
- Equation, chemistry and fingerprint logic exist only in TypeScript
  (`packages/chemistry`, `content/src`). `apps/api/AGENTS.md` forbids a Python
  chemistry parser without an ADR and forbids accepting client-authored
  curriculum as reviewed content.

Current review state of the datasets:

| Dataset | File | Records | SME-reviewed |
| --- | --- | --- | --- |
| Preparation/production equations | `preparation-production.json` | 77 products, 117 routes | 0 (116 owner-approved, 1 in review) |
| Nomenclature | `nomenclature.json` | 510 | 0 |
| Balancing lessons | `balancing-reactions.json` | 114 (5.2 MB, step-by-step) | 0 |
| Elements | `elements.json` | 118 | 118 |
| Named groups | `groups.json` | 8 | 8 (no fingerprint) |
| Alternate mnemonics | `alternate-group-mnemonics.json` | 8 | 0 |

Editing from the admin console therefore changes either where curriculum lives
or how it reaches Git. Both are ADR triggers in `AGENTS.md` (persistence model,
major external service).

## Options

### A. Admin console edits Git through pull requests (recommended)

The console is an editor for `content/data/`. The API turns each save into a
commit on a `content/<id>` branch and opens a pull request through the GitHub
API. CI runs the existing validators; the owner merges; release-please and the
Watchtower update (ADR 0012) deliver it to learners.

- Keeps one source of truth, every validator, the fingerprint review model,
  the offline bundle and the API chemistry boundary unchanged.
- The browser editor reuses `@inorganic/content` and `packages/chemistry`
  for immediate feedback (parse, balance, fingerprint). CI remains the
  authoritative check, so nothing the browser computes is trusted.
- Cost: an edit reaches learners only after the content PR, the release PR and
  the update. The API needs a GitHub write credential (new secret, see
  Security).

### B. Curriculum moves into PostgreSQL

New tables hold editable datasets; the API serves versioned snapshots; the PWA
fetches and caches them in IndexedDB instead of importing them at build time.

- Edits are live immediately.
- Cost: changes the persistence and offline model (ADR 0003), needs a
  cross-language validation strategy (a Python port of the parser and balance
  checks, or Node in the API image), a public curriculum endpoint for guests,
  snapshot versioning for attempts, and a one-time import with a cut-over.
  Git history stops being the review record.

### C. Database overlay on top of Git content

Admin-created items live in the database and are merged with the static
content at runtime. Rejected: two sources of truth for the same family, and
the overlay still needs everything in B.

## Decision (proposed: option A)

1. **Scope and order.** Phase 1 covers preparation/production equations
   (products and routes). Nomenclature follows. Elements, groups and
   mnemonics later if wanted. Balancing lessons stay file-edited: they are
   multi-step derivations, not form data.
2. **Operations.** Add, modify, and remove. Remove sets `status: deprecated`
   (IDs are never reused, attempts keep referencing them) and the runtime
   build already drops deprecated records. A record that never shipped can be
   deleted outright in the same PR.
3. **SME validation.** "Označit jako ověřeno SME" is available to an admin
   whose account is linked to a `chemistry-sme` entry in `reviewers.json`
   (today `reviewer.vvojtisek`). The API takes the reviewer ID from the
   signed-in account, never from the request. The commit sets `reviewed`,
   `reviewedBy`, `reviewedAt` and the fingerprint; CI recomputes and rejects a
   wrong fingerprint. An admin without a linked SME entry can edit but not
   validate. This keeps the documented rule that a review is a personal
   attestation by a registered SME.
4. **Edit clears validation.** Saving a change to a reviewed record writes it
   back as `in-review` (or `owner-approved` when the owner releases it) and
   removes the review fields, matching the existing workflow.
5. **Learner visibility unchanged.** Learners keep seeing `owner-approved`
   and `reviewed` records, labelled by `reviewLevel`. Showing only
   SME-validated items would today remove every equation and nomenclature
   exercise (0 of 117 routes and 0 of 510 names are SME-reviewed). The
   product owner can switch this per family later; the release gate
   `pnpm content:release-check` already enforces SME review where it is run.
6. **Transport.** New admin endpoints under `/api/v1/admin/curriculum/...`,
   admin role, CSRF token and allowed Origin as on all mutations, bounded
   payloads, Pydantic schemas with `extra="forbid"` mirroring the content
   schemas for shape only. Each change writes a structured audit log line
   (actor ID, record ID, action, PR URL). The API validates shape and
   authorization; chemistry validity is CI's job.
7. **GitHub access.** A GitHub App installation token (preferred) or
   fine-grained token limited to `vvojtisek/chem-app` with `contents:write`
   and `pull_requests:write`, read from `.env.production`
   (`CURRICULUM_GITHUB_TOKEN`), validated at startup only when the feature is
   enabled. Branch protection on `main` must require CI and a human merge.

## Consequences

Security properties that change (flagged per project policy):

- **New write credential on the server.** Whoever controls the API process,
  or an admin session, can push branches and open PRs in the repository.
  The token cannot be path-restricted, so a stolen token could propose code
  changes, not only content. Merge to `main` still needs the owner; this holds
  only while branch protection is enforced, which is host/GitHub state and is
  unverified.
- **Admin role gains a content attestation path.** Limited to accounts linked
  to a registered SME, with the reviewer ID resolved server-side.
- None of the confirmed properties (hashed session tokens, SameSite=Strict
  with Origin and CSRF checks, Argon2 cap, non-enumerating registration and
  reset, encrypted outbox tokens, least-privilege DB role, read-only
  containers) is weakened. No new tables are needed for option A.

Operational:

- Latency from save to learner is the PR merge, the release PR merge and an
  update. Several edits can be batched in one content PR per session to keep
  the release PR count down.
- Concurrent edits to the same file are serialized by Git: the API rebases
  the content branch or reports a conflict to the admin.
- Option B remains possible later; nothing in A blocks it.

## Rollout (option A)

1. This ADR and plan (docs only).
2. API: GitHub adapter with timeouts, admin curriculum endpoints for
   preparation/production (list from the deployed snapshot, create, update,
   deprecate, validate), audit log, tests with a fake adapter.
3. Web: admin console section "Data" with list, editor using
   `@inorganic/content` validation, and validate/deprecate actions.
4. Nomenclature editor.

Each phase is a separate pull request. Production changes only when the owner
sets the token and merges.
