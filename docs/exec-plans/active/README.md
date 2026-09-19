# Active execution plans

Place current, task-specific implementation plans in this directory when work spans multiple modules, migrations, or review stages.

An active plan should state:

- goal, scope, and non-goals;
- relevant product requirements and ADRs;
- milestones with verifiable acceptance criteria;
- affected modules and dependency order;
- content and chemistry-review requirements;
- migrations, compatibility, offline, security, and rollback considerations;
- exact validation commands from `docs/testing.md`;
- decisions, discoveries, blockers, and completion evidence as work progresses.

Use a lowercase hyphenated filename such as `offline-attempt-sync.md`. Move completed plans to a future `docs/exec-plans/completed/` directory rather than rewriting their history. This README is guidance, not an active implementation plan.
