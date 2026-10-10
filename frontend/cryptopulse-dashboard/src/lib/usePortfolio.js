import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { load, PORTFOLIO_KEY, save } from "./storage";

/**
 * The user's holdings.
 *  - Guest: kept in this browser (localStorage).
 *  - Signed in: loaded from / saved to their account, so it follows them to
 *    any device. On first sign-in, holdings entered as a guest are uploaded
 *    if the account has none yet.
 * Returns { holdings, setHoldings, where, ready }.
 */
export function usePortfolio() {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState(() => load(PORTFOLIO_KEY, []));
  const [ready, setReady] = useState(!user);
  const loadedFor = useRef(null);

  // load from the account when signed in
  useEffect(() => {
    if (!user) {
      if (loadedFor.current) setHoldings([]); // just signed out - forget the account's holdings
      loadedFor.current = null;
      setReady(true);
      return undefined;
    }
    let alive = true;
    setReady(false);
    api.myPortfolio().then(({ holdings: server }) => {
      if (!alive) return;
      const local = load(PORTFOLIO_KEY, []);
      if (!server.length && local.length) {
        api.saveMyPortfolio(local).catch(() => {});
        setHoldings(local);
      } else {
        setHoldings(server);
      }
      loadedFor.current = user.id;
      setReady(true);
    }).catch(() => { if (alive) { loadedFor.current = user.id; setReady(true); } });
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // save on every change
  useEffect(() => {
    if (!ready) return;
    save(PORTFOLIO_KEY, holdings);
    if (user && loadedFor.current === user.id) {
      api.saveMyPortfolio(holdings).catch(() => {});
    }
  }, [holdings, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return { holdings, setHoldings, where: user ? "account" : "browser", ready };
}
