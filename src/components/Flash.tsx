import { readFlash } from "@/lib/flash";

export default function Flash({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flash = readFlash(searchParams);
  if (!flash) return null;
  return <div className={`flash flash-${flash.category}`}>{flash.message}</div>;
}
