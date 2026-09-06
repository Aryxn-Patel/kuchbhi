import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Pencil, AlertTriangle } from "lucide-react";

import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { loadReport, saveReport, formatNum, formatINR, type StoredReport } from "@/lib/report-store";
import { generateReport, type SWOT } from "@/lib/api";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Feasibility Report — Udyam Disha" },
      {
        name: "description",
        content: "Market snapshot, SWOT analysis, and pricing suggestion for your rural business idea.",
      },
    ],
  }),
  component: ReportPage,
});

function normalizeSwot(raw: unknown): SWOT {
  const empty: SWOT = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  if (!raw) return empty;

  let parsed: any = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return empty;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return empty;

  const lowerKeyMap: Record<string, unknown> = {};
  for (const key of Object.keys(parsed)) {
    lowerKeyMap[key.toLowerCase()] = parsed[key];
  }

  function toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
    if (typeof value === "string" && value.trim().length > 0) return [value];
    return [];
  }

  return {
    strengths: toArray(lowerKeyMap["strengths"]),
    weaknesses: toArray(lowerKeyMap["weaknesses"]),
    opportunities: toArray(lowerKeyMap["opportunities"]),
    threats: toArray(lowerKeyMap["threats"]),
  };
}

function InfrastructureBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div className="mb-1 flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded ${i <= clamped ? "bg-ud-govtblue" : "bg-ud-govtblue/25"}`}
        />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  explain,
}: {
  label: string;
  value: string;
  explain?: string;
}) {
  return (
    <div className="border border-ud-govtblue bg-white p-4">
      <p className="text-sm font-semibold tracking-wide text-ud-navy/70 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ud-navy">{value}</p>
      {explain && <p className="mt-1 text-xs text-ud-navy/70">{explain}</p>}
    </div>
  );
}

function ReportPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<StoredReport | null>(null);
  const [ready, setReady] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Initial load from whatever was cached when the form was submitted.
  useEffect(() => {
    setData(loadReport());
    setReady(true);
  }, []);

  // The AI-generated content (SWOT, pricing text) is written in whichever
  // language was selected at submit time and does not translate itself —
  // only the static UI labels do. So if the user switches languages after
  // arriving here, re-fetch the report in the new language and refresh the cache.
  useEffect(() => {
    if (!ready || !data) return;
    if (data.request.language === lang) return;

    let cancelled = false;
    setRegenerating(true);

    const updatedRequest = { ...data.request, language: lang };
    generateReport(updatedRequest)
      .then((response) => {
        if (cancelled) return;
        const updated: StoredReport = { request: updatedRequest, response };
        saveReport(updated);
        setData(updated);
      })
      .catch((err) => {
        // Keep showing the previous-language report rather than losing it.
        console.error("Failed to regenerate report in new language", err);
      })
      .finally(() => {
        if (!cancelled) setRegenerating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ready]);

  if (!ready) return <SiteLayout>{null}</SiteLayout>;

  if (!data) {
    return (
      <SiteLayout>
        <div className="border border-ud-govtblue bg-white p-6">
          <p className="text-base font-semibold text-ud-navy">{t("noData")}</p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-[3px] border-2 border-ud-navy bg-ud-govtblue px-4 py-2 font-bold text-white"
          >
            {t("back")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const { response } = data;
  const metrics = response.market_metrics;
  const schemes = response.applicable_schemes ?? [];
  const plan = response.financial_plan;
  const schedule = plan?.emi_schedule ?? [];
  const isReportMissing = response.business_report === null || response.business_report === undefined;
  const swot = isReportMissing ? null : normalizeSwot(response.business_report?.swot);

  const swotBlocks: [string, string[]][] = isReportMissing
    ? []
    : [
        [t("strengths"), swot!.strengths],
        [t("weaknesses"), swot!.weaknesses],
        [t("opportunities"), swot!.opportunities],
        [t("threats"), swot!.threats],
      ];

  const exampleKey = `example_${response.business_category}`;
  const example = t(exampleKey);
  const hasExample = example !== exampleKey;

  return (
    <SiteLayout>
      <div className="no-print mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-[3px] border-2 border-ud-navy bg-white px-4 py-2 font-bold text-ud-navy hover:bg-ud-tan/20"
        >
          <Pencil className="h-4 w-4" />
          {t("editDetails")}
        </Link>
      </div>

      <div className="border border-ud-govtblue bg-ud-tan/30 p-5">
        <h1 className="text-2xl font-bold text-ud-navy sm:text-3xl">{t("reportTitle")}</h1>
        <p className="mt-1 text-base text-ud-navy capitalize">
          {response.location} · {response.business_category}
        </p>
        {regenerating && (
          <p className="mt-2 text-sm font-semibold text-ud-govtblue">{t("regeneratingReport")}</p>
        )}
      </div>

      {!response.capital_advisory.is_sufficient && (
        <section className="mt-4 border-2 border-red-600 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
            <div>
              <p className="font-bold text-red-800">{t("capitalTooLowTitle")}</p>
              <p className="mt-1 text-sm text-red-800">
                {t("capitalTooLowBody")
                  .replace("{minCapital}", formatINR(response.capital_advisory.category_min_capital))
                  .replace("{category}", response.business_category)}
              </p>
              {response.capital_advisory.viable_categories.length > 0 ? (
                <p className="mt-2 text-sm text-red-800">
                  <span className="font-semibold">{t("capitalTooLowViable")}: </span>
                  {response.capital_advisory.viable_categories.map((c) => t(c)).join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-sm text-red-800">{t("capitalTooLowNoneViable")}</p>
              )}
              <Link
                to="/"
                className="mt-3 inline-block rounded-[3px] border-2 border-red-700 bg-white px-4 py-1.5 text-sm font-bold text-red-700"
              >
                {t("editDetails")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-bold text-ud-navy">{t("marketSnapshot")}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Stat label={t("population")} value={formatNum(metrics.total_population, 0)} />
          <Stat label={t("marketDensity")} value={`${formatNum(metrics.market_density)} / sq km`} />
          <Stat
            label={t("saturation")}
            value={formatNum(metrics.business_saturation_index)}
            explain={t("saturationExplain")}
          />
          <Stat
            label={t("wealth")}
            value={formatINR(metrics.true_disposable_wealth)}
            explain={t("wealthExplain")}
          />
          <div className="border border-ud-govtblue bg-white p-4">
            <p className="text-sm font-semibold tracking-wide text-ud-navy/70 uppercase">
              {t("infra")}
            </p>
            <div className="mt-2">
              <InfrastructureBar score={metrics.infrastructure_readiness_score} />
              <p className="text-sm text-ud-navy">
                {metrics.infrastructure_readiness_score.toFixed(1)} / 5
              </p>
            </div>
          </div>
          <Stat label={t("economy")} value={formatNum(metrics.economy_type_ratio, 3)} />
        </div>
      </section>

      {schemes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-ud-navy">{t("schemesTitle")}</h2>
          <p className="mt-1 text-sm text-ud-navy/70">{t("schemesSub")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {schemes.map((scheme) => {
              const nameKey = `scheme_${scheme.id}_name`;
              const descKey = `scheme_${scheme.id}_desc`;
              const localizedName = t(nameKey);
              const localizedDesc = t(descKey);
              return (
                <div key={scheme.id} className="border-2 border-ud-green bg-white p-4">
                  <div className="flex items-start gap-2">
                    <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ud-govtblue" />
                    <div>
                      <p className="font-bold text-ud-navy">
                        {localizedName !== nameKey ? localizedName : scheme.name}
                      </p>
                      <p className="mt-1 text-sm text-ud-navy/80">
                        {localizedDesc !== descKey ? localizedDesc : scheme.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isReportMissing ? (
        <section className="mt-6 border border-ud-govtblue bg-white p-5">
          <p className="text-base text-ud-navy">{t("advisoryUnavailable")}</p>
        </section>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-bold text-ud-navy">{t("swot")}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {swotBlocks.map(([label, items]) => (
                <div key={label} className="border border-ud-govtblue">
                  <div className="bg-ud-navy px-4 py-2 font-bold text-white">{label}</div>
                  <div className="bg-white p-4">
                    {items.length > 0 ? (
                      <ul className="list-inside list-disc space-y-1 text-sm text-ud-navy">
                        {items.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ud-navy/70 italic">No data available</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-ud-navy">{t("pricing")}</h2>
            <div className="mt-3 border border-ud-govtblue bg-white">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex-1 text-sm text-ud-navy">
                  {response.business_report?.pricing_suggestion}
                </p>
                <div className="shrink-0 border-2 border-ud-govtblue bg-ud-govtblue/10 px-5 py-3 text-right">
                  <p className="text-xs font-bold tracking-wide text-ud-navy/70 uppercase">
                    {t("valueEstimate")}
                  </p>
                  <p className="text-2xl font-bold text-ud-navy whitespace-nowrap">
                    {response.business_report?.pricing_value_estimate}
                  </p>
                </div>
              </div>
              {hasExample && (
                <div className="border-t border-ud-govtblue bg-ud-tan/20 px-5 py-2">
                  <p className="text-xs font-semibold text-ud-navy/80">{example}</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-bold text-ud-navy">{t("roadmapTitle")}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Stat label={t("projectCost")} value={formatINR(plan?.project_cost)} />
          <Stat label={t("loanAmount")} value={formatINR(plan?.loan_amount)} />
          <Stat label={t("ownCapital")} value={formatINR(data.request.available_capital)} />
        </div>

        <div className="mt-4 border-2 border-ud-navy bg-white">
          <h3 className="border-b-2 border-ud-navy bg-ud-tan/30 px-4 py-2 text-center text-sm font-bold tracking-[0.2em] text-ud-navy uppercase">
            {t("scheme")}
          </h3>
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-ud-navy">{plan?.scheme_name ?? "—"}</p>
            <dl className="mt-4 grid gap-3 text-base text-ud-navy sm:grid-cols-3">
              <div className="border border-ud-govtblue p-3">
                <dt className="text-sm text-ud-navy/70 uppercase">{t("interest")}</dt>
                <dd className="font-bold">
                  {plan ? (plan.interest_rate_annual * 100).toFixed(2) + "%" : "—"}
                </dd>
              </div>
              <div className="border border-ud-govtblue p-3">
                <dt className="text-sm text-ud-navy/70 uppercase">{t("tenure")}</dt>
                <dd className="font-bold">
                  {plan?.tenure_years} {t("years")}
                </dd>
              </div>
              <div className="border border-ud-govtblue p-3">
                <dt className="text-sm text-ud-navy/70 uppercase">{t("moratorium")}</dt>
                <dd className="font-bold">
                  {plan?.moratorium_months} {t("months")}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-4 border border-ud-govtblue bg-white">
          <h3 className="border-b border-ud-govtblue bg-ud-govtblue px-4 py-2.5 text-lg font-bold text-white">
            {t("emiSchedule")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="bg-ud-tan/30 text-left text-ud-navy">
                  <th className="border border-ud-govtblue px-3 py-2">{t("quarter")}</th>
                  <th className="border border-ud-govtblue px-3 py-2">{t("emi")}</th>
                  <th className="border border-ud-govtblue px-3 py-2">{t("interestComp")}</th>
                  <th className="border border-ud-govtblue px-3 py-2">{t("principalComp")}</th>
                  <th className="border border-ud-govtblue px-3 py-2">{t("closing")}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, i) => (
                  <tr key={row.quarter} className={i % 2 ? "bg-ud-tan/10" : "bg-white"}>
                    <td className="border border-ud-govtblue px-3 py-2 text-ud-navy">{row.quarter}</td>
                    <td className="border border-ud-govtblue px-3 py-2 text-ud-navy">
                      {formatINR(row.emi)}
                    </td>
                    <td className="border border-ud-govtblue px-3 py-2 text-ud-navy">
                      {formatINR(row.interest_component)}
                    </td>
                    <td className="border border-ud-govtblue px-3 py-2 text-ud-navy">
                      {formatINR(row.principal_component)}
                    </td>
                    <td className="border border-ud-govtblue px-3 py-2 text-ud-navy">
                      {formatINR(row.closing_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="no-print mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[3px] border-2 border-ud-navy bg-ud-govtblue px-5 py-2.5 text-base font-bold text-white"
        >
          {t("print")}
        </button>
      </div>
    </SiteLayout>
  );
}