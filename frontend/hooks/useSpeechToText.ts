import { useEffect, useRef, useState } from "react";

interface UseSpeechToTextProps {
  onTranscriptUpdate?: (finalTranscript: string, interimTranscript: string) => void;
  onSessionEnd?: () => void;
}

export function useSpeechToText({
  onTranscriptUpdate,
  onSessionEnd,
}: UseSpeechToTextProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const restartTimeoutRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const lastProcessedIndexRef = useRef(-1);

  // Keep references of callbacks to avoid re-triggering effects
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  const onSessionEndRef = useRef(onSessionEnd);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

  const initRecognition = () => {
    // Reset processed index for the new session
    lastProcessedIndexRef.current = -1;

    // If there is an existing instance, clean it up completely
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
    }

    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      isStartingRef.current = false;
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let newlyFinalized = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          if (i > lastProcessedIndexRef.current) {
            newlyFinalized += event.results[i][0].transcript;
            lastProcessedIndexRef.current = i;
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (newlyFinalized) {
        setTranscript((prev) => {
          const space = prev && !prev.endsWith(" ") && !newlyFinalized.startsWith(" ") ? " " : "";
          const updated = prev + space + newlyFinalized;
          if (onTranscriptUpdateRef.current) {
            onTranscriptUpdateRef.current(updated, interimTranscript);
          }
          return updated;
        });
      } else {
        setTranscript((prev) => {
          if (onTranscriptUpdateRef.current) {
            onTranscriptUpdateRef.current(prev, interimTranscript);
          }
          return prev;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setError(event.error);
      isStartingRef.current = false;

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldRestartRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      isStartingRef.current = false;

      if (onSessionEndRef.current) {
        onSessionEndRef.current();
      }

      // If should restart, schedule a restart with a new instance
      if (shouldRestartRef.current) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldRestartRef.current) {
            startListeningInternal();
          }
        }, 400);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const startListeningInternal = () => {
    const recognition = initRecognition();
    if (!recognition) return;

    if (isListening || isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      isStartingRef.current = false;
    }
  };

  const startListening = (initialText: string = "") => {
    shouldRestartRef.current = true;
    setTranscript(initialText);
    startListeningInternal();
  };

  const stopListening = () => {
    shouldRestartRef.current = false;
    isStartingRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping speech recognition:", err);
      }
    }

    setIsListening(false);

    if (onSessionEndRef.current) {
      onSessionEndRef.current();
    }
  };

  // Self-healing watchdog
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) return;

    const watchdogInterval = setInterval(() => {
      if (shouldRestartRef.current && !isListening && !isStartingRef.current) {
        console.log("Watchdog: Speech recognition auto-healing...");
        startListeningInternal();
      }
    }, 2000);

    return () => {
      clearInterval(watchdogInterval);
    };
  }, [isListening]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      isStartingRef.current = false;

      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const browserSupportsSpeechRecognition = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return {
    isListening,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition,
    error,
    transcript,
  };
}
