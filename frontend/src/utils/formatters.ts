export function formatCompactNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const formatScaledValue = (divisor: number, suffix: string) =>
    `${sign}$${(absoluteValue / divisor).toFixed(1)}${suffix}`;

  if (absoluteValue >= 1_000_000_000) {
    return formatScaledValue(1_000_000_000, "B");
  }

  if (absoluteValue >= 1_000_000) {
    return formatScaledValue(1_000_000, "M");
  }

  if (absoluteValue >= 1_000) {
    return formatScaledValue(1_000, "K");
  }

  return `${sign}$${absoluteValue.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatScore(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${Math.round(value)}/100`;
}

export function formatRatioValue(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
