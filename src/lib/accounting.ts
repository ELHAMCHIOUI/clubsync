export interface JournalEntry { id: string; day: string; label: string; category: string; method: string; income: number; expense: number }
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const decimal = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
export function journalCSV(rows: JournalEntry[]): string {
  const lines = ["Date;Libellé;Catégorie;Mode;Recettes (MAD);Charges (MAD)"];
  let income = 0, expense = 0;
  for (const row of rows) {
    income += row.income; expense += row.expense;
    const safe = (s: string) => csvCell(/^[\s]*[=+\-@\t\r]/.test(s) ? "'" + s : s);
    lines.push([row.day, safe(row.label), safe(row.category), safe(row.method), decimal(row.income), decimal(row.expense)].join(";"));
  }
  lines.push(`;TOTAL;;;${decimal(income)};${decimal(expense)}`, `;RÉSULTAT;;;${decimal(income - expense)};`);
  return "\uFEFF" + lines.join("\r\n");
}