import type { Note } from "./types";

const NOW = "2026-01-01T00:00:00.000Z";

export function seedNotes(): Note[] {
  return [
    {
      slug: "per-trade-checklist",
      title: "The Per-Trade Checklist: 8 Data Points",
      category: "Core Method",
      summary:
        "The repeatable checklist to complete after every trade. Specific enough to surface patterns, simple enough to finish in under five minutes.",
      tags: ["checklist", "core", "daily"],
      pinned: true,
      updatedAt: NOW,
      body: `# The 8 data points

You do not need paragraphs. Most of these are a single tap, a tag, or one sentence.

## 1. Strategy Name
Name the setup you traded. Not "long" or "short." The specific pattern.

This is the single most important field in your journal because it lets you compare performance across setups. Without a strategy name, all your trades blend into one average. Manage your list of strategies in [[settings|Settings]].

## 2. Quality Grade
The grade is **earned from a checklist, not typed in**. Tick off every criterion your setup actually met and the grade computes itself:

- **A** = 100% of the checklist satisfied.
- **B** = 75% or more.
- **C** = anything below 75%.

Grade the setup, not the result. An A-grade trade that loses money is still an A-grade trade. Over 50 trades, A-grade setups should show a meaningfully higher expectancy than C-grade setups. If they do not, your entry criteria need tightening. Edit the checklist itself in [[settings|Settings]].

## 3. Did You Follow Your Rules?
Tick each rule you actually followed. A trade only counts as "rules followed" when every rule is ticked.

This drives your [[rule-adherence|Rule Adherence Score]], the most direct measurement of trading discipline. When you filter by rules followed versus rules broken, you often discover your system is better than you thought. The damage comes from execution mistakes, not from bad setups.

## 4. Planned Risk vs Actual Risk
Write down the amount you planned to risk and the amount you actually risked. If your stop got moved, or you added to a loser, the second number is bigger than the first.

This gap is one of the most expensive patterns in trading. Over 100 trades, even a small average gap compounds into real money. See [[risk-gap|planned vs actual risk]].

## 5. Trade Reason (Why You Entered)
One sentence explaining why you took the trade. Not a chart analysis essay. Just the core logic.

> "BTC swept the Asia low and printed a bullish ChoCH on the 5M."

After 50 trades you can scan your reasons and spot when entries are sloppy versus precise. Sloppy reasons correlate with lower win rates.

## 6. Exit Reason (Why You Closed)
One sentence explaining why you exited. "Hit full 1:3 target." "Stopped out at planned level." "Cut early because I felt anxious."

Exit reasons reveal the patterns that cost the most money. If half your exits say "cut early," you have a profit-taking problem. You cannot fix what you do not name.

## 7. Emotion Tags
Three questions, one word each:

1. What was I feeling when I enter the trade?
2. What was I feeling during the trade?
3. What was I feeling after the trade?

Splitting the emotion across the life of the trade is what makes it diagnostic. Entering calm and panicking mid-trade is a completely different problem from entering on FOMO. Add, remove, or reword the questions in [[settings|Settings]].

## 8. One Lesson
One sentence. Not every trade has a lesson, and that is fine. Write "clean execution, nothing to change" when the trade went to plan.

These one-liners become gold during [[weekly-review|weekly review]]. When you read 20 lessons in a row, themes jump out that you would never notice trade by trade.`,
    },
    {
      slug: "two-layers",
      title: "The Two Layers of Journal Data",
      category: "Core Method",
      summary:
        "Mechanical data tells you what happened. Contextual data tells you why. Without both, a journal is just a trade log.",
      tags: ["core", "data-model"],
      pinned: true,
      updatedAt: NOW,
      body: `# Two layers, two purposes

A trading journal entry is the record you create after each trade that captures both the factual data and the decision-making context.

## Layer 1: Mechanical
Direction, entry and exit timestamps, day, coin, quantity, entry and exit price, position value, outcome, trading fee, leverage, margin, timeframe, strategy, net P&L, planned reward ratio, and final R.

Several of these compute themselves:

- **Position value** = quantity x entry price
- **Margin** = position value / leverage
- **Day** comes from the entry timestamp
- **Net P&L** comes from direction, prices, quantity, and fee
- **Win / loss / breakeven** comes from net P&L

## Layer 2: Contextual
The decisions you made, the conditions you traded in, and the quality of your execution. **This is where 90% of the improvement signal lives**, and it is the layer that only you can provide.

See the [[per-trade-checklist|8 data points]] for exactly what to capture.

---

## The two traps

1. Writing **too much**, creating 500-word essays after every trade until you burn out by week three.
2. Writing **too little**, logging only entry, exit, and P&L, which gives you nothing useful to review later.

The solution is a repeatable per-trade checklist: specific enough to surface patterns, simple enough to complete in under five minutes.`,
    },
    {
      slug: "reward-ratio",
      title: "Planned Reward Ratio and Final R",
      category: "Core Method",
      summary:
        "Record what you planned to make and what you actually banked. The gap between them is your exit discipline.",
      tags: ["risk", "metrics", "exits"],
      pinned: false,
      updatedAt: NOW,
      body: `# Plan the ratio, then record the result

## Planned reward ratio
Written as \`1:3\` or \`1:4\`. One unit of risk against three or four units of reward. Decide this **before** you enter, because it is the number that makes the setup worth taking.

## Final R
What you actually banked, expressed in the same units:

- A full winner on a 1:3 plan is **+3**.
- A full stop out is **-1**.
- Cutting a 1:3 winner early at a third of the way might be **+1**.
- Letting a stop run past its level might be **-3**.

## Plan capture
The journal compares the two and reports **plan capture**: the share of the planned reward you actually collected.

If your plan capture is consistently low, you are not losing money on bad setups. You are losing it between your entry and your exit. That is a completely different fix from changing strategy, and you can only see it once both numbers are recorded.`,
    },
    {
      slug: "journal-vs-trade-log",
      title: "Journal vs Trade Log",
      category: "Core Method",
      summary:
        "A trade log records what happened. A journal records what happened and why.",
      tags: ["core", "concepts"],
      pinned: false,
      updatedAt: NOW,
      body: `# The difference is causation

A **trade log** records what happened: entry price, exit price, profit or loss.

A **trading journal** records what happened *and why it happened*: the setup you traded, the quality of the setup, whether you followed your rules, the emotions you felt, and what you learned.

The trade log tells you that you lost $500.

The journal tells you that you lost $500 because you entered a C-grade setup while feeling frustrated after a previous loss, which is revenge trading, and now you can measure how often that pattern repeats and what it costs you.`,
    },
    {
      slug: "tagging-system",
      title: "The Tagging System",
      category: "Core Method",
      summary:
        "Start with three or four tag categories. The right tags turn your journal into a searchable database; too many create noise.",
      tags: ["tags", "setup"],
      pinned: false,
      updatedAt: NOW,
      body: `# Start with a few categories

Tags let you slice your data later. The wrong tags, or too many tags, create friction and reduce consistency. Add more categories only once you know what questions you want to answer.

Every category and every option is yours to edit in [[settings|Settings]]. The defaults are:

## Session
Asia, London, New York, Overlap. Tells you **when** you trade best.

## Market Condition
Trending, Range, Choppy, High Volatility, Low Volatility. Tells you **which environments** suit your setups.

## Confluence Count
1 factor, 2 factors, 3+ factors. Tells you whether more confirmation actually improves results, or just causes hesitation.

---

Timeframe lives in the mechanical layer rather than in tags, because every trade has exactly one.`,
    },
    {
      slug: "rule-adherence",
      title: "Rule Adherence Score",
      category: "Discipline",
      summary:
        "The most important single field. Separates system performance from execution mistakes.",
      tags: ["discipline", "metrics"],
      pinned: true,
      updatedAt: NOW,
      body: `# The most important field

Whether you followed your rules is the most important data point in the journal.

Your rules live as a checklist you define in [[settings|Settings]]. On each trade you tick the ones you actually followed. A trade counts as **rules followed** only when every box is ticked, and the journal also records the partial score so you can see how close you were.

> **Below 75% adherence means the problem is execution, not strategy.**

## How to use it

After 30 trades, filter by rules followed versus rules broken and compare the profit factor of each group. The gap is usually eye-opening.

Most traders who track this discover their strategy performs better than they thought, and the real damage comes from the trades where they broke their own rules. If your rules-followed group is profitable and your rules-broken group is not, you do not have a strategy problem. You have a discipline problem, and that is a different fix.`,
    },
    {
      slug: "risk-gap",
      title: "Planned Risk vs Actual Risk",
      category: "Discipline",
      summary:
        "The gap between what you intended to risk and what you actually risked is one of the most expensive patterns in trading.",
      tags: ["risk", "metrics", "discipline"],
      pinned: false,
      updatedAt: NOW,
      body: `# Mind the gap

Actual risk drifts upward when you:

- Move your stop further away after entry.
- Add to a losing position.
- Size up because the setup "feels" better.

## Why it matters

Over 100 trades, even a small average gap costs real money. If the gap averaged more than **20%** over a review period, your sizing discipline needs work.

The only way to see this pattern is to record both numbers on every trade. One is what you intended. The other is what you did.`,
    },
    {
      slug: "five-minute-rule",
      title: "The Five-Minute Rule",
      category: "Habit",
      summary:
        "Set a timer. When it ends, the entry is done. The journal is a data collection tool, not a diary.",
      tags: ["habit", "workflow"],
      pinned: false,
      updatedAt: NOW,
      body: `# Set a five-minute timer

The new entry screen runs the timer for you. When it ends, your entry is done. This forces you to prioritize the data points that matter and skip the narrative that does not.

The 8 data points can be completed in under three minutes for most trades:

- Strategy name — 2 seconds
- Quality checklist — 15 seconds
- Rules checklist — 15 seconds
- Planned vs actual risk — 10 seconds
- Trade reason — 15 seconds
- Exit reason — 10 seconds
- Emotion tags — 6 seconds
- One lesson — 20 seconds

> If you find yourself writing paragraphs, you are journaling wrong.

Save the analysis for your [[weekly-review|weekly review]].`,
    },
    {
      slug: "weekly-review",
      title: "The Weekly Review",
      category: "Review",
      summary:
        "A repeatable five-step pass in about 30 minutes. Every figure is computed from your logged trades.",
      tags: ["review", "weekly"],
      pinned: true,
      updatedAt: NOW,
      body: `# Measured, not narrated

The journal is data collection. The review is where improvement actually happens. Logging trades all week and then glancing at your P&L on Friday is like recording every workout and never checking whether you are getting stronger.

This journal has no AI and no pre-written verdicts. The review page does arithmetic on the trades you logged and shows you the result. If you have logged nothing, it says nothing.

## The five steps

Run this every Sunday evening or before the Monday open. Thirty minutes, consistently, beats two hours every other week.

### 1. The week at a glance

Do not zoom into individual trades yet. Look at the shape of the week: which days were green, which were red, how large the swings were, and whether your daily range is expanding or contracting against the prior week. One big red day and four small green days is a different week from four steady wins.

The page also shows your worst peak-to-trough swing inside the week. Ending green after going from +$1,200 on Wednesday to -$400 on Thursday still tells you something about risk management.

### 2. Metrics against your baseline

Without a baseline, every week feels like either a celebration or a crisis. A 45% win rate is fine if your average is 48% and alarming if your average is 62%.

Your week is compared against a rolling window that ends the day before it starts, so the week never dilutes its own baseline. Anything far enough from normal is flagged; both the window length and the flag threshold are set in [[settings|Settings]].

Six measures are compared: win rate, average winner against average loser, profit factor, trades per week, expectancy per trade, and maximum drawdown.

### 3. Process against outcome

Every decided trade is graded on two axes at once, whether you followed your rules and whether it paid:

- **Plan win** — followed the rules, made money. Repeat it.
- **Plan loss** — followed the rules, lost anyway. This is normal variance and needs no adjustment.
- **Off-plan loss** — broke a rule and paid for it.
- **Off-plan win** — broke a rule and got paid anyway. The most dangerous square on the grid, because you were rewarded for behaviour that will not keep working.

If your off-plan share crosses the threshold you set, the constraint is execution, not strategy. Changing your setup will not fix a discipline problem.

Two supporting measurements sit beside the grid. The first counts which specific rules you broke: the same rule broken twice in one week is a pattern, not a slip. The second removes your single best trade and recomputes the week, because if one winner carries the result, you had an outcome rather than an edge.

### 4. Pattern breaks

This is the most valuable part of the review, and it is where the ranked list below does the work.

### 5. One change for next week

Covered at the bottom of this page.

## How patterns are ranked

Every slice of your data is measured the same way: take the trades in that slice, sum the net P&L, and price the slice at what it cost. A slice can be a strategy, an hour of the day, a weekday, a coin, a timeframe, a setup grade, an emotion, a rule you did not tick, or one of your own tag categories.

Slices that lost money are ranked by size. The top of that list is the most expensive pattern in your journal, by definition rather than by opinion.

## Sample size

A slice with four trades in it is noise. The review flags any slice holding fewer trades than your sample-size floor, which you set in [[settings|Settings]] and which defaults to 30. Thin slices still appear, marked with their count, so you can watch them build.

## What gets measured beyond simple slices

- **Behavioural cascade** — a re-entry taken within your cascade window of a losing exit. Counted as a sequence, priced at what the follow-up trades did.
- **Position sizing** — on losing trades where actual risk exceeded planned risk, the share of the loss attributable to the extra size.
- **Exit execution** — winners closed below the [[reward-ratio|planned reward]], priced at the R left behind.
- **Day pattern** — red days that immediately followed a green day, and your longest streaks in both directions.
- **Edge concentration** — how much of your gross profit comes from how few strategies.
- **Drift** — your most recent window of trades compared against every trade before it: win rate, average winner in R, average loser in R, and expectancy per trade. A distribution shift shows up here before it shows up as a drawdown.
- **Trade order within the day** — results split by whether a trade was your first, second, third, or fourth-and-later of the day. Degrading expectancy down that list is the numeric signature of overtrading.
- **When rule breaks happen** — off-plan trades grouped by entry hour. Rule breaks usually cluster in one part of the session, which turns a vague discipline problem into a specific time window you can put a rule around.
- **Timing** — longest and shortest holds with their results, average hold on winners against losers, and your best and worst hour and weekday.

## One change per week

Analysis without action is entertainment. After the review, pick the single most expensive pattern and commit it as next week's change. The journal stores what that pattern cost when you chose it.

When you review the following week, the same measurement runs again on that week's trades and shows you the difference. If the pattern did not occur, it says so. That is the whole compliance check: the same arithmetic, one week later.

Change one thing at a time. If you change four, you cannot tell which one worked. If you change none, you wasted the data you collected. One adjustment a week is fifty-two refinements a year.

## Common ways the review fails

- **Replaying every trade in detail.** The aggregate patterns tell you more. Save the deep dives for your biggest winner and biggest loser.
- **Only reviewing losing weeks.** A winning week built on off-plan trades needs correcting before the luck runs out.
- **Letting it run long.** Ninety minutes means you will skip it.
- **Changing several things at once.** Then you cannot attribute next week's result to anything.
- **Not enough trades.** If you take three to five trades a week rather than a day, review fortnightly or monthly instead. The steps do not change, you just need enough trades for the patterns to mean anything.`,
    },
    {
      slug: "readiness",
      title: "Neuro-Readiness Scoring",
      category: "Review",
      summary:
        "How overnight physiology is turned into four scores and a hard cap on the risk you may take today.",
      tags: ["readiness", "health", "risk"],
      pinned: false,
      updatedAt: NOW,
      body: `# Your P&L is a lagging indicator of your neurobiology

Markets combine extreme uncertainty with rapid feedback, which is precisely the environment that triggers autonomic survival responses. Those responses are measurable overnight, before you place a single order.

The Readiness page turns your morning readings into four scores. Each one is a weighted blend of the measures the research attaches to that specific capacity, and every measure is judged against **your own rolling 30-day baseline** rather than a population average. Nothing is diagnosed and nothing is predicted; it is arithmetic on numbers you recorded.

## 1. Decision making

Weighing probability against reward is metabolically expensive work done by the ventromedial prefrontal cortex, and slow wave sleep is what restores that energy. Killgore and colleagues (2006) put sleep-deprived subjects through the Iowa Gambling Task, a standard proxy for financial risk-taking, and found that after two nights of loss they consistently chose high-risk, negative-expectancy options, resembling patients with actual prefrontal lesions. They did not report feeling impaired.

| Input | Weight |
| --- | --- |
| Sleep debt | 40% |
| Slow wave sleep against baseline | 40% |
| Respiratory rate against baseline | 20% |

Sleep debt scores full marks at zero and reaches zero at three hours. Respiratory rate is only penalised upward, because a spike usually means illness or systemic stress rather than anything you did at the desk.

**The compound rule.** Sleep debt above 1.5 hours together with deep sleep more than one standard deviation below baseline caps the score at 35 and halves your position sizing for the day. Either condition alone is survivable; together they are where risk judgement actually breaks.

## 2. Focus

Sustained vigilance and pattern recognition. Lo and Repin (2002) wired up professional traders during live sessions and found significant cardiovascular arousal during volatility. The traders who held a stable resting heart rate had the autonomic control to sustain attention without burning through it. REM sleep separately consolidates the associative memory that pattern recognition runs on.

| Input | Weight |
| --- | --- |
| REM sleep against baseline | 50% |
| Resting heart rate deviation | 50% |

Resting heart rate is penalised at twelve points per beat above baseline, so three beats up costs roughly a third of that component.

**The compound rule.** A resting heart rate three or more beats above baseline **combined with** REM below baseline caps Focus at 48 and moves you off scalping onto higher timeframes that need less screen time.

## 3. Discipline

Thayer's neurovisceral integration model establishes vagally mediated HRV as a proxy for the prefrontal cortex's ability to inhibit the amygdala. Practically: high HRV means the brake works, and low HRV predicts impulsive, emotionally reactive behaviour. This is the score that governs whether you will hold a stop or move it.

| Input | Weight |
| --- | --- |
| HRV against baseline | 60% |
| Yesterday's strain against today's recovery | 40% |

The second input prices allostatic load. An all-out strain day that produces a red recovery the next morning means the stress did not clear, and the mismatch is penalised in proportion to the gap.

**The compound rule.** HRV below your 30-day average with recovery in the red caps the score at 30. Below 34, the page issues a lockout rather than a size reduction, because impulse control is the one deficit you cannot trade your way around by going smaller.

## 4. Confidence

Not bravado. Interoception, the accuracy with which you read your own bodily signals. Coates found that traders with stronger physiological markers, high baseline HRV in particular, had better interoceptive sensitivity, and that this tracked with both profitability and survival on the floor.

| Input | Weight |
| --- | --- |
| Recovery zone | 50% |
| 7-day HRV trend | 30% |
| Today's strain capacity | 20% |

Green recovery on a rising HRV trend is the state in which a gut feeling is worth acting on. When the score is low, the guidance is to take only what you can point at on the chart.

## What the scores actually do

The lowest of the four governs the day, because readiness is not an average:

- 67 and above across the board: full risk.
- Lowest score 50 to 66: 75% of normal risk.
- Lowest score 34 to 49: 50%.
- Lowest score below 34: 25%.
- Discipline below 34: lockout. Manage open positions, place nothing new.

A missing reading is left out of its blend rather than counted as zero, so a partial morning still produces a usable score.

## Baselines

Deviations only mean something against your own history. The page builds a rolling 30-day average as you log, and marks the baseline unreliable under fourteen days. Until then, treat the scores as directional.

## Checking whether any of it holds

The Readiness page groups your trading results by the readiness band of the day they happened on. If your optimal days do not out-trade your compromised days over a reasonable sample, the scoring is not earning its place, and you should say so rather than keep deferring to it.

## Connecting WHOOP

The mapping from WHOOP's recovery, sleep and cycle payloads is already written, as is the write path that stores a synced day. Only the authenticated calls are missing: implement \`fetchWhoopDay\` in \`src/lib/providers/whoop.ts\` and the Try sync button starts working. Until then, enter the numbers by hand.`,
    },
    {
      slug: "premarket",
      title: "The Pre-Market Plan",
      category: "Core Method",
      summary:
        "Write the plan before the session, not the story after it. One record per day, summarised each morning.",
      tags: ["premarket", "planning", "daily"],
      pinned: false,
      updatedAt: NOW,
      body: `# Decide before it costs you anything

Everything you decide after the open is decided under time pressure with money at stake. The pre-market record moves those decisions to the one moment in the day when they are cheap.

## What goes in

**Yesterday's price movement.** One paragraph on what the market actually did in the previous session. Writing it forces you to look, and it gives next week's review something to compare your read against.

**Market analysis, top down.** A chart and a read for the monthly, weekly and daily candle. Each carries its own bias, which is what lets the summary tell you when your timeframes disagree with each other.

**Day bias.** Bullish, bearish or neutral, plus the reasoning. If the higher timeframes conflict with this, the summary says so rather than letting you notice at the worst moment.

**Important levels.** The prices that would change your mind. A level you cannot name a reaction for is decoration.

**Important events.** Scheduled news, with an impact rating. A high-impact release can invalidate a clean technical read, and knowing it is at 8:30 is different from discovering it at 8:31.

## The summary

Saving generates a summary of that day's plan, shown at the top of the page. It is deliberately today-only: yesterday's plan is history, and leaving it on screen encourages trading from a stale read. Older plans stay accessible below and can be reopened and edited.

The summary shows your bias, whether the three timeframes agree, the levels and events you marked, how complete the plan is, and what your trading has done since the open. It writes nothing you did not write first.`,
    },
    {
      slug: "screenshots",
      title: "Screenshots",
      category: "Advanced",
      summary:
        "Memory is unreliable. Two exit screenshots, on the 1 minute and 15 minute charts.",
      tags: ["screenshots", "workflow"],
      pinned: false,
      updatedAt: NOW,
      body: `# Capture what the chart looked like

After a trade is over you will rationalize your entry or forget what the setup actually looked like in real time.

This journal captures the exit on two timeframes:

1. **1 minute** — the execution detail. Did you exit into a wick, a stall, or a genuine reversal?
2. **15 minute** — the context. Was your exit near a level that mattered on the higher timeframe?

Copy a chart image to your clipboard and paste it straight into the box with \`Cmd+V\`. The image is stored locally alongside your journal data, and stays pinned on screen while you fill out the rest of the entry.`,
    },
    {
      slug: "settings",
      title: "Making the Journal Yours",
      category: "Reference",
      summary:
        "Strategies, quality checklist, rules, emotion questions, and tag categories are all editable.",
      tags: ["settings", "setup"],
      pinned: false,
      updatedAt: NOW,
      body: `# Everything here is editable

A journal only gets used if it matches how you actually trade. The Settings page controls:

## Strategies
The list you pick from on each trade. Keep it short and specific.

## Quality checklist
The criteria that define an A-grade setup for you. The grade is computed from how many you tick, so this list *is* your definition of quality. Ticking every box is an A, 75% or more is a B, below that is a C.

## Rules checklist
Your trading rules, one per line. A trade counts as "rules followed" only when every rule is ticked.

## Emotion questions
By default three: before, during, and after the trade. Add a fourth, reword them, or cut down to one.

## Tag categories
Each category has a name and a list of options. Add a category for anything you want to slice by later.

---

Changing a checklist does not rewrite history. Each trade stores the grade and score it earned at the time it was saved.`,
    },
    {
      slug: "faq",
      title: "Frequently Asked Questions",
      category: "Reference",
      summary: "Short answers to the questions that come up when setting up a journal.",
      tags: ["faq", "reference"],
      pinned: false,
      updatedAt: NOW,
      body: `# FAQ

## What should I write after every trade?
Record 8 data points: strategy name, quality grade, whether you followed your rules, planned versus actual risk, trade reason, exit reason, emotion tags, and one lesson. The mechanical layer is mostly computed. See the [[per-trade-checklist|full checklist]].

## How long should an entry take?
Under five minutes. The new entry screen runs a timer so you can see the budget.

## How is the quality grade decided?
By checklist completion, not by feel and not by result. 100% is an A, 75% or more is a B, below that is a C. You define the checklist in [[settings|Settings]].

## What tags should I use?
Start with [[tagging-system|three categories]]: session, market condition, and confluence count. Add more only once you know which questions you want to answer.

## Where are my screenshots stored?
Locally, in the \`data/screenshots\` folder next to your journal data. Nothing leaves your machine.

## What is the most important thing to track?
Whether you followed your rules. This one field lets you calculate your [[rule-adherence|Rule Adherence Score]] and separate system performance from execution mistakes.

## How is this different from a trade log?
See [[journal-vs-trade-log|journal vs trade log]]. A log records what happened. A journal records why.`,
    },
  ];
}
