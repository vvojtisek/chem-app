## Summary

<!-- What user-visible or technical outcome does this PR deliver? -->

## Linked work

- Issue / active execution plan:
- Relevant acceptance criteria:
- ADRs consulted or added:

## Changes

-

## Validation

List exact commands and results. Do not mark a command complete if it was not run.

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm content:validate`
- [ ] `pnpm contracts:check`
- [ ] `uv --directory apps/api run ruff format --check .`
- [ ] `uv --directory apps/api run ruff check .`
- [ ] `uv --directory apps/api run pytest -q`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

Focused or additional commands:

```text

```

Not run and why:

## Visual and interaction evidence

<!-- Add before/after screenshots or recordings for UI changes. Include 360 px and desktop evidence when layout changes. Do not include secrets or private data. -->

- [ ] Not applicable
- [ ] Keyboard path verified
- [ ] Touch/narrow layout verified
- [ ] Feedback does not rely on color alone
- [ ] Loading, empty, error, and offline states checked where relevant

## Chemistry and content review

- [ ] No chemistry behavior or curriculum content changed
- [ ] Automated chemistry/content validation passed
- [ ] Positive and negative fixtures were added or updated
- [ ] Chemistry SME review is complete

Reviewer/date or link to review:

Sources added or changed:

## API, persistence, and security

- [ ] No API contract change
- [ ] OpenAPI and generated client are updated
- [ ] No database migration required
- [ ] Alembic migration and compatibility/recovery notes are included
- [ ] No browser persistence migration required
- [ ] Browser migration or recoverable reset is tested
- [ ] Authorization has positive and negative tests where relevant
- [ ] No secrets, private data, or unsafe logs are included

## Risks and rollout

Known risks or limitations:

Rollout, compatibility, or rollback notes:

## Final checklist

- [ ] The diff is limited to the requested logical change
- [ ] Documentation reflects behavior and architecture
- [ ] New dependencies have a documented need
- [ ] Generated files contain only expected changes
- [ ] Remaining skipped validation or follow-up work is explicit
