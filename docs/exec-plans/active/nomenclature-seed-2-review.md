# Nomenclature seed 2 — release ledger

Prepared: 2026-09-23. Input: [archived second seed](nomenclature-seed-2.json)
(472 entries, SHA-256 `59319e3665f1366542581af1f0fc3d5aa97e6fe932766a656b4f5e82d0b4a6a1`).
Per-entry decisions: [decisions file](nomenclature-seed-2-decisions.json).
Importer: `pnpm --dir content import:nomenclature-2` (dry run; `--write` imports).

## Release basis

The content owner supplied the seed as verified from VŠCHT Praha materials and on
2026-09-23 authorized its release, stating that the source is VŠCHT and that the
owner did not review it personally. Released records are therefore `owner-approved`
with `ownerApprovedBy` = "Content owner (VŠCHT-sourced seed; release authorized
2026-09-23; not an SME review)". They cite the archived seed and the VŠCHT
nomenclature page (theory, or coordination compounds for the `coordination`
category). **No record from this seed is SME-reviewed**, and nothing here records a
review that did not happen.

The owner also decided, on 2026-09-23:

1. definite errors are corrected as the seed's own explanation (`napoveda`) indicates;
2. entries whose notation collides with another entry are released with restrictions:
   structural or duplicate notations are asked only from formula to name, name
   variants stated in the explanation become approved aliases, and organic compounds
   go to the „Další“ (`other`) category.

## Counts

| Outcome | Entries |
| --- | ---: |
| Key already in the authoring data (left unchanged) | 86 |
| — of these published before this seed | 60 |
| — of these still drafts with open issues | 26 |
| Imported and released (`owner-approved`) | 383 |
| Imported and held (`in-review`, R17) | 1 |
| Omitted | 2 |
| Total | 472 |

The authoring data now holds 510 records; 469 are published (86 earlier, 383 new).

The seed's 86 existing keys were not re-imported. The 26 drafts keep their issues from
the [first seed ledger](nomenclature-seed-review.md): CH4 (R08), FeCr2O4 (R05), FeS2
(R06), H[AuCl4] (R01), H3BO3 (R11), HBr (R07), H2C2O4 (R02, R03), HCl (R07), HF (R07),
HNO3 (R11), H2O2 (R09), H2O (R08), H3PO4 (R11), H2S (R07, R08), KCN (R15), K2C2O4
(R03), NH3 (R08), Na2B4O7 (R14), Na3N (R15), NaNH2 (R15), PBr3 (R16), PH3 (R08),
P4O10 (R10), SF6 (R16), SiCl4 (R16), SiF4 (R16). Seed 2 names three of them
differently (FeCr2O4 „oxid železnato-dichromitý“, Na2B4O7 „tetraboritan disodný“,
P4O10 „oxid tetrafosforečný“); these names were not applied and belong to R05, R14 and
R10.

## Categories and element counts

The requested categories map to the schema as follows: prvek_ion → `element-ion`,
oxid → `oxide`, hydrid → `hydride`, kyselina_bezkyslikata → `binary-acid`,
kyselina_kyslikata → `oxoacid`, sul_bezkyslikata → `binary-salt`, sul_kyslikata →
`oxoacid-salt`, hydroxid → `hydroxide`, komplex → `coordination`; organic and trivial
entries use `other` („Další“). Covalent binary halides, oxide halides and similar
compounds named like salts (for example SCl2, NF3, XeOF4) are `binary-salt`, the
category of halides in the curriculum.

| Category | Imported |
| --- | ---: |
| `element-ion` | 103 |
| `binary-salt` | 105 |
| `oxoacid-salt` | 57 |
| `coordination` | 41 |
| `oxide` | 34 |
| `oxoacid` | 17 |
| `hydride` | 10 |
| `hydroxide` | 7 |
| `other` | 7 |
| `binary-acid` | 3 |

The element count is not stored: the snapshot derives it from the formula as the
number of distinct element symbols, including brackets, parentheses and hydrate water
(CuSO4·5H2O → 4). The anion family used for quick selections is derived from salt
names (the first word, or the word after a hydrate prefix, without a hydrogen prefix).

## Corrections

Ion keys such as `SO42-` or `[AlF6]3-` store the formula without the charge and the
charge in the `charge` field. Other corrections, each following the seed's explanation:

| Key | Seed | Released |
| --- | --- | --- |
| PI3 | jodid fofsoritý | jodid fosforitý |
| BeF2 | fluorid berylnatý | fluorid beryllnatý |
| [Cr(OH)4]- | anion tetrahydroxochromitý | anion tetrahydroxochromitanový |
| N2O | azoxid | oxid dusný |
| ClF3O2 | trifluorid-oxid chloristý | trifluorid-dioxid chloristý |
| XeO2F2 | oxid - difluorid xenonový | dioxid-difluorid xenonový |
| [XeOF3]+ | kation trifluoroxenonový | kation oxo-trifluoroxenonový |
| Na[Zn(CN)4] | formula Na[Zn(CN)4] | formula Na2[Zn(CN)4] |
| CaSO4H2O, SnO2H2O | formula without a hydrate dot | CaSO4·H2O, SnO2·H2O (tagged `hydrate`) |
| PBr3S, CaCl(ClO), XeOF4 | spaced dash („tribromid - sulfid“) | unspaced hyphen, as in the explanation |
| [Ni(CO)4] | tetrakarbonyl nikl | tetrakarbonylnikl |
| Ba, Li, Li2O | barium, litium, oxid litný | baryum, lithium, oxid lithný (element data spelling; seed spelling kept as alias) |

Omitted: `NaNCN` (sodium formula with a calcium name; Na⁺ cannot balance NCN²⁻) and
`P(OR)3` (R is a placeholder, not a compound; the name is garbled).

## Question directions

125 imported records are asked only from formula to name:

- every ion and charged species, and every formula with square brackets;
- structural or duplicate notations of another entry: As4O6, P4, NH2NH2, H2[SiF6],
  [SiF6]2-, S2O6S2 2-, Na[BH4], B(OH)3, Na2SO3S, FeFe2O4, CoCo2O4, Mn2MnO4, Pb2PbO4,
  H2S2O6(O2), (NH4)2S2O6(O2), HCO2H, [(Na2O)(CaO)(SiO2)6], CaCl(ClO), N2H6SO4;
- the „Další“ group;
- mixed-anion compounds IOF5, SF4O, XeO2F2, PBr3S, XeOF4, ClF3O2: the seed orders
  their formulas inconsistently (IOF5 and XeOF4 put O first; SF4O and ClF3O2 put F
  first), and the literature commonly writes SOF4, ClO2F3 and PSBr3, so a typed
  formula would reject equivalent orders.

H3PO3 („kyselina trihydrogenfosforitá“) is asked only from name to formula: its
hydrogen prefix falls under the unresolved R11 convention, and typing the common
„kyselina fosforitá“ would otherwise count as wrong.

No formula aliases were added. P4, As4O6 and NH2NH2 are separate formula-to-name
entries, and a formula may belong to only one published record, so „fosfor“,
„oxid arsenitý“ and „hydrazin“ accept only P, As2O3 and N2H4 as typed formulas.

## Approved name aliases

Name variants stated in the explanations, accepted as aliases under the owner's
decision: AsH3 arsin; B(OCH3)3 trimethylester kyseliny borité; B(OH)3 kyselina
trihydrogenboritá; Ba barium; C2H2 acetylen; CH3OH methanol; CO(NH2)2 karbamid; ClO2F
fluorid chlorylu; H atomární vodík; HBO2 kyselina metaboritá; H5IO6 kyselina
orthojodistá; H6TeO6 kyselina orthotellurová; KO2 hyperoxid draselný; Li litium; Li2O
oxid litný; N2O4 tetraoxid didusíku; NaBH4 tetrahydridoboritan sodný; Na[BH4]
tetrahydroboritan sodný; O atomární kyslík; SCl2 chlorid sirnatý; SF2 fluorid sirnatý.

## Held record

| ID | Record | Required decision |
| --- | --- | --- |
| R17 | CuFeS2 „bis(sulfid) měďnato-železnatý“ | The explanation assigns Cu(+II) and Fe(+II). Structural and spectroscopic studies usually describe chalcopyrite as Cu(I)Fe(III)S2, although the formal assignment is debated because of covalent Fe–S bonding. Decide the taught assignment and name (including „bis(sulfid)“ versus „disulfid“) before release. |

## Open questions for SME review

These records are released under the owner's decision; the questions do not
withdraw them, but an SME review should settle them.

1. Anion order in mixed-anion names: IUPAC 2005 orders anions alphabetically
   („tetrafluorid-oxid xenonový“), while the seed uses „oxid-tetrafluorid xenonový“
   and, after correction, „dioxid-difluorid xenonový“. Only the seed's order is accepted.
2. Hydrogen prefixes in acid names (R11 class): H3PO3 uses „trihydrogen“, H3AsO4 and
   H2SO4 do not. Formula-to-name answers accept only the stored form.
3. Molecular versus aqueous names (R07 class): HI „jodovodík“, HCN „kyanovodík“ and
   H2Se „selan“ are released while HCl, HBr, HF and H2S remain drafts under R07.
4. Compounds without a well-characterized isolated form, used as formal exercises:
   IBr5, ICl5, and Mg3B2 (the historical formula of the Stock borane preparation;
   the characterized magnesium borides include MgB2, MgB4 and MgB7).
5. NH4OH „hydroxid amonný“ is a formal notation for aqueous ammonia; the explanation
   says so.
6. Stoichiometric prefixes on cations („cíničitan disodný“, „difosforičitan
   divápenatý“, „tetraboritan didraselný“): the prefix-free forms are not accepted.
7. Inconsistent ligand prefixes: Na[Ag(CN)2] „bis(kyano)stříbrnan sodný“ versus
   K[Ag(CN)2] „dikyanostříbrnan draselný“.
8. B(OCH3)3 „boritan methylnatý“ (alias „trimethylester kyseliny borité“).
9. Explanations throughout write formal oxidation states as ions in molecular
   compounds („Fosfor P(+V) váže 3 × Br(-I)“); the R16 wording audit applies here too.
10. Mixed oxides FeFe2O4, CoCo2O4, Mn2MnO4 and Pb2PbO4 are released (formula to name
    only) while FeCr2O4 remains a draft under R05.
11. „nativní vodík“ and „nativní kyslík“ for atomic H and O (aliases „atomární vodík“,
    „atomární kyslík“).
