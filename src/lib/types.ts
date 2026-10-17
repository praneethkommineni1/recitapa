// Shapes shared between API routes and the client.

export interface Step {
  text: string;
  /** Optional timer for this step, in minutes. */
  minutes: number | null;
}

export interface UserSummary {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RecipeCard {
  id: number;
  title: string;
  description: string;
  photoUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  createdAt: string;
  author: UserSummary;
  likeCount: number;
  commentCount: number;
  cookedCount: number;
  liked: boolean;
  saved: boolean;
}

export interface RecipeDetail extends RecipeCard {
  ingredients: string[];
  steps: Step[];
  comments: { id: number; body: string; createdAt: string; author: UserSummary }[];
}

/** A recipe in the full-screen Reels feed. */
export interface Reel extends RecipeCard {
  ingredients: string[];
  stepCount: number;
  /** The viewer follows the author. */
  following: boolean;
}

export interface Dinner {
  id: number;
  photoUrl: string | null;
  caption: string;
  localDate: string;
  createdAt: string;
  recipe: { id: number; title: string } | null;
  author: UserSummary;
}

export interface StoryGroup {
  user: UserSummary;
  stories: Dinner[];
  allSeen: boolean;
}

export interface StreakInfo {
  current: number;
  longest: number;
  cookedToday: boolean;
  /** Streak is alive but needs a dinner logged today to continue. */
  atRisk: boolean;
}
