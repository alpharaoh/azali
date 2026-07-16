/** Whole-dollar USD, e.g. $48,556. */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Meridian Home Brands" → "MH" — avatar fallback initials. */
export function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** "Mar 4, 2026" — table-friendly date. */
export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
