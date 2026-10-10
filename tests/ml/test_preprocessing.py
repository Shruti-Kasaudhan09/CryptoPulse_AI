"""Phase 3 - data cleaning."""

import numpy as np
import pandas as pd

from clean_data import clean_dataframe


def _raw():
    return pd.DataFrame({
        "Date": ["2026-01-03", "2026-01-01", "2026-01-02", "2026-01-02", "2026-01-04"],
        "Open": [3.0, 1.0, 2.0, 2.0, 4.0],
        "High": [3.5, 1.5, 2.5, 2.5, 4.5],
        "Low": [2.5, 0.5, 1.5, 1.5, 3.5],
        "Close": [3.2, 1.2, np.nan, np.nan, 4.2],
        "Volume": [10, 20, np.nan, np.nan, 40],
    })


def test_sorted_and_deduplicated():
    df = clean_dataframe(_raw())
    assert df["Date"].is_monotonic_increasing
    assert df["Date"].is_unique
    assert len(df) == 4


def test_dates_are_datetimes():
    df = clean_dataframe(_raw())
    assert pd.api.types.is_datetime64_any_dtype(df["Date"])


def test_missing_price_forward_filled_and_volume_zeroed():
    df = clean_dataframe(_raw())
    jan2 = df[df["Date"] == "2026-01-02"].iloc[0]
    assert jan2["Close"] == 1.2          # carried forward from Jan 1
    assert jan2["Volume"] == 0


def test_rows_with_high_below_low_are_dropped():
    raw = _raw()
    raw.loc[4, ["High", "Low"]] = [1.0, 5.0]
    df = clean_dataframe(raw)
    assert (df["High"] >= df["Low"]).all()
    assert len(df) == 3


def test_input_not_mutated():
    raw = _raw()
    before = raw.copy()
    clean_dataframe(raw)
    pd.testing.assert_frame_equal(raw, before)
