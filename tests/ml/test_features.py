"""Phase 4 - feature engineering. The most important test here is the
no-lookahead check: a feature for day t must not change when future days
are added, otherwise the model would be secretly seeing the future."""

import numpy as np
import pandas as pd

from clean_data import clean_dataframe
from indicators import build_feature_dataset, rsi


def test_no_missing_values(feature_df):
    assert not feature_df.isnull().any().any()


def test_rsi_bounded(feature_df):
    assert feature_df["RSI_14"].between(0, 100).all()


def test_rsi_is_100_when_price_only_rises():
    s = pd.Series(np.arange(1, 40, dtype=float))
    assert rsi(s).iloc[-1] == 100


def test_target_is_next_days_close(feature_df):
    np.testing.assert_allclose(feature_df["Target_NextClose"].values[:-1], feature_df["Close"].values[1:])


def test_bollinger_bands_bracket_the_average(feature_df):
    assert (feature_df["BB_Upper"] >= feature_df["BB_Lower"]).all()


def test_features_do_not_look_ahead(raw_df):
    """
    For several cut-off days t: build features using ONLY data up to t.
    Day t must still get a full feature row (a leaky feature would need
    tomorrow and come out NaN), and its values must equal what the full
    history produces for day t.
    """
    clean = clean_dataframe(raw_df)
    full = build_feature_dataset(clean, keep_latest=True).set_index("Date")
    cols = [c for c in full.columns if c != "Target_NextClose"]

    for cutoff in (120, 250, 330, len(clean)):
        past_only = build_feature_dataset(clean.iloc[:cutoff], keep_latest=True)
        day_t = clean["Date"].iloc[cutoff - 1]
        assert past_only["Date"].iloc[-1] == day_t, f"no feature row for {day_t.date()} using past data only"
        np.testing.assert_allclose(
            past_only[cols].iloc[-1].values.astype(float),
            full.loc[day_t, cols].values.astype(float),
            rtol=1e-9, err_msg=f"features for {day_t.date()} change when future data is added",
        )


def test_keep_latest_keeps_today_for_live_prediction(raw_df):
    clean = clean_dataframe(raw_df)
    train = build_feature_dataset(clean)
    live = build_feature_dataset(clean, keep_latest=True)
    assert live["Date"].iloc[-1] == clean["Date"].iloc[-1]
    assert pd.isna(live["Target_NextClose"].iloc[-1])
    assert len(live) == len(train) + 1
