import type { MathTopic } from "./types";

export const mathTopic09 = {
  id: "linearni-homogenni-rovnice",
  number: 9,
  title:
    "Homogenní lineární diferenciální rovnice prvního a druhého řádu s konstantními koeficienty a jejich řešení.",
  shortTitle: "Lineární DR s konst. koef.",
  description:
    "Charakteristická rovnice, fundamentální systém pro reálné, dvojnásobné a komplexní kořeny a počáteční úlohy.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy z metody charakteristické rovnice."],
  verificationNote: "Řešení byla ověřena dosazením do diferenciální rovnice a případných podmínek.",
  theory: [
    {
      heading: "Lineární homogenní rovnice",
      paragraphs: [
        "Rovnice je lineární, vystupuje-li v ní $y$ a jeho derivace jen v první mocnině a nenásobí se navzájem; homogenní, je-li pravá strana nulová. Pro konstantní koeficienty $a$, $b$ jde o rovnice níže.",
        "Princip superpozice: jsou-li $y_1$, $y_2$ řešení homogenní rovnice, je řešením i každá kombinace $C_1y_1+C_2y_2$. Obecné řešení rovnice 2. řádu tvoří dvě lineárně nezávislá řešení (fundamentální systém).",
      ],
      formulas: ["y'+ay=0,\\qquad y''+ay'+by=0"],
    },
    {
      heading: "Rovnice prvního řádu",
      paragraphs: [
        "Rovnice $y'+ay=0$ je separovatelná (okruh 8): $\\frac{dy}{y}=-a\\,dx$. Stejný výsledek dá dosazení $y=e^{\\lambda x}$, kdy $\\lambda+a=0$.",
      ],
      formulas: ["y=Ce^{-ax},\\qquad y(x_0)=y_0\\ \\Rightarrow\\ y=y_0e^{-a(x-x_0)}"],
    },
    {
      heading: "Charakteristická rovnice pro druhý řád",
      paragraphs: [
        "Dosadíme $y=e^{\\lambda x}$. Protože $e^{\\lambda x}\\ne0$, dostaneme charakteristickou rovnici $\\lambda^2+a\\lambda+b=0$. Podle jejích kořenů:",
      ],
      formulas: ["\\lambda^2+a\\lambda+b=0,\\qquad \\lambda_{1,2}=\\frac{-a\\pm\\sqrt{a^2-4b}}{2}"],
      items: [
        "Dva různé reálné kořeny $\\lambda_1\\ne\\lambda_2$: $y=C_1e^{\\lambda_1x}+C_2e^{\\lambda_2x}$.",
        "Dvojnásobný kořen $\\lambda$: $y=(C_1+C_2x)e^{\\lambda x}$. Druhé řešení $xe^{\\lambda x}$ vzniká proto, že samotné $e^{\\lambda x}$ je jen jedno.",
        "Komplexně sdružené kořeny $\\alpha\\pm\\beta i$: $y=e^{\\alpha x}(C_1\\cos\\beta x+C_2\\sin\\beta x)$, podle Eulerova vzorce $e^{i\\beta x}=\\cos\\beta x+i\\sin\\beta x$.",
      ],
    },
    {
      heading: "Počáteční úloha a interpretace",
      paragraphs: [
        "U rovnice 2. řádu zadáváme dvě podmínky $y(x_0)=y_0$ a $y'(x_0)=y_1$. Obecné řešení zderivujeme, dosadíme obě podmínky a vyřešíme soustavu pro $C_1$, $C_2$.",
        "Rovnice $y''+2\\delta y'+\\omega^2y=0$ popisuje tlumený oscilátor: komplexní kořeny znamenají tlumené kmity, reálné kořeny aperiodický pohyb, dvojnásobný kořen kritické tlumení. Pro $\\delta=0$ vychází harmonický pohyb $C_1\\cos\\omega x+C_2\\sin\\omega x$.",
      ],
    },
  ],
  solverTypes: [],
  exercises: [
    {
      id: "math.ode2.first-decay",
      prompt: "Řešte $y'+2y=0$, $y(0)=3$.",
      answer: "y=3e^(-2x)",
      answerLabel: "$y=3e^{-2x}$",
      hints: ["Charakteristická hodnota je $-2$."],
      solutionSteps: [
        "Rovnici přepíšeme jako $y'=-2y$.",
        "Obecné řešení je $y=Ce^{-2x}$.",
        "Z $y(0)=3$ vyplývá $C=3$.",
      ],
    },
    {
      id: "math.ode2.first-growth",
      prompt: "Řešte $y'-y=0$, $y(0)=2$.",
      answer: "y=2e^x",
      answerLabel: "$y=2e^x$",
      hints: ["Hledejte exponenciální řešení."],
      solutionSteps: [
        "Rovnice znamená $y'=y$.",
        "Obecně $y=Ce^x$.",
        "Podmínka $y(0)=2$ dává $C=2$.",
      ],
    },
    {
      id: "math.ode2.two-real-roots",
      prompt: "Najděte obecné řešení $y''-3y'+2y=0$.",
      answer: "y=C1 e^x+C2 e^(2x)",
      answerLabel: "$y=C_1e^x+C_2e^{2x}$",
      hints: ["Vyřešte $r^2-3r+2=0$."],
      solutionSteps: [
        "Charakteristický polynom se rozloží na $(r-1)(r-2)$.",
        "Dva různé kořeny jsou $r_1=1$, $r_2=2$.",
        "Obecné řešení je $y=C_1e^x+C_2e^{2x}$.",
      ],
    },
    {
      id: "math.ode2.oscillator",
      prompt: "Najděte obecné řešení $y''+y=0$.",
      answer: "y=C1 cos x+C2 sin x",
      answerLabel: "$y=C_1\\cos x+C_2\\sin x$",
      hints: ["Charakteristické kořeny jsou imaginární."],
      solutionSteps: [
        "Charakteristická rovnice je $r^2+1=0$.",
        "Kořeny jsou $r=\\pm i$.",
        "Reálný tvar řešení je $y=C_1\\cos x+C_2\\sin x$.",
      ],
    },
    {
      id: "math.ode2.symmetric-roots",
      prompt: "Najděte obecné řešení $y''-4y=0$.",
      answer: "y=C1 e^(2x)+C2 e^(-2x)",
      answerLabel: "$y=C_1e^{2x}+C_2e^{-2x}$",
      hints: ["Vyřešte $r^2-4=0$."],
      solutionSteps: [
        "Charakteristická rovnice $r^2-4=0$ se rozloží na $(r-2)(r+2)=0$.",
        "Kořeny jsou $2$ a $-2$.",
        "Obecné řešení je $y=C_1e^{2x}+C_2e^{-2x}$.",
      ],
    },
    {
      id: "math.ode2.double-root",
      prompt: "Najděte obecné řešení $y''+4y'+4y=0$.",
      answer: "y=(C1+C2 x)e^(-2x)",
      answerLabel: "$y=(C_1+C_2x)e^{-2x}$",
      hints: ["Charakteristický polynom má dvojnásobný kořen."],
      solutionSteps: [
        "$r^2+4r+4=(r+2)^2$.",
        "Dvojnásobný kořen je $r=-2$; druhé nezávislé řešení je $xe^{-2x}$.",
        "Proto $y=(C_1+C_2x)e^{-2x}$.",
      ],
    },
    {
      id: "math.ode2.complex-roots",
      prompt: "Najděte obecné řešení $y''+2y'+5y=0$.",
      answer: "y=e^(-x)(C1 cos(2x)+C2 sin(2x))",
      answerLabel: "$y=e^{-x}(C_1\\cos2x+C_2\\sin2x)$",
      hints: ["Kořeny mají tvar $-1\\pm2i$."],
      solutionSteps: [
        "Charakteristická rovnice je $r^2+2r+5=0$.",
        "Diskriminant je $4-20=-16$, tedy $r=-1\\pm2i$.",
        "Reálné řešení je $y=e^{-x}(C_1\\cos2x+C_2\\sin2x)$.",
      ],
    },
    {
      id: "math.ode2.zero-roots",
      prompt: "Najděte obecné řešení $y''=0$.",
      answer: "y=C1+C2 x",
      answerLabel: "$y=C_1+C_2x$",
      hints: ["Integrujte dvakrát nebo zvažte dvojnásobný kořen $0$."],
      solutionSteps: [
        "Jednou integrací $y''=0$ dostaneme $y'=C_2$.",
        "Druhá integrace dává $y=C_2x+C_1$.",
        "Řešení tedy tvoří všechny afinní funkce.",
      ],
    },
    {
      id: "math.ode2.oscillator-initial",
      prompt: "Řešte $y''+y=0$, $y(0)=0$, $y'(0)=1$.",
      answer: "y=sin x",
      answerLabel: "$y=\\sin x$",
      hints: ["Začněte obecným řešením s kosinem a sinem."],
      solutionSteps: [
        "Obecné řešení je $y=C_1\\cos x+C_2\\sin x$.",
        "Z $y(0)=0$ plyne $C_1=0$; derivace $y'=-C_1\\sin x+C_2\\cos x$.",
        "Z $y'(0)=1$ plyne $C_2=1$, tedy $y=\\sin x$.",
      ],
    },
    {
      id: "math.ode2.hyperbolic-initial",
      prompt: "Řešte $y''-y=0$, $y(0)=1$, $y'(0)=0$.",
      answer: "y=(e^x+e^(-x))/2",
      answerLabel: "$y=\\frac{e^x+e^{-x}}2$",
      hints: ["Charakteristické kořeny jsou $1$ a $-1$."],
      solutionSteps: [
        "Obecně $y=C_1e^x+C_2e^{-x}$.",
        "Podmínky dávají $C_1+C_2=1$ a $C_1-C_2=0$.",
        "Proto $C_1=C_2=1/2$ a $y=(e^x+e^{-x})/2$.",
      ],
    },
  ],
} as const satisfies MathTopic;
