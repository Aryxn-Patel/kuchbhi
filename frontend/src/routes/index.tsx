import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Milk, Store, Shirt, UtensilsCrossed, ShoppingBag } from "lucide-react";

import { SiteLayout } from "@/components/SiteLayout";
import { MicButton } from "@/components/MicButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, translateStateName } from "@/lib/i18n";
import { findBestMatch } from "@/lib/fuzzy-match";
import { saveReport } from "@/lib/report-store";
import {
  ApiError,
  getBlocks,
  getDistricts,
  getStates,
  getVillages,
  generateReport,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Udyam Disha — Plan your rural business with confidence" },
      {
        name: "description",
        content:
          "Check your local market potential and loan eligibility before you apply for a government-backed micro-enterprise loan.",
      },
    ],
  }),
  component: IndexPage,
});

const MAX_CAPITAL = 500000;

// Pure-white fields with a strong, distinct border (contrast fix for the
// beige-on-beige inputs from the earlier design).
const FIELD_CLASS =
  "w-full rounded-[3px] border-2 border-ud-govtblue bg-white px-3 py-2 text-ud-navy disabled:cursor-not-allowed disabled:opacity-50";

const CATEGORIES = [
  { value: "Dairy", icon: Milk },
  { value: "Retail", icon: Store },
  { value: "Textiles", icon: Shirt },
  { value: "Food Processing", icon: UtensilsCrossed },
  { value: "General Store", icon: ShoppingBag },
] as const;

function IndexPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);

  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [capital, setCapital] = useState("");

  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [villagesLoading, setVillagesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [statesError, setStatesError] = useState<string | null>(null);
  const [districtError, setDistrictError] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [villageError, setVillageError] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getStates()
      .then((res) => setStates(res.states))
      .catch(() => setStatesError(t("loadFailed")));
  }, [t]);

  useEffect(() => {
    setSelectedDistrict("");
    setDistricts([]);
    setSelectedBlock("");
    setBlocks([]);
    setSelectedVillage("");
    setVillages([]);
    if (!selectedState) return;

    setDistrictsLoading(true);
    setDistrictError(null);
    getDistricts(selectedState)
      .then((res) => setDistricts(res.districts))
      .catch(() => setDistrictError(t("loadFailed")))
      .finally(() => setDistrictsLoading(false));
  }, [selectedState, t]);

  useEffect(() => {
    setSelectedBlock("");
    setBlocks([]);
    setSelectedVillage("");
    setVillages([]);
    if (!selectedState || !selectedDistrict) return;

    setBlocksLoading(true);
    setBlockError(null);
    getBlocks(selectedState, selectedDistrict)
      .then((res) => setBlocks(res.blocks))
      .catch(() => setBlockError(t("loadFailed")))
      .finally(() => setBlocksLoading(false));
  }, [selectedState, selectedDistrict, t]);

  useEffect(() => {
    setSelectedVillage("");
    setVillages([]);
    if (!selectedState || !selectedDistrict || !selectedBlock) return;

    setVillagesLoading(true);
    setVillageError(null);
    getVillages(selectedState, selectedDistrict, selectedBlock)
      .then((res) => setVillages(res.villages))
      .catch(() => setVillageError(t("loadFailed")))
      .finally(() => setVillagesLoading(false));
  }, [selectedState, selectedDistrict, selectedBlock, t]);

  function handleCapitalChange(value: string) {
    setCapital(value);
    const numeric = Number(value);
    setCapitalError(value && numeric > MAX_CAPITAL ? t("maxCapitalError") : null);
  }

  function handleVillageVoice(transcript: string) {
    setVoiceNote(null);
    if (!villages.length) {
      setVoiceNote(t("selectBlock"));
      return;
    }
    const best = findBestMatch(transcript, villages, 0.45);
    if (best) {
      setSelectedVillage(best.match);
    } else {
      setVoiceNote(t("voiceNoMatch"));
    }
  }

  function handleCategoryVoice(transcript: string) {
    setVoiceNote(null);
    const labels = CATEGORIES.map((c) => t(c.value));
    const best = findBestMatch(transcript, [...labels, ...CATEGORIES.map((c) => c.value)], 0.45);
    if (best) {
      const idx = labels.indexOf(best.match);
      const value = idx >= 0 ? CATEGORIES[idx]!.value : best.match;
      const matched = CATEGORIES.find((c) => c.value === value);
      if (matched) setSelectedCategory(matched.value);
      else setVoiceNote(t("voiceNoMatch"));
    } else {
      setVoiceNote(t("voiceNoMatch"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const numericCapital = Number(capital);

    if (
      !selectedState ||
      !selectedDistrict ||
      !selectedBlock ||
      !selectedVillage ||
      !selectedCategory ||
      !capital
    ) {
      setFormError(t("required"));
      return;
    }
    if (numericCapital <= 0 || numericCapital > MAX_CAPITAL) {
      setFormError(t("maxCapitalError"));
      return;
    }

    const request = {
      state_name: selectedState,
      district_name: selectedDistrict,
      subdistrict_name: selectedBlock,
      village_name: selectedVillage,
      business_category: selectedCategory,
      available_capital: numericCapital,
      language: lang,
    };

    setSubmitting(true);
    try {
      const response = await generateReport(request);
      saveReport({ request, response });
      navigate({ to: "/report" });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 500 || err.status === 503)) {
        setFormError(t("aiBusy"));
      } else if (err instanceof ApiError) {
        setFormError(err.detail);
      } else {
        setFormError(t("aiBusy"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SiteLayout>
      <div className="border-2 border-ud-navy bg-ud-tan/30 p-6">
        <p className="text-xs font-bold tracking-[0.2em] text-ud-navy uppercase">
          {t("tagline")}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ud-navy sm:text-3xl">{t("heroTitle")}</h1>
        <p className="mt-2 max-w-2xl text-base text-ud-navy">{t("heroSub")}</p>
      </div>

      <div className="mt-4 flex items-start gap-3 border border-ud-govtblue bg-white p-4 text-sm text-ud-navy">
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-ud-govtblue" />
        <p>{t("notice")}</p>
      </div>

      {formError && (
        <div className="mt-4 border-2 border-destructive bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {formError}
        </div>
      )}
      {voiceNote && (
        <div className="mt-4 border border-ud-govtblue bg-white p-3 text-sm text-ud-navy">
          {voiceNote}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="border border-ud-govtblue bg-white p-5">
          <h2 className="text-lg font-bold text-ud-navy">{t("locationDetails")}</h2>
          <p className="mt-1 text-sm text-ud-navy/70">{t("locationDetailsSub")}</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-ud-navy">
                {t("state")} *
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{t("selectState")}</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {translateStateName(s, lang)}
                  </option>
                ))}
              </select>
              {statesError && <p className="mt-1 text-sm text-destructive">{statesError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-ud-navy">
                {t("district")} *
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedState || districtsLoading}
                className={FIELD_CLASS}
              >
                <option value="">{districtsLoading ? t("loading") : t("selectDistrict")}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {districtError && <p className="mt-1 text-sm text-destructive">{districtError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-ud-navy">
                {t("block")} *
              </label>
              <select
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                disabled={!selectedDistrict || blocksLoading}
                className={FIELD_CLASS}
              >
                <option value="">{blocksLoading ? t("loading") : t("selectBlock")}</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {blockError && <p className="mt-1 text-sm text-destructive">{blockError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-ud-navy">
                {t("village")} *
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  disabled={!selectedBlock || villagesLoading}
                  className={FIELD_CLASS}
                >
                  <option value="">{villagesLoading ? t("loading") : t("selectVillage")}</option>
                  {villages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <MicButton onTranscript={handleVillageVoice} />
              </div>
              {villageError && <p className="mt-1 text-sm text-destructive">{villageError}</p>}
            </div>
          </div>
        </section>

        <section className="border border-ud-govtblue bg-white p-5">
          <h2 className="text-lg font-bold text-ud-navy">{t("businessDetails")}</h2>
          <p className="mt-1 text-sm text-ud-navy/70">{t("businessDetailsSub")}</p>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-ud-navy">{t("category")} *</label>
              <MicButton onTranscript={handleCategoryVoice} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map(({ value, icon: Icon }) => {
                const active = selectedCategory === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setSelectedCategory(value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 border-[3px] px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-ud-navy bg-ud-green text-ud-navy ring-2 ring-ud-navy ring-offset-2 ring-offset-ud-bg"
                        : "border-ud-govtblue/40 bg-white text-ud-navy hover:border-ud-govtblue"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {t(value)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-sm font-semibold text-ud-navy">
              {t("capital")} *
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ud-navy">
                ₹
              </span>
              <Input
                type="number"
                value={capital}
                onChange={(e) => handleCapitalChange(e.target.value)}
                max={MAX_CAPITAL}
                placeholder="e.g. 100000"
                className="border-2 border-ud-govtblue bg-white pl-7 text-ud-navy"
              />
            </div>
            <p className="mt-1 text-sm text-ud-navy/70">
              {t("maxCapital")} ₹{MAX_CAPITAL.toLocaleString("en-IN")}
            </p>
            {capitalError && <p className="mt-1 text-sm text-destructive">{capitalError}</p>}
          </div>
        </section>

        <div className="flex flex-col items-start gap-4 border-t-2 border-ud-govtblue pt-5 md:col-span-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ud-navy">{t("footerNote")}</p>
          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full bg-ud-govtblue text-white hover:bg-ud-govtblue/90 md:w-auto"
          >
            {submitting ? t("generating") : t("submit")}
          </Button>
        </div>
        {submitting && <p className="text-sm text-ud-navy/70 md:col-span-2">{t("patience")}</p>}
      </form>
    </SiteLayout>
  );
}