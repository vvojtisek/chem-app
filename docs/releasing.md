# Releasing

Versions follow [Semantic Versioning](https://semver.org/) and are derived from
pull request titles. See [ADR 0011](decisions/0011-automated-semantic-versioning.md)
for the reasoning.

## Pull request titles

Pull requests are squash-merged, so the title becomes the commit on `main`. The
`Pull request title` check requires a
[Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<optional scope>)<optional !>: <description>
```

| Title example | Release impact | `1.2.3` becomes |
| --- | --- | --- |
| `fix(api): reject expired reset tokens` | patch | `1.2.4` |
| `perf(web): cache element tiles` | patch | `1.2.4` |
| `revert: undo practice timer` | patch | `1.2.4` |
| `feat(nomenclature): add hydrates` | minor | `1.3.0` |
| `feat(api)!: require sign-in for progress` | major | `2.0.0` |
| `docs`, `test`, `ci`, `build`, `chore`, `refactor`, `style` | none | `1.2.3` |

Use `!` for any change that breaks an existing user or deployment: removed
features, an API change an older cached client cannot handle, a database
migration that is not backward compatible, or a browser storage change that
resets local progress. Security dependency updates use `fix(deps)` so they are
released.

The branch name does not affect the version. Keep using the prefixes in
`AGENTS.md` (`feat/`, `fix/`, `docs/`, ...) for readability.

## Release flow

1. Merge pull requests to `main` as usual.
2. The `Release` workflow opens or updates a pull request titled
   `chore(main): release X.Y.Z`. It bumps `package.json`,
   `apps/web/package.json` (the version shown in the app) and
   `.release-please-manifest.json`, and adds the changes to `CHANGELOG.md`.
3. Review it. To force a different version, add a commit to `main` whose body
   ends with `Release-As: X.Y.Z`.
4. Merge it. The workflow tags the merge commit `vX.Y.Z` and publishes the
   GitHub Release with the changelog entry.

The workflow does not deploy. The server still updates from `main` as described
in [deploy/aws/README.md](../deploy/aws/README.md), so merge the release pull
request before deploying if the deployed app should show the new version.
