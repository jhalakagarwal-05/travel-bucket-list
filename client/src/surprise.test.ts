import { describe, expect, it } from "vitest";
import { pickDreamDestination } from "./surprise";

const destinations = [
  { id: 1, name: "Kyoto", status: "dream" },
  { id: 2, name: "Lisbon", status: "visited" },
  { id: 3, name: "Tokyo", status: "dream" },
  { id: 4, name: "Paris", status: "planned" },
];

describe("Surprise me", () => {
  it("picks only a dream destination, never a planned or visited one", () => {
    expect(pickDreamDestination(destinations, () => 0)).toEqual(destinations[0]);
    expect(pickDreamDestination(destinations, () => 0.99)).toEqual(destinations[2]);
  });

  it("returns null when the list has no dream destinations", () => {
    expect(pickDreamDestination([destinations[1], destinations[3]], () => 0)).toBeNull();
    expect(pickDreamDestination([], () => 0)).toBeNull();
  });

  it("chooses uniformly from the dream-only subset", () => {
    const chosen = new Map<number, number>();
    for (let index = 0; index < 1000; index++) {
      const result = pickDreamDestination(destinations, () => index / 1000);
      if (result) chosen.set(result.id, (chosen.get(result.id) ?? 0) + 1);
    }
    expect([...chosen.keys()].sort()).toEqual([1, 3]);
    expect(chosen.get(1)).toBe(500);
    expect(chosen.get(3)).toBe(500);
  });
});
