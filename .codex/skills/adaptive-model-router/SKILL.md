---
name: adaptive-model-router
description: Route software-engineering work to the cheapest appropriate Codex agent and escalate only when task complexity or evidence requires it.
---

# Adaptive Model Router

Select the least expensive capable agent for software-engineering work.

The parent agent is GPT-6 Luna High and acts as coordinator.

## Core rule

Do not use a stronger model merely because it is available.

Choose the lowest-cost agent that is reasonably likely to complete the task
correctly.

Do not automatically walk through every escalation level.

## Routing

### Parent / quick_worker — GPT-6 Luna High

Use Luna High for small, obvious, well-scoped work:

- repository inspection
- locating files or symbols
- formatting
- documentation-only edits
- lint fixes
- typo fixes
- mechanical edits
- simple test repairs
- trivial localized bugs with an obvious cause
- repetitive changes following an established pattern

If the parent can perform the task directly, do not spawn quick_worker solely
to delegate work to the same model.

Use quick_worker when delegation provides a real benefit, especially for
independent parallel work.

### implementer — GPT-6 Sol Medium

Use `implementer` for normal software-engineering work:

- implementing a normal issue
- well-defined feature development
- moderately scoped bug fixes
- changes across several related files
- normal API changes
- normal UI changes
- adding or modifying tests
- extending an existing implementation using established patterns

This should be the default worker for ordinary implementation tasks.

### feature_engineer — GPT-6 Sol High

Use `feature_engineer` when:

- a feature spans multiple modules
- backend and frontend must change together
- persistence and application logic both change
- significant refactoring is required
- several architectural layers are involved
- public contracts may be affected
- requirements contain meaningful implementation ambiguity

Do not use feature_engineer merely because an issue touches several files.

### deep_debugger — GPT-6 Sol XHigh

Use `deep_debugger` when root-cause analysis is the primary difficulty:

- unexplained CI failures
- intermittent failures
- race conditions
- concurrency problems
- environment-specific failures
- difficult state inconsistencies
- deployment behavior differs from repository state
- straightforward debugging attempts have failed
- the root cause remains unclear

Prefer evidence gathering over speculative fixes.

### hard_problem_solver — GPT-6 Astra Low

Use `hard_problem_solver` only when:

- a serious Sol-based investigation failed
- multiple evidence-based hypotheses have been exhausted
- previous approaches repeatedly failed
- assumptions need to be reconsidered
- reasoning must span code, configuration, infrastructure, tests and runtime
  behavior

Do not escalate to Astra because:

- one test failed
- compilation failed once
- the first implementation was incorrect
- a command returned an unexpected result
- additional repository exploration is needed

Before escalating, preserve and pass the evidence from previous attempts.

### migration_architect — GPT-6 Astra Medium

Use `migration_architect` directly when the task is inherently high-risk and
repo-wide, including:

- major framework migration
- language migration
- substantial database schema/data migration
- architecture transition
- multi-service migration
- major deployment architecture change
- migration requiring compatibility planning
- migration requiring rollback or recovery planning

Do not route ordinary refactoring or feature development here.

## Escalation ladder

The available capability ladder is:

1. Luna High
2. Sol Medium
3. Sol High
4. Sol XHigh
5. Astra Low
6. Astra Medium

This is not a mandatory sequence.

Start directly at the level justified by the task.

Examples:

- simple lint fix -> Luna High
- normal GitHub issue -> Sol Medium
- cross-layer feature -> Sol High
- intermittent CI race -> Sol XHigh
- unresolved difficult root cause after serious Sol work -> Astra Low
- repo-wide database migration -> Astra Medium

## Retry policy

Do not retry essentially the same failed approach more than twice.

A failed implementation does not automatically justify stronger reasoning.

First determine whether failure resulted from:

- a simple implementation mistake
- incomplete repository knowledge
- incorrect assumptions
- inadequate task classification
- genuinely insufficient reasoning capability

Escalate only for the last two cases when justified by evidence.

## Escalation handoff

When escalating after previous work, provide the stronger agent with:

1. original objective
2. relevant repository context
3. evidence gathered
4. hypotheses tested
5. changes attempted
6. test or verification results
7. what remains unexplained

The stronger agent should not restart the investigation from zero unless the
existing assumptions themselves appear unreliable.

## Parallelism

Parallelize only independent work.

Good candidates:

- repository exploration
- log analysis
- independent debugging hypotheses
- test analysis
- documentation research
- security review

Avoid concurrent agents modifying overlapping files.

Prefer one implementation owner for a coherent change.

## Completion responsibility

The parent coordinator remains responsible for:

- checking the result against the original request
- ensuring relevant verification was performed
- identifying incomplete work
- deciding whether escalation is justified
- presenting the final result

## Routing visibility

When a specialized agent is delegated work, include one concise line in the
final task summary:

`Routing: <agent-role> — <model> <reasoning-effort>`

If multiple specialized agents were used, list each unique routing decision.

Do not include routing information when the parent Luna coordinator handled
the entire task without delegation.