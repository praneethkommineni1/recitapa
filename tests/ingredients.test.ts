import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustIngredient, convertIngredient, convertTemperatures, formatAmount, parseAmount, scaleIngredient } from "../src/lib/ingredients.ts";

test("parses whole, decimal, fraction, mixed and unicode amounts", () => {
  assert.equal(parseAmount("2"), 2);
  assert.equal(parseAmount("1.5"), 1.5);
  assert.equal(parseAmount("1/2"), 0.5);
  assert.equal(parseAmount("1 1/2"), 1.5);
  assert.equal(parseAmount("½"), 0.5);
  assert.equal(parseAmount("1½"), 1.5);
});

test("formats amounts the way a cook reads them", () => {
  assert.equal(formatAmount(1.5), "1½");
  assert.equal(formatAmount(0.33), "⅓");
  assert.equal(formatAmount(2.97), "3");
  assert.equal(formatAmount(0.01), "⅛");
  assert.equal(formatAmount(312, "g"), "310");
  assert.equal(formatAmount(37.4, "ml"), "37");
  assert.equal(formatAmount(7.46, "g"), "7.5");
});

test("scales the leading quantity and leaves the rest alone", () => {
  assert.equal(scaleIngredient("200g spaghetti", 2), "400g spaghetti");
  assert.equal(scaleIngredient("1 1/2 cups milk", 2), "3 cups milk");
  assert.equal(scaleIngredient("2-3 cloves garlic", 2), "4–6 cloves garlic");
  assert.equal(scaleIngredient("1 egg", 0.5), "½ egg");
  assert.equal(scaleIngredient("3 tbsp olive oil", 1 / 3), "1 tbsp olive oil");
  assert.equal(scaleIngredient("Salt to taste", 2), "Salt to taste");
  assert.equal(scaleIngredient("Juice of 1 lemon", 2), "Juice of 1 lemon");
  assert.equal(scaleIngredient("2 large eggs", 2), "4 large eggs");
  assert.equal(scaleIngredient("1 (14 oz) can tomatoes", 2), "2 (14 oz) can tomatoes");
  assert.equal(scaleIngredient("200g spaghetti", 1), "200g spaghetti");
});

test("converts between metric and US units", () => {
  assert.equal(convertIngredient("200g spaghetti", "us"), "7 oz spaghetti");
  assert.equal(convertIngredient("1 kg potatoes", "us"), "2¼ lb potatoes");
  assert.equal(convertIngredient("250 ml stock", "us"), "1 cup stock");
  assert.equal(convertIngredient("30 ml lemon juice", "us"), "2 tbsp lemon juice");
  assert.equal(convertIngredient("2 cups flour", "metric"), "480 ml flour");
  assert.equal(convertIngredient("8 oz cheddar", "metric"), "225g cheddar");
  assert.equal(convertIngredient("3 lb chicken thighs", "metric"), "1.4kg chicken thighs");
  assert.equal(convertIngredient("2 tbsp olive oil", "metric"), "2 tbsp olive oil");
  assert.equal(convertIngredient("200g spaghetti", "metric"), "200g spaghetti");
  assert.equal(convertIngredient("200g spaghetti", "original"), "200g spaghetti");
  assert.equal(convertIngredient("3 eggs", "us"), "3 eggs");
});

test("scales then converts", () => {
  assert.equal(adjustIngredient("100g butter", 2, "us"), "7 oz butter");
});

test("converts oven temperatures in step text", () => {
  assert.equal(convertTemperatures("Bake at 200°C for 20 minutes.", "us"), "Bake at 390°F for 20 minutes.");
  assert.equal(convertTemperatures("Preheat to 350 F.", "metric"), "Preheat to 175°C.");
  assert.equal(convertTemperatures("Add 2 cups of stock.", "metric"), "Add 2 cups of stock.");
  assert.equal(convertTemperatures("Bake at 200°C.", "original"), "Bake at 200°C.");
});
