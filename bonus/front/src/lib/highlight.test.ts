import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("met en gras chaque occurrence, casse ignorée, en gardant la casse d'origine", () => {
    expect(highlight("Ryzen 7 et ryzen 5", "RYZEN")).toEqual([
      { text: "Ryzen", match: true },
      { text: " 7 et ", match: false },
      { text: "ryzen", match: true },
      { text: " 5", match: false },
    ]);
  });

  it("échappe les caractères spéciaux d'expression régulière", () => {
    expect(highlight("Câble USB-C (2 m)", "(2")).toEqual([
      { text: "Câble USB-C ", match: false },
      { text: "(2", match: true },
      { text: " m)", match: false },
    ]);
  });

  it("renvoie le texte tel quel sans terme ou sans occurrence", () => {
    expect(highlight("SSD NVMe", "  ")).toEqual([{ text: "SSD NVMe", match: false }]);
    expect(highlight("SSD NVMe", "hdd")).toEqual([{ text: "SSD NVMe", match: false }]);
  });
});
