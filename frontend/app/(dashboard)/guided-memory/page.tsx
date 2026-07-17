"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Mic,
  Send,
  Sparkles,
  ArrowLeft,
  BookHeart,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { handleSessionExpiry } from "@/utils/handleSessionExpiry";
import { PrivateRoute } from "@/utils/RouteProtection";

const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoryStatus = {
  progress: number;
  covered: string[];
  remaining: string[];
  ready: boolean;
  summary: string;
};

const WELCOME_MESSAGE = `Welcome to Capturing Story Gems (CSG)

This Guided Memory Experience is designed to help you rediscover meaningful memories before turning them into stories.

Begin with whatever you have:

• a finished story
• a rough draft
• a voice recording
• a single memory
• or simply a feeling you don't want to forget.

When you're ready, enter whatever you'd like to share about your memory below.`;

export default function GuidedMemory() {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasAiAssessment, setHasAiAssessment] = useState(false);
  const [storyStatus, setStoryStatus] = useState<StoryStatus>({
    progress: 0,
    covered: [],
    remaining: [],
    ready: false,
    summary:
      "Share your first memory and AI will identify what is covered and what could be explored.",
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { isRecording, recordingTime, startRecording, stopRecording } =
    useAudioRecorder();

  const hasUserShared = messages.some((m) => m.role === "user");
  const busy = isSending || isGenerating || isTranscribing;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 192)}px`;
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${serverBaseUrl}/user/story/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (handleSessionExpiry(data.message, router)) return;
        if (response.status === 402) {
          toast.error(data.message || "Please select a plan first");
          router.push("/select-plan");
          return;
        }
        toast.error(data.message || "Failed to get a response");
        return;
      }

      const reply = data?.response?.reply;
      if (reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
      if (data?.response?.status) {
        setStoryStatus(data.response.status);
        setHasAiAssessment(true);
      }
    } catch {
      toast.error("Failed to get a response");
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateStory = async () => {
    if (!hasUserShared || busy) return;
    setIsGenerating(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${serverBaseUrl}/user/story/conversation/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        if (handleSessionExpiry(data.message, router)) return;
        if (response.status === 402) {
          toast.error(data.message || "Please select a plan first");
          router.push("/select-plan");
          return;
        }
        toast.error(data.message || "Failed to create your story");
        return;
      }

      toast.success("Story created successfully!");
      router.push("/confirmation-page");
    } catch {
      toast.error("Failed to create your story");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMicToggle = async () => {
    if (isRecording) {
      try {
        const audioBlob = await stopRecording();
        setIsTranscribing(true);

        const token = localStorage.getItem("token");
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        const response = await fetch(`${serverBaseUrl}/user/story/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await response.json();
        setIsTranscribing(false);

        if (response.ok && data.response?.text) {
          const transcribedText = data.response.text.trim();
          if (transcribedText) {
            setInput((prev) => {
              const base = prev.trim();
              const space = base ? " " : "";
              return base + space + transcribedText;
            });
            toast.success("Transcription complete!");
          }
        } else {
          toast.error(data.message || "Failed to transcribe audio");
        }
      } catch (err: any) {
        setIsTranscribing(false);
        toast.error("Error transcribing audio: " + err.message);
      }
    } else {
      try {
        await startRecording();
      } catch (err: any) {
        toast.error("Could not access microphone: " + err.message);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PrivateRoute>
      <div className="min-h-screen bg-gradient-to-br from-[#F1FAEE] to-[#FFFDF9] font-[Inter] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-[#A8DADC]">
          <div className="max-w-3xl mx-auto w-full px-4 py-3 flex items-center justify-between gap-3">
            <button
              onClick={() => router.push("/landing-page")}
              className="flex items-center gap-2 text-[#457B9D] hover:text-[#1D3557] transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-[#457B9D] shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1D3557] font-[Cormorant_Garamond]">
                Guided Memory Experience
              </h1>
            </div>
            <button
              onClick={handleCreateStory}
              disabled={!hasUserShared || busy}
              className="flex items-center gap-2 bg-[#457B9D] text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-full hover:bg-[#1D3557] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              <BookHeart className="w-4 h-4" />
              <span className="hidden sm:inline">Create My Story</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Story readiness status */}
        <div className="bg-white/80 border-b border-[#A8DADC]">
          <div className="max-w-3xl mx-auto w-full px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {storyStatus.ready ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDashed className="w-4 h-4 shrink-0 text-[#457B9D]" />
                )}
                <span className="text-sm font-semibold text-[#1D3557]">
                  Story readiness
                </span>
                {isSending && (
                  <span className="text-xs text-[#5A9AAF] animate-pulse">
                    Reviewing…
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  storyStatus.ready
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#A8DADC]/40 text-[#1D3557]"
                }`}
              >
                {storyStatus.progress}% ready
              </span>
            </div>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  storyStatus.ready ? "bg-emerald-500" : "bg-[#457B9D]"
                }`}
                style={{ width: `${storyStatus.progress}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-[#5A7180]">
              {storyStatus.summary}
            </p>

            {hasAiAssessment &&
              (storyStatus.covered.length > 0 ||
                storyStatus.remaining.length > 0) && (
              <details className="mt-2 group">
                <summary className="text-xs font-semibold text-[#457B9D] cursor-pointer select-none">
                  See what&apos;s covered and what&apos;s left
                </summary>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">
                      Covered
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {storyStatus.covered.length > 0 ? (
                        storyStatus.covered.map((item) => (
                          <span
                            key={item}
                            className="text-[11px] bg-white text-emerald-700 border border-emerald-200 rounded-full px-2 py-1"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-emerald-700/70">
                          AI has not identified a covered detail yet.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2">
                      Still to explore
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {storyStatus.remaining.length > 0 ? (
                        storyStatus.remaining.map((item) => (
                          <span
                            key={item}
                            className="text-[11px] bg-white text-amber-700 border border-amber-200 rounded-full px-2 py-1"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-amber-700/70">
                          AI has not identified anything else to explore.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] whitespace-pre-wrap leading-relaxed text-sm sm:text-base rounded-2xl px-4 py-3 shadow-sm ${
                    m.role === "user"
                      ? "bg-[#457B9D] text-white rounded-br-sm"
                      : "bg-white text-[#1D3557] border border-[#A8DADC] rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white text-[#5A9AAF] border border-[#A8DADC] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#5A9AAF] animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#5A9AAF] animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#5A9AAF] animate-bounce"></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-[#A8DADC]">
          <div className="max-w-3xl mx-auto w-full px-4 py-4">
            {isRecording && (
              <div className="mb-2 text-xs text-red-700 bg-red-50/80 p-2.5 rounded-xl border border-red-200 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                  <strong>Recording...</strong> Speak your thoughts clearly.
                </span>
                <span className="font-mono font-semibold">
                  {Math.floor(recordingTime / 60)}:
                  {(recordingTime % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}

            {isTranscribing && (
              <div className="mb-2 text-xs text-blue-700 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                <span>Transcribing your memory... Please wait.</span>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isRecording}
                  placeholder="Share whatever you'd like about your memory..."
                  rows={1}
                  className="w-full min-h-12 max-h-48 resize-none overflow-y-auto p-3 pr-12 text-gray-800 bg-[#F1FAEE] border border-[#A8DADC] rounded-2xl placeholder-gray-400 text-sm leading-relaxed focus:outline-none focus:border-[#457B9D] focus:ring-4 focus:ring-[#A8DADC]/50 transition-[border-color,box-shadow] duration-200"
                />
                <button
                  onClick={handleMicToggle}
                  disabled={isTranscribing || isSending || isGenerating}
                  title="Voice input"
                  className={`absolute bottom-2.5 right-2.5 p-2 rounded-full transition duration-200 shadow ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-[#457B9D] hover:bg-[#1D3557]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Mic className="w-4 h-4 text-white" />
                </button>
              </div>

              <button
                onClick={handleSend}
                disabled={input.trim().length === 0 || busy}
                className="p-3 rounded-full bg-[#457B9D] text-white hover:bg-[#1D3557] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-2 text-center text-[11px] text-[#5A9AAF]">
              Take your time. When your memory feels ready, select{" "}
              <span className="font-semibold">Create My Story</span>.
            </p>
          </div>
        </div>

        {/* Generating overlay */}
        {isGenerating && (
          <div className="fixed flex flex-col justify-center items-center bg-[#0000007c] h-full w-full top-0 left-0 backdrop-blur-md z-50">
            <Image
              src={"/loader.svg"}
              width={100}
              height={100}
              alt="Loader"
              className="object-contain animate-spin"
            />
            <p className="text-[#F1FAEE] text-2xl font-[Cormorant_Garamond] mt-4 text-center px-6">
              Crafting something beautiful from what you&apos;ve shared…
            </p>
            <p className="text-[#F1FAEE]/80 text-sm mt-2">
              Story status: complete — preparing your refined version
            </p>
          </div>
        )}
      </div>
    </PrivateRoute>
  );
}
