"""
shap_explain.py
-----------------
Phase 13 of CryptoPulse AI: explain WHY the model predicted what it did,
using SHAP (SHapley Additive exPlanations).

Loads the RandomForest model saved in Phase 6 and the feature dataset, then
for the most recent day, breaks down exactly how much each feature pushed
the prediction up or down. This is the "Why this prediction?" screen from
the roadmap - the answer to a judge asking "how do you know the model isn't
a black box?"

Requires train_models.py (Phase 6) to have been run first, since it needs
the saved .joblib model.
"""

import os

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
COINS = ["BTC", "ETH", "SOL"]
MODEL_NAME = "RandomForest"  # SHAP's TreeExplainer works cleanly with tree models

NON_FEATURE_COLS = ["Date", "Target_NextClose"]


def explain_coin(coin_name):
    model_path = os.path.join(SAVED_MODELS_DIR, f"{coin_name}_{MODEL_NAME}.joblib")
    features_path = os.path.join(DATA_DIR, f"{coin_name}_features.csv")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"{model_path} not found - run models/train_models.py first.")
    if not os.path.exists(features_path):
        raise FileNotFoundError(f"{features_path} not found - run features/indicators.py first.")

    model = joblib.load(model_path)
    df = pd.read_csv(features_path)
    feature_cols = [c for c in df.columns if c not in NON_FEATURE_COLS]

    X = df[feature_cols]

    print(f"  Computing SHAP values for {len(X)} rows...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # global summary plot - which features matter most overall
    plt.figure()
    shap.summary_plot(shap_values, X, show=False)
    summary_path = os.path.join(SAVED_MODELS_DIR, f"{coin_name}_shap_summary.png")
    plt.tight_layout()
    plt.savefig(summary_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved global summary plot -> {summary_path}")

    # explanation for the single most recent day - "why THIS prediction"
    last_row_idx = len(X) - 1
    last_row_shap = shap_values[last_row_idx]
    contributions = pd.Series(last_row_shap, index=feature_cols).sort_values(key=abs, ascending=False)

    predicted_price = model.predict(X.iloc[[last_row_idx]])[0]
    # newer SHAP versions return expected_value as a 1-element array rather
    # than a float - normalise it so formatting works on any version
    base_value = float(np.ravel(explainer.expected_value)[0])

    print(f"\n  Most recent prediction for {coin_name}: ${predicted_price:,.2f}")
    print(f"  Base value (average prediction): ${base_value:,.2f}")
    print(f"  Top 8 features pushing this prediction:")
    for feature, contribution in contributions.head(8).items():
        direction = "+" if contribution > 0 else ""
        print(f"    {feature:<20} {direction}{contribution:,.2f}")

    return contributions


if __name__ == "__main__":
    print("=== CryptoPulse AI - SHAP Explainability (Phase 13) ===")

    for coin in COINS:
        print(f"\n{'='*60}\n  {coin}\n{'='*60}")
        try:
            explain_coin(coin)
        except FileNotFoundError as e:
            print(f"  {e}")

    print("\nNote: this explains RandomForest specifically (SHAP's TreeExplainer")
    print("works fastest and most reliably on tree models). For the LSTM you'd")
    print("need shap.DeepExplainer or shap.GradientExplainer instead - a good")
    print("stretch goal if you want to extend this phase.")
