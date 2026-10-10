"""
backtest.py
------------
Phase 20 of CryptoPulse AI: walk-forward backtesting.

Phase 6/7 evaluated each model ONCE: train on the first 70% of history, test
on the last 15%. That's a single snapshot. A walk-forward backtest is closer
to how the model would actually have been used:

    for each day t in the test period:
        (every RETRAIN_EVERY days) retrain on ALL data up to day t
        predict day t+1 using only information available on day t
        record prediction vs what actually happened

So the model never sees the future, and it keeps getting retrained as new
data arrives - just like a deployed system would be.

Design choices (explain these in your report/viva):
  1. Target = next-day % RETURN, not raw price (same fix as Phase 8's LSTM,
     for the same reason: tree models can't extrapolate to new price highs).
  2. Features are made STATIONARY (ratios/percentages, not dollar levels),
     e.g. Close/SMA_30 - 1 instead of SMA_30. A model trained when BTC was
     $40k and tested at $100k then sees inputs on a comparable scale.
  3. A "Naive" persistence baseline (tomorrow = today, i.e. 0% return) is
     included. In finance this baseline is notoriously hard to beat on price
     error - if a model can't beat it, say so honestly.
  4. The hypothetical equity curve is ILLUSTRATIVE ONLY: long when the model
     predicts UP, in cash otherwise, with a 0.1% fee per position change.
     It is not a trading strategy and not a promise of returns.
  5. After backtesting, each return-model is retrained on all history and
     saved as {COIN}_{Model}_returns.joblib. These - not the Phase 6
     price-level models - power the live dashboard forecast and the
     "Why this prediction?" page. Phase 6 models remain in the Model Arena
     as the documented baseline that motivated this change.

Usage:
    python evaluation/backtest.py
"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.append(os.path.dirname(__file__))
from metrics import full_report, print_report  # noqa: E402

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
COINS = ["BTC", "ETH", "SOL"]

TEST_FRAC = 0.30        # backtest over the most recent 30% of days
RETRAIN_EVERY = 7       # retrain weekly (daily is slower and barely changes results)
MIN_TRAIN_ROWS = 120
FEE = 0.001             # 0.1% per position change, for the illustrative equity curve

STATIONARY_FEATURES = [
    "Return_1d", "Return_7d", "RSI_14", "Volatility_14", "Volume_Change",
    "Close_vs_SMA7", "Close_vs_SMA30", "Close_vs_EMA14", "BB_Position",
    "MACD_Norm", "MACD_Hist_Norm", "Momentum_Norm",
]


def add_stationary_features(df):
    """Converts dollar-level indicators into scale-free ratios."""
    df = df.copy()
    close = df["Close"]
    df["Close_vs_SMA7"] = close / df["SMA_7"] - 1
    df["Close_vs_SMA30"] = close / df["SMA_30"] - 1
    df["Close_vs_EMA14"] = close / df["EMA_14"] - 1
    band = (df["BB_Upper"] - df["BB_Lower"]).replace(0, np.nan)
    df["BB_Position"] = ((close - df["BB_Lower"]) / band).fillna(0.5)
    df["MACD_Norm"] = df["MACD"] / close
    df["MACD_Hist_Norm"] = df["MACD_Hist"] / close
    df["Momentum_Norm"] = df["Momentum_10"] / close
    # Volume_Change can be huge on a zero-volume day - clip so one bad row
    # doesn't dominate a linear model
    df["Volume_Change"] = df["Volume_Change"].clip(-5, 5)
    df["Target_NextReturn"] = df["Target_NextClose"] / close - 1
    return df


def make_models():
    models = {
        # Ridge = linear regression with a little regularisation, which keeps
        # it stable when features are correlated. Features are standardised
        # first so the penalty treats RSI (~50) and returns (~0.01) fairly.
        "Ridge": lambda: make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "RandomForest": lambda: RandomForestRegressor(
            n_estimators=150, max_depth=5, min_samples_leaf=10, random_state=42, n_jobs=-1
        ),
    }
    if XGBOOST_AVAILABLE:
        models["XGBoost"] = lambda: XGBRegressor(
            n_estimators=150, max_depth=3, learning_rate=0.05, subsample=0.8,
            random_state=42, verbosity=0,
        )
    return models


def walk_forward(df, test_frac=TEST_FRAC, retrain_every=RETRAIN_EVERY):
    """
    Returns a dataframe with one row per test day:
        Date, Close (today), Actual_NextClose, Pred_<model> for every model.
    """
    df = add_stationary_features(df).reset_index(drop=True)
    n = len(df)
    start = max(int(n * (1 - test_frac)), MIN_TRAIN_ROWS)
    if start >= n:
        raise ValueError(f"Not enough rows for a backtest ({n} rows, need > {MIN_TRAIN_ROWS}).")

    factories = make_models()
    preds = {name: np.full(n, np.nan) for name in factories}
    fitted = {}

    for t in range(start, n):
        if (t - start) % retrain_every == 0:
            train = df.iloc[:t]  # everything strictly before day t
            X_train = train[STATIONARY_FEATURES]
            y_train = train["Target_NextReturn"].values
            for name, factory in factories.items():
                model = factory()
                model.fit(X_train, y_train)
                fitted[name] = model

        x_today = df.iloc[[t]][STATIONARY_FEATURES]
        for name, model in fitted.items():
            preds[name][t] = model.predict(x_today)[0]

    test = df.iloc[start:].copy()
    out = pd.DataFrame({
        "Date": test["Date"].values,
        "Close": test["Close"].values,
        "Actual_NextClose": test["Target_NextClose"].values,
        "Pred_Naive": test["Close"].values,  # persistence baseline
    })
    for name in factories:
        out[f"Pred_{name}"] = test["Close"].values * (1 + preds[name][start:])
    return out


def equity_curve(bt, model_col):
    """
    ILLUSTRATIVE ONLY. Long for the next day when the model predicts UP,
    otherwise in cash. Returns cumulative growth of $1.
    """
    actual_ret = bt["Actual_NextClose"] / bt["Close"] - 1
    signal = (bt[model_col] > bt["Close"]).astype(int)
    trades = signal.diff().abs().fillna(signal.iloc[0])
    strat_ret = signal * actual_ret - trades * FEE
    return (1 + strat_ret).cumprod()


def summarise(bt):
    rows = {}
    for col in [c for c in bt.columns if c.startswith("Pred_")]:
        name = col.replace("Pred_", "")
        report = full_report(bt["Close"], bt["Actual_NextClose"], bt[col])
        if name == "Naive":
            # the persistence baseline never predicts UP, so its direction
            # metrics are meaningless - blank them rather than report 0%
            for k in ("Accuracy", "Precision", "Recall", "F1"):
                report[k] = np.nan
            report["Final_Equity"] = np.nan
        else:
            report["Final_Equity"] = equity_curve(bt, col).iloc[-1]
        rows[name] = report
    rows["BuyAndHold"] = {
        "Final_Equity": (bt["Actual_NextClose"].iloc[-1] / bt["Close"].iloc[0]),
    }
    return rows


def train_final_models(df, coin_name):
    """
    After the backtest has measured how well each return-model generalises,
    retrain each one on ALL available history and save it. These are the
    models the API/dashboard uses for live forecasts and SHAP explanations:
    they predict % return from scale-free features, so they don't suffer the
    Phase 6 problem of tree models being unable to extrapolate to new highs.
    """
    df = add_stationary_features(df).dropna(subset=["Target_NextReturn"])
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    for name, factory in make_models().items():
        model = factory()
        model.fit(df[STATIONARY_FEATURES], df["Target_NextReturn"].values)
        joblib.dump(model, os.path.join(SAVED_MODELS_DIR, f"{coin_name}_{name}_returns.joblib"))


def run_for_coin(coin_name):
    path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} not found - run features/indicators.py first.")
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"])

    print(f"\n{'='*60}\n  {coin_name} - walk-forward backtest\n{'='*60}")
    bt = walk_forward(df)
    print(f"  Test days: {len(bt)}  ({bt['Date'].iloc[0].date()} -> {bt['Date'].iloc[-1].date()})"
          f"  | retrained every {RETRAIN_EVERY} days")

    summary = summarise(bt)
    for name, report in summary.items():
        if name in ("BuyAndHold",):
            continue
        if name == "Naive":
            print(f"  Naive (tomorrow = today)\n    MAE: ${report['MAE']:,.2f}   RMSE: ${report['RMSE']:,.2f}"
                  f"   MAPE: {report['MAPE']:.2f}%")
        else:
            print_report(name, report)

    os.makedirs(DATA_DIR, exist_ok=True)
    bt_out = bt.copy()
    for col in [c for c in bt.columns if c.startswith("Pred_") and c != "Pred_Naive"]:
        bt_out[f"Equity_{col.replace('Pred_', '')}"] = equity_curve(bt, col).values
    bt_out["Equity_BuyAndHold"] = (bt["Actual_NextClose"] / bt["Close"].iloc[0]).values
    bt_out.to_csv(os.path.join(DATA_DIR, f"{coin_name}_backtest.csv"), index=False)

    train_final_models(df, coin_name)
    print(f"  Saved final return-models -> saved_models/{coin_name}_<model>_returns.joblib")
    return summary


def save_summary(all_results):
    rows = []
    for coin, models in all_results.items():
        for model, r in models.items():
            rows.append({
                "Coin": coin, "Model": model,
                "MAE": round(r.get("MAE", np.nan), 2),
                "RMSE": round(r.get("RMSE", np.nan), 2),
                "MAPE (%)": round(r.get("MAPE", np.nan), 3),
                "Direction Accuracy (%)": round(r.get("Accuracy", np.nan) * 100, 1),
                "Direction F1 (%)": round(r.get("F1", np.nan) * 100, 1),
                "Illustrative Final Equity": round(r.get("Final_Equity", np.nan), 3),
            })
    out = pd.DataFrame(rows)
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    path = os.path.join(SAVED_MODELS_DIR, "backtest_results.csv")
    out.to_csv(path, index=False)
    print(f"\nSaved backtest summary -> {path}")
    return out


if __name__ == "__main__":
    print("=== CryptoPulse AI - Walk-forward Backtest (Phase 20) ===")
    results = {}
    for coin in COINS:
        try:
            results[coin] = run_for_coin(coin)
        except (FileNotFoundError, ValueError) as e:
            print(f"\n{coin}: {e}")
    if results:
        table = save_summary(results)
        print("\n" + table.to_string(index=False))
    print("\nReminder: this is historical evaluation, not a promise of future returns.")
