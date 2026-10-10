"""
ml_bridge.py
-------------
The backend doesn't re-implement any ML logic - it imports the exact same
functions from the ml/ folder that the pipeline uses (Phases 3, 4, 7, 11,
12, 14, 20). That way the numbers on the dashboard are guaranteed to match
what the scripts print.
"""

import os
import sys

from app.config import ML_CODE_DIR

for sub in ("preprocessing", "features", "evaluation", "analysis", "scoring"):
    path = os.path.join(ML_CODE_DIR, sub)
    if path not in sys.path:
        sys.path.append(path)

from clean_data import clean_dataframe  # noqa: E402,F401
from indicators import build_feature_dataset  # noqa: E402,F401
from metrics import full_report  # noqa: E402,F401
from backtest import STATIONARY_FEATURES, add_stationary_features  # noqa: E402,F401
from volatility_analysis import classify_volatility  # noqa: E402,F401
from anomaly_detection import FEATURE_COLS_FOR_ANOMALY, detect_anomalies  # noqa: E402,F401
from cryptopulse_score import (  # noqa: E402,F401
    WEIGHTS,
    score_anomaly,
    score_rsi,
    score_sentiment,
    score_trend,
    score_volatility,
)
