import { useEffect, useState } from "react";

/**
 * Wymusza okresowy re-render (np. żeby odświeżać „X ms temu”).
 * Krótki interwał — wrażliwy zakres to sekundy i poniżej.
 */
export function useNowTick(intervalMs = 250) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
