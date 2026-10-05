// Populate a fresh database with a few demo cooks, recipes and dinners.
// Usage: npm run seed   (all demo accounts use the password "password123")
import { getDb } from "../src/lib/db.ts";
import { hashPassword } from "../src/lib/password.ts";

const db = getDb();
if ((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n > 0) {
  console.log("Database already has users; skipping seed.");
  process.exit(0);
}

const password = hashPassword("password123");
const users = [
  ["maya", "Maya Chen", "Weeknight noodles and too many chili oils."],
  ["leo", "Leo Russo", "Nonna-approved pasta, mostly."],
  ["amara", "Amara Okafor", "Stews, spice, and Sunday baking."],
].map(([username, name, bio]) =>
  Number(db.prepare("INSERT INTO users (username, display_name, password_hash, bio) VALUES (?, ?, ?, ?)").run(username, name, password, bio).lastInsertRowid),
);
const [maya, leo, amara] = users;

const follow = db.prepare("INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)");
for (const a of users) for (const b of users) if (a !== b) follow.run(a, b);

const addRecipe = db.prepare(
  `INSERT INTO recipes (user_id, title, description, servings, prep_minutes, cook_minutes, ingredients, steps, tags, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
);
const recipe = (user: number, title: string, description: string, servings: number, prep: number, cook: number, ingredients: string[], steps: [string, number | null][], tags: string[], age: string) =>
  Number(addRecipe.run(user, title, description, servings, prep, cook, JSON.stringify(ingredients), JSON.stringify(steps.map(([text, minutes]) => ({ text, minutes }))), JSON.stringify(tags), age).lastInsertRowid);

const pasta = recipe(leo, "Cacio e pepe", "Three ingredients, one technique. The trick is starchy pasta water and patience.", 2, 5, 12,
  ["200g spaghetti or tonnarelli", "80g Pecorino Romano, finely grated", "1 tbsp black peppercorns", "Salt for the pasta water"],
  [
    ["Bring a wide pot of water to a boil and salt it lightly. Less than usual, since pecorino is salty.", 8],
    ["Toast the cracked peppercorns in a dry pan over medium heat until fragrant.", 2],
    ["Cook the pasta 2 minutes short of the package time. Save a big mug of pasta water.", 9],
    ["Mix the pecorino with a few spoons of warm (not boiling) pasta water into a thick paste.", null],
    ["Add the pasta to the pepper pan with a splash of water, take it off the heat, and toss in the cheese paste until glossy.", null],
  ], ["pasta", "italian", "weeknight"], "-2 days");

const noodles = recipe(maya, "Garlic chili oil noodles", "Fifteen-minute dinner that tastes like you tried much harder.", 2, 5, 10,
  ["200g wheat noodles", "4 cloves garlic, minced", "2 scallions, sliced", "1 tbsp chili flakes", "1 tsp sesame seeds", "3 tbsp neutral oil", "2 tbsp soy sauce", "1 tbsp black vinegar", "1 tsp sugar"],
  [
    ["Boil the noodles according to the package.", 5],
    ["In a heatproof bowl, combine garlic, scallion whites, chili flakes and sesame seeds.", null],
    ["Heat the oil until shimmering, then pour it over the aromatics. It should sizzle hard.", 2],
    ["Stir in soy, vinegar and sugar. Toss with the drained noodles and top with scallion greens.", null],
  ], ["noodles", "spicy", "quick"], "-1 day");

recipe(amara, "Weeknight jollof rice", "Smoky, tomatoey and worth the wait.", 4, 15, 45,
  ["2 cups long-grain parboiled rice", "1 can plum tomatoes", "2 red bell peppers", "1 scotch bonnet", "2 onions", "3 tbsp tomato paste", "1/3 cup oil", "2 cups chicken stock", "2 bay leaves", "1 tsp curry powder", "1 tsp dried thyme", "Salt"],
  [
    ["Blend the tomatoes, peppers, scotch bonnet and one onion until smooth.", null],
    ["Fry the other onion, sliced, in the oil until soft.", 5],
    ["Add the tomato paste and fry until it darkens.", 4],
    ["Add the blended sauce, bay, curry and thyme. Cook down until thick and the oil rises.", 20],
    ["Stir in the rinsed rice and stock. Cover tightly with foil and a lid and steam on low.", 30],
    ["Turn the heat up for the last 3 minutes to get the smoky bottom layer, then fluff.", 3],
  ], ["rice", "west african", "one-pot"], "-5 hours");

const dinner = db.prepare("INSERT INTO dinners (user_id, recipe_id, caption, local_date, created_at) VALUES (?, ?, ?, date('now', ?), datetime('now', ?))");
for (let d = 4; d >= 1; d--) dinner.run(maya, noodles, "Noodle night again", `-${d} days`, `-${d} days`);
dinner.run(maya, pasta, "Tried Leo's cacio e pepe. Didn't clump!", "-0 days", "-2 hours");
dinner.run(leo, pasta, "Classic.", "-1 days", "-20 hours");

console.log("Seeded demo data. Log in as maya, leo or amara with password: password123");
