import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

const SOURCES = ["golfCanada", "ghin", "birdies"] as const;

export default async function ConnectPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const locale = await currentLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div className="stack">
      <h1>{t("connect.title")}</h1>
      <p className="help">{t("connect.help")}</p>
      <ul className="course-list">
        {SOURCES.map((source) => (
          <li key={source} className="course-row">
            <div>
              <p className="course-name">{t(`connect.${source}`)}</p>
              <p className="meta">{t(`connect.${source}Help`)}</p>
            </div>
            <span className="pill">{t("connect.later")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
