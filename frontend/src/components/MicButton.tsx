import { Mic, MicOff } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useSpeechToText } from "@/lib/use-speech-to-text";

export function MicButton({
  onTranscript,
  className = "",
}: {
  onTranscript: (transcript: string) => void;
  className?: string;
}) {
  const { lang, t } = useI18n();
  const { listening, start, stop, supported } = useSpeechToText(lang);

  if (!supported) return null;

  return (
    <button
      type="button"
      title={t("voiceInput")}
      aria-label={t("voiceInput")}
      aria-pressed={listening}
      onClick={() => (listening ? stop() : start(onTranscript))}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border-2 transition-colors ${
        listening
          ? "border-ud-navy bg-ud-green text-ud-navy"
          : "border-ud-govtblue bg-white text-ud-govtblue hover:bg-ud-govtblue hover:text-white"
      } ${className}`}
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
