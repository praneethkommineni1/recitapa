"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/client";
import { CameraIcon } from "./Icons";

export function PhotoPicker({ value, onChange, label = "Add a photo", aspect = "aspect-[4/3]" }: { value: string | null; onChange: (dataUrl: string | null) => void; label?: string; aspect?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`relative flex w-full ${aspect} items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface text-muted`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-sm font-medium">
            <CameraIcon width={28} height={28} />
            {busy ? "Processing…" : label}
          </span>
        )}
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="mt-2 text-sm text-muted underline">
          Remove photo
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await fileToDataUrl(file));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
