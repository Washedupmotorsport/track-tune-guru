export function hotPressureValues(values: { fl: string; fr: string; rl: string; rr: string }) {
  const numbers = [values.fl, values.fr, values.rl, values.rr].map((v) =>
    v.trim() ? Number(v) : NaN,
  );
  if (numbers.some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new Error("Enter a positive pressure for all four corners");
  }
  return { hot_fl: numbers[0], hot_fr: numbers[1], hot_rl: numbers[2], hot_rr: numbers[3] };
}
