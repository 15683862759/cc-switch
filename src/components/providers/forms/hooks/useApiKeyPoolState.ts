import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiKeyEntry, ApiKeyStrategy } from "@/types";
import {
  DEFAULT_API_KEY_STRATEGY,
  apiKeyEntriesFromText,
  normalizeApiKeyEntries,
  normalizeApiKeyWeight,
} from "@/utils/apiKeyPool";

interface UseApiKeyPoolStateProps {
  initialEntries?: ApiKeyEntry[];
  initialStrategy?: ApiKeyStrategy;
  fallbackKey: string;
  onFirstKeyChange: (key: string) => void;
}

const emptyEntry = (): ApiKeyEntry => ({ key: "", weight: 1 });

export function useApiKeyPoolState({
  initialEntries,
  initialStrategy,
  fallbackKey,
  onFirstKeyChange,
}: UseApiKeyPoolStateProps) {
  const [entries, setEntries] = useState<ApiKeyEntry[]>(() => {
    const migrated = normalizeApiKeyEntries(initialEntries);
    if (migrated.length > 0) return migrated;
    const fromConfig = apiKeyEntriesFromText(fallbackKey);
    return fromConfig.length > 0 ? fromConfig : [emptyEntry()];
  });
  const [strategy, setStrategy] = useState<ApiKeyStrategy>(
    initialStrategy ?? DEFAULT_API_KEY_STRATEGY,
  );
  const dirtyRef = useRef(false);
  const lastFallbackRef = useRef(fallbackKey);

  useEffect(() => {
    const previousFallback = lastFallbackRef.current;
    lastFallbackRef.current = fallbackKey;

    if (dirtyRef.current || fallbackKey === previousFallback) return;
    if (normalizeApiKeyEntries(initialEntries).length > 0) return;

    const fromConfig = apiKeyEntriesFromText(fallbackKey);
    if (fromConfig.length > 0) {
      setEntries(fromConfig);
    }
  }, [fallbackKey, initialEntries]);

  const handleEntriesChange = useCallback(
    (nextEntries: ApiKeyEntry[]) => {
      dirtyRef.current = true;
      const normalized = nextEntries.map((entry) => ({
        key: entry.key,
        weight: normalizeApiKeyWeight(entry.weight),
      }));
      const next = normalized.length > 0 ? normalized : [emptyEntry()];
      setEntries(next);

      const firstKey =
        next.find((entry) => entry.key.trim() !== "")?.key.trim() ?? "";
      onFirstKeyChange(firstKey);
    },
    [onFirstKeyChange],
  );

  const handleStrategyChange = useCallback((next: ApiKeyStrategy) => {
    dirtyRef.current = true;
    setStrategy(next);
  }, []);

  return {
    entries,
    strategy,
    handleEntriesChange,
    handleStrategyChange,
  };
}
