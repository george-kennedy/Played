"use client";

import { useState } from "react";
import { enableShare } from "@/app/actions";

export function ShareProgress({
  verified,
  label,
  copiedLabel,
  verifyHref,
  verifyLabel,
}: {
  verified: boolean;
  label: string;
  copiedLabel: string;
  verifyHref: string;
  verifyLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!verified) {
    return (
      <a className="button secondary" href={verifyHref}>
        {verifyLabel}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => {
        void enableShare()
          .then(async ({ url }) => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          })
          .catch(() => setCopied(false));
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
