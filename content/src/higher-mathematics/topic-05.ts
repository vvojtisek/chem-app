import type { MathTopic } from "./types";

export const mathTopic05 = {
  id: "primitivni-funkce",
  number: 5,
  title:
    "Primitivní funkce. Neurčitý integrál a jeho výpočet pomocí metody per partes a substituce.",
  shortTitle: "Primitivní funkce",
  description:
    "Primitivní funkce a neurčitý integrál, tabulkové integrály, linearita, metoda per partes a substituce.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy ze standardních integračních pravidel."],
  verificationNote: "Každá primitivní funkce byla zkontrolována derivováním výsledku.",
  theory: [
    {
      heading: "Primitivní funkce a neurčitý integrál",
      paragraphs: [
        "Funkce $F$ je primitivní k $f$ na intervalu $I$, platí-li $F'(x)=f(x)$ pro každé $x\\in I$. Primitivní funkce se liší jen o konstantu, proto píšeme $\\int f(x)\\,dx=F(x)+C$. Každá spojitá funkce na intervalu má primitivní funkci.",
        "Výsledek vždy ověříte derivováním. Vztah platí na intervalu: například $\\int\\frac1x\\,dx=\\ln|x|+C$ zvlášť na $(-\\infty,0)$ a na $(0,\\infty)$. Některé primitivní funkce nejsou elementární (např. k $e^{-x^2}$).",
      ],
      formulas: ["\\int\\bigl(af(x)+bg(x)\\bigr)\\,dx=a\\int f(x)\\,dx+b\\int g(x)\\,dx"],
    },
    {
      heading: "Tabulkové integrály",
      paragraphs: [
        "Integrál součtu je součet integrálů a konstantu lze vytknout. Integrál součinu ani podílu ale obecně není součinem či podílem integrálů; na to slouží metody níže.",
      ],
      items: [
        "$\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C$ pro $n\\ne-1$; $\\int\\frac1x\\,dx=\\ln|x|+C$",
        "$\\int e^x\\,dx=e^x+C$; $\\int a^x\\,dx=\\frac{a^x}{\\ln a}+C$",
        "$\\int\\sin x\\,dx=-\\cos x+C$; $\\int\\cos x\\,dx=\\sin x+C$; $\\int\\frac{dx}{\\cos^2x}=\\tan x+C$",
        "$\\int\\frac{dx}{1+x^2}=\\arctan x+C$; $\\int\\frac{dx}{\\sqrt{1-x^2}}=\\arcsin x+C$",
      ],
    },
    {
      heading: "Substituce",
      paragraphs: [
        "Obsahuje-li integrand složenou funkci $f(g(x))$ spolu s derivací vnitřní funkce $g'(x)$, zvolíme $u=g(x)$, $du=g'(x)\\,dx$. Po integraci podle $u$ dosadíme zpět $u=g(x)$.",
        "Častý speciální případ: $\\int\\frac{g'(x)}{g(x)}\\,dx=\\ln|g(x)|+C$ a $\\int f(ax+b)\\,dx=\\frac1aF(ax+b)+C$.",
      ],
      formulas: ["\\int f(g(x))\\,g'(x)\\,dx=\\int f(u)\\,du\\Big|_{u=g(x)}"],
    },
    {
      heading: "Metoda per partes",
      paragraphs: [
        "Vychází z derivace součinu. Za $u$ volíme část, která se derivováním zjednoduší (mnohočlen, $\\ln x$, $\\arctan x$), za $dv$ část, kterou umíme integrovat ($e^x$, $\\sin x$, $\\cos x$, $x^n$).",
        "U $\\int\\ln x\\,dx$ volíme $u=\\ln x$, $dv=dx$. U integrálů typu $\\int e^x\\sin x\\,dx$ se po dvojím použití per partes původní integrál objeví znovu; rovnici pak vyřešíme pro hledaný integrál.",
      ],
      formulas: [
        "\\int u\\,dv=uv-\\int v\\,du,\\qquad\\text{tj.}\\qquad\\int u v'\\,dx=uv-\\int u'v\\,dx",
      ],
    },
  ],
  solverTypes: ["integral"],
  exercises: [
    {
      id: "math.antiderivative.power",
      prompt: "Vypočtěte $\\int 2x\\,dx$.",
      answer: "x^2+C",
      answerLabel: "$x^2+C$",
      hints: ["Použijte mocninné pravidlo."],
      solutionSteps: [
        "Primitivní funkce k $x$ je $x^2/2$.",
        "Konstantní násobek $2$ dá $x^2$.",
        "Obecný výsledek je $x^2+C$; derivace $x^2$ je $2x$.",
      ],
    },
    {
      id: "math.antiderivative.cos",
      prompt: "Vypočtěte $\\int\\cos x\\,dx$.",
      answer: "sin x+C",
      answerLabel: "$\\sin x+C$",
      hints: ["Která funkce má derivaci $\\cos x$?"],
      solutionSteps: [
        "Platí $(\\sin x)'=\\cos x$.",
        "Všechny primitivní funkce se liší konstantou.",
        "Integrál je $\\sin x+C$.",
      ],
    },
    {
      id: "math.antiderivative.reciprocal",
      prompt: "Vypočtěte $\\int\\frac1x\\,dx$ pro $x\\ne0$.",
      answer: "ln|x|+C",
      answerLabel: "$\\ln|x|+C$",
      hints: ["Na každé souvislé části oboru použijte logaritmus absolutní hodnoty."],
      solutionSteps: [
        "Pro $x\\ne0$ platí $(\\ln|x|)'=1/x$.",
        "Obor tvoří intervaly $(-\\infty,0)$ a $(0,\\infty)$.",
        "Na každém intervalu je výsledkem $\\ln|x|+C$.",
      ],
    },
    {
      id: "math.antiderivative.log-substitution",
      prompt: "Vypočtěte $\\int\\frac{2x}{x^2+1}\\,dx$.",
      answer: "ln(x^2+1)+C",
      answerLabel: "$\\ln(x^2+1)+C$",
      hints: ["Zvolte $u=x^2+1$."],
      solutionSteps: [
        "Položíme $u=x^2+1$, pak $du=2x\\,dx$.",
        "Integrál přejde na $\\int du/u=\\ln|u|+C$.",
        "Protože $x^2+1>0$, výsledek je $\\ln(x^2+1)+C$.",
      ],
    },
    {
      id: "math.antiderivative.power-substitution",
      prompt: "Vypočtěte $\\int3(3x+1)^4\\,dx$.",
      answer: "(3x+1)^5/5+C",
      answerLabel: "$\\frac{(3x+1)^5}{5}+C$",
      hints: ["Položte $u=3x+1$."],
      solutionSteps: [
        "Pro $u=3x+1$ platí $du=3\\,dx$.",
        "Získáme $\\int u^4\\,du=u^5/5+C$.",
        "Vrátíme proměnnou: $(3x+1)^5/5+C$.",
      ],
    },
    {
      id: "math.antiderivative.exp-parts",
      prompt: "Vypočtěte $\\int xe^x\\,dx$ metodou per partes.",
      answer: "(x-1)e^x+C",
      answerLabel: "$(x-1)e^x+C$",
      hints: ["Zvolte $u=x$, $dv=e^x\\,dx$."],
      solutionSteps: [
        "Při $u=x$, $du=dx$, $v=e^x$ platí $\\int u\\,dv=uv-\\int v\\,du$.",
        "Dostaneme $xe^x-\\int e^x\\,dx=xe^x-e^x+C$.",
        "Po vytknutí je výsledek $(x-1)e^x+C$.",
      ],
    },
    {
      id: "math.antiderivative.trig-parts",
      prompt: "Vypočtěte $\\int x\\cos x\\,dx$ metodou per partes.",
      answer: "x sin x+cos x+C",
      answerLabel: "$x\\sin x+\\cos x+C$",
      hints: ["Zvolte $u=x$, $dv=\\cos x\\,dx$."],
      solutionSteps: [
        "Pak $du=dx$ a $v=\\sin x$.",
        "$\\int x\\cos x\\,dx=x\\sin x-\\int\\sin x\\,dx$.",
        "Protože $\\int\\sin x\\,dx=-\\cos x$, vyjde $x\\sin x+\\cos x+C$.",
      ],
    },
    {
      id: "math.antiderivative.log-parts",
      prompt: "Vypočtěte $\\int\\ln x\\,dx$ pro $x>0$.",
      answer: "x ln x-x+C",
      answerLabel: "$x\\ln x-x+C$",
      hints: ["V metodě per partes položte $u=\\ln x$, $dv=dx$."],
      solutionSteps: [
        "Pak $du=dx/x$ a $v=x$.",
        "$\\int\\ln x\\,dx=x\\ln x-\\int x(1/x)\\,dx$.",
        "Výsledek je $x\\ln x-x+C$.",
      ],
    },
    {
      id: "math.antiderivative.half-log",
      prompt: "Vypočtěte $\\int\\frac{x}{x^2+4}\\,dx$.",
      answer: "1/2 ln(x^2+4)+C",
      answerLabel: "$\\frac12\\ln(x^2+4)+C$",
      hints: ["Derivace jmenovatele je $2x$."],
      solutionSteps: [
        "Položme $u=x^2+4$, potom $du=2x\\,dx$.",
        "Integrál je $\\frac12\\int du/u=\\frac12\\ln|u|+C$.",
        "Protože $u>0$, dostaneme $\\frac12\\ln(x^2+4)+C$.",
      ],
    },
    {
      id: "math.antiderivative.exp-chain",
      prompt: "Vypočtěte $\\int e^{2x}\\,dx$.",
      answer: "1/2 e^(2x)+C",
      answerLabel: "$\\frac12e^{2x}+C$",
      hints: ["Vnitřní derivace exponentu je $2$."],
      solutionSteps: [
        "Položme $u=2x$, tedy $dx=du/2$.",
        "Pak $\\int e^{2x}\\,dx=\\frac12\\int e^u\\,du$.",
        "Výsledek je $\\frac12e^{2x}+C$.",
      ],
    },
  ],
} as const satisfies MathTopic;
