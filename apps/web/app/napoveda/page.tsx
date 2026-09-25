import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8 sm:px-8">
      <Link className="inline-flex min-h-11 items-center underline" href="/">
        Zpět na úvod
      </Link>
      <header className="mt-5">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Nápověda</h1>
        <p className="mt-2 leading-7 text-ink-2">
          Stručný průvodce učením, procvičováním a ukládáním pokroku.
        </p>
      </header>

      <div className="mt-7 grid gap-5">
        <section aria-labelledby="help-learning" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="help-learning">
            Učení a procvičování
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            V části Učivo si témata procházíte bez testování. Režimy Procvičování pokládají otázky,
            vyhodnocují odpovědi a mohou nabídnout opakování chyby.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            Tabulka prvků podporuje výběr jednotlivých prvků i celých skupin. Vzorec zapisujte
            běžnými číslicemi; rovnice lze zadat také se znakem šipky →.
          </p>
        </section>

        <section aria-labelledby="help-offline" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="help-offline">
            Použití bez připojení
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Nejprve aplikaci jednou otevřete při připojení k internetu, aby se načetly výukové
            stránky. Procvičování pak můžete otevřít offline. Přihlášené účty odešlou uložené pokusy
            po obnovení připojení; synchronizaci ukazuje stav v horní navigaci.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            Host může učivo prohlížet, ale neukládá osobní pokusy ani úpravy. Přihlášení,
            registrace, změna hesla a synchronizace vyžadují připojení.
          </p>
        </section>

        <section aria-labelledby="help-progress" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="help-progress">
            Pokrok a synchronizace
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Osobní stránka Pokrok zobrazuje místní zvládnutí prvků a souhrn synchronizovaných
            výsledků. Zvládnutí vyžaduje alespoň tři odpovědi a více zohledňuje novější pokusy.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            Reset pokroku je dostupný po přihlášení a potvrzení. Vynuluje aktivní statistiky a
            místní rozpracované pokusy na zařízeních při jejich příštím připojení. Starší serverové
            události zůstávají uchované pro výpočet denního limitu nahrávání; reset není žádost o
            výmaz účtu.
          </p>
        </section>

        <section aria-labelledby="help-sources" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="help-sources">
            Zdroje a kontrola obsahu
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Příprava a výroba látek vychází z materiálu e-learningu VŠCHT; jeden nevyvážený zdrojový
            zápis je z výuky vyřazen. Názvosloví vychází z VŠCHT materiálů. Automatické kontroly
            ověřují zápis vzorců a vyvážení rovnic, odborné posouzení je samostatná kontrola.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            K datu vydání této verze je odborně zkontrolováno 118 záznamů prvků. Osm pojmenovaných
            skupin a část rovnic a názvosloví čeká na odbornou kontrolu; alternativní mnemotechnické
            pomůcky jsou příspěvky vlastníka obsahu.
          </p>
          <a
            className="mt-3 inline-flex min-h-11 items-center underline"
            href="https://e-learning.vscht.cz/echo/anorganika/PripravyVyroby/indexes/equationsIndexByProduct.html"
            rel="noreferrer"
            target="_blank"
          >
            Zdroj rovnic: e-learning VŠCHT (otevře novou kartu)
          </a>
        </section>
      </div>

      <footer className="mt-7 border-t border-line pt-4">
        <Link className="min-h-11 inline-flex items-center underline" href="/soukromi">
          Ochrana soukromí a práce s údaji
        </Link>
      </footer>
    </main>
  );
}
