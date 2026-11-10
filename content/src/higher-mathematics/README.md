# Higher mathematics practice source

This collection holds the nine syllabus sections shown in Učivo (`/predmety/matematika`) and
Procvičovat (`/predmety/matematika/procvicovani`) and 95 worked exercises. It is separate from the chemistry
curriculum and is not imported by chemistry code. Every section is draft content: exercises
have Codex as responsible editor, theory blocks have Claude as editor. No human reviewer or
chemistry SME approval is implied.

Each section has its official syllabus `title`, a `shortTitle` for tiles, `theory` blocks and
`solverTypes`, the server-side solver problem types (ADR 0015) offered on the section's Učivo
page. An exercise may carry `solver`, the same problem for the solver; signed-in learners then
see the solver's verified steps, and `apps/api/tests/test_math_practice_solver_links.py` checks
that every linked exercise solves.
The theory carries over the rule explanations the solver gives for the former topics (Limita,
Derivace, Implicitní derivace, Integrál, Parciální derivace, Gradient, Směrová derivace,
Dvojný a trojný integrál): limits to section 1, derivatives and implicit derivatives to 2,
partial derivatives, gradient and directional derivative to 4, integrals to 5 to 7, multiple
integrals to 7.

Prompts, hints, worked steps and theory are Czech text with inline TeX between dollar signs;
`formulas` are display TeX without dollar signs. The answer field is short canonical text for
deterministic grading; answerLabel is optional display notation. The client must not interpret
algebraically equivalent free-form answers as correct unless an explicit acceptedAnswers entry
exists.

Exercise answers were checked by substitution, differentiation, sign analysis or characteristic
roots, and spot-checked with SymPy. The automated catalog test checks structure and coverage,
not a human mathematical review. Before a scientific release, an independent mathematics
reviewer should review the set and record approval through a dedicated workflow.
