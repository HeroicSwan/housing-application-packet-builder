export const statusLabel = (status: string) => status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const formatDate = (date: Date | string | null | undefined) => date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date)) : "Not provided";
export const formatMoney = (cents: number | null | undefined) => cents == null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
