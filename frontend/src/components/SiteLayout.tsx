import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import type { ReactNode } from "react";

import { LANGS, useI18n, type Lang } from "@/lib/i18n";

function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="flex items-center gap-2 rounded-md border-2 border-white bg-ud-navy px-3 py-2">
      <Globe className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="cursor-pointer rounded-[3px] border-none bg-transparent text-base font-bold text-white focus:outline-none"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="text-ud-navy">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-ud-bg">
      <div className="no-print h-1.5 w-full bg-ud-govtblue" />
      <header className="no-print border-b-2 border-ud-govtblue bg-ud-navy">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-white text-lg font-bold text-white">
              UD
            </span>
            <span>
              <span className="block text-xl leading-tight font-bold tracking-tight text-white">
                {t("brand")}
              </span>
              <span className="block text-xs text-ud-tan">{t("tagline")}</span>
            </span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      {/* Footer intentionally has no Terms/Privacy/Contact links per product requirements. */}
      <footer className="no-print border-t-2 border-ud-govtblue bg-ud-navy px-4 py-6 text-ud-tan">
        <div className="mx-auto max-w-5xl space-y-1 text-sm">
          <p className="font-bold text-white">{t("brand")}</p>
          <p>{t("footerMission")}</p>
        </div>
      </footer>
    </div>
  );
}
