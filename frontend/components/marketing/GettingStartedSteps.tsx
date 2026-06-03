"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { MarketingStep } from "@/api/marketingPageApis";
import LinkifiedText from "./LinkifiedText";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

function CopyMemoryBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.error("Could not copy text");
      return;
    }
    setCopied(true);
    toast.success("Memory copied to clipboard");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-[#EEF5F7] rounded-xl p-5 pr-14">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy memory text"}
        title={copied ? "Copied" : "Copy to clipboard"}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#76AEC3]/30 bg-white text-[#457B9D] shadow-sm transition-colors hover:bg-[#EEF5F7] hover:border-[#76AEC3]/50 focus:outline-none focus:ring-2 focus:ring-[#76AEC3]/40"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
        <LinkifiedText text={text} className="whitespace-pre-line" />
      </p>
    </div>
  );
}

const defaultSteps: MarketingStep[] = [
  {
    number: "1",
    label: "Step 1 of 7",
    title: "Begin Practice Story 1",
    points: [
      "Click \"Give it a Try\"",
      "The \"Share Your Story\" text box will pop up.",
      "You will be asked to copy and then paste the \"example\" memory narrative into the box.",
    ],
  },
  {
    number: "2",
    label: "Step 2 of 7",
    title: "Copy \"Example\" Memory",
    points: [
      "Below is the \"example\" memory we created for your first practice story.",
      "Click the button to copy it.",
    ],
    copyBlockText:
      "One morning, I was sitting quietly when I heard small footsteps in the hallway. My granddaughter Emma, only three years old, appeared at the doorway holding her favorite stuffed bunny. She walked over to me slowly, climbed onto my lap without saying a word, and nestled against my chest. We sat together in the gentle morning light streaming through the window. After a few moments of silence, she looked up at me with her bright blue eyes and whispered, \"I love you, Grandma.\" Then she hopped down and ran back to play, leaving me with the warmth of that simple, perfect moment that I'll treasure forever.",
  },
  {
    number: "3",
    label: "Step 3 of 7",
    title: "Enter Sample Memory into Text Box",
    points: [
      "Paste the copied memory into the \"Share Your Story\" box. The memory will be analyzed for clarity questions.",
      "Wait about a minute while your memory narrative is analyzed.",
    ],
  },
];

const GettingStartedSteps = ({
  content,
}: {
  content?: { title?: string; subtitle?: string; steps?: MarketingStep[] };
}) => {
  const steps = content?.steps?.length ? content.steps : defaultSteps;
  return (
    // Outer background to match the subtle off-white context
    <div className="w-full bg-[#F4F3EE] py-10 md:py-12 px-5 sm:px-8 font-sans flex justify-center">
      {/* Main White Card Container */}
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-10">
        {/* Header Section */}
        <div className="mb-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#2E2E2E] mb-2 tracking-tight leading-[1.15] whitespace-pre-line">
            <LinkifiedText
              text={content?.title ?? "Getting Started"}
              className="whitespace-pre-line"
            />
          </h2>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed whitespace-pre-line">
            <LinkifiedText
              text={
                content?.subtitle ??
                "Set up your first practice story with our example memory"
              }
              className="whitespace-pre-line"
            />
          </p>
        </div>

        {/* Steps Container */}
        <div className="space-y-10">
          {steps.map((step, idx) => (
            <div key={`${step.number}-${idx}`} className="flex gap-5 sm:gap-6">
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#76AEC3] text-white flex items-center justify-center font-bold text-sm mt-1">
                {step.number}
              </div>
              <div className="flex-1">
                <span className="block text-[#76AEC3] text-[11px] font-semibold tracking-[0.2em] uppercase mb-2 whitespace-pre-line">
                  <LinkifiedText text={step.label} className="whitespace-pre-line" />
                </span>
                <h3 className="font-serif text-xl font-medium text-[#2E2E2E] mb-3 leading-tight whitespace-pre-line">
                  <LinkifiedText text={step.title} className="whitespace-pre-line" />
                </h3>
                <div className="text-gray-600 text-sm md:text-base space-y-2 leading-relaxed mb-4">
                  
                  {step.points?.map((point, pointIdx) => (
                    <p key={pointIdx}>
                      <LinkifiedText text={point} className="whitespace-pre-line" />
                    </p>
                  ))}
                </div>
                {step.copyBlockText ? (
                  <CopyMemoryBlock text={step.copyBlockText} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GettingStartedSteps;
