"""
train_lstm.py
--------------
Phase 8 of CryptoPulse AI: an LSTM that learns from sequences of past days
instead of a single day's snapshot, the way Random Forest/XGBoost do.

IMPORTANT DESIGN CHANGE from Phase 6:
Phase 6 predicted the next day's absolute CLOSE PRICE. Looking at the real
run results, that caused two problems:
  1. Tree models (RF/XGBoost) can't extrapolate past the price range they
     were trained on - on a trending asset like BTC that made them WORSE
     than plain Linear Regression, not better.
  2. Direction accuracy was close to a coin flip everywhere, and the one
     "good" F1 score (BTC RandomForest) turned out to just be the model
     predicting "UP" almost every day because BTC trended up overall.

So here the LSTM predicts the next day's PERCENTAGE RETURN instead of the
raw price. This keeps the target centered around 0 regardless of whether
the coin 10x'd or crashed during training, and we reconstruct the actual
predicted price afterwards as:

    predicted_next_close = today's_close * (1 + predicted_return)

This is the standard way time-series forecasting handles a strong trend,
and it's worth explicitly mentioning in your report as a deliberate fix,
not an afterthought.
"""

import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "evaluation"))
from metrics import full_report, print_report  # noqa: E402

try:
    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.models import Sequential
    TENSORFLOW_AVAILABLE = True
    tf.random.set_seed(42)
except ImportError:
    TENSORFLOW_AVAILABLE = False

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
COINS = ["BTC", "ETH", "SOL"]

LOOKBACK = 30          # how many past days the LSTM looks at to make one prediction
TRAIN_FRAC = 0.70
VAL_FRAC = 0.15
RETURN_SCALE = 100.0   # train on % returns (e.g. 1.5 instead of 0.015) - easier for the net to learn


def load_feature_data(coin_name):
    path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} not found - run features/indicators.py first.")
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"])
    return df


def add_return_target(df):
    """Same info as Target_NextClose, reframed as a % return relative to today's close."""
    df = df.copy()
    df["Target_NextReturn"] = (df["Target_NextClose"] - df["Close"]) / df["Close"] * RETURN_SCALE
    return df


def chronological_split(df, train_frac=TRAIN_FRAC, val_frac=VAL_FRAC):
    n = len(df)
    train_end = int(n * train_frac)
    val_end = int(n * (train_frac + val_frac))
    return df.iloc[:train_end], df.iloc[train_end:val_end], df.iloc[val_end:]


def create_sequences(df, feature_cols, target_col, lookback=LOOKBACK, closes=None):
    """
    Turns a flat dataframe into (X, y, current_price) arrays for the LSTM.

    X[i] = the `lookback` days of features ending at row i (inclusive)
    y[i] = the target at row i (the return from day i's close to day i+1's close)
    current_price[i] = day i's actual close - needed later to turn a
                        predicted return back into a predicted price

    IMPORTANT: `df` is usually the SCALED frame, and Close is one of the
    features, so df["Close"] holds standardised values (around -1..2), not
    dollars. Pass the real closes via `closes` whenever current_price will be
    used to rebuild a dollar price.
    """
    X, y, current_price = [], [], []
    values = df[feature_cols].values
    targets = df[target_col].values
    closes = df["Close"].values if closes is None else np.asarray(closes)

    for i in range(lookback - 1, len(df)):
        X.append(values[i - lookback + 1: i + 1])
        y.append(targets[i])
        current_price.append(closes[i])

    return np.array(X), np.array(y), np.array(current_price)


def build_model(n_timesteps, n_features):
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=(n_timesteps, n_features)),
        Dropout(0.2),
        LSTM(32),
        Dropout(0.2),
        Dense(16, activation="relu"),
        Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    return model


def run_for_coin(coin_name):
    print(f"\n{'='*60}")
    print(f"  {coin_name} - LSTM")
    print(f"{'='*60}")

    df = load_feature_data(coin_name)
    df = add_return_target(df)

    feature_cols = [c for c in df.columns if c not in ("Date", "Target_NextClose", "Target_NextReturn")]

    train_df, val_df, test_df = chronological_split(df)

    if len(train_df) < LOOKBACK + 20:
        print(f"  Not enough data for a {LOOKBACK}-day lookback window, skipping.")
        return None

    # fit the scaler ONLY on training data - fitting it on everything would
    # leak information about future price ranges into the training process
    scaler = StandardScaler()
    scaler.fit(train_df[feature_cols])

    def scale(d):
        scaled = d.copy()
        scaled[feature_cols] = scaler.transform(d[feature_cols])
        return scaled

    # scale each split with the same (train-fitted) scaler, but build
    # sequences from a version that includes some trailing context from the
    # previous split so we don't lose the first `lookback` rows of val/test
    train_scaled = scale(train_df)
    val_context = pd.concat([train_df.tail(LOOKBACK - 1), val_df]).pipe(scale)
    test_raw = pd.concat([val_df.tail(LOOKBACK - 1), test_df])
    test_context = test_raw.pipe(scale)

    X_train, y_train, _ = create_sequences(train_scaled, feature_cols, "Target_NextReturn")
    X_val, y_val, _ = create_sequences(val_context, feature_cols, "Target_NextReturn")
    # real dollar closes (not the scaled ones) so prices are rebuilt correctly
    X_test, y_test, test_current_price = create_sequences(
        test_context, feature_cols, "Target_NextReturn", closes=test_raw["Close"].values
    )

    print(f"  Sequences -> train: {X_train.shape}, val: {X_val.shape}, test: {X_test.shape}")

    model = build_model(n_timesteps=LOOKBACK, n_features=len(feature_cols))

    early_stop = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True)
    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=32,
        callbacks=[early_stop],
        verbose=0,
    )

    pred_return_scaled = model.predict(X_test, verbose=0).flatten()
    pred_return = pred_return_scaled / RETURN_SCALE

    # reconstruct actual predicted price from the predicted return
    pred_next_close = test_current_price * (1 + pred_return)
    true_next_close = test_current_price * (1 + (y_test / RETURN_SCALE))

    report = full_report(test_current_price, true_next_close, pred_next_close)
    print_report(f"{coin_name} - LSTM", report)

    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    model.save(os.path.join(SAVED_MODELS_DIR, f"{coin_name}_LSTM.keras"))
    joblib.dump(scaler, os.path.join(SAVED_MODELS_DIR, f"{coin_name}_LSTM_scaler.joblib"))

    return report


def append_to_arena_csv(all_results):
    """Adds LSTM rows to the existing model_arena_results.csv from Phase 6/7, if it exists."""
    csv_path = os.path.join(SAVED_MODELS_DIR, "model_arena_results.csv")
    rows = []
    for coin, report in all_results.items():
        if report is None:
            continue
        rows.append({
            "Coin": coin,
            "Model": "LSTM",
            "MAE": round(report["MAE"], 2),
            "RMSE": round(report["RMSE"], 2),
            "MAPE (%)": round(report["MAPE"], 2),
            "Direction Accuracy (%)": round(report["Accuracy"] * 100, 1),
            "Direction F1 (%)": round(report["F1"] * 100, 1),
        })
    if not rows:
        return

    new_rows_df = pd.DataFrame(rows)
    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path)
        existing = existing[existing["Model"] != "LSTM"]  # replace any previous LSTM run
        combined = pd.concat([existing, new_rows_df], ignore_index=True)
    else:
        combined = new_rows_df

    combined.to_csv(csv_path, index=False)
    print(f"\nUpdated -> {csv_path}")


if __name__ == "__main__":
    print("=== CryptoPulse AI - LSTM Training (Phase 8) ===")

    if not TENSORFLOW_AVAILABLE:
        print("\ntensorflow is not installed. Run: pip install tensorflow")
        sys.exit(1)

    all_results = {}
    for coin in COINS:
        try:
            all_results[coin] = run_for_coin(coin)
        except FileNotFoundError as e:
            print(f"\n{coin}: {e}")

    append_to_arena_csv(all_results)

    print(f"\n{'='*60}")
    print("  Done. Compare these numbers against saved_models/model_arena_results.csv")
    print("  from Phase 6/7 - the LSTM should handle the trending-price problem better")
    print("  than the tree models did, since it's predicting returns, not raw price.")
    print("  Next step: Phase 9 - crypto news sentiment (FinBERT)")
    print(f"{'='*60}")
