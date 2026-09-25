import { PageHeader } from "@/components/page-header";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[{ label: "Nápověda", href: "/napoveda" }, { label: "Ochrana soukromí" }]}
        description="Stručné technické informace o údajích, se kterými aplikace pracuje."
        title="Ochrana soukromí"
      />

      <aside className="rounded-2xl border border-warn bg-warn-soft p-5 text-warn">
        <h2 className="font-semibold">Informace pro správce před veřejným spuštěním</h2>
        <p className="mt-2 leading-7">
          Toto technické shrnutí nenahrazuje úplné informační oznámení. Provozovatel musí před
          veřejným spuštěním doplnit svou identitu, kontaktní údaj pro uplatnění práv a pravidla
          uchovávání a výmazu dat.
        </p>
      </aside>

      <div className="mt-6 grid gap-5">
        <section aria-labelledby="privacy-account" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="privacy-account">
            Údaje účtu
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Registrovaný účet používá uživatelské jméno, ověřenou e-mailovou adresu a heslo. Server
            ukládá pouze hash hesla a hash identifikátoru přihlášení; přihlašovací cookie není
            přístupná JavaScriptu. E-mailový poskytovatel zpracuje adresu a jednorázový odkaz pro
            ověření nebo obnovu hesla.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            Host se přihlašuje bez e-mailu a může pouze prohlížet obsah. Pro ochranu přihlášení
            vznikají také časově omezené záznamy pro omezení opakovaných požadavků.
          </p>
        </section>

        <section aria-labelledby="privacy-progress" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="privacy-progress">
            Pokusy a místní data
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Synchronizované pokusy obsahují režim, identifikaci otázky a verze učiva, čas, výsledek
            a údaje potřebné pro vyhodnocení a synchronizaci. Aplikace neodesílá zadaný text
            odpovědi. Správnost hlásí klient a sama o sobě není nezávisle ověřená.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            Pokusy, vlastní kartičky, nastavení a rozpracované série mohou být uloženy v úložišti
            prohlížeče. Synchronizované pokusy se ukládají také na serveru. Reset pokroku staré
            serverové pokusy pouze vyřadí z aktivních statistik; ponechá je pro evidenci denního
            limitu. Reset proto není fyzickým výmazem osobních údajů. Samoobslužné odstranění účtu
            tato verze nenabízí.
          </p>
        </section>

        <section aria-labelledby="privacy-cookies" className="rounded-2xl border border-line p-5">
          <h2 className="text-xl font-semibold" id="privacy-cookies">
            Přihlášení a offline režim
          </h2>
          <p className="mt-2 leading-7 text-ink-2">
            Přihlášení používá zabezpečené cookies. Pro offline zobrazení si prohlížeč uchovává
            značku posledního ověřeného účtu, která obsahuje identifikátor a zobrazované údaje účtu,
            roli a poslední známou generaci pokroku; neobsahuje heslo ani přihlašovací token.
            Výukové stránky a soubory aplikace se ukládají do cache service workeru.
          </p>
          <p className="mt-2 leading-7 text-ink-2">
            V aktuální implementaci nejsou reklamní ani analytické skripty. Provozovatel serveru
            spravuje databázi, zálohy a technické provozní záznamy; jejich dobu uchovávání musí
            stanovit a zveřejnit sám.
          </p>
        </section>
      </div>
    </main>
  );
}
