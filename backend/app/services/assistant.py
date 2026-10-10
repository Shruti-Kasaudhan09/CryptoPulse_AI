"""
assistant.py - "Ask CryptoPulse": answer questions using the project's own data

Two modes, chosen automatically:

1. AI mode (agentic). When an LLM API key is configured (see config.py), a
   language model is given a set of TOOLS - thin wrappers around this
   backend's own services (forecast, SHAP explanation, risk, sentiment, model
   accuracy, the user's portfolio). The model decides which tools to call,
   reads their JSON results and writes the answer. It is instructed to use
   only numbers returned by the tools, so answers are grounded in CryptoPulse
   data rather than the model's memory. Works with any OpenAI-compatible
   API: Google Gemini, Groq or OpenAI.

2. Offline mode. No key, no internet, or the LLM call fails -> a rule-based
   engine detects the coin(s) and intent (English, Hinglish or Hindi
   keywords) and answers from the same tools with templates. Less flexible,
   but it never breaks during a demo.

Every answer returns the data points it used ("sources") so it's auditable.
"""

import json
import re

from app.config import DISCLAIMER, LLM, SUPPORTED_COINS
from app.services import analysis, evaluation, explanation, market, prediction
from app.services.data import CoinNotFound, DataNotReady

MAX_TOOL_STEPS = 5


# ============================================================ tools
def _market(coin):
    d = market.get_market(coin, days=30)
    s = d["series"]
    first = s[0]["Close"] if s else None
    return {
        "coin": coin, "as_of": d["as_of"], "price_usd": round(d["latest"]["close"], 4),
        "change_24h_pct": round(d["latest"]["change_pct"], 2),
        "change_30d_pct": round((d["latest"]["close"] / first - 1) * 100, 2) if first else None,
        "rsi_14": round(d["latest"]["rsi"], 1),
        "high_30d": round(d["latest"]["high_period"], 4), "low_30d": round(d["latest"]["low_period"], 4),
    }


def _forecast(coin):
    p = prediction.get_prediction(coin)
    return {
        "coin": coin, "forecast_for": p["forecast_for"], "current_price": p["current_close"],
        "headline_model": p["headline"]["model"],
        "predicted_price": p["headline"]["predicted_close"],
        "predicted_return_pct": p["headline"]["predicted_return_pct"],
        "direction": p["headline"]["direction"],
        "models": [{"model": m["model"], "return_pct": m["predicted_return_pct"], "direction": m["direction"]}
                   for m in p["all_models"]],
        "models_up": p["agreement"]["up"], "models_down": p["agreement"]["down"],
        "vs_naive_baseline_pct": (p["skill_vs_naive"] or {}).get("improvement_pct"),
    }


def _explain(coin):
    e = explanation.get_explanation(coin, None, top_n=5)
    return {
        "coin": coin, "model": e["model"], "predicted_return_pct": round(e["predicted_return_pct"], 3),
        "average_forecast_pct": round(e["base_value_pct"], 3),
        "top_drivers": [
            {"feature": f["description"], "today_value": round(f["value"], 4),
             "pushed_forecast_pct_points": round(f["contribution_pct"], 3),
             "pushed_price_usd": round(f["contribution_usd"], 2)}
            for f in e["top_features"]
        ],
        "by_group_pct_points": {g["group"]: round(g["contribution_pct"], 3) for g in e["groups"]},
    }


def _risk(coin):
    v = analysis.get_volatility(coin, days=30)
    a = analysis.get_anomalies(coin, days=30, limit=3)
    return {
        "coin": coin, "volatility_level": v["level"],
        "daily_volatility_pct": round(v["value"] * 100, 2),
        "volatility_percentile": round(v["percentile"]),
        "anomaly_today": a["today_is_anomaly"], "anomaly_today_reason": a["today_reason"],
        "recent_anomalies": [{"date": r["date"], "reason": r["reason"], "return_pct": round(r["return_pct"], 2)}
                             for r in a["recent"]],
        "anomaly_rate_pct": round(a["total_flagged"] / a["total_days"] * 100, 1),
    }


def _pulse(coin, ctx):
    raw, available = ctx.get("sentiment", (0.0, False))
    p = analysis.get_pulse(coin, raw, available)
    return {"coin": coin, "score": p["score"], "labels": p["labels"],
            "components": {c["key"]: c["score"] for c in p["components"]}}


def _sentiment(ctx):
    hist = ctx.get("sentiment_history") or []
    if not hist:
        return {"available": False, "note": "No news sentiment has been logged yet."}
    l = hist[-1]
    return {"available": True, "date": str(l["date"]), "score_-1_to_1": l["sentiment_score"],
            "positive_pct": l["pos_pct"], "neutral_pct": l["neu_pct"], "negative_pct": l["neg_pct"],
            "headlines": l["n_articles"], "days_of_history": len(hist)}


def _performance(coin):
    out = {"coin": coin}
    try:
        arena = evaluation.get_arena(coin)
        out["holdout"] = [{"model": r["Model"], "mape_pct": r["MAPE (%)"],
                           "direction_accuracy_pct": r["Direction Accuracy (%)"]} for r in arena["rows"]]
    except DataNotReady:
        pass
    try:
        bt = evaluation.get_backtest(coin)
        out["walk_forward_backtest"] = [
            {"model": r["Model"], "rmse": r["RMSE"], "direction_accuracy_pct": r["Direction Accuracy (%)"]}
            for r in bt["summary"] if r["Model"] != "BuyAndHold"]
        out["backtest_days"] = bt["n_days"]
    except DataNotReady:
        pass
    return out


def _portfolio(ctx):
    if not ctx.get("portfolio"):
        return {"available": False, "note": "The user hasn't added any holdings on the My Portfolio page."}
    from app.services.portfolio import analyse_portfolio
    raw, available = ctx.get("sentiment", (0.0, False))
    p = analyse_portfolio(ctx["portfolio"], raw, available)
    return {
        "available": True, "total_value_usd": round(p["total_value"], 2),
        "expected_value_tomorrow_usd": round(p["expected_value_tomorrow"], 2),
        "expected_change_pct": round(p["expected_change_pct"], 3),
        "profit_loss_usd": None if p["pnl_total"] is None else round(p["pnl_total"], 2),
        "risk_label": p["risk"]["label"], "risk_score_0_100": p["risk"]["score"],
        "typical_daily_swing_usd": round(p["risk"]["daily_swing"], 2),
        "holdings": [{"coin": h["coin"], "amount": h["amount"], "value_usd": round(h["value"], 2),
                      "weight_pct": round(h["weight_pct"], 1), "forecast_direction": h["forecast_direction"],
                      "forecast_return_pct": h["forecast_return_pct"], "volatility": h["volatility_level"],
                      "anomaly_today": h["anomaly_today"]} for h in p["holdings"]],
        "insights": p["insights"],
    }


COIN_PARAM = {"type": "object", "properties": {"coin": {"type": "string", "enum": list(SUPPORTED_COINS),
              "description": "Coin symbol"}}, "required": ["coin"]}
NO_PARAM = {"type": "object", "properties": {}}

TOOLS = {
    "get_market": ("Current price, 24h and 30-day change, RSI and 30-day range for a coin.", COIN_PARAM,
                   lambda a, c: _market(a["coin"])),
    "get_forecast": ("Tomorrow's forecast from every model, the headline model, how many models agree, "
                     "and how the headline model compared with a naive 'tomorrow = today' baseline.",
                     COIN_PARAM, lambda a, c: _forecast(a["coin"])),
    "explain_forecast": ("SHAP explanation: which indicators pushed tomorrow's forecast up or down and by "
                         "how much.", COIN_PARAM, lambda a, c: _explain(a["coin"])),
    "get_risk": ("Volatility level vs the coin's own history, and Isolation Forest anomaly flags.",
                 COIN_PARAM, lambda a, c: _risk(a["coin"])),
    "get_pulse_score": ("The CryptoPulse Score (0-100) and its components.", COIN_PARAM,
                        lambda a, c: _pulse(a["coin"], c)),
    "get_news_sentiment": ("Latest FinBERT news sentiment (market-wide, not per coin).", NO_PARAM,
                           lambda a, c: _sentiment(c)),
    "get_model_performance": ("How accurate each model was historically (holdout test + walk-forward "
                              "backtest).", COIN_PARAM, lambda a, c: _performance(a["coin"])),
    "analyse_my_portfolio": ("Analyse the user's own holdings from the My Portfolio page: value, "
                             "tomorrow's expected value, risk, concentration.", NO_PARAM,
                             lambda a, c: _portfolio(c)),
}


def run_tool(name, args, ctx):
    if name not in TOOLS:
        return {"error": f"unknown tool {name}"}
    try:
        if "coin" in (args or {}):
            args["coin"] = str(args["coin"]).upper()
        return TOOLS[name][2](args or {}, ctx)
    except (DataNotReady, CoinNotFound) as e:
        return {"error": str(e)}


def _source_label(name, args):
    coin = (args or {}).get("coin")
    return f"{name}({coin})" if coin else name


# ============================================================ AI mode
SYSTEM_PROMPT = """You are CryptoPulse Assistant, built into the CryptoPulse AI dashboard (a student \
project analysing BTC, ETH and SOL with ML models).

Rules:
- ALWAYS call tools to get data before answering. Only state numbers that tools returned; never use \
prices or facts from your own memory.
- If the user doesn't name a coin, use the currently selected coin: {coin}.
- Reply in the same language the user writes in (English, Hindi or Hinglish).
- Be concise: 2-6 short sentences or a few bullets. Use **bold** for key numbers.
- Explain jargon simply (e.g. "RSI above 70 means the price rose fast recently").
- Forecasts are model estimates with limited accuracy. Never tell the user to buy or sell; if asked, \
explain what the data shows and say it isn't financial advice.
- Only answer questions about crypto markets, this dashboard, or the user's portfolio."""


def _llm_answer(question, history, ctx):
    import httpx

    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(coin=ctx["coin"])}]
    for turn in (history or [])[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])[:2000]})
    messages.append({"role": "user", "content": question})

    tools = [{"type": "function", "function": {"name": n, "description": d, "parameters": p}}
             for n, (d, p, _) in TOOLS.items()]
    used, sources = [], []
    headers = {"Authorization": f"Bearer {LLM['api_key']}", "Content-Type": "application/json"}
    url = LLM["base_url"].rstrip("/") + "/chat/completions"

    with httpx.Client(timeout=45) as client:
        for _ in range(MAX_TOOL_STEPS):
            r = client.post(url, headers=headers, json={
                "model": LLM["model"], "messages": messages, "tools": tools,
                "tool_choice": "auto", "temperature": 0.2,
            })
            r.raise_for_status()
            msg = r.json()["choices"][0]["message"]
            calls = msg.get("tool_calls") or []
            if not calls:
                return msg.get("content") or "", used, sources
            messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
            for call in calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = run_tool(name, args, ctx)
                used.append(_source_label(name, args))
                sources.append({"tool": _source_label(name, args), "data": result})
                messages.append({"role": "tool", "tool_call_id": call.get("id", name),
                                 "content": json.dumps(result, default=str)[:6000]})
    raise RuntimeError("The model kept calling tools without answering.")


# ============================================================ offline mode
COIN_WORDS = {
    "BTC": ["btc", "bitcoin", "बिटकॉइन", "बिटकोइन"],
    "ETH": ["eth", "ethereum", "ether", "इथेरियम", "एथेरियम"],
    "SOL": ["sol", "solana", "सोलाना"],
}

INTENTS = [
    ("portfolio", ["portfolio", "my coins", "my holdings", "holding", "i own", "i have", "पोर्टफोलियो",
                   "mera ", "meri ", "mere ", "मेरा", "मेरी", "मेरे"]),
    ("compare", ["compare", " vs", "versus", "better", "which coin", "तुलना", "kaun sa", "कौन सा", "konsa"]),
    ("why", ["why", "reason", "explain", "because", "क्यों", "kyu", "kyon", "kyun", "वजह", "कारण"]),
    ("model", ["model", "accura", "reliable", "trust", "backtest", "correct", "भरोसा", "सही"]),
    ("risk", ["risk", "safe", "volatil", "danger", "stable", "रिस्क", "सुरक्षित", "खतरा", "जोखिम"]),
    ("anomaly", ["anomal", "unusual", "strange", "weird", "अजीब", "असामान्य"]),
    ("sentiment", ["news", "sentiment", "headline", "mood", "खबर", "न्यूज़", "न्यूज"]),
    ("forecast", ["tomorrow", "forecast", "predict", "next day", "up or down", "go up", "go down", "future",
                  "कल", "kal", "बढ़", "गिर", "badh", "gir"]),
    ("score", ["score", "pulse", "स्कोर"]),
    ("price", ["price", "current", "today", "rate", "worth", "cost", "कीमत", "भाव", "दाम", "रेट", "आज"]),
]

HELP = ["hi", "hello", "hey", "help", "what can you", "namaste", "नमस्ते", "हेलो", "मदद"]


def _find_coins(q):
    found = []
    for coin, words in COIN_WORDS.items():
        for w in words:
            if re.search(rf"(?<![a-z]){re.escape(w)}(?![a-z])", q):
                found.append(coin)
                break
    return found


def _has(q, word):
    """Latin keywords must start at a word boundary ('rate' must not match 'accurate');
    Devanagari keywords are matched as plain substrings."""
    if word.isascii():
        return re.search(rf"(?<![a-z]){re.escape(word)}", q) is not None
    return word in q


def _find_intents(q):
    found = [name for name, words in INTENTS if any(_has(q, w) for w in words)]
    if "why" in found and "forecast" in found:
        found.remove("forecast")  # "why is the forecast up" -> the explanation already covers it
    return found


def _usd(v):
    return f"${v:,.2f}" if abs(v) < 1000 else f"${v:,.0f}"


def _arrow(d):
    return "▲ up" if d == "UP" else "▼ down"


def _offline_answer(question, ctx):
    q = " " + question.lower().strip() + " "
    coins = _find_coins(q) or [ctx["coin"]]
    intents = _find_intents(q)
    parts, used, sources = [], [], []

    def call(name, args=None):
        args = args or {}
        res = run_tool(name, dict(args), ctx)
        used.append(_source_label(name, args))
        sources.append({"tool": _source_label(name, args), "data": res})
        return res

    if not intents and any(_has(q, w) for w in HELP):
        return ("I can answer questions using CryptoPulse's own data, for example:\n"
                "- **Why** is the BTC forecast up or down?\n- Is **SOL risky** right now?\n"
                "- **Which model** is most accurate for ETH?\n- **Compare** BTC and ETH\n"
                "- How is **my portfolio** doing?"), used, sources

    if "portfolio" in intents:
        p = call("analyse_my_portfolio")
        if not p.get("available"):
            parts.append("You haven't added any holdings yet. Open **My Portfolio**, add what you own "
                         "(e.g. 0.05 BTC), then ask me again.")
        else:
            chg = p["expected_change_pct"]
            parts.append(f"Your portfolio is worth **{_usd(p['total_value_usd'])}**. Based on each coin's "
                         f"headline model, tomorrow's expected value is **{_usd(p['expected_value_tomorrow_usd'])}** "
                         f"({'+' if chg >= 0 else ''}{chg:.2f}%). Risk level: **{p['risk_label']}** "
                         f"(about ±{_usd(p['typical_daily_swing_usd'])} on a typical day).")
            if p["profit_loss_usd"] is not None:
                pl = p["profit_loss_usd"]
                parts.append(f"Profit/loss vs your buy prices: **{'+' if pl >= 0 else '−'}{_usd(abs(pl))}**.")
            parts.append("\n".join(f"- {i}" for i in p["insights"][:3]))
        intents = [i for i in intents if i != "portfolio"]

    if "compare" in intents or len(coins) > 1:
        cs = coins if len(coins) > 1 else list(SUPPORTED_COINS)
        lines = []
        for c in cs:
            f = call("get_forecast", {"coin": c})
            r = call("get_risk", {"coin": c})
            s = call("get_pulse_score", {"coin": c})
            if "error" in f:
                continue
            lines.append(f"- **{c}**: forecast {_arrow(f['direction'])} {f['predicted_return_pct']:+.2f}% · "
                         f"volatility {r.get('volatility_level', '?')} · CryptoPulse Score **{s.get('score', 0):.0f}**")
        parts.append("Side by side:\n" + "\n".join(lines))
        intents = [i for i in intents if i != "compare"]
        coins = coins[:1]

    coin = coins[0]
    if not intents and not parts:
        intents = ["price", "forecast", "risk"]

    for intent in intents[:3]:
        if intent == "price":
            m = call("get_market", {"coin": coin})
            if "error" in m:
                parts.append(m["error"]); continue
            rsi = m["rsi_14"]
            zone = "overbought (rose fast recently)" if rsi > 70 else "oversold (fell fast recently)" if rsi < 30 else "neutral"
            parts.append(f"**{coin}** closed at **{_usd(m['price_usd'])}** on {m['as_of']} "
                         f"({m['change_24h_pct']:+.2f}% in 24h, {m['change_30d_pct']:+.1f}% over 30 days). "
                         f"RSI is {rsi}, which is {zone}.")
        elif intent == "forecast":
            f = call("get_forecast", {"coin": coin})
            if "error" in f:
                parts.append(f["error"]); continue
            parts.append(f"For {f['forecast_for']}, **{f['headline_model']}** expects {coin} to go "
                         f"**{_arrow(f['direction'])}** to **{_usd(f['predicted_price'])}** "
                         f"({f['predicted_return_pct']:+.2f}%). {f['models_up']} of "
                         f"{f['models_up'] + f['models_down']} models agree it goes up.")
        elif intent == "why":
            e = call("explain_forecast", {"coin": coin})
            if "error" in e:
                parts.append(e["error"]); continue
            drivers = e["top_drivers"][:3]
            bits = [f"**{d['feature']}** ({'+' if d['pushed_price_usd'] >= 0 else '−'}"
                    f"{_usd(abs(d['pushed_price_usd']))})" for d in drivers]
            direction = "up" if e["predicted_return_pct"] > 0 else "down"
            parts.append(f"The {e['model']} model's forecast for {coin} points **{direction}** "
                         f"({e['predicted_return_pct']:+.3f}%). The biggest drivers were: " + ", ".join(bits)
                         + ". Positive values pushed the forecast up; negative values pulled it down.")
        elif intent == "risk":
            r = call("get_risk", {"coin": coin})
            if "error" in r:
                parts.append(r["error"]); continue
            txt = (f"{coin}'s volatility is **{r['volatility_level']}** right now: about "
                   f"{r['daily_volatility_pct']}% per day, higher than {r['volatility_percentile']}% of its past days.")
            txt += (f" ⚠ Today was flagged as an **anomaly**: {r['anomaly_today_reason']}."
                    if r["anomaly_today"] else " No anomaly was detected today.")
            parts.append(txt)
        elif intent == "anomaly":
            r = call("get_risk", {"coin": coin})
            if "error" in r:
                parts.append(r["error"]); continue
            recent = r["recent_anomalies"]
            head = (f"Today {coin} **was** flagged: {r['anomaly_today_reason']}." if r["anomaly_today"]
                    else f"No anomaly for {coin} today.")
            if recent:
                head += " Most recent flagged days:\n" + "\n".join(f"- {a['date']}: {a['reason']}" for a in recent)
            parts.append(head + "\n(An anomaly means statistically unusual, not fraud.)")
        elif intent == "sentiment":
            s = call("get_news_sentiment")
            if not s.get("available"):
                parts.append("No news sentiment has been logged yet. Run the daily sentiment logger first.")
            else:
                sc = s["score_-1_to_1"]
                mood = "positive" if sc > 0.1 else "negative" if sc < -0.1 else "neutral"
                parts.append(f"Crypto news mood is **{mood}** (score {sc:+.2f} on −1…+1, {s['date']}): "
                             f"{s['positive_pct']:.0f}% positive, {s['neutral_pct']:.0f}% neutral, "
                             f"{s['negative_pct']:.0f}% negative across {s['headlines']} headlines.")
        elif intent == "model":
            p = call("get_model_performance", {"coin": coin})
            bt = [r for r in p.get("walk_forward_backtest", []) if r["model"] != "Naive" and r["rmse"]]
            naive = next((r for r in p.get("walk_forward_backtest", []) if r["model"] == "Naive"), None)
            if not bt:
                parts.append("Model performance results aren't available yet. Run the pipeline first.")
                continue
            best = min(bt, key=lambda r: r["rmse"])
            best_dir = max(bt, key=lambda r: r["direction_accuracy_pct"] or 0)
            txt = (f"In the walk-forward backtest for {coin} ({p.get('backtest_days')} days), **{best['model']}** "
                   f"had the lowest price error and **{best_dir['model']}** called the direction right most often "
                   f"(**{best_dir['direction_accuracy_pct']}%**; 50% would be a coin flip).")
            if naive and naive["rmse"]:
                beat = best["rmse"] < naive["rmse"]
                txt += (" It beat the naive 'tomorrow = today' guess on error." if beat else
                        " Honestly, none beat the naive 'tomorrow = today' guess on price error, which is common "
                        "for daily crypto prices.")
            parts.append(txt)
        elif intent == "score":
            s = call("get_pulse_score", {"coin": coin})
            if "error" in s:
                parts.append(s["error"]); continue
            parts.append(f"{coin}'s CryptoPulse Score is **{s['score']:.0f}/100**: trend {s['labels']['trend']}, "
                         f"volatility {s['labels']['volatility']}, sentiment {s['labels']['sentiment']}, "
                         f"anomaly {s['labels']['anomaly']}. It's a summary, not a buy/sell signal.")

    return "\n\n".join(p for p in parts if p), used, sources


# ============================================================ entry point
SUGGESTIONS = [
    "Why is the {coin} forecast {dir} tomorrow?",
    "Is {coin} risky right now?",
    "Which model is most accurate for {coin}?",
    "Compare BTC, ETH and SOL",
    "How is my portfolio doing?",
    "What is the news mood today?",
]


def suggestions_for(coin):
    try:
        d = prediction.get_prediction(coin)["headline"]["direction"].lower()
    except Exception:
        d = "up or down"
    return [s.format(coin=coin, dir=d) for s in SUGGESTIONS]


def ask(question, coin="BTC", history=None, portfolio=None, sentiment=(0.0, False),
        sentiment_history=None):
    question = (question or "").strip()
    if not question:
        raise ValueError("Please type a question.")
    if len(question) > 1000:
        question = question[:1000]
    coin = coin.upper() if coin and coin.upper() in SUPPORTED_COINS else "BTC"
    ctx = {"coin": coin, "portfolio": portfolio or [], "sentiment": sentiment,
           "sentiment_history": sentiment_history or []}

    mode, note = "offline", None
    if LLM["enabled"]:
        try:
            answer, used, sources = _llm_answer(question, history, ctx)
            mode = "ai"
        except Exception as e:  # network down, bad key, rate limit... never break the demo
            note = f"AI mode unavailable ({type(e).__name__}); answered with the offline engine."
            answer, used, sources = _offline_answer(question, ctx)
    else:
        answer, used, sources = _offline_answer(question, ctx)

    return {
        "answer": answer.strip() or "I couldn't find data for that. Try one of the suggestions below.",
        "mode": mode,
        "provider": LLM["provider"] if mode == "ai" else None,
        "note": note,
        "tools_used": list(dict.fromkeys(used)),
        "sources": sources,
        "coin": coin,
        "suggestions": suggestions_for(coin),
        "disclaimer": DISCLAIMER,
    }
