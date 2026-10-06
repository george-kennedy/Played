import { attachRow, uploadCsv } from "@/app/actions";
import { getDb, latestImport, listFacilities, listUnmatched } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import type { ImportReason } from "@/lib/import-csv";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.email_verified_at) redirect("/verify-email?error=required");
  const locale = await currentLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const query = await searchParams;
  const db = getDb();
  const review = latestImport(db, user.id);
  const unmatched = listUnmatched(db, user.id);
  const facilities = listFacilities(db).sort((a, b) => a.officialName.localeCompare(b.officialName));
  const error =
    query.error === "outside_seed"
      ? t("import.reason.outside_seed")
      : query.error === "conflict"
        ? t("import.reason.conflict")
        : query.error === "missing"
          ? t("import.reason.missing")
          : null;

  return (
    <div className="stack">
      <h1>{t("import.title")}</h1>
      <p className="help">{t("import.help")}</p>
      <form className="stack card" action={uploadCsv}>
        <label>
          {t("import.file")}
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <button type="submit">{t("import.submit")}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {!review ? <p>{t("import.none")}</p> : null}
      {review ? (
        <section className="stack">
          <p>{t("import.accepted", { count: review.acceptedMatched })}</p>
          <p>{t("import.duplicates", { count: review.duplicates })}</p>
          <h2>{t("import.failed")}</h2>
          {review.failures.length === 0 ? <p className="muted">—</p> : null}
          <ul>
            {review.failures.map((failure, index) => (
              <li key={`${failure.line}-${index}`}>
                {failure.line}: {failure.courseName ? `${failure.courseName} — ` : ""}
                {t(`import.reason.${failure.reason as ImportReason}`)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="stack">
        <h2>{t("import.unmatched")}</h2>
        <p className="help">{t("import.attachHelp")}</p>
        {unmatched.length === 0 ? <p className="muted">—</p> : null}
        <ul className="course-list">
          {unmatched.map((round) => (
            <li key={round.id} className="course-row">
              <div>
                <strong>{round.rawCourseName}</strong>
                <p className="meta">{round.playedOn} · {round.holes}</p>
              </div>
              <form className="stack" action={attachRow}>
                <input type="hidden" name="roundId" value={round.id} />
                <label>
                  {t("import.attach")}
                  <select name="facilityId" required defaultValue="">
                    <option value="" disabled>{t("directory.any")}</option>
                    {facilities.map((facility) => (
                      <option key={facility.facilityId} value={facility.facilityId}>
                        {facility.officialName}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">{t("import.attach")}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
