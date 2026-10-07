import { connectGolfCanada, disconnectAccount, uploadBirdies } from "@/app/actions";
import { getDb, listExternalLinks, type ExternalLink } from "@/lib/db";
import { translate, type MessageKey } from "@/lib/i18n";
import { golfCanadaLicensed, type ScoreProvider } from "@/lib/providers";
import { currentLocale, currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

function countParam(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function indexText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function LinkControls({
  link,
  sourceLabel,
  t,
}: {
  link: ExternalLink | undefined;
  sourceLabel: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  if (!link) return null;
  return (
    <div className="stack">
      {link.lastSyncAt ? (
        <p className="meta">{t("connect.lastSync", { time: link.lastSyncAt.slice(0, 16).replace("T", " ") })}</p>
      ) : null}
      {link.handicapIndex != null ? (
        <p>{t("connect.handicap", { index: indexText(link.handicapIndex), source: sourceLabel })}</p>
      ) : null}
      {link.status === "linked" ? (
        <form action={disconnectAccount}>
          <input type="hidden" name="provider" value={link.provider} />
          <p className="help">{t("connect.kept")}</p>
          <button className="secondary" type="submit">
            {t("connect.disconnect")}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string; unmatched?: string; duplicates?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const locale = await currentLocale();
  const query = await searchParams;
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const links = new Map<ScoreProvider, ExternalLink>(
    listExternalLinks(getDb(), user.id).map((link) => [link.provider, link]),
  );
  const golfLink = links.get("golf_canada");
  const birdiesLink = links.get("birdies");
  const golfOpen = golfCanadaLicensed() && golfLink?.status !== "linked";
  const added = countParam(query.added);
  const unmatched = countParam(query.unmatched);
  const duplicates = countParam(query.duplicates);
  const errorKey =
    query.error === "endpoint"
      ? "connect.endpoint"
      : query.error === "bad_file"
        ? "connect.badFile"
        : query.error === "agreement"
          ? "connect.agreement"
          : query.error === "generic"
            ? "error.generic"
            : null;

  return (
    <div className="stack">
      <h1>{t("connect.title")}</h1>
      <p className="help">{t("connect.help")}</p>
      {errorKey ? <p className="error">{t(errorKey)}</p> : null}
      {added != null ? <p>{t("connect.added", { count: added })}</p> : null}
      {unmatched != null && unmatched > 0 ? <p>{t("connect.unmatched", { count: unmatched })}</p> : null}
      {duplicates != null && duplicates > 0 ? <p>{t("connect.duplicates", { count: duplicates })}</p> : null}
      <section className="card stack">
        <h2>{t("connect.golfCanada")}</h2>
        <p className="help">{t("connect.golfCanadaHelp")}</p>
        {golfCanadaLicensed() ? null : <p>{t("connect.agreement")}</p>}
        <LinkControls link={golfLink} sourceLabel={t("connect.golfCanada")} t={t} />
        {golfOpen ? (
          <form className="stack" action={connectGolfCanada}>
            <label>
              {t("connect.member")}
              <input name="memberId" autoComplete="off" required pattern="[A-Za-z0-9-]{4,32}" />
            </label>
            <label>
              <input type="checkbox" name="consent" value="yes" required /> {t("connect.consent")}
            </label>
            <button type="submit">{t("connect.sync")}</button>
          </form>
        ) : golfLink?.status === "linked" ? null : (
          <span className="pill">{t("connect.later")}</span>
        )}
      </section>
      <section className="card stack">
        <h2>{t("connect.birdies")}</h2>
        <p className="help">{t("connect.birdiesHelp")}</p>
        <p>{t("connect.birdiesFile")}</p>
        <LinkControls link={birdiesLink} sourceLabel={t("connect.birdies")} t={t} />
        {birdiesLink?.status === "linked" ? null : (
          <form className="stack" action={uploadBirdies}>
            <label>
              {t("connect.chooseFile")}
              <input type="file" name="file" accept="application/json,.json" required />
            </label>
            <button type="submit">{t("connect.sync")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
