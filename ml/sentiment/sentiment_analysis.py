"""
sentiment_analysis.py
----------------------
Phase 9 of CryptoPulse AI: crypto news sentiment using FinBERT (a BERT model
fine-tuned specifically on financial text - much better suited to headlines
like "Bitcoin ETF outflows accelerate" than a generic sentiment model).

IMPORTANT LIMITATION (be upfront about this in your report/viva):
Free RSS feeds only give TODAY's headlines, not a historical archive. So
this script gives you real sentiment for right now, but it can't retroactively
tell you what sentiment was on, say, March 3rd 2025. For a true historical
daily sentiment series to combine with 2 years of price history, you'd need
a paid news API with historical access (NewsAPI, CryptoPanic Pro, etc.).

The practical fix used here (see log_daily_sentiment.py in this folder):
run that script once a day (e.g. via cron / Task Scheduler) and it appends
today's score to a running CSV. Do that for a few weeks and you'll have a
real historical sentiment series to plug into Phase 10.

Usage:
    python sentiment_analysis.py
"""

import os

import feedparser
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

NEWS_FEEDS = {
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "Cointelegraph": "https://cointelegraph.com/rss",
    "Bitcoin Magazine": "https://bitcoinmagazine.com/.rss/full/",
}

FINBERT_MODEL = "ProsusAI/finbert"

_pipeline_cache = None


def get_finbert_pipeline():
    """
    Loads the FinBERT sentiment pipeline once and reuses it (loading the
    model takes a few seconds, so we don't want to do it per-headline).
    First run downloads the model (~440MB) and caches it locally.
    """
    global _pipeline_cache
    if _pipeline_cache is None:
        from transformers import pipeline
        print("Loading FinBERT model (first run downloads ~440MB, then it's cached)...")
        _pipeline_cache = pipeline("sentiment-analysis", model=FINBERT_MODEL)
    return _pipeline_cache


def fetch_headlines(feed_urls=NEWS_FEEDS, limit_per_source=15):
    articles = []
    for source, url in feed_urls.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:limit_per_source]:
                articles.append({
                    "source": source,
                    "title": entry.get("title", ""),
                    "link": entry.get("link", ""),
                })
        except Exception as e:
            print(f"  Could not fetch {source}: {e}")
    return articles


def score_headlines(articles):
    """Runs FinBERT on each headline. Returns articles with label + score added."""
    nlp = get_finbert_pipeline()
    titles = [a["title"] for a in articles if a["title"]]

    if not titles:
        return []

    results = nlp(titles)  # [{'label': 'positive', 'score': 0.87}, ...]

    scored = []
    for article, result in zip(articles, results):
        scored.append({
            **article,
            "label": result["label"],       # 'positive' / 'negative' / 'neutral'
            "confidence": round(result["score"], 3),
        })
    return scored


def aggregate_daily_sentiment(scored_articles):
    """
    Turns a list of per-headline scores into one daily summary.
    sentiment_score is on a -1 (all negative) to +1 (all positive) scale,
    weighted by each prediction's confidence.
    """
    if not scored_articles:
        return {"pos_pct": 0, "neu_pct": 0, "neg_pct": 0, "sentiment_score": 0, "n_articles": 0}

    n = len(scored_articles)
    pos = sum(1 for a in scored_articles if a["label"] == "positive")
    neg = sum(1 for a in scored_articles if a["label"] == "negative")
    neu = n - pos - neg

    # weighted score: positive articles add their confidence, negative subtract it
    weighted_sum = sum(
        a["confidence"] if a["label"] == "positive"
        else -a["confidence"] if a["label"] == "negative"
        else 0
        for a in scored_articles
    )
    sentiment_score = weighted_sum / n

    return {
        "pos_pct": round(pos / n * 100, 1),
        "neu_pct": round(neu / n * 100, 1),
        "neg_pct": round(neg / n * 100, 1),
        "sentiment_score": round(sentiment_score, 4),
        "n_articles": n,
    }


if __name__ == "__main__":
    print("=== CryptoPulse AI - News Sentiment (Phase 9) ===\n")

    print("Fetching headlines...")
    articles = fetch_headlines()
    print(f"  Got {len(articles)} headlines\n")

    if not articles:
        print("No headlines fetched - check your internet connection / feed URLs.")
    else:
        print("Scoring with FinBERT (this loads the model, may take a moment)...")
        scored = score_headlines(articles)

        summary = aggregate_daily_sentiment(scored)
        print(f"\nToday's Market Sentiment")
        print(f"  Positive: {summary['pos_pct']}%  Neutral: {summary['neu_pct']}%  Negative: {summary['neg_pct']}%")
        print(f"  Sentiment score: {summary['sentiment_score']:+.4f}  (range -1 to +1)")
        print(f"  Based on {summary['n_articles']} headlines\n")

        print("Sample headlines:")
        for a in scored[:8]:
            print(f"  [{a['label']:>8}] ({a['confidence']:.2f}) {a['title']}")

        os.makedirs(DATA_DIR, exist_ok=True)
        out_path = os.path.join(DATA_DIR, "latest_sentiment.csv")
        pd.DataFrame(scored).to_csv(out_path, index=False)
        print(f"\nSaved full headline scores -> {out_path}")
        print("\nTo build a real historical series for Phase 10, run log_daily_sentiment.py")
        print("daily (e.g. via a scheduled task).")
