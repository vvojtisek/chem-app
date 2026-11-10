import type { MathTopic } from "./types";

export const mathTopic02 = {
  id: "derivace-tecny-asymptoty",
  number: 2,
  title:
    "Derivace funkce a její geometrický význam. Výpočet derivace. Rovnice tečny. L’Hospitalovo pravidlo. Asymptoty.",
  shortTitle: "Derivace, tečna, asymptoty",
  description:
    "Definice a geometrický význam derivace, derivační pravidla, implicitní derivace, tečna, L’Hospitalovo pravidlo a asymptoty.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy ze standardních pravidel diferenciálního počtu."],
  verificationNote: "Derivace a limity byly ověřeny přímým výpočtem a zpětným dosazením.",
  theory: [
    {
      heading: "Definice a geometrický význam",
      paragraphs: [
        "Derivace funkce $f$ v bodě $x_0$ je limita směrnic sečen grafu procházejících body $[x_0,f(x_0)]$ a $[x_0+h,f(x_0+h)]$. Geometricky je $f'(x_0)$ směrnice tečny ke grafu v bodě $[x_0,f(x_0)]$; fyzikálně okamžitá rychlost změny.",
        "Má-li $f$ v bodě derivaci, je v něm spojitá. Opak neplatí: $|x|$ je v $0$ spojitá, ale derivaci tam nemá (jednostranné derivace jsou $-1$ a $1$).",
      ],
      formulas: ["f'(x_0)=\\lim_{h\\to0}\\frac{f(x_0+h)-f(x_0)}{h}"],
    },
    {
      heading: "Derivační pravidla",
      paragraphs: [
        "Derivace součtu je součet derivací jednotlivých členů a konstantní násobek lze vytknout před derivaci. Pro součin, podíl a složenou funkci platí:",
      ],
      formulas: [
        "(uv)'=u'v+uv',\\qquad \\left(\\frac uv\\right)'=\\frac{u'v-uv'}{v^2}\\ (v\\ne0)",
        "\\bigl(f(g(x))\\bigr)'=f'(g(x))\\cdot g'(x)\\quad\\text{(řetízkové pravidlo)}",
      ],
      items: [
        "$(x^n)'=nx^{n-1}$, $(e^x)'=e^x$, $(a^x)'=a^x\\ln a$, $(\\ln x)'=\\frac1x$",
        "$(\\sin x)'=\\cos x$, $(\\cos x)'=-\\sin x$, $(\\tan x)'=\\frac1{\\cos^2x}$",
        "$(\\arcsin x)'=\\frac1{\\sqrt{1-x^2}}$, $(\\arctan x)'=\\frac1{1+x^2}$",
        "Základ i exponent závisí na proměnné: $f^g=e^{g\\ln f}$ a derivujeme exponent, $(f^g)'=f^g\\left(g'\\ln f+g\\frac{f'}{f}\\right)$.",
      ],
    },
    {
      heading: "Implicitní derivace",
      paragraphs: [
        "Je-li křivka zadána rovnicí $F(x,y)=0$ a $y$ chápeme jako funkci $x$, derivujeme obě strany podle $x$ a u každého výskytu $y$ použijeme řetízkové pravidlo ($\\frac{d}{dx}y^2=2yy'$). Pak rovnici vyřešíme pro $y'$.",
        "Ekvivalentně podle věty o implicitní funkci platí vzorec níže, pokud $F_y\\ne0$ (parciální derivace viz okruh 4).",
      ],
      formulas: ["y'=-\\frac{F_x(x,y)}{F_y(x,y)}"],
    },
    {
      heading: "Rovnice tečny a normály",
      paragraphs: [
        "Tečna ke grafu $f$ v bodě $[x_0,f(x_0)]$ má směrnici $f'(x_0)$. Normála je k tečně kolmá, její směrnice je $-1/f'(x_0)$ (pro $f'(x_0)\\ne0$).",
      ],
      formulas: ["t:\\ y=f(x_0)+f'(x_0)(x-x_0),\\qquad n:\\ y=f(x_0)-\\frac{1}{f'(x_0)}(x-x_0)"],
    },
    {
      heading: "L’Hospitalovo pravidlo",
      paragraphs: [
        "Vychází-li dosazením neurčitý výraz $\\frac00$ nebo $\\frac{\\infty}{\\infty}$ a čitatel i jmenovatel jsou derivovatelné, limitu podílu nahradíme limitou podílu derivací (pokud ta existuje). Čitatel a jmenovatel derivujeme zvlášť, nikoli jako podíl.",
        "Typ $0\\cdot\\infty$ nejprve zapíšeme jako podíl ($fg=\\frac{f}{1/g}$), typ $\\infty-\\infty$ převedeme na společný jmenovatel a typy $1^\\infty$, $0^0$, $\\infty^0$ převedeme přes $e^{g\\ln f}$. Pravidlo lze použít opakovaně, před každým použitím ale ověřte, že výraz je stále neurčitý.",
      ],
      formulas: ["\\lim_{x\\to a}\\frac{f(x)}{g(x)}=\\lim_{x\\to a}\\frac{f'(x)}{g'(x)}"],
    },
    {
      heading: "Asymptoty",
      paragraphs: ["Asymptoty vyšetřujeme zvlášť pro $x\\to+\\infty$ a $x\\to-\\infty$."],
      items: [
        "Svislá asymptota $x=a$: alespoň jedna jednostranná limita v $a$ je nevlastní ($\\pm\\infty$). Kandidáti jsou body mimo definiční obor a krajní body otevřených intervalů.",
        "Asymptota se směrnicí $y=kx+q$ pro $x\\to\\pm\\infty$: $k=\\lim\\frac{f(x)}{x}$ a $q=\\lim(f(x)-kx)$, obě limity musí být vlastní. Pro $k=0$ jde o vodorovnou asymptotu $y=q$.",
        "U racionální funkce dostaneme šikmou asymptotu dělením mnohočlenů: $\\frac{x^2+1}{x}=x+\\frac1x$, proto $y=x$.",
      ],
    },
  ],
  solverTypes: ["derivative", "implicit", "limit"],
  exercises: [
    {
      id: "math.derivatives.polynomial",
      solver: {
        problemType: "derivative",
        values: { expression: "x^3-2x", variable: "x", order: "1", point: "1" },
      },
      prompt: "Určete $f'(1)$ pro $f(x)=x^3-2x$.",
      answer: "1",
      hints: ["Derivujte každý člen zvlášť."],
      solutionSteps: ["Derivace je $f'(x)=3x^2-2$.", "Dosadíme $x=1$.", "Získáme $f'(1)=3-2=1$."],
    },
    {
      id: "math.derivatives.log",
      solver: {
        problemType: "derivative",
        values: { expression: "ln(x)", variable: "x", order: "1", point: "e" },
      },
      prompt: "Určete $f'(e)$ pro $f(x)=\\ln x$.",
      answer: "1/e",
      answerLabel: "$\\frac1e$",
      hints: ["Použijte derivaci přirozeného logaritmu."],
      solutionSteps: [
        "Na $(0,\\infty)$ platí $(\\ln x)'=1/x$.",
        "Dosadíme $x=e$.",
        "Výsledek je $1/e$.",
      ],
    },
    {
      id: "math.derivatives.trigonometric",
      solver: {
        problemType: "derivative",
        values: { expression: "sin(x)", variable: "x", order: "1", point: "pi/3" },
      },
      prompt: "Určete $f'(\\pi/3)$ pro $f(x)=\\sin x$.",
      answer: "1/2",
      answerLabel: "$\\frac12$",
      hints: ["Derivace sinu je kosinus."],
      solutionSteps: ["$f'(x)=\\cos x$.", "Dosadíme $x=\\pi/3$.", "$\\cos(\\pi/3)=1/2$."],
    },
    {
      id: "math.derivatives.product",
      solver: {
        problemType: "derivative",
        values: { expression: "x^2 e^x", variable: "x", order: "1", point: "1" },
      },
      prompt: "Určete $f'(1)$ pro $f(x)=x^2e^x$.",
      answer: "3e",
      answerLabel: "$3e$",
      hints: ["Použijte pravidlo pro derivaci součinu."],
      solutionSteps: [
        "$f'(x)=2xe^x+x^2e^x=e^x(2x+x^2)$.",
        "Pro $x=1$ dostáváme $e(2+1)$.",
        "Tedy $f'(1)=3e$.",
      ],
    },
    {
      id: "math.derivatives.quotient",
      solver: {
        problemType: "derivative",
        values: { expression: "(x+1)/(x-1)", variable: "x", order: "1", point: "2" },
      },
      prompt: "Určete $f'(2)$ pro $f(x)=\\frac{x+1}{x-1}$.",
      answer: "-2",
      hints: ["Použijte pravidlo pro podíl nebo přepište funkci jako $1+2/(x-1)$."],
      solutionSteps: [
        "Přepis $f(x)=1+2/(x-1)$ platí pro $x\\ne1$.",
        "Derivace je $f'(x)=-2/(x-1)^2$.",
        "Při $x=2$ je $f'(2)=-2$.",
      ],
    },
    {
      id: "math.derivatives.tangent",
      solver: {
        problemType: "derivative",
        values: { expression: "x^2", variable: "x", order: "1", point: "1" },
      },
      prompt: "Napište rovnici tečny ke grafu $y=x^2$ v bodě s $x=1$.",
      answer: "y=2x-1",
      answerLabel: "$y=2x-1$",
      hints: ["Směrnice tečny je hodnota derivace v bodě."],
      solutionSteps: [
        "Bod dotyku je $(1,1)$ a derivace $f'(x)=2x$.",
        "Směrnice v $x=1$ je $2$.",
        "Bodová rovnice $y-1=2(x-1)$ dává $y=2x-1$.",
      ],
    },
    {
      id: "math.derivatives.hospital-log",
      solver: {
        problemType: "limit",
        values: { expression: "ln(1+x)/x", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to0}\\frac{\\ln(1+x)}{x}$ pomocí L’Hospitalova pravidla.",
      answer: "1",
      hints: ["Tvar je $0/0$."],
      solutionSteps: [
        "Čitatel i jmenovatel konvergují k $0$.",
        "Derivace čitatele je $1/(1+x)$, derivace jmenovatele je $1$.",
        "Limita jejich podílu pro $x\\to0$ je $1$.",
      ],
    },
    {
      id: "math.derivatives.hospital-exp",
      solver: {
        problemType: "limit",
        values: { expression: "(e^x-1-x)/x^2", variable: "x", point: "0", direction: "+-" },
      },
      prompt: "Vypočtěte $\\lim_{x\\to0}\\frac{e^x-1-x}{x^2}$.",
      answer: "1/2",
      answerLabel: "$\\frac12$",
      hints: ["L’Hospitalovo pravidlo lze použít dvakrát."],
      solutionSteps: [
        "Po prvním použití dostaneme limitu $(e^x-1)/(2x)$, opět typu $0/0$.",
        "Po druhém použití je výraz $e^x/2$.",
        "Při $x\\to0$ vyjde $1/2$.",
      ],
    },
    {
      id: "math.derivatives.vertical-asymptote",
      solver: {
        problemType: "limit",
        values: { expression: "1/(x-2)", variable: "x", point: "2", direction: "+" },
      },
      prompt: "Určete svislou asymptotu funkce $f(x)=1/(x-2)$.",
      answer: "x=2",
      answerLabel: "$x=2$",
      hints: ["Hledejte nulový jmenovatel a nevlastní jednostrannou limitu."],
      solutionSteps: [
        "Jmenovatel se rovná nule v $x=2$.",
        "Zprava $1/(x-2)\\to+\\infty$, zleva $\\to-\\infty$.",
        "Svislá asymptota je $x=2$.",
      ],
    },
    {
      id: "math.derivatives.oblique-asymptote",
      solver: {
        problemType: "limit",
        values: { expression: "((x^2+1)/x)/x", variable: "x", point: "oo", direction: "+-" },
      },
      prompt: "Určete šikmou asymptotu funkce $f(x)=\\frac{x^2+1}{x}$ pro $x\\to\\infty$.",
      answer: "y=x",
      answerLabel: "$y=x$",
      hints: ["Proveďte dělení polynomů."],
      solutionSteps: [
        "Pro $x\\ne0$ píšeme $f(x)=x+1/x$.",
        "Rozdíl $f(x)-x=1/x$ pro $x\\to\\infty$ mizí.",
        "Šikmá asymptota má rovnici $y=x$.",
      ],
    },
    {
      id: "math.derivatives.implicit-circle",
      solver: { problemType: "implicit", values: { equation: "x^2 + y^2 = 25", x: "x", y: "y" } },
      prompt: "Křivka je zadána rovnicí $x^2+y^2=25$. Určete $y'$ v bodě $[3,4]$.",
      answer: "-3/4",
      answerLabel: "$-\\frac34$",
      acceptedAnswers: ["-0,75", "-0.75"],
      hints: ["Derivujte obě strany podle $x$; $y$ je funkcí $x$.", "$\\frac{d}{dx}y^2=2yy'$."],
      solutionSteps: [
        "Derivujeme: $2x+2yy'=0$.",
        "Vyjádříme $y'=-\\frac{x}{y}$ (pro $y\\ne0$).",
        "V bodě $[3,4]$: $y'=-\\frac34$. Stejný výsledek dává vzorec $y'=-F_x/F_y$ pro $F=x^2+y^2-25$.",
      ],
    },
  ],
} as const satisfies MathTopic;
