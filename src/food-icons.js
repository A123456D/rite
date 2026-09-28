/* Food category icon system. Every pantry/meal item gets a hand-drawn
   stroke glyph (matching the nav icon language) plus a category hue that
   tints its tile — so lists scan visually without emoji or photos. */

const S = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const FOOD_CATEGORIES = [
  { id: "egg", hue: "#f0c24f", rx: /egg|omelett/, icon: S(`<path d="M12 4c3.8 0 7 3.6 7 7.6 0 4.2-3 7.4-7 7.4s-7-3.2-7-7.4C5 7.6 8.2 4 12 4z"/><circle cx="12" cy="14" r="2.6"/>`) },
  { id: "shrimp", hue: "#f2726a", rx: /shrimp|prawn|lobster|crab|crawl/, icon: S(`<path d="M18 4c-7 0-12 4-12 10 0 4 3 7 7 7 3 0 5-2 5-4s-2-3-4-3"/><path d="M18 4l3 3M15 4l2 2"/><path d="M8 9h4M7 13h4"/>`) },
  { id: "shellfish", hue: "#4a9fd8", rx: /mussel|clam|oyster|shellfish|scallop/, icon: S(`<path d="M12 4c5 0 8 4 8 8l-8 8-8-8c0-4 3-8 8-8z"/><path d="M4 12h16M12 4v16"/>`) },
  { id: "fish", hue: "#4a9fd8", rx: /salmon|tuna|cod|tilapia|trout|mackerel|sardine|fish|white fish/, icon: S(`<path d="M3 12c3.5-4.5 8-6.5 12-6.5 4 0 7.5 2 9.5 6.5-2 4.5-5.5 6.5-9.5 6.5-4 0-8.5-2-12-6.5z"/><path d="M6 12h.01"/><path d="M24 5l-3.5 7L24 19"/>`) },
  { id: "cheese", hue: "#f5c451", rx: /cheese|cheddar|mozzarella|feta|parmesan|provolone|swiss|ricotta|mascarpone|brie|goat|blue/, icon: S(`<path d="M3 16l17-8v9H3z"/><path d="M3 16v2h17"/><circle cx="10" cy="15" r="1"/><circle cx="15" cy="14" r="1"/>`) },
  { id: "yogurt", hue: "#f0c24f", rx: /yogurt|yoghurt|skyr|kefir/, icon: S(`<path d="M7 8h10l-1.2 12H8.2z"/><path d="M6.5 8c2.5-1.5 8.5-1.5 11 0"/><path d="M17 3l2 2"/>`) },
  { id: "butter", hue: "#f0c24f", rx: /butter|ghee|margarine/, icon: S(`<rect x="4" y="11" width="16" height="7" rx="1"/><path d="M7 11V7h10v4"/>`) },
  { id: "milk", hue: "#f0c24f", rx: /milk|cream|half.and.half|kefir/, icon: S(`<path d="M8 3h8v4l2 3v11H6V10z"/><path d="M6 10h12"/>`) },
  { id: "pasta", hue: "#e0c078", rx: /pasta|spaghetti|penne|noodle|macaroni|lasagn|ravioli|pad thai/, icon: S(`<path d="M4 9c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0"/><path d="M4 14c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0"/><path d="M4 19c2.5-2.5 5-2.5 8 0"/>`) },
  { id: "bread", hue: "#c98d4b", rx: /bread|bagel|croissant|tortilla|toast|bun|sourdough|rye|baguette|waffle|pancake|pretzel|sandwich/, icon: S(`<path d="M4 10c0-3 3.6-5 8-5s8 2 8 5v9H4z"/><path d="M4 14h16"/>`) },
  { id: "grains", hue: "#d8b56a", rx: /rice|oat|quinoa|couscous|bulgur|barley|granola|cereal|porridge|grain|wheat|flour/, icon: S(`<path d="M12 21V8"/><path d="M12 8c0-3 2-5 4-5 0 3-2 5-4 5z"/><path d="M12 8c0-3-2-5-4-5 0 3 2 5 4 5z"/><path d="M12 13c0-3 2-5 4-5 0 3-2 5-4 5z"/><path d="M12 13c0-3-2-5-4-5 0 3 2 5 4 5z"/>`) },
  { id: "sweets", hue: "#c77dff", rx: /chocolate|cookie|cake|brownie|donut|muffin|candy|jam|jelly|honey|sugar|nutella|syrup|ice cream|sweet|dessert|protein bar/, icon: S(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>`) },
  { id: "fruit", hue: "#f272a0", rx: /apple|banana|orange|berry|strawberr|blueberr|raspberr|grape|melon|watermelon|pineapple|mango|peach|pear|cherr|kiwi|lemon|lime|grapefruit|plum|raisin|date|fig|fruit|avocado/, icon: S(`<path d="M12 7c-3-2-7 0-7 5 0 4 3 8 7 8s7-4 7-8c0-5-4-7-7-5z"/><path d="M12 7c0-2 1-3 3-4"/>`) },
  { id: "legumes", hue: "#9aa46a", rx: /bean|lentil|chickpea|garbanzo|tofu|tempeh|seitan|edamame|soy|falafel|pea\b|hummus/, icon: S(`<path d="M4 13h16c0 4.5-3.5 7-8 7s-8-2.5-8-7z"/><circle cx="10" cy="9" r="1.4"/><circle cx="14" cy="8" r="1.4"/>`) },
  { id: "vegetables", hue: "#52b788", rx: /broccoli|spinach|kale|lettuce|salad|tomato|cucumber|pepper|capsicum|onion|garlic|carrot|celery|zucchini|courgette|mushroom|cauliflower|green bean|corn|asparagus|cabbage|beet|pumpkin|kimchi|potato|vegetable|veg|slaw/, icon: S(`<path d="M12 21c-5-2-8-6-8-11 0-3 1-5 3-6 2 3 5 4 5 4s3-1 5-4c2 1 3 3 3 6 0 5-3 9-8 11z"/><path d="M12 8v13"/>`) },
  { id: "nuts", hue: "#b08968", rx: /almond|walnut|cashew|pistachio|pecan|peanut|nut|chia|flax|seed/, icon: S(`<path d="M10 4c3 0 4 3 2 5 3-1 6 1 6 4 0 4-4 7-8 7-4 0-7-3-7-7 0-3 3-5 5-5 0-3 1-4 2-4z"/>`) },
  { id: "alcohol", hue: "#b57ba6", rx: /beer|wine|vodka|whisk|rum\b|gin\b|alcohol|sake/, icon: S(`<path d="M8 4h8c0 5-1 8-4 8s-4-3-4-8z"/><path d="M12 12v7M9 21h6"/>`) },
  { id: "coffee", hue: "#a1734d", rx: /coffee|latte|cappuccino|espresso|cocoa/, icon: S(`<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"/>`) },
  { id: "drinks", hue: "#74c0fc", rx: /juice|cola|soda|drink|water/, icon: S(`<path d="M7 4h10l-2 16H9z"/><path d="M13 4l4-3"/>`) },
  { id: "sauces", hue: "#9aa0a6", rx: /ketchup|mustard|mayo|soy|pesto|ranch|dressing|sauce|oil|vinegar|syrup/, icon: S(`<path d="M10 3h4v4l2 3v11H8V10z"/><path d="M10 3h4"/>`) },
  { id: "fastfood", hue: "#d9825f", rx: /fries|nugget|pizza|doner|kebab|sushi|burrito|taco|caesar|burger|fast food/, icon: S(`<path d="M4 10c0-3 4-5 8-5s8 2 8 5H4z"/><path d="M4 13h16M5 16c1 2 3 3 7 3s6-1 7-3"/>`) },
  { id: "pizza", hue: "#e08040", rx: /pizza/, icon: S(`<path d="M4 5c5-2 11-2 16 0l-8 16z"/><circle cx="12" cy="9" r="1"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/>`) },
  { id: "meat", hue: "#e0564e", rx: /beef|steak|burger|filet|sirloin|ribeye|brisket|liver|veal|pork|bacon|ham\b|sausage|lamb|prosciutto|salami|deli|meat|jerky/, icon: S(`<path d="M5 10c0-3 3-5 7.5-5S20 7 20 10.5 16.5 17 12 17c-4.5 0-7-2.5-7-7z"/><path d="M9 10c2.5-1 5 0 6.5 2"/>`) },
  { id: "poultry", hue: "#f5a623", rx: /chicken|turkey|duck|poultry|rotisserie|wing/, icon: S(`<circle cx="13" cy="9" r="6.5"/><path d="M17.5 13.5L13 18"/><circle cx="11.5" cy="19.5" r="1.8"/>`) },
];

const GENERIC = {
  id: "generic",
  hue: "",
  rx: /.*/,
  icon: S(`<path d="M7 3v7a2 2 0 0 0 2 2 2 2 0 0 1-2 2 2 2 0 0 0-2 2 2 2 0 0 0 2 2 2 2 0 0 0 2-2"/><path d="M17 3c-2 0-3 2-3 4s1 3 2 3v11"/>`),
};

export function categoryOf(food) {
  const hay = `${food?.id || ""} ${food?.name || ""} ${(food?.aliases || []).join(" ")} ${food?.base ? " " : ""}`.toLowerCase();
  for (const c of FOOD_CATEGORIES) {
    if (c.rx.test(hay)) return c;
  }
  return GENERIC;
}

export function foodIcon(food, size = 28) {
  const c = categoryOf(food);
  return tile(c, size);
}

export function catIcon(categoryId, size = 28) {
  const c = FOOD_CATEGORIES.find((x) => x.id === categoryId) || GENERIC;
  return tile(c, size);
}

export const MEAL_ICON = S(
  `<path d="M7 3v7a2 2 0 0 0 2 2 2 2 0 0 1-2 2 2 2 0 0 0-2 2 2 2 0 0 0 2 2 2 2 0 0 0 2-2"/><path d="M17 3c-2 0-3 2-3 4s1 3 2 3v11"/>`
);

function tile(c, size) {
  return `<span class="food-ico" style="--fh:${c.hue || "var(--mute)"};width:${size}px;height:${size}px">${c.icon}</span>`;
}
