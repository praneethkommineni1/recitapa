"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { CloseIcon, PlusIcon } from "@/components/Icons";
import { PhotoPicker } from "@/components/PhotoPicker";
import { api } from "@/lib/client";

type StepDraft = { text: string; minutes: string };

export default function NewRecipe() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<string[]>(["", "", ""]);
  const [steps, setSteps] = useState<StepDraft[]>([{ text: "", minutes: "" }, { text: "", minutes: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id } = await api<{ id: number }>("/api/recipes", {
        body: {
          title,
          description,
          photo,
          servings,
          prepMinutes: prep,
          cookMinutes: cook,
          tags: tags.split(/[,\s]+/).filter(Boolean),
          ingredients: ingredients.filter((i) => i.trim()),
          steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text, minutes: s.minutes || null })),
        },
      });
      router.replace(`/recipes/${id}`); // the app shell checks for new badges on navigation
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New recipe" back />
      <form onSubmit={submit} className="space-y-6 px-5 pb-10">
        <PhotoPicker value={photo} onChange={setPhoto} label="Add a cover photo" />
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input font-serif !text-2xl" placeholder="Grandma's Sunday ragù" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="desc">The story</label>
          <textarea id="desc" className="input min-h-24" placeholder="Why you love it, where it's from…" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Serves", servings, setServings],
            ["Prep min", prep, setPrep],
            ["Cook min", cook, setCook],
          ].map(([label, value, set]) => (
            <div key={label as string}>
              <label className="label">{label as string}</label>
              <input className="input" inputMode="numeric" pattern="[0-9]*" value={value as string} onChange={(e) => (set as (v: string) => void)(e.target.value.replace(/\D/g, ""))} />
            </div>
          ))}
        </div>

        <fieldset>
          <legend className="label">Ingredients</legend>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder={i === 0 ? "400g spaghetti" : "Ingredient"} value={ing} onChange={(e) => setIngredients(ingredients.map((x, j) => (j === i ? e.target.value : x)))} />
                {ingredients.length > 1 && (
                  <button type="button" className="px-2 text-muted" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} aria-label="Remove ingredient"><CloseIcon width={18} /></button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 flex items-center gap-1 text-sm font-semibold" onClick={() => setIngredients([...ingredients, ""])}>
            <PlusIcon width={16} /> Add ingredient
          </button>
        </fieldset>

        <fieldset>
          <legend className="label">Steps</legend>
          <p className="-mt-1 mb-3 text-xs text-muted">Add a timer to any step and the voice chef will run it for you.</p>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-serif text-lg">Step {i + 1}</span>
                  {steps.length > 1 && (
                    <button type="button" className="text-muted" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Remove step"><CloseIcon width={18} /></button>
                  )}
                </div>
                <textarea className="input min-h-20" placeholder="What to do…" value={step.text} onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))} />
                <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <span>Timer</span>
                  <input className="input !w-20 !py-1.5" inputMode="numeric" placeholder="—" value={step.minutes} onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, minutes: e.target.value.replace(/\D/g, "") } : s)))} />
                  <span>minutes</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 flex items-center gap-1 text-sm font-semibold" onClick={() => setSteps([...steps, { text: "", minutes: "" }])}>
            <PlusIcon width={16} /> Add step
          </button>
        </fieldset>

        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input id="tags" className="input" placeholder="pasta, weeknight, vegetarian" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Publishing…" : "Publish recipe"}</button>
      </form>
    </>
  );
}
