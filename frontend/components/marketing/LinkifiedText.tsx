import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/;

function toHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function splitTrailingPunctuation(value: string) {
  const match = value.match(TRAILING_PUNCTUATION_REGEX);
  if (!match) return { clean: value, trailing: "" };
  const trailing = match[0];
  return {
    clean: value.slice(0, -trailing.length),
    trailing,
  };
}

function renderMultilineText(text: string, keyPrefix: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => (
    <React.Fragment key={`${keyPrefix}-line-${lineIdx}`}>
      {line}
      {lineIdx < lines.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}

export default function LinkifiedText({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (!part) return null;
        const isUrl = /^(https?:\/\/|www\.)/i.test(part);

        if (!isUrl) {
          return (
            <React.Fragment key={`text-${idx}`}>
              {renderMultilineText(part, `text-${idx}`)}
            </React.Fragment>
          );
        }

        const { clean, trailing } = splitTrailingPunctuation(part);
        const href = toHref(clean);

        return (
          <React.Fragment key={`url-${idx}`}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-medium underline decoration-blue-600 underline-offset-2 break-words hover:text-blue-700"
            >
              {clean}
            </a>
            {trailing}
          </React.Fragment>
        );
      })}
    </span>
  );
}
