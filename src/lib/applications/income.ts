export type IncomeForNormalization = { amountCents: number; frequency: string; hoursPerWeek: number | null; weeksPerYear: number | null; startDate: Date | null; endDate: Date | null };

export function normalizeMonthlyIncome(record: IncomeForNormalization) {
  if (record.frequency === "WEEKLY") return record.amountCents * 52 / 12;
  if (record.frequency === "BIWEEKLY") return record.amountCents * 26 / 12;
  if (record.frequency === "SEMIMONTHLY") return record.amountCents * 2;
  if (record.frequency === "ANNUAL") return record.amountCents / 12;
  if (record.frequency === "HOURLY") return record.amountCents * (record.hoursPerWeek ?? 0) * (record.weeksPerYear ?? 52) / 12;
  if (record.frequency === "ONE_TIME") {
    if (!record.startDate || !record.endDate) return record.amountCents / 12;
    const months = Math.max(1, (record.endDate.getUTCFullYear() - record.startDate.getUTCFullYear()) * 12 + record.endDate.getUTCMonth() - record.startDate.getUTCMonth() + 1);
    return record.amountCents / months;
  }
  return record.amountCents;
}
