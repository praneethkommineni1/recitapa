// Badge catalog. Badges are earned automatically from what a cook does in the app;
// each one tracks a single metric against a target so we can show progress.

export type Metric =
  | "dinners"
  | "photoDinners"
  | "longestStreak"
  | "freezesUsed"
  | "recipesPosted"
  | "likesReceived"
  | "commentsWritten"
  | "following"
  | "followers"
  | "othersRecipesCooked"
  | "yourRecipesCookedByOthers"
  | "distinctRecipesCooked"
  | "aiSessions"
  | "mishapsRescued"
  | `dish:${DishKind}`;

export type DishKind = "bread" | "pasta" | "noodles" | "pizza" | "tacos" | "soup" | "curry" | "dessert" | "eggs" | "rice" | "greens" | "spicy";

export type BadgeCategory = "Streaks" | "Dinners" | "Recipes" | "Community" | "Sous-chef" | "Specialties";

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  metric: Metric;
  target: number;
}

export const BADGES: Badge[] = [
  // Streaks (longest streak, so a badge is never lost)
  { id: "on-a-roll", name: "On a Roll", description: "Cook dinner 3 nights in a row.", emoji: "🥐", category: "Streaks", metric: "longestStreak", target: 3 },
  { id: "hot-streak", name: "Hot Streak", description: "Keep a 7-night dinner streak.", emoji: "🔥", category: "Streaks", metric: "longestStreak", target: 7 },
  { id: "well-seasoned", name: "Well Seasoned", description: "Keep a 30-night dinner streak.", emoji: "🧂", category: "Streaks", metric: "longestStreak", target: 30 },
  { id: "slow-cooker", name: "Slow Cooker", description: "Keep a 100-night dinner streak. Slow and steady.", emoji: "🍲", category: "Streaks", metric: "longestStreak", target: 100 },
  { id: "chill-out", name: "Chill Out", description: "Have a streak freeze save your streak.", emoji: "🧊", category: "Streaks", metric: "freezesUsed", target: 1 },

  // Dinners
  { id: "first-course", name: "First Course", description: "Log your first dinner.", emoji: "🍽️", category: "Dinners", metric: "dinners", target: 1 },
  { id: "plate-expectations", name: "Plate Expectations", description: "Log 25 dinners.", emoji: "📖", category: "Dinners", metric: "dinners", target: 25 },
  { id: "fork-lift", name: "Fork Lift", description: "Log 100 dinners.", emoji: "🍴", category: "Dinners", metric: "dinners", target: 100 },
  { id: "say-cheese", name: "Say Cheese", description: "Share 10 dinners with a photo.", emoji: "📸", category: "Dinners", metric: "photoDinners", target: 10 },
  { id: "spice-of-life", name: "Spice of Life", description: "Cook 10 different recipes.", emoji: "🌶️", category: "Dinners", metric: "distinctRecipesCooked", target: 10 },

  // Recipes
  { id: "recipe-for-success", name: "Recipe for Success", description: "Publish your first recipe.", emoji: "📝", category: "Recipes", metric: "recipesPosted", target: 1 },
  { id: "chefs-kiss", name: "Chef's Kiss", description: "Publish 10 recipes.", emoji: "💋", category: "Recipes", metric: "recipesPosted", target: 10 },
  { id: "whole-enchilada", name: "The Whole Enchilada", description: "Publish 25 recipes.", emoji: "🌯", category: "Recipes", metric: "recipesPosted", target: 25 },
  { id: "hall-of-flame", name: "Hall of Flame", description: "Get 50 likes on your recipes.", emoji: "❤️‍🔥", category: "Recipes", metric: "likesReceived", target: 50 },
  { id: "spice-influencer", name: "Spice Influencer", description: "Have others cook your recipes 5 times.", emoji: "✨", category: "Recipes", metric: "yourRecipesCookedByOthers", target: 5 },

  // Community
  { id: "gouda-company", name: "Gouda Company", description: "Follow 5 cooks.", emoji: "🧀", category: "Community", metric: "following", target: 5 },
  { id: "big-cheese", name: "The Big Cheese", description: "Reach 25 followers.", emoji: "👑", category: "Community", metric: "followers", target: 25 },
  { id: "spill-the-beans", name: "Spill the Beans", description: "Leave 10 comments.", emoji: "🫘", category: "Community", metric: "commentsWritten", target: 10 },
  { id: "borrowed-thyme", name: "Borrowed Thyme", description: "Cook 5 recipes from other people.", emoji: "🌿", category: "Community", metric: "othersRecipesCooked", target: 5 },

  // Sous-chef
  { id: "hey-sous", name: "Hey Sous", description: "Cook with the AI sous-chef for the first time.", emoji: "🎙️", category: "Sous-chef", metric: "aiSessions", target: 1 },
  { id: "saved-by-the-bell-pepper", name: "Saved by the Bell Pepper", description: "Let the sous-chef rescue a kitchen mishap.", emoji: "🫑", category: "Sous-chef", metric: "mishapsRescued", target: 1 },
  { id: "whisk-taker", name: "Whisk Taker", description: "Survive 5 kitchen mishaps.", emoji: "🥄", category: "Sous-chef", metric: "mishapsRescued", target: 5 },

  // Specialties (dinners whose recipe or caption match the dish)
  { id: "loaf-actually", name: "Loaf Actually", description: "Homemade sourdough connoisseur: bake bread 3 times.", emoji: "🍞", category: "Specialties", metric: "dish:bread", target: 3 },
  { id: "pasta-la-vista", name: "Pasta La Vista", description: "Cook 5 pasta dinners.", emoji: "🍝", category: "Specialties", metric: "dish:pasta", target: 5 },
  { id: "use-your-noodle", name: "Use Your Noodle", description: "Cook 5 noodle dinners.", emoji: "🍜", category: "Specialties", metric: "dish:noodles", target: 5 },
  { id: "pizza-my-heart", name: "Pizza My Heart", description: "Make pizza 3 times.", emoji: "🍕", category: "Specialties", metric: "dish:pizza", target: 3 },
  { id: "nacho-average-cook", name: "Nacho Average Cook", description: "Cook 5 taco, burrito or nacho nights.", emoji: "🌮", category: "Specialties", metric: "dish:tacos", target: 5 },
  { id: "souper-star", name: "Souper Star", description: "Make 5 soups or stews.", emoji: "🥣", category: "Specialties", metric: "dish:soup", target: 5 },
  { id: "curry-favor", name: "Curry Favor", description: "Cook 5 curries.", emoji: "🍛", category: "Specialties", metric: "dish:curry", target: 5 },
  { id: "batter-up", name: "Batter Up", description: "Bake 5 desserts.", emoji: "🧁", category: "Specialties", metric: "dish:dessert", target: 5 },
  { id: "eggcellent", name: "Eggcellent", description: "Cook 5 egg dishes.", emoji: "🍳", category: "Specialties", metric: "dish:eggs", target: 5 },
  { id: "rice-rice-baby", name: "Rice Rice Baby", description: "Cook 5 rice dishes.", emoji: "🍚", category: "Specialties", metric: "dish:rice", target: 5 },
  { id: "romaine-calm", name: "Romaine Calm", description: "Cook 5 salads or veggie-forward dinners.", emoji: "🥗", category: "Specialties", metric: "dish:greens", target: 5 },
  { id: "heat-seeker", name: "Heat Seeker", description: "Cook 5 spicy dinners.", emoji: "🌋", category: "Specialties", metric: "dish:spicy", target: 5 },
];

// Word-start matches so "rice" doesn't match "price" and "pie" doesn't match "piece".
const DISH_PATTERNS: Record<DishKind, string[]> = {
  bread: ["sourdough", "bread", "loaf", "focaccia", "baguette", "brioche", "bagel", "challah", "ciabatta", "naan"],
  pasta: ["pasta", "spaghetti", "penne", "linguine", "lasagn", "rigatoni", "fettuccine", "tagliatelle", "cacio", "carbonara", "bolognese", "ravioli", "gnocchi", "orzo", "macaroni", "mac and cheese", "tonnarelli"],
  noodles: ["noodle", "ramen", "udon", "soba", "pho\\b", "pad thai", "lo mein", "chow mein", "japchae"],
  pizza: ["pizza", "calzone", "flatbread"],
  tacos: ["taco", "burrito", "quesadilla", "enchilada", "nacho", "fajita", "tostada"],
  soup: ["soup", "stew", "chowder", "bisque", "gumbo", "broth", "minestrone", "goulash"],
  curry: ["curry", "masala", "dal\\b", "dahl", "korma", "vindaloo", "tikka", "rendang"],
  dessert: ["cake", "cookie", "brownie", "pie\\b", "tart\\b", "dessert", "cupcake", "muffin", "pudding", "ice cream", "cheesecake", "crumble", "tiramisu"],
  eggs: ["egg", "omelet", "frittata", "shakshuka", "quiche"],
  rice: ["rice\\b", "risotto", "paella", "biryani", "jollof", "pilaf", "congee"],
  greens: ["salad", "vegan", "vegetarian", "veggie", "tofu", "greens", "plant-based", "kale"],
  spicy: ["spicy", "chili", "chilli", "jalape", "sriracha", "gochujang", "hot sauce", "harissa", "scotch bonnet", "habanero", "vindaloo"],
};
const DISH_REGEX = Object.fromEntries(
  Object.entries(DISH_PATTERNS).map(([kind, words]) => [kind, new RegExp(`\\b(?:${words.join("|")})`, "i")]),
) as Record<DishKind, RegExp>;

/** Which dish kinds a dinner counts toward, from its recipe title, tags and caption. */
export function dishKinds(text: string): DishKind[] {
  return (Object.keys(DISH_REGEX) as DishKind[]).filter((k) => DISH_REGEX[k].test(text));
}

export type BadgeStats = Partial<Record<Metric, number>>;

export interface BadgeProgress extends Badge {
  value: number;
  earned: boolean;
}

export function evaluateBadges(stats: BadgeStats): BadgeProgress[] {
  return BADGES.map((b) => {
    const value = stats[b.metric] ?? 0;
    return { ...b, value: Math.min(value, b.target), earned: value >= b.target };
  });
}
