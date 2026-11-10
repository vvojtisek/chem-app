import type { MathTopic } from "./types";

export const mathTopic01 = {
  id: "limity-spojitost",
  number: 1,
  title:
    "Limita funkce a základní techniky jejího výpočtu. Spojitost funkce. Vlastnosti spojitých funkcí.",
  shortTitle: "Limita a spojitost",
  description:
    "Definice limity, jednostranné limity, úpravy neurčitých výrazů, spojitost a věty o spojitých funkcích.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: [
    "Samostatně odvozené úlohy z definice limity a standardních vět diferenciálního počtu.",
  ],
  verificationNote: "Každý výsledek byl nezávisle dosazen nebo odvozen algebraickou úpravou.",
  theory: [
    {
      heading: "Co je limita",
      paragraphs: [
        "Číslo $L$ je limitou funkce $f$ v bodě $a$, jestliže se hodnoty $f(x)$ blíží k $L$, když se $x$ blíží k $a$ (přitom $x\\ne a$). Hodnota $f(a)$ samotná limitu neovlivňuje a funkce v bodě $a$ ani nemusí být definovaná.",
        "Jednostranné limity sledují jen $x>a$ (zprava, $x\\to a^+$) nebo $x<a$ (zleva, $x\\to a^-$). Oboustranná limita existuje právě tehdy, když existují obě jednostranné a jsou si rovny. Pokud se liší, oboustranná limita neexistuje.",
        "Limita může být i nevlastní ($\\pm\\infty$) a lze ji počítat i v nekonečnu ($x\\to\\pm\\infty$).",
      ],
      formulas: [
        "\\lim_{x\\to a} f(x)=L \\iff \\forall\\varepsilon>0\\ \\exists\\delta>0:\\ 0<|x-a|<\\delta \\Rightarrow |f(x)-L|<\\varepsilon",
      ],
    },
    {
      heading: "Postup výpočtu",
      paragraphs: [
        "Vždy začněte dosazením. Je-li funkce v bodě spojitá, limitu získáme dosazením. Vyjde-li neurčitý výraz ($\\frac00$, $\\frac{\\infty}{\\infty}$, $0\\cdot\\infty$, $\\infty-\\infty$, $1^\\infty$, $0^0$, $\\infty^0$), výraz upravíme:",
      ],
      items: [
        "Krácení: čitatel a jmenovatel mají společný činitel, např. $\\frac{x^2-1}{x-1}=x+1$ pro $x\\ne1$.",
        "Rozšíření sdruženým výrazem u odmocnin: $(\\sqrt{A}-B)(\\sqrt{A}+B)=A-B^2$.",
        "Racionální funkce v nekonečnu: vydělíme nejvyšší mocninou jmenovatele.",
        "Základní limity (viz vzorce níže), po substituci $u=g(x)\\to0$.",
        "Nenulové číslo děleno nulou: čitatel se blíží $c\\ne0$ a jmenovatel $0$; znaménko výsledku určíme z chování jmenovatele u bodu (jednostranné limity).",
        "Typy $1^\\infty$, $0^0$, $\\infty^0$: přepis $f^g=e^{g\\ln f}$; exponenciála je spojitá, proto stačí spočítat limitu exponentu.",
        "Typ $0\\cdot\\infty$ zapíšeme jako podíl, typ $\\frac00$ nebo $\\frac\\infty\\infty$ lze řešit L’Hospitalovým pravidlem (okruh 2).",
      ],
    },
    {
      heading: "Základní limity",
      paragraphs: [
        "Tyto limity se používají jako stavební kameny; ostatní na ně převádíme substitucí.",
      ],
      formulas: [
        "\\lim_{x\\to0}\\frac{\\sin x}{x}=1,\\qquad \\lim_{x\\to0}\\frac{1-\\cos x}{x^2}=\\frac12",
        "\\lim_{x\\to0}\\frac{e^x-1}{x}=1,\\qquad \\lim_{x\\to0}\\frac{\\ln(1+x)}{x}=1,\\qquad \\lim_{x\\to\\infty}\\left(1+\\frac{a}{x}\\right)^x=e^a",
      ],
    },
    {
      heading: "Spojitost funkce",
      paragraphs: [
        "Funkce $f$ je spojitá v bodě $a$, je-li v něm definovaná a platí $\\lim_{x\\to a}f(x)=f(a)$. Spojitost zprava a zleva se definuje pomocí jednostranných limit. Funkce je spojitá na intervalu, je-li spojitá v každém jeho bodě (v krajních bodech jednostranně).",
        "Mnohočleny, $e^x$, $\\sin x$, $\\cos x$ jsou spojité na $\\mathbb R$; racionální funkce, $\\ln x$, $\\sqrt x$, $\\tan x$ jsou spojité na svém definičním oboru. Součet, součin, podíl (se jmenovatelem $\\ne0$) a složení spojitých funkcí jsou spojité.",
        "Body nespojitosti: odstranitelná (limita existuje, ale $\\ne f(a)$ nebo $f(a)$ není definováno), skok (jednostranné limity jsou různé), nespojitost 2. druhu (některá jednostranná limita neexistuje nebo je nevlastní).",
      ],
    },
    {
      heading: "Vlastnosti spojitých funkcí na uzavřeném intervalu",
      paragraphs: ["Nechť je $f$ spojitá na $[a,b]$. Pak platí:"],
      items: [
        "Weierstrassova věta: $f$ je na $[a,b]$ omezená a nabývá na něm své největší i nejmenší hodnoty.",
        "Bolzanova věta: je-li $f(a)\\cdot f(b)<0$, existuje $c\\in(a,b)$ s $f(c)=0$. Používá se k důkazu existence kořene a k metodě půlení intervalu.",
        "Darbouxova vlastnost: $f$ nabývá všech hodnot mezi $f(a)$ a $f(b)$.",
        "Je-li $f$ navíc ryze monotónní, je prostá a inverzní funkce $f^{-1}$ je také spojitá.",
      ],
    },
  ],
  solverTypes: ["limit"],
  exercises: [
    {
      id: "math.limits.factor",
      solver: {
        problemType: "limit",
        values: { expression: "(x^2-1)/(x-1)", variable: "x", point: "1", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to1}\\frac{x^2-1}{x-1}$.",
      answer: "2",
      hints: ["Rozložte rozdíl čtverců."],
      solutionSteps: [
        "Pro $x\\ne1$ platí $x^2-1=(x-1)(x+1)$.",
        "Zkrátíme výraz na $x+1$.",
        "Při $x\\to1$ dostáváme $1+1=2$.",
      ],
    },
    {
      id: "math.limits.sin",
      solver: {
        problemType: "limit",
        values: { expression: "sin(3x)/x", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to0}\\frac{\\sin(3x)}{x}$.",
      answer: "3",
      hints: ["Převeďte výraz na základní limitu $\\sin u/u$."],
      solutionSteps: [
        "Položíme $u=3x$, takže $u\\to0$.",
        "Píšeme $\\frac{\\sin(3x)}{x}=3\\frac{\\sin u}{u}$.",
        "Základní limita je $1$, proto výsledek je $3$.",
      ],
    },
    {
      id: "math.limits.root",
      solver: {
        problemType: "limit",
        values: { expression: "(sqrt(x+4)-2)/x", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to0}\\frac{\\sqrt{x+4}-2}{x}$.",
      answer: "1/4",
      answerLabel: "$\\frac14$",
      hints: ["Vynásobte čitatele a jmenovatele sdruženým výrazem."],
      solutionSteps: [
        "Násobíme $\\sqrt{x+4}+2$.",
        "Dostaneme $\\frac{x}{x(\\sqrt{x+4}+2)}=\\frac1{\\sqrt{x+4}+2}$ pro $x\\ne0$.",
        "Dosazením $x=0$ vyjde $1/(2+2)=1/4$.",
      ],
    },
    {
      id: "math.limits.cos",
      solver: {
        problemType: "limit",
        values: { expression: "(1-cos(x))/x^2", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to0}\\frac{1-\\cos x}{x^2}$.",
      answer: "1/2",
      answerLabel: "$\\frac12$",
      hints: ["Použijte $1-\\cos x=2\\sin^2(x/2)$."],
      solutionSteps: [
        "Přepíšeme výraz na $\\frac{2\\sin^2(x/2)}{x^2}=\\frac12\\left(\\frac{\\sin(x/2)}{x/2}\\right)^2$.",
        "Podíl v závorce konverguje k $1$.",
        "Limita je $1/2$.",
      ],
    },
    {
      id: "math.limits.rational-infinity",
      solver: {
        problemType: "limit",
        values: { expression: "(2x^2+1)/(x^2-3)", variable: "x", point: "oo", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to\\infty}\\frac{2x^2+1}{x^2-3}$.",
      answer: "2",
      hints: ["Vydělte čitatele i jmenovatele $x^2$."],
      solutionSteps: [
        "Po dělení získáme $\\frac{2+1/x^2}{1-3/x^2}$.",
        "Pro $x\\to\\infty$ oba členy s $1/x^2$ mizí.",
        "Limita je $2/1=2$.",
      ],
    },
    {
      id: "math.limits.exponential",
      solver: {
        problemType: "limit",
        values: { expression: "(1+2/x)^x", variable: "x", point: "oo", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to\\infty}(1+2/x)^x$.",
      answer: "e^2",
      answerLabel: "$e^2$",
      hints: ["Vezměte logaritmus výrazu."],
      solutionSteps: [
        "Pro $y=(1+2/x)^x$ je $\\ln y=x\\ln(1+2/x)$.",
        "S $u=2/x$ platí $x\\ln(1+2/x)=2\\ln(1+u)/u\\to2$.",
        "Spojitostí exponenciály dostáváme $y\\to e^2$.",
      ],
    },
    {
      id: "math.limits.one-sided",
      solver: {
        problemType: "limit",
        values: { expression: "abs(x)/x", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Existuje $\\lim_{x\\to0}\\frac{|x|}{x}$? Odpovězte ano nebo ne.",
      answer: "ne",
      acceptedAnswers: ["Ne"],
      hints: ["Porovnejte limitu zprava a zleva."],
      solutionSteps: [
        "Pro $x>0$ je $|x|/x=1$, tedy pravá limita je $1$.",
        "Pro $x<0$ je $|x|/x=-1$, tedy levá limita je $-1$.",
        "Jednostranné limity se liší, oboustranná limita neexistuje.",
      ],
    },
    {
      id: "math.limits.removable",
      prompt:
        "Jakou hodnotu přiřadíte $f(1)$, aby $f(x)=\\frac{x^2-1}{x-1}$ pro $x\\ne1$ byla spojitá v $1$?",
      answer: "2",
      hints: ["Spojitost vyžaduje $f(1)=\\lim_{x\\to1}f(x)$."],
      solutionSteps: [
        "Pro $x\\ne1$ zkrátíme $f(x)$ na $x+1$.",
        "Limita v bodě $1$ je $2$.",
        "Definujeme tedy $f(1)=2$.",
      ],
    },
    {
      id: "math.limits.ivt",
      prompt: "Má $f(x)=x^3+x-1$ kořen v intervalu $(0,1)$? Odpovězte ano nebo ne.",
      answer: "ano",
      acceptedAnswers: ["Ano"],
      hints: ["Použijte větu o mezihodnotě."],
      solutionSteps: [
        "Polynom je spojitý na $[0,1]$.",
        "Platí $f(0)=-1<0$ a $f(1)=1>0$.",
        "Věta o mezihodnotě zaručuje kořen v $(0,1)$.",
      ],
    },
    {
      id: "math.limits.pole",
      prompt: "Je $f(x)=\\frac1{x-2}$ spojitá v bodě $x=2$? Odpovězte ano nebo ne.",
      answer: "ne",
      acceptedAnswers: ["Ne"],
      hints: ["Zkontrolujte definiční obor funkce."],
      solutionSteps: [
        "Pro $x=2$ je jmenovatel nulový, takže $f(2)$ není definována.",
        "Spojitost v bodě vyžaduje, aby tam funkce měla hodnotu.",
        "Funkce tedy v $x=2$ není spojitá.",
      ],
    },
  ],
} as const satisfies MathTopic;
