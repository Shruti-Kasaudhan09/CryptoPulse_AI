"""
model_arena.py
---------------
Runs train_models.py for every coin, collects all the metrics into one
comparison table, and saves a bar chart comparing RMSE across models.

This is the "Model Arena" page mentioned in the roadmap - it's the evidence
that the model wasn't picked arbitrarily, it was chosen after comparing it
against simpler baselines.

Run this AFTER train_models.py (or just run this directly - it calls
run_for_coin itself, so it doesn't strictly need to be run in order).
"""

import os

import matplotlib
matplotlib.use("Agg")  # no display available when running from a script/server
import matplotlib.pyplot as plt
import pandas as pd

from train_models import COINS, run_for_coin

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")


def build_comparison_table(all_results):
    """
    all_results: {coin: {model_name: report_dict}}
    Returns a tidy dataframe, one row per (coin, model).
    """
    rows = []
    for coin, model_results in all_results.items():
        for model_name, report in model_results.items():
            rows.append({
                "Coin": coin,
                "Model": model_name,
                "MAE": round(report["MAE"], 2),
                "RMSE": round(report["RMSE"], 2),
                "MAPE (%)": round(report["MAPE"], 2),
                "Direction Accuracy (%)": round(report["Accuracy"] * 100, 1),
                "Direction F1 (%)": round(report["F1"] * 100, 1),
            })
    return pd.DataFrame(rows)


def plot_rmse_comparison(comparison_df, save_path):
    coins = comparison_df["Coin"].unique()
    models = comparison_df["Model"].unique()

    fig, axes = plt.subplots(1, len(coins), figsize=(5 * len(coins), 5), sharey=False)
    if len(coins) == 1:
        axes = [axes]

    for ax, coin in zip(axes, coins):
        subset = comparison_df[comparison_df["Coin"] == coin]
        ax.bar(subset["Model"], subset["RMSE"], color=["#4c72b0", "#dd8452", "#55a868"])
        ax.set_title(f"{coin} - RMSE by Model")
        ax.set_ylabel("RMSE (USD)")
        ax.tick_params(axis="x", rotation=20)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"\nSaved comparison chart -> {save_path}")


if __name__ == "__main__":
    print("=== CryptoPulse AI - Model Arena ===\n")

    all_results = {}
    for coin in COINS:
        try:
            all_results[coin] = run_for_coin(coin)
        except FileNotFoundError as e:
            print(f"{coin}: {e}")

    if not all_results:
        print("\nNo results to compare - make sure earlier phases ran successfully.")
    else:
        comparison_df = build_comparison_table(all_results)

        print("\n" + "=" * 70)
        print("  MODEL ARENA - Full Comparison")
        print("=" * 70)
        print(comparison_df.to_string(index=False))

        os.makedirs(RESULTS_DIR, exist_ok=True)
        csv_path = os.path.join(RESULTS_DIR, "model_arena_results.csv")
        comparison_df.to_csv(csv_path, index=False)
        print(f"\nSaved comparison table -> {csv_path}")

        chart_path = os.path.join(RESULTS_DIR, "model_arena_rmse.png")
        plot_rmse_comparison(comparison_df, chart_path)
