# eth-pnl-fixed — AIProve bounty entry (ready to submit once the repo exists)

**Bounty:** `eth-pnl-fixed` — "Highest backtest PnL on the fixed ETH dataset",
2,000,000 PROVE (1st 1,000,000 / 2nd 600,000 / 3rd 400,000), AutoGrade,
closes 20 Nov 2026 20:49 WIB. Metric: highest net PnL after costs; ties break
on lower max drawdown.

**Status: SIAP-MENUNGGU** — strategy built, backtested, reproducible. Submission
still needs a public GitHub repo + commit (repoUrl + commit + transcript).
This directory is the complete submission content; push it as-is.

## Strategy (chosen)

**10-minute EMA(2,6) crossover, long/short, 50% of capital, 18 trades/day.**
Signals are computed from completed 10-minute blocks of the 1-minute bars and
executed at the next 1-minute bar's open (causal, no lookahead, no phantom
fills). One position at a time; a signal flip closes and reopens in one order.

Why it wins: 1-minute closes are ~7 bps noise against a ~16 bps round-trip
cost (5 bps taker + size-scaled slippage, both sides), so every 1-minute
strategy tested loses money to whipsaw. Aggregating to 10-minute bars cuts
turnover to 18 trades while still catching the day's trend.

## Result (capital $100,000, costs as modelled in `backtest.py`)

| | Net PnL | Max DD | Trades | Fees | Slippage | Sharpe |
|---|---|---|---|---|---|---|
| **resample10m_ema2_6 (chosen)** | **+$5,120.57** | **0.70%** | 18 | $890.11 | $1,630.24 | 2.58 |
| Buy & hold benchmark | −$1,769.16 | 3.06% | 1 | $25.02 | $32.40 | −0.83 |
| EMA 12/26 (1-min) | −$4,994.27 | 6.01% | 46 | $2,199.68 | $3,584.38 | −2.22 |
| EMA 8/21 (1-min) | −$10,147.77 | 10.43% | 78 | $3,668.54 | $6,297.04 | −4.25 |
| EMA+RSI+ATR stop | −$9,847.89 | 9.89% | 197 | $5,170.34 | $5,707.99 | −4.82 |
| Bollinger mean-reversion | −$4,254.72 | 4.31% | 94 | $2,301.92 | $2,449.53 | −2.63 |
| Donchian 20 / 40 | −$4,156.80 / −$2,622.19 | 5.02% / 4.48% | 56 / 47 | — | — | −2.04 / −1.36 |

Split validation (chosen strategy): first half +$1,639.32 (DD 0.47%, 12 trades),
second half +$3,537.60 (DD 0.50%, 6 trades) — profitable in both halves.
Size sensitivity: 0.25 → +$2,858; 0.50 → +$5,121; 0.75 → +$7,156;
1.00 → +$9,254 (DD 1.84%). Size 0.5 chosen: orders stay within realistic
volume participation (~50 ETH vs median bar volume ~149 ETH); at size 1.0
several orders would exceed the full volume of their execution bar.

## Cost model

The challenge README states fees + size-scaled slippage without publishing
exact bps, so this entry uses documented standard assumptions: taker 5 bps
(market orders only; maker 2 bps documented, never used), slippage
`1 + 20 * (order_qty / bar_volume)` bps capped at 15 bps, execution at the
next bar's open, final position marked to market less one exit cost.
The chosen strategy stays #1 under every cost regime tested
(taker 0–10 bps × slippage coef 0–60) — see SUMMARY.md.

## Files

- `backtest.py` — strategies + backtest engine + comparison runner (single file,
  pandas/numpy only). `python3 backtest.py` reproduces `results.json`.
- `bars.csv` — frozen dataset, copied verbatim from
  `github.com/AIProveRH/aiprove/tree/main/challenges/eth-backtest`
  (1,440 ETH/USDT 1-min bars, 24h ending 2026-11-13 12:17 UTC).
- `results.json` — full comparison table, split validation, size sensitivity,
  and the chosen strategy's trade log.
- `SUMMARY.md` — full write-up incl. robustness checks and overfitting caveats.
- `CHALLENGE_README.md` — the challenge's own README, verbatim.

## Reproduce

```bash
python3 backtest.py   # prints the comparison table, writes results.json
```
