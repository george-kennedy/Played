import { redirect } from "next/navigation";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.province) query.set("view", params.province);
  for (const key of ["q", "played", "access", "ranking", "holes", "show", "place"] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const search = query.toString();
  redirect(search ? `/?${search}` : "/");
}
