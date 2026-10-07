import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Played",
  description: "A map of courses played across Canada.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const user = await currentUser();
  const headerList = await headers();
  const path = headerList.get("x-played-path") ?? "/";
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  return (
    <html lang={locale}>
      <body>
        <SiteHeader locale={locale} user={user} path={path || "/"} />
        <main>{children}</main>
        <footer className="site-footer">{translate(locale, "footer.free")}</footer>
        {plausibleDomain ? (
          <script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />
        ) : null}
      </body>
    </html>
  );
}
