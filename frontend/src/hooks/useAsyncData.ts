import { useCallback, useEffect, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/** Loads data when deps change; `reload()` fetches again keeping the current data on screen. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    loader().then(
      (data) => active && setState({ data, error: undefined, loading: false }),
      (error: unknown) => active && setState((current) => ({ ...current, error, loading: false })),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
}
