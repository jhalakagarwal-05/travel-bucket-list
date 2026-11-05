type HasStatus = { status: string };

export function pickDreamDestination<T extends HasStatus>(
  destinations: readonly T[],
  random: () => number = Math.random,
): T | null {
  const dreams = destinations.filter((destination) => destination.status === "dream");
  if (dreams.length === 0) return null;
  const index = Math.min(dreams.length - 1, Math.max(0, Math.floor(random() * dreams.length)));
  return dreams[index];
}
