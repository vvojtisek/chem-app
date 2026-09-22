# Nomenclature seed — review ledger

Prepared: 2026-09-22. Input: [archived seed](nomenclature-seed.json).
Implementation contract: [developer plan](nomenclature-foundation.md).

This is a preliminary editorial/engineering triage, not chemistry approval. Every
entry is unreviewed. Preserve the supplied names/explanations in the archive;
corrections belong in separately reviewed authoring records. Categories below are
proposals, not runtime data. Difficulty and allowed directions await editor/SME
assignment. No item becomes releasable merely because it has no specific issue.

## Disposition

- `core-candidate`: plausible scope/grammar for the first release; still requires
  sources, review metadata, canonical/alias validation, and explanation review.
- `decision-required`: hold until the listed scientific/scope/teaching decision is
  resolved. Most can use the basic parser, which does not establish correctness.
- `defer-grammar`: preserved for later supported grammar and coordination scope.
- `defer-scope`: preserved for later explicit organic/related curriculum scope.

| Disposition | Records |
| --- | ---: |
| `core-candidate` | 86 |
| `decision-required` | 34 |
| `defer-grammar` | 2 |
| `defer-scope` | 4 |
| Total | 126 |

The seed has 20 hydrates. `hydrate` is an orthogonal tag, not a replacement for
the proposed base category. `binary-acid` denotes a curriculum family here; its
bare HCl/HBr/HF/H2S prompts still need the molecular/aqueous distinction. Records
classified `extension` cannot silently enter a core category to meet a count.

## Review issues

The table identifies risks/questions rather than authorizing corrections. The SME
must record the adopted curriculum convention, evidence, canonical answer,
direction-specific aliases, and positive/negative fixtures.

| ID | Affected subject | Required decision/action |
| --- | --- | --- |
| R01 | `H[AuCl4]`, `K2[HgI4]` | Square-bracket coordination compounds are outside the initial grammar. Keep in staging; later review ligand terminology, canonical names, aliases, and scope before adding grammar. |
| R02 | Oxalic acid and its hydrate | The supplied oxalic-acid explanation uses `ethanovou/dikarboxylovou`, while the seed also uses ethanová for acetic acid. Resolve this inconsistent identification from an authoritative source; do not inherit it into the hydrate explanation or runtime. |
| R03 | Oxalic/acetic acid and potassium oxalate | Organic/related material needs explicit curriculum scope. Preserve all four records, but defer them from the first inorganic core set. This is scope triage, not a claim that they are chemically invalid. |
| R04 | Thiosulfate and pentahydrate | Distinguish the formal substitution convention used to explain the name from a site-specific oxidation-state derivation. The seed's central-sulfur `+VI` statement needs an explicit curriculum explanation/source, not an automatic universal rule or unsourced replacement. |
| R05 | `FeCr2O4`, `Pb3O4` | Review mixed-oxide/spinel teaching, accepted Czech names, and the ion-based explanation. Decide whether these advanced items belong in this release; no generic single-cation rule. |
| R06 | `FeS2` | Review the disulfide description and distinguish ion charge from oxidation number; do not treat it as an ordinary sulfide or accept the FeS name. |
| R07 | Hydrogen halides and H2S | Define molecular versus aqueous context and exactly which names/aliases are accepted in each direction; preserve meaningful distinctions. |
| R08 | H2O, NH3, PH3, CH4, H2S | Decide coverage of parent hydrides/trivial names and source-supported aliases. Do not accept every parenthetical seed synonym. Avoid misleading classification as an oxoacid or salt. |
| R09 | H2O2 | Peroxide requires its own reviewed teaching/fixture; oxygen rules for ordinary oxides cannot be copied blindly. Hold under extension scope pending decision. |
| R10 | P4O10 | Define whether the reverse prompt requests molecular or empirical notation and whether P2O5 is accepted. Review the seed's dimer wording. Never globally reduce all formulas. |
| R11 | H3BO3, H3PO4, HNO3 | Review hydrogen-prefix conventions, accepted shorter names, and suffix explanation. Do not infer aliases by deleting a prefix or extracting prose. |
| R12 | Potassium/aluminium, potassium/chromium, ammonium/iron double-salt hydrates | Review the order/hyphenation of Czech names, hydration count, compound identity, and advanced difficulty. Avoid treating them as a single simple cation salt. |
| R13 | Listed potassium/sodium sulfite hydrates | Verify the exact hydrate form and source; being syntactically parseable and electrically plausible is insufficient. No conclusion here that a listed hydrate is impossible. |
| R14 | Na2B4O7 and decahydrate | Resolve chosen naming convention and any explicit stoichiometric prefix/alias; review borate explanation and hydrate name together. |
| R15 | Na3N, NaN3, NaNH2, KCN | Review specialist anions, intended scope, and explanations. Do not infer stability/preparation facts from a valid formula/name pair. |
| R16 | PBr3, SF6, SiCl4, SiF4 | Review wording that treats formal oxidation-state bookkeeping as literal separated cations/anions in molecular compounds. Apply the same wording audit throughout the seed. |

Global review checks for **all** entries:

1. Canonical name/formula and explicit accepted/rejected variants in both directions.
2. Distinguish polyatomic-ion charges from atom oxidation numbers in notation and
   explanations; the source frequently uses Roman-number notation for both.
3. Validate spelling, morphology, context, and every nontrivial assertion.
4. Preserve hydration count, group boundaries, and case-sensitive symbols.
5. Add authoritative sources and real reviewer/date metadata; a seed attachment is
   provenance only. Changes to answers/explanations reopen review.
6. The imported explanation is post-answer material, never a hidden automatic alias
   source or a pre-answer hint. All but one contain the complete canonical name.

## Source leads for the reviewer

- [VŠCHT: Názvosloví — teoretická část](https://e-learning.vscht.cz/mod/page/view.php?id=13158&lang=en)
  distinguishes oxidation numbers/ion charges, molecular HCl/aqueous acid, and
  provides a formal thio-substitution teaching convention. This supports keeping
  R04 a curriculum-adjudication task rather than making an automatic correction.
- [VŠCHT: Názvosloví koordinačních sloučenin](https://e-learning.vscht.cz/mod/page/view.php?id=54358&lang=en)
  is a reference for the separate coordination naming review.
- [VŠCHT: Anorganické názvosloví v kostce](https://vydavatelstvi.vscht.cz/p/97-anorganicke-nazvoslovi-v-kostce)
  is an identifiable textbook lead. Only its publisher description was inspected
  for this plan; do not pretend its full contents or the seed have been validated.

These sources were consulted as review leads on 2026-09-22. They do not establish
record-level approval. Add a precise section/page and the adopted convention to
each authoring record during review; do not paste this source list indiscriminately
onto all 126 records.

## Complete source-key inventory

Names below are copied from the seed without correction. `—` means no additional
item-specific issue identified during planning; the global checks still apply.
Order follows the supplied seed to aid comparison. The importer must eventually
map each key to a stable ID and report its final disposition.

| Source formula key | Supplied name | Proposed base category | Hydrate | Disposition | Issues |
| --- | --- | --- | --- | --- | --- |
| `AgCl` | chlorid stříbrný | `binary-salt` | no | `core-candidate` | — |
| `AgNO3` | dusičnan stříbrný | `oxoacid-salt` | no | `core-candidate` | — |
| `Al2(SO4)3` | síran hlinitý | `oxoacid-salt` | no | `core-candidate` | — |
| `Al(OH)3` | hydroxid hlinitý | `hydroxide` | no | `core-candidate` | — |
| `Al2O3` | oxid hlinitý | `oxide` | no | `core-candidate` | — |
| `B2O3` | oxid boritý | `oxide` | no | `core-candidate` | — |
| `BaCl2` | chlorid barnatý | `binary-salt` | no | `core-candidate` | — |
| `BaCl2.2H2O` | dihydrát chloridu barnatého | `binary-salt` | yes | `core-candidate` | — |
| `Be(NO3)2` | dusičnan beryllnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `Be(NO3)2.4H2O` | tetrahydrát dusičnanu beryllnatého | `oxoacid-salt` | yes | `core-candidate` | — |
| `Ca(H2PO4)2` | dihydrogenfosforečnan vápenatý | `hydrogensalt` | no | `core-candidate` | — |
| `Ca3(PO4)2` | fosforečnan vápenatý | `oxoacid-salt` | no | `core-candidate` | — |
| `Ca3P2` | fosfid vápenatý | `binary-salt` | no | `core-candidate` | — |
| `CaCl2` | chlorid vápenatý | `binary-salt` | no | `core-candidate` | — |
| `CaCO3` | uhličitan vápenatý | `oxoacid-salt` | no | `core-candidate` | — |
| `CaF2` | fluorid vápenatý | `binary-salt` | no | `core-candidate` | — |
| `CaHPO4` | hydrogenfosforečnan vápenatý | `hydrogensalt` | no | `core-candidate` | — |
| `CaO` | oxid vápenatý | `oxide` | no | `core-candidate` | — |
| `Cd(NO3)2` | dusičnan kademnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `CdCl2` | chlorid kademnatý | `binary-salt` | no | `core-candidate` | — |
| `CdI2` | jodid kademnatý | `binary-salt` | no | `core-candidate` | — |
| `CO2` | oxid uhličitý | `oxide` | no | `core-candidate` | — |
| `Cr2(SO4)3` | síran chromitý | `oxoacid-salt` | no | `core-candidate` | — |
| `Cr2O3` | oxid chromitý | `oxide` | no | `core-candidate` | — |
| `Cu(NO3)2` | dusičnan měďnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `Cu(NO3)2.3H2O` | trihydrát dusičnanu měďnatého | `oxoacid-salt` | yes | `core-candidate` | — |
| `Cu(OH)2` | hydroxid měďnatý | `hydroxide` | no | `core-candidate` | — |
| `CuCl2` | chlorid měďnatý | `binary-salt` | no | `core-candidate` | — |
| `CuCl2.2H2O` | dihydrát chloridu měďnatého | `binary-salt` | yes | `core-candidate` | — |
| `CuI` | jodid měďný | `binary-salt` | no | `core-candidate` | — |
| `CuO` | oxid měďnatý | `oxide` | no | `core-candidate` | — |
| `Cu2O` | oxid měďný | `oxide` | no | `core-candidate` | — |
| `CuSO4` | síran měďnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `CuSO4.5H2O` | pentahydrát síranu měďnatého | `oxoacid-salt` | yes | `core-candidate` | — |
| `FeCr2O4` | chromitan železnatý | `extension` | no | `decision-required` | R05 |
| `FeS` | sulfid železnatý | `binary-salt` | no | `core-candidate` | — |
| `FeS2` | disulfid železnatý | `binary-salt` | no | `decision-required` | R06 |
| `FeSO4` | síran železnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `FeSO4.7H2O` | heptahydrát síranu železnatého | `oxoacid-salt` | yes | `core-candidate` | — |
| `H[AuCl4]` | kyselina tetrachlorozlatitá | `extension` | no | `defer-grammar` | R01 |
| `H2C2O4` | kyselina šťavelová | `extension` | no | `defer-scope` | R02, R03 |
| `H2C2O4.2H2O` | dihydrát kyseliny šťavelové | `extension` | yes | `defer-scope` | R02, R03 |
| `H2O` | voda | `extension` | no | `decision-required` | R08 |
| `H2O2` | peroxid vodíku | `extension` | no | `decision-required` | R09 |
| `H2S` | sulfan | `binary-acid` | no | `decision-required` | R07, R08 |
| `H2SO4` | kyselina sírová | `oxoacid` | no | `core-candidate` | — |
| `H3BO3` | kyselina trihydrogenboritá | `oxoacid` | no | `decision-required` | R11 |
| `H3PO4` | kyselina trihydrogenfosforečná | `oxoacid` | no | `decision-required` | R11 |
| `HBr` | bromovodík | `binary-acid` | no | `decision-required` | R07 |
| `HCl` | chlorovodík | `binary-acid` | no | `decision-required` | R07 |
| `HF` | fluorovodík | `binary-acid` | no | `decision-required` | R07 |
| `Hg(NO3)2` | dusičnan rtuťnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `HNO3` | kyselina dusičná | `oxoacid` | no | `decision-required` | R11 |
| `CH3COOH` | kyselina octová | `extension` | no | `defer-scope` | R03 |
| `CH4` | methan | `extension` | no | `decision-required` | R08 |
| `K2[HgI4]` | tetrajodortuťnatan draselný | `extension` | no | `defer-grammar` | R01 |
| `K2C2O4` | šťavelan draselný | `extension` | no | `defer-scope` | R03 |
| `K2Cr2O7` | dichroman draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `K2CrO4` | chroman draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `K2O` | oxid draselný | `oxide` | no | `core-candidate` | — |
| `K2SO3` | siřičitan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `K2SO3.2H2O` | dihydrát siřičitanu draselného | `oxoacid-salt` | yes | `decision-required` | R13 |
| `K2SO4` | síran draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KAl(SO4)2.12H2O` | dodekahydrát síranu draselno-hlinitého | `oxoacid-salt` | yes | `decision-required` | R12 |
| `KClO3` | chlorečnan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KCl` | chlorid draselný | `binary-salt` | no | `core-candidate` | — |
| `KCN` | kyanid draselný | `extension` | no | `decision-required` | R15 |
| `KCr(SO4)2.12H2O` | dodekahydrát síranu draselno-chromitého | `oxoacid-salt` | yes | `decision-required` | R12 |
| `KI` | jodid draselný | `binary-salt` | no | `core-candidate` | — |
| `KIO3` | jodičnan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KMnO4` | manganistan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KNO2` | dusitan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KNO3` | dusičnan draselný | `oxoacid-salt` | no | `core-candidate` | — |
| `KOH` | hydroxid draselný | `hydroxide` | no | `core-candidate` | — |
| `Mg3N2` | nitrid hořečnatý | `binary-salt` | no | `core-candidate` | — |
| `MgCO3` | uhličitan hořečnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `MgCl2` | chlorid hořečnatý | `binary-salt` | no | `core-candidate` | — |
| `MgCl2.6H2O` | hexahydrát chloridu hořečnatého | `binary-salt` | yes | `core-candidate` | — |
| `MgO` | oxid hořečnatý | `oxide` | no | `core-candidate` | — |
| `MgSO4` | síran hořečnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `MgSO4.7H2O` | heptahydrát síranu hořečnatého | `oxoacid-salt` | yes | `core-candidate` | — |
| `MnO2` | oxid manganičitý | `oxide` | no | `core-candidate` | — |
| `Na2B4O7` | tetraboritan sodný | `oxoacid-salt` | no | `decision-required` | R14 |
| `Na2B4O7.10H2O` | dekahydrát tetraboritanu sodného | `oxoacid-salt` | yes | `decision-required` | R14 |
| `Na2CO3` | uhličitan sodný | `oxoacid-salt` | no | `core-candidate` | — |
| `Na2CrO4` | chroman sodný | `oxoacid-salt` | no | `core-candidate` | — |
| `Na2SO3` | siřičitan sodný | `oxoacid-salt` | no | `core-candidate` | — |
| `Na2SO3.2H2O` | dihydrát siřičitanu sodného | `oxoacid-salt` | yes | `decision-required` | R13 |
| `Na2SO3.7H2O` | heptahydrát siřičitanu sodného | `oxoacid-salt` | yes | `decision-required` | R13 |
| `Na2S2O3` | thiosíran sodný | `oxoacid-salt` | no | `decision-required` | R04 |
| `Na2S2O3.5H2O` | pentahydrát thiosíranu sodného | `oxoacid-salt` | yes | `decision-required` | R04 |
| `Na2SO4` | síran sodný | `oxoacid-salt` | no | `core-candidate` | — |
| `Na2SO4.10H2O` | dekahydrát síranu sodného | `oxoacid-salt` | yes | `core-candidate` | — |
| `Na3N` | nitrid sodný | `binary-salt` | no | `decision-required` | R15 |
| `NaCl` | chlorid sodný | `binary-salt` | no | `core-candidate` | — |
| `NaH2PO4` | dihydrogenfosforečnan sodný | `hydrogensalt` | no | `core-candidate` | — |
| `NaN3` | azid sodný | `extension` | no | `decision-required` | R15 |
| `NaNH2` | amid sodný | `extension` | no | `decision-required` | R15 |
| `NaNO3` | dusičnan sodný | `oxoacid-salt` | no | `core-candidate` | — |
| `NaOH` | hydroxid sodný | `hydroxide` | no | `core-candidate` | — |
| `(NH4)2Fe(SO4)2.6H2O` | hexahydrát síranu amonno-železnatého | `oxoacid-salt` | yes | `decision-required` | R12 |
| `(NH4)2SO4` | síran amonný | `oxoacid-salt` | no | `core-candidate` | — |
| `NH3` | amoniak | `extension` | no | `decision-required` | R08 |
| `NH4Cl` | chlorid amonný | `binary-salt` | no | `core-candidate` | — |
| `NH4NO2` | dusitan amonný | `oxoacid-salt` | no | `core-candidate` | — |
| `NH4NO3` | dusičnan amonný | `oxoacid-salt` | no | `core-candidate` | — |
| `NiCl2.6H2O` | hexahydrát chloridu nikelnatého | `binary-salt` | yes | `core-candidate` | — |
| `NO` | oxid dusnatý | `oxide` | no | `core-candidate` | — |
| `NO2` | oxid dusičitý | `oxide` | no | `core-candidate` | — |
| `P4O10` | oxid fosforečný | `oxide` | no | `decision-required` | R10 |
| `Pb3O4` | tetraoxid olovnato-olovičitý | `oxide` | no | `decision-required` | R05 |
| `PbCO3` | uhličitan olovnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `PbCrO4` | chroman olovnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `PbO2` | oxid olovičitý | `oxide` | no | `core-candidate` | — |
| `PBr3` | bromid fosforitý | `binary-salt` | no | `decision-required` | R16 |
| `PH3` | fosfan | `extension` | no | `decision-required` | R08 |
| `RbNO3` | dusičnan rubidný | `oxoacid-salt` | no | `core-candidate` | — |
| `SF6` | fluorid sírový | `binary-salt` | no | `decision-required` | R16 |
| `SiCl4` | chlorid křemičitý | `binary-salt` | no | `decision-required` | R16 |
| `SiF4` | fluorid křemičitý | `binary-salt` | no | `decision-required` | R16 |
| `SiO2` | oxid křemičitý | `oxide` | no | `core-candidate` | — |
| `SO2` | oxid siřičitý | `oxide` | no | `core-candidate` | — |
| `SO3` | oxid sírový | `oxide` | no | `core-candidate` | — |
| `ZnO` | oxid zinečnatý | `oxide` | no | `core-candidate` | — |
| `ZnSO4` | síran zinečnatý | `oxoacid-salt` | no | `core-candidate` | — |
| `ZnSO4.7H2O` | heptahydrát síranu zinečnatého | `oxoacid-salt` | yes | `core-candidate` | — |

## Completion evidence to fill during implementation

Track each source key through its permanent ID, authored correction, reviewer,
review date, adopted sources, enabled directions, rejected alternatives, and release
content version. Close issue IDs only with evidence. Keep deferred entries visible
in coverage reports; never delete them to manufacture a clean release count.
