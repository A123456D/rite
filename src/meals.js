export const SLOTS = [
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch", name: "Lunch" },
  { id: "dinner", name: "Dinner" },
  { id: "snacks", name: "Snacks" },
];

export function normalizeSlot(id) {
  if (id === "late") return "snacks";
  if (SLOTS.some((s) => s.id === id)) return id;
  return "dinner";
}

export function defaultSlot() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snacks";
}

export function slotName(id) {
  return SLOTS.find((s) => s.id === normalizeSlot(id))?.name || "Dinner";
}

export function clockTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
