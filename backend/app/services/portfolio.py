"""
portfolio.py - "My Portfolio": analyse the user's OWN holdings

The user sends what they hold, e.g.
    [{"coin": "BTC", "amount": 0.05, "buy_price": 60000}, {"coin": "ETH", "amount": 2}]
and gets back, using the same models as the rest of the dashboard:
  - current value, profit/loss (if a buy price was given) and allocation
  - tomorrow's expected value, using each coin's headline forecast model
  - a risk read: value-weighted volatility, anomaly flags, concentration
  - plain-language insights

Nothing is stored on the server - holdings stay in the user's browser.
"""

from app.config import DISCLAIMER, SUPPORTED_COINS
from app.services.analysis import get_anomalies, get_pulse, get_volatility
from app.services.data import BadRequest, CoinNotFound, normalise_coin
from app.services.prediction import get_prediction

VOL_RISK = {"Low": 1, "Medium": 2, "High": 3}
MAX_HOLDINGS = 20


def _clean_holdings(holdings):
    if not isinstance(holdings, list) or not holdings:
        raise BadRequest("Add at least one holding, e.g. {\"coin\": \"BTC\", \"amount\": 0.1}.")
    if len(holdings) > MAX_HOLDINGS:
        raise BadRequest(f"At most {MAX_HOLDINGS} holdings.")

    merged = {}
    for h in holdings:
        if not isinstance(h, dict):
            raise BadRequest("Each holding must look like {\"coin\": \"BTC\", \"amount\": 0.1}.")
        try:
            coin = normalise_coin(str(h.get("coin", "")))
        except CoinNotFound as e:
            raise BadRequest(str(e))
        try:
            amount = float(h.get("amount", 0))
        except (TypeError, ValueError):
            raise BadRequest(f"Amount for {coin} must be a number.")
        if not amount > 0:
            raise BadRequest(f"Amount for {coin} must be greater than 0.")
        buy = h.get("buy_price")
        if buy in ("", None):
            buy = None
        else:
            try:
                buy = float(buy)
            except (TypeError, ValueError):
                raise BadRequest(f"Buy price for {coin} must be a number.")
            if not buy > 0:
                raise BadRequest(f"Buy price for {coin} must be greater than 0.")

        # the same coin entered twice -> combine, with a weighted average buy price
        if coin in merged:
            m = merged[coin]
            if m["buy_price"] is not None and buy is not None:
                m["buy_price"] = (m["buy_price"] * m["amount"] + buy * amount) / (m["amount"] + amount)
            else:
                m["buy_price"] = None
            m["amount"] += amount
        else:
            merged[coin] = {"coin": coin, "amount": amount, "buy_price": buy}
    return list(merged.values())


def analyse_portfolio(holdings, sentiment_raw=0.0, sentiment_available=False) -> dict:
    items = _clean_holdings(holdings)

    rows = []
    for h in items:
        coin = h["coin"]
        pred = get_prediction(coin)
        vol = get_volatility(coin, days=30)
        anom = get_anomalies(coin, days=30, limit=1)
        pulse = get_pulse(coin, sentiment_raw, sentiment_available)

        price = pred["current_close"]
        value = h["amount"] * price
        exp_ret = pred["headline"]["predicted_return_pct"] / 100
        row = {
            "coin": coin,
            "name": SUPPORTED_COINS[coin],
            "amount": h["amount"],
            "price": price,
            "value": value,
            "buy_price": h["buy_price"],
            "cost": h["amount"] * h["buy_price"] if h["buy_price"] else None,
            "forecast_return_pct": pred["headline"]["predicted_return_pct"],
            "forecast_direction": pred["headline"]["direction"],
            "forecast_model": pred["headline"]["model"],
            "expected_value_tomorrow": value * (1 + exp_ret),
            "volatility_level": vol["level"],
            "volatility_daily_pct": vol["value"] * 100,
            "anomaly_today": anom["today_is_anomaly"],
            "pulse_score": pulse["score"],
            "as_of": pred["as_of"],
        }
        if row["cost"]:
            row["pnl"] = value - row["cost"]
            row["pnl_pct"] = (value / row["cost"] - 1) * 100
        else:
            row["pnl"] = row["pnl_pct"] = None
        rows.append(row)

    total = sum(r["value"] for r in rows)
    for r in rows:
        r["weight_pct"] = r["value"] / total * 100 if total else 0
    rows.sort(key=lambda r: -r["value"])

    exp_total = sum(r["expected_value_tomorrow"] for r in rows)
    costed = [r for r in rows if r["cost"]]
    cost_total = sum(r["cost"] for r in costed)
    pnl_total = sum(r["pnl"] for r in costed) if costed else None

    # value-weighted risk: 1 (all Low) .. 3 (all High), then scaled to 0-100
    risk_raw = sum(VOL_RISK[r["volatility_level"]] * r["weight_pct"] / 100 for r in rows)
    risk_score = round((risk_raw - 1) / 2 * 100)
    risk_label = "Low" if risk_score < 34 else "Moderate" if risk_score < 67 else "High"
    top = rows[0]
    # expected 1-day swing (±1σ) in currency terms, from each coin's own volatility
    daily_swing = sum(r["value"] * r["volatility_daily_pct"] / 100 for r in rows)
    pulse_avg = sum(r["pulse_score"] * r["weight_pct"] / 100 for r in rows)

    insights = []
    if top["weight_pct"] >= 70 and len(rows) > 1:
        insights.append(f"{top['weight_pct']:.0f}% of your portfolio is in {top['coin']}, so its moves "
                        f"dominate your results. That's highly concentrated.")
    elif len(rows) == 1:
        insights.append(f"Everything is in {top['coin']}. A single-coin portfolio has no diversification.")
    else:
        insights.append(f"Your largest holding is {top['coin']} at {top['weight_pct']:.0f}% of the value.")
    high = [r["coin"] for r in rows if r["volatility_level"] == "High"]
    if high:
        insights.append(f"{', '.join(high)} {'is' if len(high) == 1 else 'are'} in a high-volatility "
                        f"period compared with {'its' if len(high) == 1 else 'their'} own history.")
    flagged = [r["coin"] for r in rows if r["anomaly_today"]]
    if flagged:
        insights.append(f"The anomaly detector flagged today's trading in {', '.join(flagged)} as unusual.")
    ups = [r["coin"] for r in rows if r["forecast_direction"] == "UP"]
    downs = [r["coin"] for r in rows if r["forecast_direction"] == "DOWN"]
    if ups and downs:
        insights.append(f"Models lean up for {', '.join(ups)} and down for {', '.join(downs)} tomorrow.")
    elif ups:
        insights.append("Models lean up for every coin you hold tomorrow. Remember these are estimates.")
    else:
        insights.append("Models lean down for every coin you hold tomorrow. Remember these are estimates.")
    insights.append(f"On a typical day your portfolio could swing about ±${daily_swing:,.0f} "
                    f"(one standard deviation of recent daily moves).")

    return {
        "total_value": total,
        "expected_value_tomorrow": exp_total,
        "expected_change": exp_total - total,
        "expected_change_pct": (exp_total / total - 1) * 100 if total else 0,
        "cost_total": cost_total or None,
        "pnl_total": pnl_total,
        "pnl_total_pct": (pnl_total / cost_total * 100) if pnl_total is not None and cost_total else None,
        "risk": {"score": risk_score, "label": risk_label, "daily_swing": daily_swing},
        "pulse_weighted": round(pulse_avg, 1),
        "holdings": rows,
        "insights": insights,
        "as_of": max(r["as_of"] for r in rows),
        "disclaimer": DISCLAIMER,
    }
