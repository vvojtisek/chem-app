import type { MathTopic } from "./types";

export const mathTopic04 = {
  id: "diferencial-krivky",
  number: 4,
  title: "Diferenciál funkce. Křivky a jejich parametrizace.",
  shortTitle: "Diferenciál a křivky",
  description:
    "Diferenciál a lineární aproximace, totální diferenciál funkce více proměnných s gradientem a směrovou derivací, parametrizace křivek.",
  status: "draft",
  responsibleEditor: "Codex",
  theoryEditor: "Claude",
  sources: ["Samostatně odvozené úlohy z diferenciálu a elementární parametrizace křivek."],
  verificationNote: "Parametrické derivace, body a délky byly přepočteny přímo ze zadání.",
  theory: [
    {
      heading: "Diferenciál funkce jedné proměnné",
      paragraphs: [
        "Má-li $f$ v bodě $x_0$ derivaci, je přírůstek funkce pro malé $h=dx$ dobře přiblížen lineární funkcí $df=f'(x_0)\\,dx$. Diferenciál je přírůstek na tečně, nikoli na grafu; chyba aproximace jde k nule rychleji než $dx$.",
        "Lineární aproximace se používá k odhadům: $\\sqrt{4{,}04}\\approx\\sqrt4+\\frac{1}{2\\sqrt4}\\cdot0{,}04=2{,}01$. Pravidla pro diferenciál odpovídají derivačním pravidlům, např. $d(uv)=v\\,du+u\\,dv$.",
      ],
      formulas: ["df(x_0)=f'(x_0)\\,dx,\\qquad f(x_0+dx)\\approx f(x_0)+f'(x_0)\\,dx"],
    },
    {
      heading: "Parciální derivace a totální diferenciál",
      paragraphs: [
        "U funkce více proměnných derivujeme podle jedné proměnné a ostatní proměnné se chovají jako konstanty: pro $f(x,y)=x^2y$ je $\\frac{\\partial f}{\\partial x}=2xy$ a $\\frac{\\partial f}{\\partial y}=x^2$.",
        "Totální diferenciál sčítá příspěvky všech proměnných. Má-li $f$ spojité parciální derivace, platí $f(x_0+dx,y_0+dy)\\approx f(x_0,y_0)+df$; geometricky jde o tečnou rovinu ke grafu. Totální diferenciál se používá i k odhadu chyby měření.",
      ],
      formulas: ["df=\\frac{\\partial f}{\\partial x}\\,dx+\\frac{\\partial f}{\\partial y}\\,dy"],
    },
    {
      heading: "Gradient a směrová derivace",
      paragraphs: [
        "Gradient je vektor parciálních derivací podle všech proměnných. Ukazuje směr nejrychlejšího růstu funkce a jeho velikost je tato největší rychlost růstu.",
        "Směrová derivace ve směru $\\mathbf u$ je skalární součin gradientu a jednotkového směru, proto směr nejprve vydělíme jeho velikostí. Ve směru kolmém ke gradientu je nulová (směr vrstevnice).",
      ],
      formulas: [
        "\\nabla f=\\left(\\frac{\\partial f}{\\partial x},\\frac{\\partial f}{\\partial y}\\right),\\qquad \\frac{\\partial f}{\\partial\\mathbf u}(P)=\\nabla f(P)\\cdot\\frac{\\mathbf u}{\\|\\mathbf u\\|}",
      ],
    },
    {
      heading: "Parametrizace křivek",
      paragraphs: [
        "Rovinná křivka je zadána dvojicí funkcí $x=\\varphi(t)$, $y=\\psi(t)$ pro $t\\in[\\alpha,\\beta]$. Parametr $t$ lze chápat jako čas a bod $[\\varphi(t),\\psi(t)]$ jako polohu. Jedna křivka má mnoho parametrizací.",
        "Tečný vektor je $(\\varphi'(t),\\psi'(t))$, jeho velikost je rychlost. Je-li $\\varphi'(t)\\ne0$, má tečna směrnici $\\frac{dy}{dx}=\\frac{\\psi'(t)}{\\varphi'(t)}$. Délka křivky je integrál rychlosti.",
      ],
      formulas: [
        "\\frac{dy}{dx}=\\frac{\\psi'(t)}{\\varphi'(t)},\\qquad \\ell=\\int_\\alpha^\\beta\\sqrt{\\varphi'(t)^2+\\psi'(t)^2}\\,dt",
      ],
      items: [
        "Přímka bodem $A$ se směrem $\\mathbf v$: $X=A+t\\mathbf v$, $t\\in\\mathbb R$.",
        "Kružnice se středem $[m,n]$ a poloměrem $r$: $x=m+r\\cos t$, $y=n+r\\sin t$, $t\\in[0,2\\pi)$.",
        "Elipsa s poloosami $a$, $b$: $x=a\\cos t$, $y=b\\sin t$.",
        "Graf funkce $y=f(x)$: $x=t$, $y=f(t)$.",
      ],
    },
  ],
  solverTypes: ["derivative", "partial", "gradient", "directional"],
  exercises: [
    {
      id: "math.differential.square",
      prompt: "Pro $f(x)=x^2$ vypočtěte diferenciál $df$ v $x=3$ při $dx=0{,}1$.",
      answer: "0,6",
      acceptedAnswers: ["0.6", "3/5"],
      answerLabel: "$0{,}6$",
      hints: ["Platí $df=f'(x)\\,dx$."],
      solutionSteps: ["$f'(x)=2x$.", "V $x=3$ je $f'(3)=6$.", "$df=6\\cdot0{,}1=0{,}6$."],
    },
    {
      id: "math.differential.sin",
      prompt: "Pro $f(x)=\\sin x$ v $x=0$ určete koeficient u $dx$ v diferenciálu $df$.",
      answer: "1",
      hints: ["Derivace sinu je kosinus."],
      solutionSteps: [
        "$df=f'(x)\\,dx=\\cos x\\,dx$.",
        "V $x=0$ je $\\cos0=1$.",
        "Proto $df=1\\,dx$ a hledaný koeficient je $1$.",
      ],
    },
    {
      id: "math.differential.root-approximation",
      prompt: "Pomocí diferenciálu odhadněte $\\sqrt{4{,}04}$ na dvě desetinná místa.",
      answer: "2,01",
      acceptedAnswers: ["2.01"],
      answerLabel: "$2{,}01$",
      hints: ["Linearizujte $f(x)=\\sqrt x$ v bodě $x=4$."],
      solutionSteps: [
        "$f(4)=2$ a $f'(4)=1/(2\\sqrt4)=1/4$.",
        "Změna argumentu je $dx=0{,}04$, tedy $df\\approx(1/4)\\cdot0{,}04=0{,}01$.",
        "Odhad je $2+0{,}01=2{,}01$.",
      ],
    },
    {
      id: "math.curves.parametric-slope",
      prompt: "Pro $x=t^2$, $y=t^3$ určete $dy/dx$ v $t=2$.",
      answer: "3",
      hints: ["Použijte podíl $y'(t)/x'(t)$."],
      solutionSteps: [
        "$x'(t)=2t$ a $y'(t)=3t^2$.",
        "Pro $t\\ne0$ je $dy/dx=3t^2/(2t)=3t/2$.",
        "Při $t=2$ je směrnice $3$.",
      ],
    },
    {
      id: "math.curves.parametric-tangent",
      prompt: "Určete tečnu ke křivce $x=t$, $y=t^2$ pro $t=1$.",
      answer: "y=2x-1",
      answerLabel: "$y=2x-1$",
      hints: ["Nejprve určete bod a směrnici."],
      solutionSteps: [
        "V $t=1$ leží bod $(1,1)$.",
        "Směrnice je $y'(1)/x'(1)=2/1=2$.",
        "Rovnice $y-1=2(x-1)$ se upraví na $y=2x-1$.",
      ],
    },
    {
      id: "math.curves.circle-radius",
      prompt: "Jaký poloměr má křivka $x=2\\cos t$, $y=2\\sin t$?",
      answer: "2",
      hints: ["Sečtěte $x^2+y^2$."],
      solutionSteps: [
        "$x^2+y^2=4\\cos^2t+4\\sin^2t$.",
        "Identita $\\cos^2t+\\sin^2t=1$ dává $x^2+y^2=4$.",
        "Jde o kružnici s poloměrem $2$.",
      ],
    },
    {
      id: "math.curves.line-point",
      prompt: "Určete bod přímky $x=1+3t$, $y=2-t$ pro $t=2$.",
      answer: "(7,0)",
      answerLabel: "$(7,0)$",
      hints: ["Dosadíte parametr do obou souřadnic."],
      solutionSteps: ["$x(2)=1+3\\cdot2=7$.", "$y(2)=2-2=0$.", "Hledaný bod je $(7,0)$."],
    },
    {
      id: "math.curves.line-length",
      prompt: "Určete délku křivky $x=t$, $y=2t$ pro $0\\le t\\le1$.",
      answer: "sqrt(5)",
      answerLabel: "$\\sqrt5$",
      hints: ["Integrujte rychlost $\\sqrt{x'(t)^2+y'(t)^2}$."],
      solutionSteps: [
        "Derivace souřadnic jsou $x'=1$ a $y'=2$.",
        "Rychlost je stále $\\sqrt{1^2+2^2}=\\sqrt5$.",
        "Délka je $\\int_0^1\\sqrt5\\,dt=\\sqrt5$.",
      ],
    },
    {
      id: "math.curves.unit-speed",
      prompt: "Určete velikost rychlosti křivky $x=\\cos t$, $y=\\sin t$ v $t=\\pi/2$.",
      answer: "1",
      hints: ["Odvoďte obě souřadnice podle $t$."],
      solutionSteps: [
        "$x'=-\\sin t$ a $y'=\\cos t$.",
        "Velikost rychlosti je $\\sqrt{\\sin^2t+\\cos^2t}$.",
        "Identita dává hodnotu $1$ i pro $t=\\pi/2$.",
      ],
    },
    {
      id: "math.curves.ellipse-point",
      prompt: "Určete bod elipsy $x=3\\cos t$, $y=2\\sin t$ pro $t=0$.",
      answer: "(3,0)",
      answerLabel: "$(3,0)$",
      hints: ["Použijte $\\cos0=1$ a $\\sin0=0$."],
      solutionSteps: ["$x(0)=3\\cos0=3$.", "$y(0)=2\\sin0=0$.", "Bod má souřadnice $(3,0)$."],
    },
    {
      id: "math.differential.partial",
      prompt: "Pro $f(x,y)=x^2y+y^3$ určete $\\frac{\\partial f}{\\partial x}$ v bodě $[1,2]$.",
      answer: "4",
      hints: ["Při derivování podle $x$ je $y$ konstanta."],
      solutionSteps: [
        "$\\frac{\\partial}{\\partial x}(x^2y)=2xy$ a $\\frac{\\partial}{\\partial x}y^3=0$.",
        "Tedy $\\frac{\\partial f}{\\partial x}=2xy$.",
        "V bodě $[1,2]$: $2\\cdot1\\cdot2=4$.",
      ],
    },
    {
      id: "math.differential.total",
      prompt:
        "Pro $f(x,y)=xy$ vypočtěte totální diferenciál $df$ v bodě $[2,3]$ při $dx=0{,}1$ a $dy=-0{,}2$.",
      answer: "-0,1",
      answerLabel: "$-0{,}1$",
      acceptedAnswers: ["-0.1", "-1/10"],
      hints: ["$df=f_x\\,dx+f_y\\,dy$."],
      solutionSteps: [
        "$f_x=y$, $f_y=x$.",
        "V bodě $[2,3]$: $df=3\\,dx+2\\,dy$.",
        "Dosadíme: $3\\cdot0{,}1+2\\cdot(-0{,}2)=0{,}3-0{,}4=-0{,}1$.",
      ],
    },
    {
      id: "math.differential.directional",
      prompt:
        "Určete směrovou derivaci funkce $f(x,y)=x^2y$ v bodě $[1,2]$ ve směru $\\mathbf u=(3,4)$.",
      answer: "16/5",
      answerLabel: "$\\frac{16}{5}$",
      acceptedAnswers: ["3,2", "3.2"],
      hints: ["Spočtěte gradient a směr znormujte.", "$\\|(3,4)\\|=5$."],
      solutionSteps: [
        "$\\nabla f=(2xy,\\,x^2)$, v bodě $[1,2]$ je $\\nabla f=(4,1)$.",
        "Jednotkový směr: $\\frac{\\mathbf u}{\\|\\mathbf u\\|}=\\left(\\frac35,\\frac45\\right)$.",
        "$\\frac{\\partial f}{\\partial\\mathbf u}=4\\cdot\\frac35+1\\cdot\\frac45=\\frac{16}{5}$.",
      ],
    },
  ],
} as const satisfies MathTopic;
