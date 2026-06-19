"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PenTool, Mic } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { handleSessionExpiry } from "@/utils/handleSessionExpiry";
import { PrivateRoute } from "@/utils/RouteProtection";
import { toast } from "sonner";
const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

export default function ClarityQuestions() {
  const router = useRouter();
  const [story, setStory] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [activeMode, setActiveMode] = useState<"text" | "mic">("text");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    story: "",
  });

  const [isTranscribing, setIsTranscribing] = useState(false);
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  const handleMicToggle = async () => {
    if (isRecording) {
      try {
        const audioBlob = await stopRecording();
        setActiveMode("text");
        setIsTranscribing(true);

        const token = localStorage.getItem("token");
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        const response = await fetch(`${serverBaseUrl}/user/story/transcribe`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();
        setIsTranscribing(false);

        if (response.ok && data.response?.text) {
          const transcribedText = data.response.text.trim();
          if (transcribedText) {
            setStory((prev) => {
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
        setActiveMode("mic");
        await startRecording();
      } catch (err: any) {
        setActiveMode("text");
        toast.error("Could not access microphone: " + err.message);
      }
    }
  };

  useEffect(() => {
    const storedStory = sessionStorage.getItem("story");
    if (storedStory) {
      setStory(storedStory);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("story", story);
  }, [story]);



  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({
      story: "",
    });
    setDisabled(true);
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${serverBaseUrl}/user/story/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ story }),
      });
      const data = await response.json();
      if (response.ok) {
        const storyId = data.response.storyId;
        const questions = data.response.questions;
        sessionStorage.setItem("storyId", storyId);
        sessionStorage.setItem("questions", questions);
        sessionStorage.removeItem("story");
        router.push("/clarity-questions");
      } else {
        if (handleSessionExpiry(data.message, router)) return;
        if (response.status === 403) {
          const error = typeof data.error;
          if (error === "object") {
            setErrors(data.error);
          }
        } else if (response.status === 402) {
          toast.error(data.message || "Please select a plan first");
          router.push("/select-plan");
          return;
        }
        const msg = data.message || "Failed to create your story";
        toast.error(msg);
      }
    } catch {
      toast.error("Failed to create your story");
    } finally {
      setIsLoading(false);
      setDisabled(false);
    }
  };

  return (
    <PrivateRoute>
      <div className="min-h-screen bg-white flex flex-col lg:flex-row justify-between gap-6 lg:gap-10 font-[Inter] p-6 sm:p-8 lg:p-10 bg-[url('/assets/clarity-questions-bg.png')] bg-cover bg-center w-full">
        {/* Left Panel - Questions */}
        <div className="flex-1 flex flex-col justify-between order-2 lg:order-1">
          <div className="flex flex-col justify-between h-full">
            {/* Header */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#1D3557] mb-4 leading-tight font-[Cormorant_Garamond] font-bold">
              Let&apos;s explore your memory a little deeper
            </h1>
            <p className="text-[#5A9AAF] mb-8 sm:mb-10 lg:mb-12 text-lg sm:text-xl lg:text-[22px]">
              Answer these questions in your own way!
            </p>

            <div className="relative h-64 w-full">
              <div className="relative mb-6 h-full">
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  disabled={activeMode === "mic"}
                  placeholder="Once upon a time... or perhaps it was just yesterday."
                  className="w-full h-full p-4 text-gray-800 bg-[#F1FAEE] border border-[#A8DADC] rounded-xl resize-none placeholder-gray-400 text-sm leading-relaxed focus:outline-none focus:border-[#457B9D] focus:ring-4 focus:ring-[#A8DADC]/50 transition-all duration-200"
                  rows={4}
                />

                {/* Floating Buttons */}
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <button
                    onClick={() => {
                      handleMicToggle();
                    }}
                    className={`p-2 rounded-full transition duration-200 shadow-lg ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600 animate-pulse"
                        : "bg-[#457B9D] hover:bg-[#1D3557] hover:shadow-xl transform hover:scale-110"
                    }`}
                    title="Voice input"
                  >
                    <Mic className="w-4 h-4 text-white" />
                  </button>

                  <button
                    onClick={() => {
                      if (isRecording) {
                        stopRecording().catch(() => {});
                      }
                      setActiveMode("text");
                    }}
                    className={`p-2 rounded-full transition duration-200 shadow-lg ${
                      activeMode === "text"
                        ? "bg-[#1D3557]"
                        : "bg-[#457B9D] hover:bg-[#1D3557] hover:shadow-xl transform hover:scale-110"
                    }`}
                    title="Writing assistant"
                  >
                    <PenTool className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              {errors?.story && (
                <p className="joi-error-message mb-4 text-xs">
                  {errors?.story[0]}
                </p>
              )}
            </div>

            {isRecording && (
              <div className="mt-2 text-xs text-red-700 bg-red-50/80 p-3 rounded-xl border border-red-200 leading-relaxed shadow-sm transition-all duration-200 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                  <strong>Recording...</strong> Speak your thoughts clearly.
                </span>
                <span className="font-mono font-semibold">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}

            {isTranscribing && (
              <div className="mt-2 text-xs text-blue-700 bg-blue-50/80 p-3 rounded-xl border border-blue-200 leading-relaxed shadow-sm transition-all duration-200 flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                <span>Transcribing your memory with OpenAI Whisper... Please wait.</span>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-end text-[20px] items-center mt-4">
              <button
                onClick={handleContinue}
                disabled={story.trim().length === 0 || disabled}
                className="bg-[#457B9D] hover:bg-[#3A6B7F] text-white p-3 rounded-full font-medium transition-colors"
              >
                Continue your journey
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 relative order-1 lg:order-2 mb-6 sm:mb-0">
          <Image
            src={"/assets/clarity-confirmation-image.jpg"}
            width={2000}
            height={2000}
            alt="Clarity Question"
            className="w-full h-full object-cover object-right rounded-lg lg:rounded-tr-[120px]"
          />
        </div>

        {/* Loader */}
        {isLoading && (
          <div className="fixed flex flex-col justify-center items-center bg-[#0000007c] h-full w-full top-0 left-0 backdrop-blur-md z-50">
            <Image
              src={"/loader.svg"}
              width={100}
              height={100}
              alt="Loader"
              className="object-contain animate-spin"
            />
            <p className="text-[#F1FAEE] text-2xl font-[Cormorant_Garamond]">
              Crafting something beautiful from what you&apos;ve shared…
            </p>
          </div>
        )}
      </div>
    </PrivateRoute>
  );
}
