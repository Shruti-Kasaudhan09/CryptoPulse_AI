import { Link } from "react-router-dom";
import AnomalyCard from "../components/dashboard/AnomalyCard";
import ForecastCard from "../components/dashboard/ForecastCard";
import PriceChart from "../components/dashboard/PriceChart";
import PulseCard from "../components/dashboard/PulseCard";
import SentimentCard from "../components/dashboard/SentimentCard";
import TrackRecord from "../components/dashboard/TrackRecord";
import VolatilityCard from "../components/dashboard/VolatilityCard";
import Slider, { SlideIntro } from "../components/Slider";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";

function GoTo({ to, children }) {
  return (
    <Link
      to={to}
      className="glass tilt inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

export default function Dashboard({ coin }) {
  const prediction = useApi((o) => api.prediction(coin, o), [coin]);
  const pulse = useApi((o) => api.pulse(coin, o), [coin]);
  const sentiment = useApi((o) => api.sentiment(o), []);
  const volatility = useApi((o) => api.volatility(coin, o), [coin]);
  const anomaly = useApi((o) => api.anomaly(coin, o), [coin]);

  const total = 5;
  const slides = [
    {
      key: "market",
      tab: "Market",
      hint: "Price & indicators",
      content: (
        <>
          <SlideIntro
            step={1} total={total}
            title={`${coin} market view`}
            text="Daily price with its 30-day average and Bollinger Bands, momentum from RSI, and every day the anomaly detector flagged."
            points={["OHLCV from Yahoo Finance", "22 technical features", "Anomalies marked in orange"]}
          />
          <PriceChart coin={coin} anomalies={anomaly.data?.series.filter((p) => p.is_anomaly)} />
        </>
      ),
    },
    {
      key: "forecast",
      tab: "AI Forecast",
      hint: "Tomorrow + score",
      content: (
        <>
          <SlideIntro
            step={2} total={total}
            title="What the models expect tomorrow"
            text="Every model forecasts tomorrow's return; the headline comes from whichever had the lowest error in the walk-forward backtest. The CryptoPulse Score condenses trend, RSI, volatility, sentiment and anomalies into one number."
            points={["Ridge · Random Forest · XGBoost · LSTM", "Chosen by evidence", "Not a buy/sell signal"]}
            action={<GoTo to={`/why?coin=${coin}`}>Explain this forecast</GoTo>}
          />
          <div className="stagger grid gap-6 lg:grid-cols-2">
            <ForecastCard q={prediction} coin={coin} />
            <PulseCard q={pulse} />
          </div>
        </>
      ),
    },
    {
      key: "risk",
      tab: "Risk Radar",
      hint: "Volatility & anomalies",
      content: (
        <>
          <SlideIntro
            step={3} total={total}
            title="How turbulent is the market?"
            text="Volatility is ranked against this coin's own history, so Solana's calm isn't judged by Bitcoin's standards. Isolation Forest flags days whose price, volume and volatility pattern is statistically unusual."
            points={["Per-coin thresholds", "Isolation Forest", "Unusual ≠ fraud"]}
          />
          <div className="stagger grid gap-6 lg:grid-cols-2">
            <VolatilityCard q={volatility} />
            <AnomalyCard q={anomaly} />
          </div>
        </>
      ),
    },
    {
      key: "sentiment",
      tab: "News Pulse",
      hint: "FinBERT sentiment",
      content: (
        <>
          <SlideIntro
            step={4} total={total}
            title="What the news is saying"
            text="Live crypto headlines scored by FinBERT, a language model trained on financial text. A score is logged every day, so the history grows over time and can later become a model input."
            points={["CoinDesk · Cointelegraph · Bitcoin Magazine", "ProsusAI/finbert", "Logged daily to the database"]}
          />
          <div className="mx-auto max-w-2xl">
            <SentimentCard q={sentiment} />
          </div>
        </>
      ),
    },
    {
      key: "record",
      tab: "Track Record",
      hint: "Forecasts vs reality",
      content: (
        <>
          <SlideIntro
            step={5} total={total}
            title="Did past forecasts come true?"
            text="Every forecast this dashboard shows is saved, then scored against the real closing price once that day has happened, building an honest, out-of-sample track record."
            points={["Stored in PostgreSQL / SQLite", "Scored automatically", "50% = coin flip"]}
            action={<GoTo to={`/backtest?coin=${coin}`}>See the full backtest</GoTo>}
          />
          {/* re-fetch once the prediction (which gets logged) has loaded */}
          <TrackRecord coin={coin} refreshKey={prediction.data ? prediction.data.as_of : "pending"} />
        </>
      ),
    },
  ];

  return <Slider slides={slides} label={`${coin} overview`} />;
}
