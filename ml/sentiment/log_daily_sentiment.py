"""
log_daily_sentiment.py
------------------------
Phase 10 helper. Run this once per day (schedule it - cron on Mac/Linux,
Task Scheduler on Windows) and it appends today's aggregate sentiment score
to daily_sentiment_log.csv. After a few weeks you'll have a genuine
historical sentiment series you can merge with price data.

Windows Task Scheduler quick setup:
    Create a basic task -> Trigger: Daily -> Action: Start a program
    Program: python.exe
    Arguments: "C:\\path\\to\\CryptoPulse-AI\\ml\\sentiment\\log_daily_sentiment.py"

Usage:
    python log_daily_sentiment.py
"""

import os
from datetime import date

import pandas as pd

from sentiment_analysis import aggregate_daily_sentiment, fetch_headlines, score_headlines

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
LOG_PATH = os.path.join(DATA_DIR, "daily_sentiment_log.csv")


def run_once():
    today = date.today().isoformat()

    articles = fetch_headlines()
    if not articles:
        print("No headlines fetched today, skipping log entry.")
        return

    scored = score_headlines(articles)
    summary = aggregate_daily_sentiment(scored)
    summary["date"] = today

    os.makedirs(DATA_DIR, exist_ok=True)

    if os.path.exists(LOG_PATH):
        log_df = pd.read_csv(LOG_PATH)
        # don't add a duplicate row if this already ran today
        log_df = log_df[log_df["date"] != today]
    else:
        log_df = pd.DataFrame()

    log_df = pd.concat([log_df, pd.DataFrame([summary])], ignore_index=True)
    log_df = log_df.sort_values("date").reset_index(drop=True)
    log_df.to_csv(LOG_PATH, index=False)

    print(f"Logged sentiment for {today}: score={summary['sentiment_score']:+.4f} "
          f"({summary['n_articles']} headlines)")
    print(f"Log now has {len(log_df)} days of data -> {LOG_PATH}")


if __name__ == "__main__":
    run_once()
