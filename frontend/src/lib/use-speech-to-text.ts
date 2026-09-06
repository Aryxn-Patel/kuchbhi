import { useCallback, useEffect, useRef, useState } from "react";

import { type Lang } from "./i18n";

// Maps our app languages to BCP-47 tags the Web Speech API understands.
const RECOGNITION_LANG: Record<Lang, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Assamese: "as-IN",
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * Thin wrapper over the browser's native SpeechRecognition API.
 *
 * This is a pragmatic "voice input" implementation — it uses whatever STT
 * engine the user's browser/OS ships (Chrome routes this through Google's
 * speech service). It is NOT a custom-trained regional-accent model; for
 * production-grade accuracy on rural/regional Indian accents, swap this
 * hook's internals for a call to a dedicated service (e.g. Bhashini/ASR,
 * Google Cloud Speech-to-Text) without changing the calling components.
 */
export function useSpeechToText(lang: Lang) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError("unsupported");
        return;
      }

      setError(null);
      const recognition = new Ctor();
      recognition.lang = RECOGNITION_LANG[lang] ?? "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        onResult(transcript.trim());
      };
      recognition.onerror = () => {
        setError("error");
        setListening(false);
      };
      recognition.onend = () => setListening(false);

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [lang],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, error, start, stop, supported: isSpeechRecognitionSupported() };
}
