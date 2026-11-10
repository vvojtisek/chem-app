import type { MathTopic } from "./types";

export const mathTopic03 = {
  id: "prubeh-funkce",
  number: 3,
  title:
    "Vyšetřování monotonie a lokálních extrémů funkce na základě první derivace. Derivace vyšších řádů. Konvexní a konkávní funkce. Inflexní body. Vyšetřování průběhu funkce.",
  shortTitle: "Průběh funkce",
  description:
    "Monotonie a lokální extrémy z první derivace, vyšší derivace, konvexita, konkávnost, inflexní body a celkový průběh funkce.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy z testu první a druhé derivace."],
  verificationNote: "Znaménkové intervaly a hodnoty extrémů byly zkontrolovány dosazením.",
  theory: [
    {
      heading: "Monotonie z první derivace",
      paragraphs: [
        "Nechť je $f$ spojitá na intervalu $I$ a má derivaci v jeho vnitřních bodech. Je-li $f'(x)>0$ na vnitřku $I$, je $f$ na $I$ rostoucí; je-li $f'(x)<0$, je klesající. Postup: najdeme body, kde $f'(x)=0$ nebo $f'$ neexistuje, rozdělíme jimi definiční obor a na každém intervalu určíme znaménko $f'$.",
      ],
    },
    {
      heading: "Lokální extrémy",
      paragraphs: [
        "Nutná podmínka (Fermatova věta): má-li $f$ v bodě $x_0$ lokální extrém a existuje-li $f'(x_0)$, pak $f'(x_0)=0$. Body s $f'(x_0)=0$ jsou stacionární. Extrém může nastat i v bodě, kde derivace neexistuje ($|x|$ v $0$).",
        "Postačující podmínka z první derivace: mění-li $f'$ v $x_0$ znaménko z $+$ na $-$, je v $x_0$ lokální maximum; z $-$ na $+$ lokální minimum; nemění-li znaménko, extrém tam není (např. $x^3$ v $0$).",
        "Test druhou derivací: je-li $f'(x_0)=0$ a $f''(x_0)>0$, je v $x_0$ ostré lokální minimum; při $f''(x_0)<0$ ostré lokální maximum; při $f''(x_0)=0$ test nerozhoduje.",
        "Globální extrémy spojité funkce na $[a,b]$ hledáme mezi stacionárními body, body bez derivace a krajními body $a$, $b$ (Weierstrassova věta, okruh 1).",
      ],
    },
    {
      heading: "Derivace vyšších řádů",
      paragraphs: [
        "Druhá derivace je derivace první derivace, $f''=(f')'$, obecně $f^{(n)}=(f^{(n-1)})'$. Pro mnohočlen stupně $n$ je $f^{(n+1)}=0$.",
      ],
      formulas: [
        "(x^k)^{(n)}=\\frac{k!}{(k-n)!}x^{k-n}\\ (n\\le k),\\qquad (e^{ax})^{(n)}=a^ne^{ax},\\qquad (\\sin x)^{(n)}=\\sin\\!\\left(x+\\frac{n\\pi}{2}\\right)",
      ],
    },
    {
      heading: "Konvexita, konkávnost a inflexní body",
      paragraphs: [
        "Funkce je na intervalu konvexní, leží-li graf nad každou svou tečnou (sečna leží nad grafem); konkávní, leží-li pod tečnami. Má-li $f$ druhou derivaci: $f''>0$ znamená ryze konvexní, $f''<0$ ryze konkávní.",
        "Inflexní bod je bod, kde se konvexita mění v konkávnost nebo naopak a graf v něm má tečnu. Nutnou podmínkou (pokud $f''(x_0)$ existuje) je $f''(x_0)=0$; postačuje, aby $f''$ v $x_0$ změnila znaménko. Pozor: $f''(x_0)=0$ nestačí, $x^4$ v $0$ inflexi nemá.",
      ],
    },
    {
      heading: "Postup vyšetřování průběhu funkce",
      paragraphs: [
        "Každý bod postupu kontrolujte proti předchozím: například lichá funkce má extrémy symetricky a funkce rostoucí na celém $\\mathbb R$ nemá lokální extrém.",
      ],
      items: [
        "Definiční obor, sudost/lichost, periodicita, průsečíky s osami.",
        "Spojitost a limity v krajních bodech definičního oboru (okruh 1).",
        "Asymptoty svislé i se směrnicí (okruh 2).",
        "První derivace: stacionární body, intervaly monotonie, lokální extrémy a jejich hodnoty.",
        "Druhá derivace: intervaly konvexity a konkávnosti, inflexní body.",
        "Tabulka znamének a náčrt grafu; obor hodnot odečteme z grafu.",
      ],
    },
  ],
  solverTypes: ["derivative", "limit"],
  exercises: [
    {
      id: "math.analysis.minimum",
      solver: {
        problemType: "derivative",
        values: { expression: "x^2-4x", variable: "x", order: "1", point: "2" },
      },
      prompt: "Určete $x$ lokálního minima funkce $f(x)=x^2-4x$.",
      answer: "2",
      hints: ["Najděte nulový bod první derivace."],
      solutionSteps: [
        "$f'(x)=2x-4$ a $f'(x)=0$ právě pro $x=2$.",
        "Derivace se mění ze záporné na kladnou.",
        "V $x=2$ je lokální minimum.",
      ],
    },
    {
      id: "math.analysis.maximum",
      solver: {
        problemType: "derivative",
        values: { expression: "-x^2+6x", variable: "x", order: "1", point: "3" },
      },
      prompt: "Určete $x$ lokálního maxima funkce $f(x)=-x^2+6x$.",
      answer: "3",
      hints: ["Parabola je otevřená dolů."],
      solutionSteps: [
        "$f'(x)=-2x+6$ má nulu $x=3$.",
        "Před $3$ je derivace kladná, za $3$ záporná.",
        "Lokální maximum nastává při $x=3$.",
      ],
    },
    {
      id: "math.analysis.increasing-cubic",
      solver: {
        problemType: "derivative",
        values: { expression: "x^3-3x", variable: "x", order: "1", point: "1" },
      },
      prompt: "Na kterých intervalech roste $f(x)=x^3-3x$? Odpovězte intervaly.",
      answer: "(-inf,-1) U (1,inf)",
      answerLabel: "$(-\\infty,-1)\\cup(1,\\infty)$",
      hints: ["Vyřešte nerovnici $f'(x)>0$."],
      solutionSteps: [
        "$f'(x)=3x^2-3=3(x-1)(x+1)$.",
        "Součin je kladný pro $x<-1$ a $x>1$.",
        "Funkce roste na $(-\\infty,-1)$ a $(1,\\infty)$.",
      ],
    },
    {
      id: "math.analysis.cubic-extrema",
      solver: {
        problemType: "derivative",
        values: { expression: "x^3-3x", variable: "x", order: "1", point: "-1" },
      },
      prompt: "Určete lokální maximum a minimum funkce $f(x)=x^3-3x$ ve tvaru $(x,y)$.",
      answer: "maximum (-1,2), minimum (1,-2)",
      answerLabel: "maximum $(-1,2)$, minimum $(1,-2)$",
      hints: ["Kritické body jsou $x=-1$ a $x=1$."],
      solutionSteps: [
        "$f'(x)=3(x-1)(x+1)$ mění v $-1$ znaménko z $+$ na $-$.",
        "V $1$ se mění z $-$ na $+$.",
        "$f(-1)=2$ a $f(1)=-2$, tedy maximum $(-1,2)$ a minimum $(1,-2)$.",
      ],
    },
    {
      id: "math.analysis.higher-derivative",
      solver: {
        problemType: "derivative",
        values: { expression: "x^5", variable: "x", order: "3", point: "1" },
      },
      prompt: "Určete $f'''(1)$ pro $f(x)=x^5$.",
      answer: "60",
      hints: ["Derivujte třikrát."],
      solutionSteps: ["$f'(x)=5x^4$.", "$f''(x)=20x^3$ a $f'''(x)=60x^2$.", "$f'''(1)=60$."],
    },
    {
      id: "math.analysis.convex",
      solver: {
        problemType: "derivative",
        values: { expression: "x^2", variable: "x", order: "2" },
      },
      prompt: "Je $f(x)=x^2$ konvexní na celé $\\mathbb R$? Odpovězte ano nebo ne.",
      answer: "ano",
      acceptedAnswers: ["Ano"],
      hints: ["Znaménko druhé derivace určuje zakřivení."],
      solutionSteps: [
        "$f'(x)=2x$.",
        "$f''(x)=2>0$ pro každé reálné $x$.",
        "Funkce je na $\\mathbb R$ konvexní.",
      ],
    },
    {
      id: "math.analysis.concave",
      solver: {
        problemType: "derivative",
        values: { expression: "-x^2", variable: "x", order: "2" },
      },
      prompt: "Je $f(x)=-x^2$ konkávní na celé $\\mathbb R$? Odpovězte ano nebo ne.",
      answer: "ano",
      acceptedAnswers: ["Ano"],
      hints: ["Vypočtěte druhou derivaci."],
      solutionSteps: [
        "$f'(x)=-2x$.",
        "$f''(x)=-2<0$ pro každé $x$.",
        "Funkce je na $\\mathbb R$ konkávní.",
      ],
    },
    {
      id: "math.analysis.inflection",
      solver: {
        problemType: "derivative",
        values: { expression: "x^3", variable: "x", order: "2", point: "0" },
      },
      prompt: "Určete inflexní bod grafu $f(x)=x^3$.",
      answer: "(0,0)",
      answerLabel: "$(0,0)$",
      hints: ["Zkontrolujte změnu znaménka druhé derivace."],
      solutionSteps: [
        "$f''(x)=6x$ má nulu v $x=0$.",
        "Druhá derivace je vlevo záporná a vpravo kladná.",
        "$f(0)=0$, proto inflexní bod je $(0,0)$.",
      ],
    },
    {
      id: "math.analysis.stationary-no-extremum",
      solver: {
        problemType: "derivative",
        values: { expression: "x^3", variable: "x", order: "1", point: "0" },
      },
      prompt: "Má $f(x)=x^3$ v $x=0$ lokální extrém? Odpovězte ano nebo ne.",
      answer: "ne",
      acceptedAnswers: ["Ne"],
      hints: ["Samotné $f'(0)=0$ nestačí."],
      solutionSteps: [
        "$f'(x)=3x^2$ a $f'(0)=0$.",
        "Derivace je na obou stranách bodu $0$ nezáporná a funkce roste.",
        "V $x=0$ je stacionární inflexe, nikoli extrém.",
      ],
    },
    {
      id: "math.analysis.quadratic-curve",
      solver: {
        problemType: "derivative",
        values: { expression: "x^2-4x+3", variable: "x", order: "1", point: "2" },
      },
      prompt: "Určete souřadnice vrcholu $f(x)=x^2-4x+3$.",
      answer: "(2,-1)",
      answerLabel: "$(2,-1)$",
      hints: ["Doplňte na čtverec nebo použijte derivaci."],
      solutionSteps: [
        "Úpravou dostaneme $f(x)=(x-2)^2-1$.",
        "Čtverec je nejmenší pro $x=2$.",
        "Tehdy $f(2)=-1$, tedy vrchol je $(2,-1)$.",
      ],
    },
  ],
} as const satisfies MathTopic;
