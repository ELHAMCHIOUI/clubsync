import { describe, expect, it } from "vitest";
import { parseMAD, toWhatsAppNumber } from "@/lib/format";

describe("montants", () => {
  it("convertit 300 en 30000 centimes", () => expect(parseMAD("300")).toBe(30000));
  it("convertit 300,50 en 30050 centimes", () => expect(parseMAD("300,50")).toBe(30050));
});
describe("numéros WhatsApp", () => {
  it("06 12 34 56 78 → 212612345678", () => expect(toWhatsAppNumber("06 12 34 56 78")).toBe("212612345678"));
  it("+212… → 212…", () => expect(toWhatsAppNumber("+212612345678")).toBe("212612345678"));
  it("00212… → 212…", () => expect(toWhatsAppNumber("00212612345678")).toBe("212612345678"));
  it("refuse un numéro invalide", () => expect(toWhatsAppNumber("1234")).toBeNull());
});

import { invoiceNumber, totalHT } from "@/lib/format";
describe("factures", () => {
  it("numéro F-2026-0001", () => expect(invoiceNumber("F", "2026-10-21", 1)).toBe("F-2026-0001"));
  it("HT de 300 MAD TTC à 20 % = 250 MAD", () => expect(totalHT(30000, 20)).toBe(25000));
});
