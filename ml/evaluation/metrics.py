"""
metrics.py
----------
Phase 7 of CryptoPulse AI: proper evaluation, not just "accuracy is 95%".

For a price-forecasting model we care about two different things:
1. Regression error - how far off in dollars was the prediction (MAE, RMSE, MAPE)
2. Direction - did we at least get UP vs DOWN right? (accuracy, precision, recall, F1)

Direction matters more than people expect - a model can have decent MAE but
still be useless for trading if it never gets the direction right.
"""

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
)


def regression_metrics(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))

    # MAPE - mean absolute percentage error, easier to explain to non-ML people
    # ("the model is off by about X% on average")
    mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100

    return {"MAE": mae, "RMSE": rmse, "MAPE": mape}


def direction_metrics(current_price, y_true_next, y_pred_next):
    """
    current_price: today's actual close (what the prediction is relative to)
    y_true_next:   tomorrow's actual close
    y_pred_next:   tomorrow's predicted close

    We turn both into UP(1)/DOWN(0) labels relative to today's price, then
    score it like a classification problem.
    """
    current_price = np.asarray(current_price)
    y_true_next = np.asarray(y_true_next)
    y_pred_next = np.asarray(y_pred_next)

    true_direction = (y_true_next > current_price).astype(int)
    pred_direction = (y_pred_next > current_price).astype(int)

    return {
        "Accuracy": accuracy_score(true_direction, pred_direction),
        "Precision": precision_score(true_direction, pred_direction, zero_division=0),
        "Recall": recall_score(true_direction, pred_direction, zero_division=0),
        "F1": f1_score(true_direction, pred_direction, zero_division=0),
    }


def full_report(current_price, y_true_next, y_pred_next):
    """Convenience wrapper that returns both regression and direction metrics."""
    report = {}
    report.update(regression_metrics(y_true_next, y_pred_next))
    report.update(direction_metrics(current_price, y_true_next, y_pred_next))
    return report


def print_report(name, report):
    print(f"  {name}")
    print(f"    MAE:       ${report['MAE']:,.2f}")
    print(f"    RMSE:      ${report['RMSE']:,.2f}")
    print(f"    MAPE:      {report['MAPE']:.2f}%")
    print(f"    Direction Accuracy:  {report['Accuracy']*100:.1f}%")
    print(f"    Direction Precision: {report['Precision']*100:.1f}%")
    print(f"    Direction Recall:    {report['Recall']*100:.1f}%")
    print(f"    Direction F1:        {report['F1']*100:.1f}%")
