"""
train_models.py
----------------
Phase 5 + 6 of CryptoPulse AI.

Phase 5 - defining the task:
We're predicting Target_NextClose (tomorrow's closing price) from today's
features. This is a regression task. We also derive a direction (UP/DOWN)
from it for the direction metrics.

Phase 6 - baseline models:
We train three models of increasing complexity so we can compare them
honestly instead of just picking one:
    1. Linear Regression   - simplest possible baseline
    2. Random Forest       - handles non-linearity, less prone to overfitting
    3. XGBoost              - usually the strongest of the three on tabular data

IMPORTANT: this is a time-series problem. We do NOT shuffle the data before
splitting - the test set must be the most recent chunk of time, otherwise
the model would be "seeing the future" during training, which quietly
inflates every metric and is a very common mistake in student projects.
"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "evaluation"))
from metrics import full_report, print_report  # noqa: E402

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
COINS = ["BTC", "ETH", "SOL"]

# columns that aren't features - Date is metadata, Close/Target are what we
# use to build features or what we're predicting, not inputs themselves
NON_FEATURE_COLS = ["Date", "Target_NextClose"]


def chronological_split(df, train_frac=0.70, val_frac=0.15):
    """
    Splits a time-ordered dataframe into train/val/test WITHOUT shuffling.
    train_frac + val_frac must be < 1, the remainder becomes the test set.
    """
    n = len(df)
    train_end = int(n * train_frac)
    val_end = int(n * (train_frac + val_frac))

    train_df = df.iloc[:train_end]
    val_df = df.iloc[train_end:val_end]
    test_df = df.iloc[val_end:]

    return train_df, val_df, test_df


def get_feature_columns(df):
    return [c for c in df.columns if c not in NON_FEATURE_COLS]


def load_feature_data(coin_name):
    path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} not found - run features/indicators.py first.")
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"])
    return df


def train_and_evaluate(coin_name, model_name, model, train_df, test_df, feature_cols):
    X_train = train_df[feature_cols]
    y_train = train_df["Target_NextClose"]
    X_test = test_df[feature_cols]
    y_test = test_df["Target_NextClose"]

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # "current price" for direction scoring = today's actual close, i.e.
    # the Close column of the same rows we're predicting the next day for
    current_price = test_df["Close"].values

    report = full_report(current_price, y_test.values, y_pred)
    print_report(f"{coin_name} - {model_name}", report)

    # save the trained model so the API/dashboard can load it later without
    # retraining every time
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    model_path = os.path.join(SAVED_MODELS_DIR, f"{coin_name}_{model_name}.joblib")
    joblib.dump(model, model_path)

    return report


def run_for_coin(coin_name):
    print(f"\n{'='*60}")
    print(f"  {coin_name}")
    print(f"{'='*60}")

    df = load_feature_data(coin_name)
    train_df, val_df, test_df = chronological_split(df)
    feature_cols = get_feature_columns(df)

    print(f"  Train: {len(train_df)} rows | Val: {len(val_df)} rows | Test: {len(test_df)} rows")
    print(f"  Features used ({len(feature_cols)}): {feature_cols}\n")

    models = {
        "LinearRegression": LinearRegression(),
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=8, random_state=42
        ),
    }

    if XGBOOST_AVAILABLE:
        models["XGBoost"] = XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            random_state=42,
            verbosity=0,
        )
    else:
        print("  (xgboost not installed - skipping. Run: pip install xgboost)")

    results = {}
    for model_name, model in models.items():
        results[model_name] = train_and_evaluate(
            coin_name, model_name, model, train_df, test_df, feature_cols
        )

    return results


if __name__ == "__main__":
    print("=== CryptoPulse AI - Baseline Model Training (Phase 5 & 6) ===")

    all_results = {}
    for coin in COINS:
        try:
            all_results[coin] = run_for_coin(coin)
        except FileNotFoundError as e:
            print(f"\n{coin}: {e}")

    print(f"\n{'='*60}")
    print("  Done. Trained models are saved in ml/saved_models/")
    print("  Next step: run models/model_arena.py to compare all results in one table")
    print(f"{'='*60}")
