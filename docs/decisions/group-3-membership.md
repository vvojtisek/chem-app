# ADR: Group-3 membership and periodic-grid positions

- Status: accepted
- Date: 2026-09-21

## Context

The periodic-table curriculum must place one element in every non-f-block
`(period, group)` cell. The source data previously assigned La, Lu, Ac, and Lr
to group 3. That made periods 6 and 7 ambiguous: each contained two distinct
elements at group 3, so the 92 elements with a non-null group occupied only
90 grid positions.

The project audit dated 2026-09-21 identified the IUPAC 2021 provisional
Sc–Y–Lu–Lr treatment as the required resolution.

## Decision

For this curriculum, group 3 consists of Sc, Y, Lu, and Lr.

La and Ac are represented as f-block elements with `group: null`. They remain
in the period-6 and period-7 lanthanide/actinide rows rather than occupying
main-grid group-3 cells.

The content validator rejects two distinct elements that share a non-null
`(period, group)` position.

## Consequences

- The standard 18-group grid has an unambiguous cell for every element that
  declares a group.
- Periodic-table rendering can rely on one element per main-grid cell.
- A later change to group-3 membership requires a replacement ADR, corresponding
  curriculum review, and updated validation fixtures.
