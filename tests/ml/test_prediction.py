"""Phase 7 metrics, Phase 20 backtest, and Phase 5/6 prediction behaviour."""

import numpy as np
import pandas as pd
import pytest

from backtest import STATIONARY_FEATURES, add_stationary_features, equity_curve, walk_forward
from metrics import direction_metrics, full_report, regression_metrics


# ------------------------------------------------------------------ metrics
def test_perfect_prediction_has_zero_error():
    y = np.array([100.0, 110.0, 105.0])
    m = regression_metrics(y, y)
    assert m["MAE"] == m["RMSE"] == m["MAPE"] == 0


def test_mape_is_percentage():
    m = regression_metrics([100.0], [110.0])
    assert m["MAPE"] == pytest.approx(10.0)


def test_direction_metrics():
    today = [100, 100, 100, 100]
    actual = [101, 99, 101, 99]      # up, down, up, down
    pred = [102, 98, 98, 98]         # up, down, DOWN (wrong), down
    m = direction_metrics(today, actual, pred)
    assert m["Accuracy"] == pytest.approx(0.75)
    assert m["Precision"] == pytest.approx(1.0)
    assert m["Recall"] == pytest.approx(0.5)


def test_full_report_has_all_keys():
    r = full_report([1, 1], [2, 0.5], [1.5, 0.8])
    assert set(r) == {"MAE", "RMSE", "MAPE", "Accuracy", "Precision", "Recall", "F1"}


# ------------------------------------------------------------------ backtest
def test_stationary_features_are_scale_free(feature_df):
    scaled = feature_df.copy()
    for c in ["Open", "High", "Low", "Close", "SMA_7", "SMA_14", "SMA_30", "EMA_7", "EMA_14",
              "BB_Upper", "BB_Lower", "BB_Width", "MACD", "MACD_Signal", "MACD_Hist",
              "Momentum_10", "Target_NextClose"]:
        scaled[c] = scaled[c] * 10
    a = add_stationary_features(feature_df)[STATIONARY_FEATURES]
    b = add_stationary_features(scaled)[STATIONARY_FEATURES]
    pd.testing.assert_frame_equal(a, b, check_exact=False, rtol=1e-9)


def test_walk_forward_never_uses_future_data(feature_df):
    """Scrambling the last 20 days must not change any earlier prediction."""
    base = walk_forward(feature_df, test_frac=0.3, retrain_every=7)

    tampered = feature_df.copy()
    tail = tampered.index[-20:]
    for c in ["Close", "Target_NextClose", "Return_1d", "RSI_14"]:
        tampered.loc[tail, c] = tampered.loc[tail, c].sample(frac=1, random_state=1).values
    changed = walk_forward(tampered, test_frac=0.3, retrain_every=7)

    cutoff = len(base) - 21  # predictions made before the tampered window
    for col in [c for c in base.columns if c.startswith("Pred_")]:
        np.testing.assert_allclose(base[col].values[:cutoff], changed[col].values[:cutoff], err_msg=col)


def test_walk_forward_output_shape(feature_df):
    bt = walk_forward(feature_df, test_frac=0.3)
    assert {"Date", "Close", "Actual_NextClose", "Pred_Naive", "Pred_Ridge", "Pred_RandomForest"} <= set(bt.columns)
    assert not bt.isnull().any().any()
    np.testing.assert_array_equal(bt["Pred_Naive"], bt["Close"])


def test_equity_curve_stays_flat_when_always_in_cash():
    bt = pd.DataFrame({"Close": [100.0, 101, 99], "Actual_NextClose": [101.0, 99, 102], "Pred_X": [90.0, 90, 90]})
    np.testing.assert_allclose(equity_curve(bt, "Pred_X"), 1.0)


def test_walk_forward_rejects_tiny_datasets(feature_df):
    with pytest.raises(ValueError):
        walk_forward(feature_df.head(50))
