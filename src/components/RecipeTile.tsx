import Link from "next/link";
import type { RecipeCard } from "@/lib/types";
import { totalMinutes } from "./RecipeCard";

/** Background for recipes without any photo, stable per recipe. */
export const coverGradient = (id: number) => {
  const hue = (id * 47) % 360;
  return `linear-gradient(160deg, hsl(${hue} 42% 30%), hsl(${(hue + 40) % 360} 48% 11%))`;
};

/** Compact, photo-first recipe card for carousels and grids. */
export function RecipeTile({ recipe, className = "" }: { recipe: RecipeCard; className?: string }) {
  const time = totalMinutes(recipe);
  return (
    <Link href={`/recipes/${recipe.id}`} className={`group block ${className}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-line">
        {recipe.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-active:scale-[0.98]" />
        ) : (
          <div className="flex h-full w-full items-end p-3" style={{ background: coverGradient(recipe.id) }}>
            <span className="line-clamp-4 font-serif text-xl leading-tight text-white">{recipe.title}</span>
          </div>
        )}
        {time && (
          <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{time}</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-semibold">{recipe.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted">
        {recipe.author.displayName}
        {recipe.cookedCount > 0 && ` · cooked ${recipe.cookedCount}×`}
      </p>
    </Link>
  );
}
