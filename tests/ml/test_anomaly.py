"""Phase 11 volatility, Phase 12 anomalies and Phase 14 score."""

import pandas as pd
import pytest

from anomaly_detection import detect_anomalies
from cryptopulse_score import score_anomaly, score_rsi, score_sentiment, score_trend, score_volatility
from volatility_analysis import classify_volatility


# ---------------------------------------------------------------- anomaly
def test_contamination_controls_flag_rate(feature_df):
    df, _ = detect_anomalies(feature_df, contamination=0.05)
    assert df["Is_Anomaly"].mean() == pytest.approx(0.05, abs=0.01)


def test_obvious_outlier_is_flagged(feature_df):
    df = feature_df.copy()
    i = len(df) // 2
    df.loc[i, "Return_1d"] = 0.60      # +60% in a day
    df.loc[i, "Volume_Change"] = 25.0  # 26x volume
    df.loc[i, "Volatility_14"] = df["Volatility_14"].max() * 3
    out, _ = detect_anomalies(df)
    assert out.loc[i, "Is_Anomaly"]
    assert out.loc[i, "Anomaly_Score"] == out["Anomaly_Score"].min()


def test_anomaly_detection_is_reproducible(feature_df):
    a, _ = detect_anomalies(feature_df)
    b, _ = detect_anomalies(feature_df)
    pd.testing.assert_series_equal(a["Is_Anomaly"], b["Is_Anomaly"])


# ------------------------------------------------------------- volatility
def test_volatility_levels_split_into_thirds(feature_df):
    df, t = classify_volatility(feature_df)
    assert t["low_thresh"] < t["high_thresh"]
    shares = df["Volatility_Level"].value_counts(normalize=True)
    for level in ("Low", "Medium", "High"):
        assert shares[level] == pytest.approx(1 / 3, abs=0.03)


def test_volatility_thresholds_are_per_coin(feature_df):
    calm = feature_df.copy()
    calm["Volatility_14"] = calm["Volatility_14"] / 10
    _, t1 = classify_volatility(feature_df)
    _, t2 = classify_volatility(calm)
    assert t2["high_thresh"] == pytest.approx(t1["high_thresh"] / 10)


# ------------------------------------------------------------------ score
def test_score_components_are_0_to_100(feature_df):
    assert 0 <= score_trend(feature_df) <= 100
    assert 0 <= score_rsi(feature_df) <= 100
    for level in ("Low", "Medium", "High", "Unknown"):
        assert 0 <= score_volatility(level) <= 100
    assert score_sentiment(-1) == 0 and score_sentiment(1) == 100 and score_sentiment(0) == 50
    assert score_anomaly(True) < score_anomaly(False)


def test_rsi_score_peaks_at_50():
    df = pd.DataFrame({"RSI_14": [50.0]})
    assert score_rsi(df) == 100
    assert score_rsi(pd.DataFrame({"RSI_14": [90.0]})) < score_rsi(pd.DataFrame({"RSI_14": [60.0]}))
