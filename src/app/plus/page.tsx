"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PageHeader, useUser } from "@/components/AppShell";
import { api } from "@/lib/client";
import type { PlanInfo } from "@/lib/plan";
import { buyNative, isNativeApp, loadNativeOffer, restoreNative, type NativeOffer } from "@/lib/purchases";

const WEB_PRICES = { month: "$4.99", year: "$39.99" };

const PERKS = [
  { title: "Unlimited voice sous-chef", body: "Cook with the AI chef every night, with no monthly limit." },
  { title: "Streak freezes", body: "Two a month. Miss a night and your streak keeps going." },
  { title: "Rescue any dinner", body: "Mishap fixes and step rewrites whenever something goes sideways." },
  { title: "Support independent cooking", body: "Keep Recitapa ad-free for everyone." },
];

export default function Page() {
  return (
    <Suspense>
      <Plus />
    </Suspense>
  );
}

function Plus() {
  const { user } = useUser();
  const params = useSearchParams();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [billing, setBilling] = useState<{ stripe: boolean; devMode: boolean } | null>(null);
  const [interval, setBillingInterval] = useState<"month" | "year">("year");
  const [offer, setOffer] = useState<NativeOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const native = isNativeApp();

  const load = useCallback(
    () =>
      api<{ plan: PlanInfo; billing: { stripe: boolean; devMode: boolean } }>("/api/plan").then((r) => {
        setPlan(r.plan);
        setBilling(r.billing);
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (native && user) loadNativeOffer(user.id).then(setOffer).catch((e) => setError(e.message));
  }, [native, user]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const subscribe = () =>
    run(async () => {
      if (native) {
        const pkg = interval === "year" ? offer?.annual : offer?.monthly;
        if (!user || !pkg) throw new Error("Subscriptions aren't available right now.");
        if (await buyNative(user.id, pkg)) setPlan((await api<{ plan: PlanInfo }>("/api/billing/sync", { body: {} })).plan);
      } else {
        location.href = (await api<{ url: string }>("/api/billing/checkout", { body: { interval } })).url;
      }
    });

  const manage = () =>
    run(async () => {
      if (plan?.source === "apple") location.href = "https://apps.apple.com/account/subscriptions";
      else location.href = (await api<{ url: string }>("/api/billing/portal", { body: {} })).url;
    });

  const restore = () =>
    run(async () => {
      if (!user) return;
      await restoreNative(user.id);
      setPlan((await api<{ plan: PlanInfo }>("/api/billing/sync", { body: {} })).plan);
    });

  const devToggle = () => run(async () => setPlan((await api<{ plan: PlanInfo }>("/api/billing/dev", { body: {} })).plan));

  if (!plan || !billing) return <PageHeader title="" back />;
  const price = (i: "month" | "year") =>
    native ? (i === "year" ? offer?.annual : offer?.monthly)?.product.priceString ?? "—" : WEB_PRICES[i];
  const canBuy = native ? Boolean(offer?.annual || offer?.monthly) : billing.stripe;

  return (
    <>
      <PageHeader title="" back />
      <main className="px-6 pb-12">
        <p className="label">Recitapa Plus</p>
        {plan.plan === "plus" ? (
          <>
            <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
              {params.get("welcome") ? <>Welcome to <em>Plus</em>.</> : <>You&apos;re on <em>Plus</em>.</>}
            </h1>
            <p className="mt-3 text-muted">
              Unlimited AI chef, {plan.freezesLeft} streak freeze{plan.freezesLeft === 1 ? "" : "s"} ready.
              {plan.plusUntil && ` Renews or ends ${new Date(plan.plusUntil).toLocaleDateString()}.`}
            </p>
            {plan.source !== "dev" && (
              <button onClick={manage} disabled={busy} className="btn btn-ghost mt-8 w-full">Manage subscription</button>
            )}
          </>
        ) : (
          <>
            <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
              Never cook <em>alone</em>.
            </h1>
            {plan.aiSessionsLimit !== null && (
              <p className="mt-3 text-muted">
                You&apos;ve used {plan.aiSessionsUsed} of {plan.aiSessionsLimit} free AI chef sessions this month.
              </p>
            )}

            <ul className="mt-8 space-y-5">
              {PERKS.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <p className="font-serif text-xl leading-tight">{p.title}</p>
                    <p className="text-sm text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {(["year", "month"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setBillingInterval(i)}
                  className={`relative rounded-2xl border p-4 text-left ${interval === i ? "border-ink bg-surface" : "border-line"}`}
                >
                  {i === "year" && (
                    <span className="absolute -top-2.5 left-4 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent-ink uppercase">
                      Best value
                    </span>
                  )}
                  <p className="text-sm font-semibold">{i === "year" ? "Yearly" : "Monthly"}</p>
                  <p className="font-serif text-2xl">{price(i)}</p>
                  <p className="text-xs text-muted">{i === "year" ? "per year" : "per month"}</p>
                </button>
              ))}
            </div>

            <button onClick={subscribe} disabled={busy || !canBuy} className="btn btn-primary mt-6 w-full !py-4">
              {busy ? "One moment…" : native ? "Subscribe" : "Start 7-day free trial"}
            </button>
            {!canBuy && <p className="mt-2 text-center text-xs text-muted">Payments aren&apos;t set up on this server yet.</p>}
            <p className="mt-3 text-center text-xs text-muted">
              {native
                ? "Billed through your Apple ID. Cancel anytime in Settings."
                : "Then billed automatically. Cancel anytime before the trial ends and you won't be charged."}
            </p>
            {native && (
              <button onClick={restore} disabled={busy} className="mt-4 w-full text-center text-sm text-muted underline">Restore purchases</button>
            )}
          </>
        )}
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <LegalLinks />
        {billing.devMode && (
          <button onClick={devToggle} disabled={busy} className="mt-10 w-full text-center text-xs text-muted underline">
            Dev mode: toggle Plus
          </button>
        )}
      </main>
    </>
  );
}

// Apple requires subscription screens to link to the Terms of Use and Privacy Policy.
function LegalLinks() {
  const terms = process.env.NEXT_PUBLIC_TERMS_URL;
  const privacy = process.env.NEXT_PUBLIC_PRIVACY_URL;
  if (!terms && !privacy) return null;
  return (
    <p className="mt-6 flex justify-center gap-4 text-xs text-muted">
      {terms && <a href={terms} className="underline">Terms of Use</a>}
      {privacy && <a href={privacy} className="underline">Privacy Policy</a>}
    </p>
  );
}
