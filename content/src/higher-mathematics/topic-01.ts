import type { MathTopic } from "./types";

export const mathTopic01 = {
  id: "limity-spojitost",
  title: "Limity a spojitost",
  description: "Základní techniky výpočtu limit, jednostranné limity a spojitost funkce.",
  status: "draft",
  responsibleEditor: "Codex",
  sources: [
    "Samostatně odvozené úlohy z definice limity a standardních vět diferenciálního počtu.",
  ],
  verificationNote: "Každý výsledek byl nezávisle dosazen nebo odvozen algebraickou úpravou.",
  exercises: [
    {
      id: "math.limits.factor",
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
