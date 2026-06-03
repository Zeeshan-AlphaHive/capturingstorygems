"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Footer from "@/components/Footer";
import { getInvitationPagePublic } from "@/api/invitationPageApis";
import { normalizeInvitationHtml } from "@/utils/invitationHtml";
import "react-quill-new/dist/quill.snow.css";

function enhanceLinks(container: HTMLElement | null) {
  if (!container) return;
  container.querySelectorAll("a").forEach((anchor) => {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
}

export default function InvitationPage() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getInvitationPagePublic();
        if (cancelled) return;
        setTitle(data.title || "");
        setHtml(normalizeInvitationHtml(data.html || ""));
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load invitation page";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && html) {
      enhanceLinks(contentRef.current);
    }
  }, [loading, html]);

  const displayTitle = title.trim() || "Invitation";

  return (
    <div className="min-h-screen flex flex-col min-w-0 w-full bg-gradient-to-br from-[#FAF9F6] to-[#F1FAEE]">
      <div className="relative w-full py-6 sm:py-8 bg-gradient-to-r from-[#457B9D] to-[#375E73]">
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-4 left-6 w-20 h-20 bg-white rounded-full blur-2xl" />
          <div className="absolute bottom-4 right-6 w-24 h-24 bg-white rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 text-white text-center px-4 sm:px-6">
          <div className="flex justify-center mb-2">
            <Image
              src="/leaf-1.svg"
              width={36}
              height={36}
              alt=""
              aria-hidden
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-[Cormorant_Garamond] font-bold mb-1 max-w-full break-normal px-2 leading-tight">
            {loading ? "Loading..." : displayTitle}
          </h1>
          <p className="text-sm sm:text-base opacity-90">
            Capturing Story Gems
          </p>
        </div>
      </div>

      <main className="flex-1 w-full max-w-none px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-5 pb-10 sm:pb-12 min-w-0">
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-6 py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#457B9D] border-t-transparent" />
            <p className="text-gray-500 text-sm mt-4">Loading invitation...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center shadow-sm">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <article className="w-full min-w-0 bg-white rounded-xl sm:rounded-2xl shadow-[0_8px_32px_rgba(29,53,87,0.1)] border border-gray-100 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#A8DADC] via-[#457B9D] to-[#1D3557]" />

            <div className="px-5 sm:px-8 lg:px-12 py-8 sm:py-10 min-w-0 w-full overflow-x-hidden">
              {html ? (
                <div className="ql-snow invitation-quill-view w-full max-w-full min-w-0 overflow-x-hidden">
                  <div
                    ref={contentRef}
                    className="ql-editor"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">
                  No invitation content has been published yet.
                </p>
              )}
            </div>
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}
