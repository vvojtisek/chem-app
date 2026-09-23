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

## Cost and concurrency guardrails

Optimize for successful completion per unit of compute, not maximum model strength.

### Default concurrency

Use at most one specialized implementation agent at a time.

Spawn multiple agents only when the subtasks are genuinely independent and
parallel execution provides a clear benefit.

Do not create multiple agents to solve the same problem unless explicitly
performing independent hypothesis analysis.

### Parallel-agent limit

Without explicit user instruction:

- maximum 2 concurrent specialized agents;
- maximum 3 concurrent read-only exploration agents;
- maximum 1 agent allowed to modify a given area of the repository.

Never let multiple agents concurrently modify overlapping files.

### Escalation budget

Do not escalate solely because an implementation or test failed.

Before escalating to a stronger model, determine whether the failure is caused by:

1. an implementation mistake;
2. missing repository context;
3. an incorrect assumption;
4. task scope being larger than classified;
5. genuinely insufficient reasoning capability.

Cases 1 and 2 should normally be retried at the current level.

Case 3 may justify a different approach at the current level.

Cases 4 and 5 may justify escalation.

### Astra guardrail

Astra is expensive and must not be selected merely for convenience.

Before spawning `hard_problem_solver`, the parent must have evidence that a
serious Sol-level attempt failed or that important assumptions require
reconsideration.

Before spawning `migration_architect`, the task must inherently involve a
high-risk migration or architecture transition.

Do not use Astra for:

- ordinary implementation;
- repository exploration;
- formatting or linting;
- routine test failures;
- simple CI failures with an obvious cause;
- normal feature development;
- code review that can be handled by Luna or Sol.

### Repeated failure protection

Track materially different approaches, not command failures.

Do not retry essentially the same reasoning path more than twice.

If two materially different approaches fail at the same capability level,
either:

- escalate one level with an evidence summary; or
- stop and report the blocker if stronger reasoning is unlikely to help.

Never enter an open-ended retry loop.

### Delegation depth

Prefer shallow delegation:

parent coordinator
→ specialized worker

A specialized worker should not normally spawn another specialized worker.

Return unresolved work to the parent coordinator for reclassification and
possible escalation.

### Completion economy

Do not spawn another agent merely to confirm work that can be verified
deterministically with tests, linters, type checking, builds, or direct
inspection.

Prefer deterministic verification over model-based re-review.

## Escalation handoff format

When escalating from one agent to a stronger agent, do not restart the task
from zero.

The parent coordinator must provide the new agent with a concise structured
handoff containing:

### Objective
What must ultimately be achieved.

### Current scope
Files, modules, services, or subsystems currently believed to be relevant.

### Evidence
Concrete observations from code, logs, tests, CI, runtime behavior, or
repository state.

### Attempts
For each materially different approach already tried:

- hypothesis;
- action taken;
- result;
- why the approach is considered unsuccessful or incomplete.

### Known-good facts
Facts already verified and not worth re-investigating unless contradictory
evidence appears.

### Open questions
What remains unexplained or unresolved.

### Verification state
Tests, builds, linters, type checks, reproduction steps, or diagnostics already
executed and their results.

### Constraints
Relevant requirements from AGENTS.md, ADRs, issue acceptance criteria,
architecture, compatibility, security, or user instructions.

The receiving agent must:

1. read the handoff before exploring;
2. avoid repeating completed investigation without a concrete reason;
3. challenge previous assumptions only when evidence justifies it;
4. continue from the highest-value unresolved question;
5. return new evidence to the parent if another escalation is required.

Keep the handoff concise. Include evidence and conclusions, not full transcripts
or unnecessary command output.