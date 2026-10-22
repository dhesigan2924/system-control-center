import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './useToast';

export interface UseApiOptions {
  /** Auto refresh interval in milliseconds. 0 (default) disables auto refresh. */
  refreshInterval?: number;
  /**
   * Key used to share the last response between page mounts. When a page is
   * opened again the cached data is rendered immediately and refreshed in the
   * background instead of showing a loading spinner.
   */
  cacheKey?: string;
}

// Last response per cache key, kept between route changes
const responseCache = new Map<string, { data: unknown; updatedAt: Date }>();
const MAX_CACHE_ENTRIES = 50;

function cacheResponse(key: string, data: unknown) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { data, updatedAt: new Date() });
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options: UseApiOptions = {}
) {
  const { refreshInterval = 0, cacheKey } = options;

  const cached = cacheKey ? responseCache.get(cacheKey) : undefined;

  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  // `loading` only covers the very first load, background refreshes keep the
  // previously loaded data on screen instead of blanking the view.
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(cached?.updatedAt ?? null);
  const toast = useToast();

  // Keep the fetcher and toast in refs: they are recreated on every render and
  // would otherwise restart the request loop on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const hasDataRef = useRef(Boolean(cached));
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  const fetchData = useCallback(async () => {
    const initial = !hasDataRef.current;
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const result = await fetcherRef.current();
      setData(result);
      hasDataRef.current = true;
      setError(null);
      setUpdatedAt(new Date());
      if (cacheKeyRef.current) {
        cacheResponse(cacheKeyRef.current, result);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch data';
      setError(message);
      // Only surface a toast when there is nothing to show yet
      if (!hasDataRef.current) {
        toastRef.current.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  // Background refresh: keeps the view up to date without a manual reload
  useEffect(() => {
    if (!refreshInterval) return;
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchData, refreshInterval]);

  return { data, loading, refreshing, error, updatedAt, refetch: fetchData };
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let intervalId: ReturnType<typeof setInterval>;

    const fetchData = async () => {
      setRefreshing(true);
      try {
        const result = await fetcherRef.current();
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, interval);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [interval, enabled]);

  return { data, loading, refreshing, error };
}
