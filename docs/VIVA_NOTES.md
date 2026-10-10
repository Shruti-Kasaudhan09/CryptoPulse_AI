# Viva notes

Material for the report, slides and viva (Phase 23). Every claim here is
backed by code in the repo — know where each one lives.

## The 60-second pitch

Most student crypto projects stop at "we predicted Bitcoin's price with an
LSTM and got 95% accuracy". CryptoPulse AI instead asks *how much should you
trust a forecast, and why did the model make it?* It combines price
forecasting (4 models), news sentiment (FinBERT), volatility regimes and
anomaly detection (Isolation Forest) into one explainable score; every
forecast is explained with SHAP, validated with a walk-forward backtest
against a naive baseline, and logged to a database so its real-world track
record builds up over time.

## Demo flow (5 minutes)

1. **Dashboard, BTC** — price chart (anomalies marked in orange), CryptoPulse Score and its components.
2. **Next-day forecast** — point at *model agreement* and the *honesty check* vs naive.
3. **Volatility + Anomaly cards** — anomaly reasons in plain language; say "unusual ≠ fraud".
4. **Why this prediction?** — walk through the top 3 SHAP bars; show they sum exactly to the forecast; switch model.
5. **Model Arena** — the tree-model extrapolation finding.
6. **Backtest** — walk-forward method, naive baseline row, rolling accuracy around 50%.
7. **Live track record** — "every forecast is stored and scored against reality."

## Design decisions and why

| Decision | Why | Where |
|---|---|---|
| Chronological split, never shuffled | Shuffling lets the model train on the future | `train_models.py` |
| Scaler fitted on training data only | Fitting on all data leaks future price ranges | `train_lstm.py` |
| Predict % return, not price | Trees can't extrapolate to new highs; returns are centred on 0 | `train_lstm.py`, `backtest.py` |
| Scale-free features (`Close/SMA_30 − 1`) | Model trained at $40k still sees comparable inputs at $100k | `backtest.py::add_stationary_features` |
| Naive baseline in every backtest | Without a reference point, an RMSE number means nothing | `backtest.py` |
| Headline model = lowest backtest RMSE | Chosen by evidence, not by preference | `prediction.py` |
| Volatility thresholds per coin | SOL's "calm" is BTC's "wild" | `volatility_analysis.py` |
| Anomaly ≠ fraud | Isolation Forest finds *statistically unusual*, nothing more | `anomaly_detection.py` |
| Exact linear SHAP for Ridge | For a linear model SHAP has a closed form, no approximation | `explanation.py` |
| Sentiment stored in the DB | Free feeds have no archive; lost history can't be re-downloaded | `db/models.py` |

## Likely questions

**"What accuracy did you get?"**
Give two numbers and the baseline: price error (MAPE) *and* direction
accuracy, compared with the naive model. Say plainly that on daily data no
model clearly beat "tomorrow = today" on price error, and direction accuracy
is near 50–58%. Then explain why that's the expected, honest result for an
efficient market — and that the project's contribution is the explainable,
validated system around the forecast, not a magic predictor.

**"How do you know there's no data leakage?"**
Three layers: chronological splits; scaler fitted on train only; and two
automated tests — features for day *t* built from data up to *t* equal those
built from full history, and scrambling future days never changes an earlier
backtest prediction. Both tests were checked by injecting a leak and
confirming they fail.

**"Why did Linear Regression beat XGBoost?"**
Trees predict by averaging training targets in a leaf, so their output is
bounded by the training price range. BTC made new highs in the test period,
so trees under-predicted. That motivated switching to return targets.

**"How does SHAP work?"**
It splits a prediction into per-feature contributions (Shapley values from
game theory) so that *base value + sum of contributions = prediction*
exactly. The API returns `check_sum_pct` to prove the sum matches, and a test
asserts it.

**"Why is it called multimodal if sentiment isn't a model input?"**
Be upfront: numerical and text modalities are fused in the CryptoPulse Score
today. Fusing sentiment as a *training feature* needs historical sentiment,
which isn't freely available — so the system collects its own, daily, into
the database. That's the planned next step, stated as future scope.

**"What's the CryptoPulse Score based on?"**
A transparent weighted sum: trend 30%, RSI balance 20%, calmness
(inverse volatility) 20%, sentiment 20%, no-anomaly 10%. The weights are a
design choice, not learned — say so, and say it's not a buy/sell signal.

**"What went wrong during the project?"**
Good answer: the LSTM scaling bug. Close was scaled as a feature, and the
scaled value was then used to rebuild the dollar price, making LSTM metrics
meaningless. It was caught because MAE and MAPE were inconsistent. Fixed by
passing unscaled closes.

## Limitations (say them before you're asked)

- ~2 years of daily data per coin — small for deep learning.
- Sentiment history starts from the day logging began.
- Only BTC, ETH, SOL.
- LSTM isn't deployed on the free hosting tier (TensorFlow is too large).
- The score's weights are hand-chosen.

## Future scope

- Add logged sentiment as a model feature once 6+ months exist.
- Hourly data; more coins; on-chain metrics.
- Probabilistic forecasts (prediction intervals) instead of point forecasts.
- Learn the score weights from historical outcomes.
