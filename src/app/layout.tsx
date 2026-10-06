import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Played",
  description: "Played and not played courses in Atlantic Canada.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await currentLocale();
  const user = await currentUser();
  const headerList = await headers();
  const path = headerList.get("x-played-path") ?? "/";
  return (
    <html lang={locale}>
      <body>
        <SiteHeader locale={locale} user={user} path={path || "/"} />
        <main>{children}</main>
        <footer className="site-footer">{translate(locale, "footer.free")}</footer>
      </body>
    </html>
  );
}
