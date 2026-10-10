"""
run_pipeline.py
----------------
Runs the whole ML pipeline (Phases 2-14 + Phase 20 backtest) in the correct
order, so you don't have to manually run each script every time:

    download -> clean -> features -> baselines + arena -> LSTM
    -> volatility -> anomaly -> SHAP -> CryptoPulse score -> backtest

Run this from the ml/ folder:
    python run_pipeline.py                  # full run with real data
    python run_pipeline.py --skip-download  # reuse the CSVs already in data/
    python run_pipeline.py --skip-lstm      # skip Phase 8 (e.g. no tensorflow)
    python run_pipeline.py --sample-data    # offline: SYNTHETIC data, for testing only
"""

import argparse
import os
import subprocess
import sys

ML_DIR = os.path.dirname(os.path.abspath(__file__))


def build_steps(args):
    steps = []
    if args.sample_data:
        steps.append(("Generating SYNTHETIC sample data (offline mode)",
                      os.path.join(ML_DIR, "data", "make_sample_data.py")))
    elif not args.skip_download:
        steps.append(("Downloading data", os.path.join(ML_DIR, "data", "download_data.py")))

    steps += [
        ("Cleaning data", os.path.join(ML_DIR, "preprocessing", "clean_data.py")),
        ("Building features", os.path.join(ML_DIR, "features", "indicators.py")),
        ("Training + comparing baseline models", os.path.join(ML_DIR, "models", "model_arena.py")),
    ]
    if not args.skip_lstm:
        steps.append(("Training LSTM (Phase 8)", os.path.join(ML_DIR, "models", "train_lstm.py")))
    steps += [
        ("Volatility analysis (Phase 11)", os.path.join(ML_DIR, "analysis", "volatility_analysis.py")),
        ("Anomaly detection (Phase 12)", os.path.join(ML_DIR, "analysis", "anomaly_detection.py")),
        ("SHAP explainability (Phase 13)", os.path.join(ML_DIR, "explainability", "shap_explain.py")),
        ("CryptoPulse Score (Phase 14)", os.path.join(ML_DIR, "scoring", "cryptopulse_score.py")),
        ("Walk-forward backtest (Phase 20)", os.path.join(ML_DIR, "evaluation", "backtest.py")),
    ]
    return steps
# Note: Phase 9 (sentiment_analysis.py) and Phase 10 (log_daily_sentiment.py) are
# run separately, not as part of this pipeline - they hit live news feeds and
# download the FinBERT model on first run, so they're meant to be run on their
# own schedule rather than every time you retrain.


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the CryptoPulse AI ML pipeline")
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-lstm", action="store_true")
    parser.add_argument("--sample-data", action="store_true",
                        help="use SYNTHETIC data instead of downloading (testing only)")
    args = parser.parse_args()

    for step_name, script_path in build_steps(args):
        print(f"\n{'#'*70}")
        print(f"# {step_name}")
        print(f"{'#'*70}")
        # run each script from its own folder so its relative imports work
        result = subprocess.run([sys.executable, os.path.basename(script_path)],
                                cwd=os.path.dirname(script_path))
        if result.returncode != 0:
            print(f"\nStep failed: {step_name}. Fix the error above before continuing.")
            sys.exit(1)

    print("\nAll done. Check ml/data/ for datasets and ml/saved_models/ for trained models + results.")
    print("Next: load everything into the database with  python ../backend/app/db/sync.py")
