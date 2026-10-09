# ADR 0011: Derive releases from Conventional Commit pull request titles

- Status: Accepted
- Date: 2026-10-09
- Decision owners: Engineering

## Context

The application shows its version in the app shell from
`apps/web/package.json`. That version was bumped by hand (last to `1.1.7`), the
repository had no Git tags or GitHub Releases, and other version fields
(`package.json` at the root, `apps/api/pyproject.toml`) were unmaintained.

Pull requests are squash-merged, so the pull request title becomes the commit
subject on `main`. `AGENTS.md` already requires Conventional Commits. One
proposal was to derive the version bump from the branch prefix (`fix/`, `feat/`,
`breaking/`, `chore/`). The branch name is not stored in Git history after a
squash merge, cannot express a breaking `feat` or `fix`, and many pull requests
come from `claude/*` branches with no type prefix.

## Decision

- The pull request title is the single input for versioning. It must be a
  Conventional Commit, enforced by the `Pull request title` workflow.
- Release impact follows Semantic Versioning and release-please defaults:
  `type!:` is major, `feat` is minor, `fix`, `perf` and `revert` are patch, and
  `docs`, `test`, `ci`, `build`, `chore`, `refactor` and `style` do not release.
- `release-please` runs on every push to `main`. It maintains one release pull
  request that bumps the version in `package.json`, `apps/web/package.json` and
  `.release-please-manifest.json` and updates `CHANGELOG.md`. Merging it creates
  the `vX.Y.Z` tag and the GitHub Release.
- Versioning continues the shipped `1.x` line from `1.1.7`. Commits after
  `14252d7` (the commit that set `1.1.7`) count toward the first automated
  release.
- The release workflow uses the repository `GITHUB_TOKEN` with `contents`,
  `issues` and `pull-requests` write scope, pins actions to commit SHAs, and
  does not build or deploy.
- `apps/api` keeps its own unreleased `0.1.0`; the product version is the web
  and root version.

## Consequences

- Branch prefixes stay a naming convention only; they do not affect versions.
- A release is an explicit act: merging the release pull request. Feature
  merges alone do not tag.
- Workflows do not run on pull requests or tags created by `GITHUB_TOKEN`, so
  CI does not run on the release pull request until it is merged. Running CI on
  it requires a GitHub App or fine-grained token secret.
- A wrong title on a merged pull request can be corrected before release with a
  `Release-As: X.Y.Z` footer in a later commit on `main`.
