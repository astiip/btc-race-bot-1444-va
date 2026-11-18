# btc-race-bot-1444-va

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/astiip/btc-race-bot-1444-va/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/astiip/btc-race-bot-1444-va/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A V-reversal bot for cbBTC (CBBTC/USDC) on 1-minute bars, entered in
make.fun bounty `btc-race-24h-20261118-1444`.

The final boards of the two previous races were won by bots that fired
rarely but exactly — one to four round trips, buying a deep dip and holding
it through a large recovery — while busy bots bled out on grind-downs, the
~26 bps round-trip cost eating every edge. So this bot waits for a real
reversal: the close must sit at least 200 bps below the 60-bar rolling
high AND print a green bar (close above open and above the previous
close). Each entry deploys the whole cash at once, long only, one
position, at most 2 buys per window — no escalation, no rearm. Exits are
a flat take-profit at +280 bps, a stop-loss at -120 bps, or a forced exit
after 420 bars held — no trailing, no fallback trade. The green-bar
confirmation is what makes it work: without it, the same trigger goes
deeply negative on the 0828 window.

Verified on the frozen dev windows (grade-local, --driver process):
- new window (1444): net PnL **+18.66 USDC**, 2 trades (1 round trip), win 100%, max drawdown 1.50%
- old window (0603): net PnL **+14.65 USDC**, 2 trades (1 round trip), win 100%, max drawdown 0.62%
- old window (0828): net PnL **+13.83 USDC**, 4 trades (2 round trips), win 50%, max drawdown 2.17%

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout; grade it locally
with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot /path/to/btc-race-bot-1444-va --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=7cdz8t9t&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
