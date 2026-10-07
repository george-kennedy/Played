"use client";

import { useEffect, useId, useRef, useState } from "react";
import { enableShare } from "@/app/actions";

type ShareUrls = {
  url: string;
  cardUrl: string;
  storyUrl: string;
};

export function ShareProgress({
  verified,
  label,
  copiedLabel,
  verifyHref,
  verifyLabel,
  title,
  nativeLabel,
  facebookLabel,
  instagramLabel,
  copyLabel,
  closeLabel,
  help,
  failedLabel,
}: {
  verified: boolean;
  label: string;
  copiedLabel: string;
  verifyHref: string;
  verifyLabel: string;
  title: string;
  nativeLabel: string;
  facebookLabel: string;
  instagramLabel: string;
  copyLabel: string;
  closeLabel: string;
  help: string;
  failedLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [urls, setUrls] = useState<ShareUrls | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!verified) {
    return (
      <a className="button secondary" href={verifyHref}>
        {verifyLabel}
      </a>
    );
  }

  const openPanel = () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    void enableShare()
      .then((next) => {
        setUrls(next);
        dialogRef.current?.showModal();
      })
      .catch(() => setError(failedLabel))
      .finally(() => setBusy(false));
  };

  const copyLink = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.url);
      setCopied(true);
      setError(null);
    } catch {
      setError(failedLabel);
    }
  };

  const shareNative = async () => {
    if (!urls || !navigator.share) return;
    try {
      await navigator.share({
        title: "Played",
        text: title,
        url: urls.url,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(failedLabel);
    }
  };

  const shareFacebook = () => {
    if (!urls) return;
    const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urls.url)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button type="button" className="button secondary" disabled={busy} onClick={openPanel}>
        {busy ? "…" : label}
      </button>
      {error && !urls ? <p className="error">{error}</p> : null}
      <dialog ref={dialogRef} className="share-dialog" aria-labelledby={titleId}>
        <form method="dialog" className="share-dialog-panel">
          <header className="share-dialog-bar">
            <h2 id={titleId}>{title}</h2>
            <button type="submit" className="secondary" value="close">
              {closeLabel}
            </button>
          </header>
          {urls ? (
            <>
              <img className="share-dialog-preview" src={urls.cardUrl} alt="" />
              <p className="help">{help}</p>
              {error ? <p className="error">{error}</p> : null}
              <div className="share-dialog-actions">
                {canNativeShare ? (
                  <button type="button" onClick={() => void shareNative()}>
                    {nativeLabel}
                  </button>
                ) : null}
                <button type="button" onClick={shareFacebook}>
                  {facebookLabel}
                </button>
                <a className="button" href={urls.storyUrl} download="played-story.svg">
                  {instagramLabel}
                </a>
                <button type="button" className="secondary" onClick={() => void copyLink()}>
                  {copied ? copiedLabel : copyLabel}
                </button>
              </div>
            </>
          ) : null}
        </form>
      </dialog>
    </>
  );
}
