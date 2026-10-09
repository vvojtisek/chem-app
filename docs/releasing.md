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
5. The same run builds the `api` and `web` images from that commit for
   `linux/arm64` (the production host is a `t4g` instance) and pushes them to
   `ghcr.io/vvojtisek/chem-app-api` and `ghcr.io/vvojtisek/chem-app-web` as
   `X.Y.Z`. Only after both pushes succeed does it move the `stable` tag of
   both images to `X.Y.Z` (ADR 0012).

The workflow does not deploy. The server still updates from `main` as described
in [deploy/aws/README.md](../deploy/aws/README.md), so merge the release pull
request before deploying if the deployed app should show the new version.

### Published images

- The images contain no configuration or secrets. The `web` image is built with
  `API_PROXY_TARGET=http://api:8000`, the address used by
  `docker-compose.prod.yml`.
- The first push creates each GHCR package as private. Make both packages
  public once (package settings, "Change visibility") so the server can pull
  them without registry credentials.
- To roll back, point `stable` at an earlier version with
  `docker buildx imagetools create --tag <image>:stable <image>:X.Y.Z` for both
  images.
- A release with no `feat`, `fix`, `perf` or `revert` changes is never cut, so
  no images are built for `ci`, `docs` or `chore`-only merges.

## Update notice for administrators

Administrators see an "Aktualizovat na vX.Y.Z" button and a "Co je nového"
link to the release notes next to the version in the app header when a newer
GitHub Release exists. Learners see only the version.

- The API reads `https://api.github.com/repos/<RELEASE_CHECK_REPOSITORY>/releases/latest`
  at most once every five minutes (once per 10 minutes after a failure) and
  serves the result at `GET /api/v1/admin/releases/latest`, which requires the
  admin role. The header asks again whenever the tab becomes visible, so a tab
  left open picks up a new release without a reload.
- Only a `vX.Y.Z` tag whose release page is on `github.com` for that repository
  is accepted. Any error leaves the plain version in place.
- Set `RELEASE_CHECK_REPOSITORY` to an empty value to turn the check off; it is
  off by default outside production.
- Next to the notice, administrators get an "Aktualizovat na vX.Y.Z" button.
  After confirmation it asks Watchtower, through the API, to pull the `stable`
  images and restart the app containers (ADR 0012). It can only apply what CI
  published as `stable`; it never chooses a version. See
  [deployment.md](deployment.md#updating-the-application).
- Watchtower answering 202 only means it accepted the request. The tab then
  polls `GET /app-version` (the version of the web build that is serving) every
  10 seconds and reloads once it changes. If it has not changed after
  10 minutes, the header says so and offers the button again; check
  `docker compose ... logs watchtower` on the host.
