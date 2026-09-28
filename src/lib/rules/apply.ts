/**
 * Power off the battlefield, from the ingested Comprehensive Rules.
 * 113.6: abilities function on the battlefield unless an exception says otherwise.
 * 113.6a / 604.3: a characteristic-defining ability functions in every zone.
 * 604.3a: it has to define power or toughness. "Gets +N/+N" or "gets -N/-N" modifies (613.4c). It does not define.
 * 208.3: off the battlefield, printed power is the power when no defining ability replaces it.
 */
export function powerOffBattlefield(oracle: string, printed: string | null): {
  usePrinted: boolean;
  rules: string[];
} {
  const s = oracle.toLowerCase();
  const defines =
    printed === "*" ||
    /power and toughness are each equal to/.test(s) ||
    /\bpower is equal to\b/.test(s) ||
    /\btoughness is equal to\b/.test(s);
  if (defines) return { usePrinted: false, rules: ["604.3", "604.3a", "113.6a", "613.4a"] };
  return { usePrinted: true, rules: ["113.6", "613.4c", "208.3"] };
}
