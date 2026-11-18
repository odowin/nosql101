import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("fusionne les classes Tailwind en conflit et ignore les valeurs fausses", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
