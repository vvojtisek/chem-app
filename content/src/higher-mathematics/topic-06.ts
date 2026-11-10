import type { MathTopic } from "./types";

export const mathTopic06 = {
  id: "integrace-typu-funkci",
  number: 6,
  title: "Integrace vybraných typů funkcí.",
  shortTitle: "Integrace typů funkcí",
  description:
    "Racionální funkce a parciální zlomky, goniometrické funkce a vybrané iracionální integrandy.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy ze standardních integračních identit."],
  verificationNote: "Výsledky byly ověřeny derivováním a kontrolou definičních oborů.",
  theory: [
    {
      heading: "Racionální funkce",
      paragraphs: [
        "Je-li stupeň čitatele větší nebo roven stupni jmenovatele, nejprve mnohočleny vydělíme. Zbylou ryze racionální funkci rozložíme na součet jednodušších (parciálních) zlomků podle rozkladu jmenovatele:",
      ],
      formulas: [
        "\\frac{1}{x^2-1}=\\frac12\\left(\\frac1{x-1}-\\frac1{x+1}\\right)",
        "\\int\\frac{dx}{(x+m)^2+n^2}=\\frac1n\\arctan\\frac{x+m}{n}+C",
      ],
      items: [
        "Jednoduchý reálný kořen $a$: zlomek $\\frac{A}{x-a}$, integrál $A\\ln|x-a|$.",
        "Násobný kořen $(x-a)^k$: zlomky $\\frac{A_1}{x-a}+\\dots+\\frac{A_k}{(x-a)^k}$.",
        "Nerozložitelný kvadratický činitel $x^2+px+q$: zlomek $\\frac{Bx+C}{x^2+px+q}$. Rozdělíme jej na část $\\frac{(x^2+px+q)'}{x^2+px+q}$ (dá logaritmus) a zbytek, který po doplnění na čtverec dá $\\arctan$.",
      ],
    },
    {
      heading: "Goniometrické funkce",
      paragraphs: [
        "Součiny typu $\\sin ax\\cos bx$ převedeme na součty vzorci pro součet a rozdíl argumentů.",
      ],
      items: [
        "Sudé mocniny snížíme vzorci $\\sin^2x=\\frac{1-\\cos2x}2$, $\\cos^2x=\\frac{1+\\cos2x}2$.",
        "Lichá mocnina $\\sin$ nebo $\\cos$: oddělíme jeden činitel a substituujeme druhou funkci, např. $\\int\\sin^3x\\,dx$ přes $u=\\cos x$.",
        "$\\int\\tan x\\,dx=-\\ln|\\cos x|+C$ (substituce $u=\\cos x$, tvar $-\\frac{u'}{u}$).",
        "Racionální funkce $\\sin x$ a $\\cos x$: univerzální substituce $t=\\tan\\frac x2$, kdy $\\sin x=\\frac{2t}{1+t^2}$, $\\cos x=\\frac{1-t^2}{1+t^2}$, $dx=\\frac{2\\,dt}{1+t^2}$. Vede vždy na racionální funkci, často ale zdlouhavě.",
      ],
    },
    {
      heading: "Vybrané iracionální funkce",
      paragraphs: [
        "Po každé substituci nezapomeňte vrátit původní proměnnou a výsledek ověřit derivováním.",
      ],
      items: [
        "$\\int\\frac{dx}{\\sqrt{a^2-x^2}}=\\arcsin\\frac xa+C$ pro $|x|<a$.",
        "$\\sqrt{a^2-x^2}$: substituce $x=a\\sin t$; $\\sqrt{x^2+a^2}$: substituce $x=a\\sinh t$ nebo Eulerova substituce.",
        "$\\sqrt[n]{ax+b}$: substituce $t=\\sqrt[n]{ax+b}$ převede integrand na racionální funkci.",
      ],
    },
  ],
  solverTypes: ["integral"],
  exercises: [
    {
      id: "math.integrals.arctan",
      solver: { problemType: "integral", values: { expression: "1/(1+x^2)", variable: "x" } },
      prompt: "Vypočtěte $\\int\\frac1{1+x^2}\\,dx$.",
      answer: "arctan x+C",
      answerLabel: "$\\arctan x+C$",
      hints: ["Vzpomeňte si na derivaci arkustangens."],
      solutionSteps: [
        "Platí $(\\arctan x)'=1/(1+x^2)$.",
        "Integrand je přesně tato derivace.",
        "Výsledek je $\\arctan x+C$.",
      ],
    },
    {
      id: "math.integrals.arcsin",
      solver: { problemType: "integral", values: { expression: "1/sqrt(1-x^2)", variable: "x" } },
      prompt: "Vypočtěte $\\int\\frac1{\\sqrt{1-x^2}}\\,dx$ na $(-1,1)$.",
      answer: "arcsin x+C",
      answerLabel: "$\\arcsin x+C$",
      hints: ["Využijte derivaci arkussinus."],
      solutionSteps: [
        "Na $(-1,1)$ je $(\\arcsin x)'=1/\\sqrt{1-x^2}$.",
        "Integrand souhlasí s derivací.",
        "Primitivní funkce je $\\arcsin x+C$.",
      ],
    },
    {
      id: "math.integrals.partial-fractions-square",
      solver: { problemType: "integral", values: { expression: "1/(x^2-1)", variable: "x" } },
      prompt: "Vypočtěte $\\int\\frac1{x^2-1}\\,dx$ pro $|x|>1$.",
      answer: "1/2 ln|(x-1)/(x+1)|+C",
      answerLabel: "$\\frac12\\ln\\left|\\frac{x-1}{x+1}\\right|+C$",
      hints: ["Rozložte $x^2-1=(x-1)(x+1)$."],
      solutionSteps: [
        "Parciální zlomky dávají $1/(x^2-1)=\\frac12/(x-1)-\\frac12/(x+1)$.",
        "Integrujeme člen po členu: $\\frac12\\ln|x-1|-\\frac12\\ln|x+1|+C$.",
        "Sloučením logaritmů dostaneme $\\frac12\\ln|(x-1)/(x+1)|+C$.",
      ],
    },
    {
      id: "math.integrals.partial-fractions-linear",
      solver: { problemType: "integral", values: { expression: "1/(x(x+1))", variable: "x" } },
      prompt: "Vypočtěte $\\int\\frac1{x(x+1)}\\,dx$ pro $x>0$.",
      answer: "ln(x/(x+1))+C",
      answerLabel: "$\\ln\\frac{x}{x+1}+C$",
      hints: ["Zapište integrand jako $1/x-1/(x+1)$."],
      solutionSteps: [
        "$1/[x(x+1)]=1/x-1/(x+1)$.",
        "Po integraci dostaneme $\\ln x-\\ln(x+1)+C$ pro $x>0$.",
        "Logaritmy sloučíme na $\\ln[x/(x+1)]+C$.",
      ],
    },
    {
      id: "math.integrals.sin-squared",
      solver: { problemType: "integral", values: { expression: "sin(x)^2", variable: "x" } },
      prompt: "Vypočtěte $\\int\\sin^2x\\,dx$.",
      answer: "x/2-sin(2x)/4+C",
      answerLabel: "$\\frac x2-\\frac{\\sin(2x)}4+C$",
      hints: ["Použijte $\\sin^2x=(1-\\cos2x)/2$."],
      solutionSteps: [
        "Identita převede integrál na $\\frac12\\int(1-\\cos2x)\\,dx$.",
        "Integrál kosinu je $\\int\\cos2x\\,dx=\\sin2x/2$.",
        "Výsledek je $x/2-\\sin(2x)/4+C$.",
      ],
    },
    {
      id: "math.integrals.cos-squared",
      solver: { problemType: "integral", values: { expression: "cos(x)^2", variable: "x" } },
      prompt: "Vypočtěte $\\int\\cos^2x\\,dx$.",
      answer: "x/2+sin(2x)/4+C",
      answerLabel: "$\\frac x2+\\frac{\\sin(2x)}4+C$",
      hints: ["Použijte $\\cos^2x=(1+\\cos2x)/2$."],
      solutionSteps: [
        "Identita dá $\\frac12\\int(1+\\cos2x)\\,dx$.",
        "Platí $\\int\\cos2x\\,dx=\\sin2x/2$.",
        "Tedy integrál je $x/2+\\sin(2x)/4+C$.",
      ],
    },
    {
      id: "math.integrals.tangent",
      solver: { problemType: "integral", values: { expression: "tan(x)", variable: "x" } },
      prompt: "Vypočtěte $\\int\\tan x\\,dx$ na intervalu, kde $\\cos x\\ne0$.",
      answer: "-ln|cos x|+C",
      answerLabel: "$-\\ln|\\cos x|+C$",
      hints: ["Přepište tangens jako $\\sin x/\\cos x$."],
      solutionSteps: [
        "Položme $u=\\cos x$, pak $du=-\\sin x\\,dx$.",
        "$\\int\\sin x/\\cos x\\,dx=-\\int du/u$.",
        "Dostáváme $-\\ln|\\cos x|+C$.",
      ],
    },
    {
      id: "math.integrals.sec-squared",
      prompt: "Vypočtěte $\\int\\frac1{\\cos^2x}\\,dx$.",
      answer: "tan x+C",
      answerLabel: "$\\tan x+C$",
      hints: ["Znáte derivaci tangens?"],
      solutionSteps: [
        "Na intervalech bez nul kosinu platí $(\\tan x)'=1/\\cos^2x$.",
        "Integrand je derivací tangens.",
        "Výsledek je $\\tan x+C$.",
      ],
    },
    {
      id: "math.integrals.shifted-quadratic",
      solver: {
        problemType: "integral",
        values: { expression: "(x+1)/(x^2+2x+2)", variable: "x" },
      },
      prompt: "Vypočtěte $\\int\\frac{x+1}{x^2+2x+2}\\,dx$.",
      answer: "1/2 ln(x^2+2x+2)+C",
      answerLabel: "$\\frac12\\ln(x^2+2x+2)+C$",
      hints: ["Derivace jmenovatele je $2x+2$."],
      solutionSteps: [
        "Položme $u=x^2+2x+2=(x+1)^2+1>0$.",
        "Pak $du=2(x+1)\\,dx$, tedy integrál je $\\frac12\\int du/u$.",
        "Výsledek je $\\frac12\\ln(x^2+2x+2)+C$.",
      ],
    },
    {
      id: "math.integrals.scaled-arctan",
      solver: { problemType: "integral", values: { expression: "1/(x^2+4)", variable: "x" } },
      prompt: "Vypočtěte $\\int\\frac1{x^2+4}\\,dx$.",
      answer: "1/2 arctan(x/2)+C",
      answerLabel: "$\\frac12\\arctan(x/2)+C$",
      hints: ["Vytkněte $4$ a položte $u=x/2$."],
      solutionSteps: [
        "$x^2+4=4[1+(x/2)^2]$.",
        "Pro $u=x/2$ je $dx=2\\,du$, tedy integrál je $\\frac12\\int du/(1+u^2)$.",
        "Výsledek je $\\frac12\\arctan(x/2)+C$.",
      ],
    },
  ],
} as const satisfies MathTopic;
