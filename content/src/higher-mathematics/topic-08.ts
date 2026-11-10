import type { MathTopic } from "./types";

export const mathTopic08 = {
  id: "separovatelne-rovnice",
  number: 8,
  title: "Diferenciální rovnice prvního řádu. Rovnice separované a separovatelné a jejich řešení.",
  shortTitle: "DR 1. řádu",
  description:
    "Pojem řešení a počáteční úlohy, rovnice separované a separovatelné, stacionární řešení a ověření dosazením.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy z metody separace proměnných."],
  verificationNote: "Každé řešení bylo dosazeno do rovnice i počáteční podmínky.",
  theory: [
    {
      heading: "Diferenciální rovnice a její řešení",
      paragraphs: [
        "Diferenciální rovnice prvního řádu je vztah mezi neznámou funkcí $y(x)$, její derivací a proměnnou $x$, typicky ve tvaru $y'=f(x,y)$. Řešením je funkce definovaná na intervalu, která rovnici splňuje v každém jeho bodě.",
        "Obecné řešení obsahuje jednu konstantu $C$. Počáteční (Cauchyova) úloha přidává podmínku $y(x_0)=y_0$, která konstantu určí. Je-li $f$ spojitá a má spojitou $\\frac{\\partial f}{\\partial y}$, má počáteční úloha v okolí $x_0$ právě jedno řešení.",
        "Řešení vždy ověřte dosazením do rovnice i do počáteční podmínky a uveďte interval, na kterém platí.",
      ],
    },
    {
      heading: "Separovaná a separovatelná rovnice",
      paragraphs: [
        "Rovnice je separovatelná, lze-li pravou stranu zapsat jako součin funkce $x$ a funkce $y$. Separovaná rovnice má proměnné již oddělené: $q(y)\\,dy=p(x)\\,dx$.",
        "Postup: přepíšeme $y'=\\frac{dy}{dx}$, převedeme vše s $y$ na jednu stranu a vše s $x$ na druhou, obě strany integrujeme a je-li to možné, vyjádříme $y$. Konstantu z obou integrací spojíme do jedné.",
      ],
      formulas: [
        "y'=g(x)\\,h(y)\\quad\\Longrightarrow\\quad\\int\\frac{dy}{h(y)}=\\int g(x)\\,dx+C\\qquad(h(y)\\ne0)",
      ],
    },
    {
      heading: "Stacionární řešení a ztracená řešení",
      paragraphs: [
        "Dělení $h(y)$ je dovoleno jen tam, kde $h(y)\\ne0$. Každý kořen $h(y_0)=0$ dává konstantní (stacionární) řešení $y\\equiv y_0$, které je třeba ověřit a doplnit zvlášť; například $y'=y^2$ má kromě $y=\\frac{-1}{x+C}$ i řešení $y\\equiv0$.",
        "Po integraci typu $\\ln|y|=G(x)+C$ dostaneme $y=Ke^{G(x)}$, kde $K=\\pm e^C$; volba $K=0$ vrací stacionární řešení $y\\equiv0$.",
      ],
    },
    {
      heading: "Typické aplikace",
      paragraphs: [
        "U fyzikálních úloh vyberte větev řešení, která odpovídá počáteční podmínce (kladná koncentrace, správné znaménko odmocniny).",
      ],
      items: [
        "Exponenciální růst a rozpad $y'=ky$: $y=y_0e^{kx}$ (radioaktivní rozpad, reakce 1. řádu).",
        "Kinetika 2. řádu $c'=-kc^2$: $\\frac1c=\\frac1{c_0}+kt$.",
        "Newtonův zákon ochlazování $T'=-k(T-T_0)$: substituce $u=T-T_0$ vede na $u'=-ku$.",
      ],
    },
  ],
  solverTypes: ["integral"],
  exercises: [
    {
      id: "math.ode1.direct",
      prompt: "Řešte $y'=2x$, $y(0)=1$.",
      answer: "y=x^2+1",
      answerLabel: "$y=x^2+1$",
      hints: ["Integrujte přímo podle $x$."],
      solutionSteps: [
        "Integrací $dy=2x\\,dx$ dostaneme $y=x^2+C$.",
        "Podmínka $y(0)=1$ dává $C=1$.",
        "Řešení je $y=x^2+1$; derivace je $2x$.",
      ],
    },
    {
      id: "math.ode1.exponential",
      prompt: "Řešte $y'=y$, $y(0)=2$.",
      answer: "y=2e^x",
      answerLabel: "$y=2e^x$",
      hints: ["Pro nenulové řešení integrujte $dy/y=dx$."],
      solutionSteps: [
        "Separací dostaneme $dy/y=dx$ a tedy $\\ln|y|=x+C$.",
        "Odtud $y=Ke^x$.",
        "Z $y(0)=2$ plyne $K=2$, tedy $y=2e^x$.",
      ],
    },
    {
      id: "math.ode1.gaussian-growth",
      prompt: "Řešte $y'=xy$, $y(0)=1$.",
      answer: "y=e^(x^2/2)",
      answerLabel: "$y=e^{x^2/2}$",
      hints: ["Separujte $dy/y=x\\,dx$."],
      solutionSteps: [
        "Integrace dává $\\ln|y|=x^2/2+C$.",
        "Tedy $y=Ke^{x^2/2}$.",
        "Podmínka $y(0)=1$ určí $K=1$.",
      ],
    },
    {
      id: "math.ode1.decay",
      prompt: "Řešte $y'=-2y$, $y(0)=3$.",
      answer: "y=3e^(-2x)",
      answerLabel: "$y=3e^{-2x}$",
      hints: ["Separujte $dy/y=-2\\,dx$."],
      solutionSteps: [
        "Z integrace plyne $\\ln|y|=-2x+C$.",
        "Zapisujeme $y=Ke^{-2x}$.",
        "Pro $x=0$ má být $y=3$, tedy $K=3$.",
      ],
    },
    {
      id: "math.ode1.square-root",
      prompt: "Řešte $y'=x/y$, $y(0)=1$; vyberte kladnou větev.",
      answer: "y=sqrt(x^2+1)",
      answerLabel: "$y=\\sqrt{x^2+1}$",
      hints: ["Vynásobte rovnici $y$ a integrujte $y\\,dy=x\\,dx$."],
      solutionSteps: [
        "Separace dává $y\\,dy=x\\,dx$.",
        "Po integraci $y^2/2=x^2/2+C$, tedy $y^2=x^2+C_1$.",
        "Z $y(0)=1$ plyne $C_1=1$ a kladná větev je $y=\\sqrt{x^2+1}$.",
      ],
    },
    {
      id: "math.ode1.polynomial-factor",
      prompt: "Řešte $y'=(1+x^2)y$, $y(0)=1$.",
      answer: "y=e^(x+x^3/3)",
      answerLabel: "$y=e^{x+x^3/3}$",
      hints: ["Integrujte $dy/y=(1+x^2)\\,dx$."],
      solutionSteps: [
        "Separací získáme $\\ln|y|=x+x^3/3+C$.",
        "Tedy $y=Ke^{x+x^3/3}$.",
        "Počáteční hodnota dává $K=1$.",
      ],
    },
    {
      id: "math.ode1.riccati-separable",
      prompt: "Řešte $y'=y^2$, $y(0)=1$ na intervalu obsahujícím $0$.",
      answer: "y=1/(1-x)",
      answerLabel: "$y=\\frac1{1-x}$",
      hints: ["Integrujte $dy/y^2=dx$."],
      solutionSteps: [
        "Integrace dává $-1/y=x+C$ pro nenulovou větev.",
        "Dosazení $y(0)=1$ určí $C=-1$.",
        "Dostaneme $y=1/(1-x)$ na maximálním intervalu $x<1$.",
      ],
    },
    {
      id: "math.ode1.arctangent",
      prompt: "Řešte $y'=2x(1+y^2)$, $y(0)=0$ v okolí nuly.",
      answer: "y=tan(x^2)",
      answerLabel: "$y=\\tan(x^2)$",
      hints: ["Integrál $dy/(1+y^2)$ je arkustangens."],
      solutionSteps: [
        "Separace dává $dy/(1+y^2)=2x\\,dx$.",
        "Integrujeme na $\\arctan y=x^2+C$.",
        "$y(0)=0$ určí $C=0$, takže lokálně $y=\\tan(x^2)$.",
      ],
    },
    {
      id: "math.ode1.euler",
      prompt: "Řešte $y'=y/x$, $y(1)=2$ na $x>0$.",
      answer: "y=2x",
      answerLabel: "$y=2x$",
      hints: ["Integrujte $dy/y=dx/x$."],
      solutionSteps: [
        "Separace vede na $\\ln|y|=\\ln x+C$ pro $x>0$.",
        "Odtud $y=Kx$.",
        "Z $y(1)=2$ vyjde $K=2$, tedy $y=2x$.",
      ],
    },
    {
      id: "math.ode1.gaussian-decay",
      prompt: "Řešte $y'=-xy$, $y(0)=4$.",
      answer: "y=4e^(-x^2/2)",
      answerLabel: "$y=4e^{-x^2/2}$",
      hints: ["Separujte proměnné a integrujte $-x$."],
      solutionSteps: [
        "$dy/y=-x\\,dx$ dává $\\ln|y|=-x^2/2+C$.",
        "Tedy $y=Ke^{-x^2/2}$.",
        "Počáteční podmínka určí $K=4$.",
      ],
    },
  ],
} as const satisfies MathTopic;
