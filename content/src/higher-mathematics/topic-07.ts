import type { MathTopic } from "./types";

export const mathTopic07 = {
  id: "urcity-integral",
  title: "Určitý a Newtonův integrál",
  description: "Newtonova–Leibnizova věta, substituce, symetrie a nevlastní integrál.",
  status: "draft",
  responsibleEditor: "Codex",
  sources: ["Samostatně odvozené úlohy z Newtonovy–Leibnizovy věty."],
  verificationNote: "Primitivní funkce a dosazení mezí byly ověřeny přímým výpočtem.",
  exercises: [
    {
      id: "math.definite.power",
      prompt: "Vypočtěte $\\int_0^1x^2\\,dx$.",
      answer: "1/3",
      answerLabel: "$\\frac13$",
      hints: ["Primitivní funkce je $x^3/3$."],
      solutionSteps: [
        "Najdeme $F(x)=x^3/3$.",
        "Newtonova–Leibnizova věta dává $F(1)-F(0)$.",
        "Výsledek je $1/3-0=1/3$.",
      ],
    },
    {
      id: "math.definite.sin",
      prompt: "Vypočtěte $\\int_0^\\pi\\sin x\\,dx$.",
      answer: "2",
      hints: ["Primitivní funkce k sinu je $-\\cos x$."],
      solutionSteps: [
        "$F(x)=-\\cos x$.",
        "$F(\\pi)-F(0)=-\\cos\\pi+\\cos0$.",
        "Protože $\\cos\\pi=-1$ a $\\cos0=1$, výsledek je $2$.",
      ],
    },
    {
      id: "math.definite.log",
      prompt: "Vypočtěte $\\int_1^e\\frac1x\\,dx$.",
      answer: "1",
      hints: ["Použijte $F(x)=\\ln x$."],
      solutionSteps: [
        "Na $[1,e]$ je primitivní funkce $F(x)=\\ln x$.",
        "Dosadíme horní a dolní mez: $\\ln e-\\ln1$.",
        "Výsledek je $1-0=1$.",
      ],
    },
    {
      id: "math.definite.exp",
      prompt: "Vypočtěte $\\int_0^1 e^x\\,dx$.",
      answer: "e-1",
      answerLabel: "$e-1$",
      hints: ["Exponenciála je vlastní primitivní funkcí."],
      solutionSteps: ["$F(x)=e^x$.", "$F(1)-F(0)=e^1-e^0$.", "Výsledek je $e-1$."],
    },
    {
      id: "math.definite.linear",
      prompt: "Vypočtěte $\\int_0^2(2x+1)\\,dx$.",
      answer: "6",
      hints: ["Integrujte jednotlivé členy."],
      solutionSteps: [
        "Primitivní funkce je $F(x)=x^2+x$.",
        "$F(2)=4+2=6$ a $F(0)=0$.",
        "Určitý integrál je $6$.",
      ],
    },
    {
      id: "math.definite.odd",
      prompt: "Vypočtěte $\\int_{-1}^1x^3\\,dx$.",
      answer: "0",
      hints: ["Integrand je lichá funkce na souměrném intervalu."],
      solutionSteps: [
        "$x^3$ je lichá funkce, takže záporná a kladná část se vyruší.",
        "Přímo: $F(x)=x^4/4$.",
        "$F(1)-F(-1)=1/4-1/4=0$.",
      ],
    },
    {
      id: "math.definite.even",
      prompt: "Vypočtěte $\\int_{-1}^1x^2\\,dx$.",
      answer: "2/3",
      answerLabel: "$\\frac23$",
      hints: ["U sudé funkce lze počítat dvakrát integrál od $0$ do $1$."],
      solutionSteps: [
        "$x^2$ je sudá funkce, proto integrál je $2\\int_0^1x^2\\,dx$.",
        "Primitivní funkce je $x^3/3$.",
        "Dostáváme $2(1/3-0)=2/3$.",
      ],
    },
    {
      id: "math.definite.cos",
      prompt: "Vypočtěte $\\int_0^{\\pi/2}\\cos x\\,dx$.",
      answer: "1",
      hints: ["Primitivní funkce je sinus."],
      solutionSteps: [
        "$F(x)=\\sin x$.",
        "Dosadíme meze: $\\sin(\\pi/2)-\\sin0$.",
        "Výsledek je $1-0=1$.",
      ],
    },
    {
      id: "math.definite.substitution",
      prompt: "Vypočtěte $\\int_0^1 xe^{x^2}\\,dx$.",
      answer: "(e-1)/2",
      answerLabel: "$\\frac{e-1}{2}$",
      hints: ["Položte $u=x^2$ a upravte meze."],
      solutionSteps: [
        "Pro $u=x^2$ je $du=2x\\,dx$; meze $x=0,1$ odpovídají $u=0,1$.",
        "Integrál je $\\frac12\\int_0^1e^u\\,du$.",
        "Dostáváme $\\frac12(e^1-e^0)=(e-1)/2$.",
      ],
    },
    {
      id: "math.definite.improper-log",
      prompt: "Vypočtěte nevlastní integrál $\\int_0^1\\ln x\\,dx$.",
      answer: "-1",
      hints: ["Dolní mez nahraďte $a>0$ a nechte $a\\to0^+$."],
      solutionSteps: [
        "Pro $a>0$ je $\\int_a^1\\ln x\\,dx=[x\\ln x-x]_a^1$.",
        "To je $-1-(a\\ln a-a)$.",
        "Protože $a\\ln a\\to0$ a $a\\to0$, limita je $-1$.",
      ],
    },
  ],
} as const satisfies MathTopic;
