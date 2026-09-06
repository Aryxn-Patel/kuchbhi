import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface MicButtonProps {
  onTranscript: (transcript: string) => void;
}

const LANG_CODE: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Assamese: "as-IN",
};

export function MicButton({ onTranscript }: MicButtonProps) {
  const { lang } = useI18n();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [onTranscript]);

  function handleClick() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.lang = LANG_CODE[lang] ?? "en-IN";

    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 transition-colors ${
        listening
          ? "border-ud-navy bg-ud-green text-ud-navy"
          : "border-ud-govtblue bg-white text-ud-govtblue hover:bg-ud-govtblue/10"
      }`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}