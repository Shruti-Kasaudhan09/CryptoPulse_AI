import { useCallback, useEffect, useState } from "react";

/**
 * useApi(fetcher, deps) -> { data, error, loading, reload }
 * Cancels the in-flight request when deps change or the component unmounts,
 * so switching coins quickly never shows a stale coin's data.
 */
export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ data: s.data, error: null, loading: true }));
    fetcher({ signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ data: null, error, loading: false });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
