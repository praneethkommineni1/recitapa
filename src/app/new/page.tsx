import Link from "next/link";
import { PageHeader } from "@/components/AppShell";

export default function NewChooser() {
  const options = [
    { href: "/dinner/new", title: "Tonight's dinner", body: "Post a photo story for 24 hours and keep your streak going." },
    { href: "/recipes/new", title: "A recipe", body: "Write it up with steps and timers so anyone can cook it with the voice chef." },
  ];
  return (
    <>
      <PageHeader title="Share" />
      <div className="space-y-4 px-5 pt-2">
        {options.map((o) => (
          <Link key={o.href} href={o.href} className="block rounded-3xl border border-line bg-surface p-6">
            <p className="font-serif text-3xl tracking-tight">{o.title}</p>
            <p className="mt-1 text-muted">{o.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
