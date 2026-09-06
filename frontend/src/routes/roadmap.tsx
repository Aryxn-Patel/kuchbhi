import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SiteLayout } from "@/components/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { formatINR, loadReport, type StoredReport } from "@/lib/report-store";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Financial Roadmap — Udyam Disha" },
      {
        name: "description",
        content:
          "Project cost, loan amount, scheme terms and a quarterly EMI repayment schedule for your rural micro-enterprise plan.",
      },
      { property: "og:title", content: "Financial Roadmap — Udyam Disha" },
      {
        property: "og:description",
        content: "Scheme terms and full quarterly repayment schedule, ready to print.",
      },
    ],
  }),
  component: RoadmapPage,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ud-gold bg-ud-cream p-4">
      <p className="text-sm font-semibold tracking-wide text-ud-ochre uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ud-brown">{value}</p>
    </div>
  );
}

function RoadmapPage() {
  const { t } = useI18n();
  const [data, setData] = useState<StoredReport | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadReport());
    setReady(true);
  }, []);

  if (!ready) return <SiteLayout>{null}</SiteLayout>;

  if (!data) {
    return (
      <SiteLayout>
        <div className="border border-ud-gold bg-ud-sand p-6">
          <p className="text-base font-semibold text-ud-brown">{t("noData")}</p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-[3px] border border-ud-brown bg-ud-ochre px-4 py-2 font-bold text-ud-cream"
          >
            {t("back")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const plan = data.response.financial_plan;
  const schedule = plan?.emi_schedule ?? [];

  return (
    <SiteLayout>
      <div className="border border-ud-gold bg-ud-sand p-5">
        <h1 className="text-2xl font-bold text-ud-brown sm:text-3xl">{t("roadmapTitle")}</h1>
        <p className="mt-1 text-base text-ud-brown capitalize">{data.response.location}</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("projectCost")} value={formatINR(plan?.project_cost)} />
        <Stat label={t("loanAmount")} value={formatINR(plan?.loan_amount)} />
        <Stat label={t("ownCapital")} value={formatINR(data.request.available_capital)} />
      </div>

      <section className="mt-6 border-2 border-ud-brown bg-ud-cream">
        <h2 className="border-b-2 border-ud-brown bg-ud-sand px-4 py-2 text-center text-sm font-bold tracking-[0.2em] text-ud-brown uppercase">
          {t("scheme")}
        </h2>
        <div className="p-5 text-center">
          <p className="text-2xl font-bold text-ud-brown">{plan?.scheme_name ?? "—"}</p>
          <dl className="mt-4 grid gap-3 text-base text-ud-brown sm:grid-cols-3">
            <div className="border border-ud-gold p-3">
              <dt className="text-sm text-ud-ochre uppercase">{t("interest")}</dt>
              <dd className="font-bold">
                {plan ? (plan.interest_rate_annual * 100).toFixed(2) + "%" : "—"}
              </dd>
            </div>
            <div className="border border-ud-gold p-3">
              <dt className="text-sm text-ud-ochre uppercase">{t("tenure")}</dt>
              <dd className="font-bold">
                {plan?.tenure_years} {t("years")}
              </dd>
            </div>
            <div className="border border-ud-gold p-3">
              <dt className="text-sm text-ud-ochre uppercase">{t("moratorium")}</dt>
              <dd className="font-bold">
                {plan?.moratorium_months} {t("months")}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 border border-ud-gold bg-white">
        <h2 className="border-b border-ud-gold bg-ud-ochre px-4 py-2.5 text-lg font-bold text-ud-cream">
          {t("emiSchedule")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="bg-ud-sand text-left text-ud-brown">
                <th className="border border-ud-gold px-3 py-2">{t("quarter")}</th>
                <th className="border border-ud-gold px-3 py-2">{t("emi")}</th>
                <th className="border border-ud-gold px-3 py-2">{t("interestComp")}</th>
                <th className="border border-ud-gold px-3 py-2">{t("principalComp")}</th>
                <th className="border border-ud-gold px-3 py-2">{t("closing")}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, i) => (
                <tr key={row.quarter} className={i % 2 ? "bg-ud-cream" : "bg-white"}>
                  <td className="border border-ud-gold px-3 py-2 text-ud-brown">{row.quarter}</td>
                  <td className="border border-ud-gold px-3 py-2 text-ud-brown">
                    {formatINR(row.emi)}
                  </td>
                  <td className="border border-ud-gold px-3 py-2 text-ud-brown">
                    {formatINR(row.interest_component)}
                  </td>
                  <td className="border border-ud-gold px-3 py-2 text-ud-brown">
                    {formatINR(row.principal_component)}
                  </td>
                  <td className="border border-ud-gold px-3 py-2 text-ud-brown">
                    {formatINR(row.closing_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="no-print mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-[3px] border border-ud-brown bg-ud-ochre px-5 py-2.5 text-base font-bold text-ud-cream"
        >
          {t("print")}
        </button>
        <Link
          to="/report"
          className="rounded-[3px] border border-ud-ochre bg-ud-cream px-5 py-2.5 text-base font-bold text-ud-brown"
        >
          {t("backReport")}
        </Link>
      </div>
    </SiteLayout>
  );
}
