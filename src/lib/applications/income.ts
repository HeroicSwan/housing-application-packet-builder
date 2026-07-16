export type IncomeForNormalization = {
  amountCents: number;
  frequency: string;
  hoursPerWeek: number | null;
  daysPerWeek?: number | null;
  weeksPerYear: number | null;
  averagingPeriodMonths?: number | null;
  monthlyOvertimeCents?: number | null;
  monthlyOverrideCents?: number | null;
  startDate: Date | null;
  endDate: Date | null;
};

function periodMonths(record: IncomeForNormalization) {
  if (record.averagingPeriodMonths) return record.averagingPeriodMonths;
  if (!record.startDate || !record.endDate) return 12;
  return Math.max(1, (record.endDate.getUTCFullYear() - record.startDate.getUTCFullYear()) * 12 + record.endDate.getUTCMonth() - record.startDate.getUTCMonth() + 1);
}

export function normalizeMonthlyIncome(record: IncomeForNormalization) {
  if (record.monthlyOverrideCents !== null && record.monthlyOverrideCents !== undefined) return record.monthlyOverrideCents;
  let base = record.amountCents;
  if (record.frequency === "WEEKLY") base = record.amountCents * 52 / 12;
  else if (record.frequency === "BIWEEKLY") base = record.amountCents * 26 / 12;
  else if (record.frequency === "SEMIMONTHLY") base = record.amountCents * 2;
  else if (record.frequency === "QUARTERLY") base = record.amountCents / 3;
  else if (record.frequency === "ANNUAL") base = record.amountCents / 12;
  else if (record.frequency === "HOURLY") base = record.amountCents * (record.hoursPerWeek ?? 0) * (record.weeksPerYear ?? 52) / 12;
  else if (record.frequency === "DAILY") base = record.amountCents * (record.daysPerWeek ?? 0) * (record.weeksPerYear ?? 52) / 12;
  else if (record.frequency === "ONE_TIME" || record.frequency === "IRREGULAR") base = record.amountCents / periodMonths(record);
  return base + (record.monthlyOvertimeCents ?? 0);
}
