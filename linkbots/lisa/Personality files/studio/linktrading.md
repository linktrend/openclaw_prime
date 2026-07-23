# LiNKtrading — Briefing Summary

_Briefed 2026-07-19 from `/LiNKdrive/Manuals/LiNKtrading/linktrading_manual.md`. Planning stage, no action needed._

## Core Architecture

- **AI-assisted, deterministic, multi-venue trading platform** — not a single bot script
- **Central doctrine:** AI assists (research, audit, review, reports) but does NOT control live execution
- **Presumptive core engine:** NautilusTrader (open-source, Rust-native, Python strategy layer, event-driven)
- **Subject to:** formal validation sprint before production commitment
- **Fallback:** QuantConnect LEAN; Freqtrade/Hummingbot as crypto sandbox candidates; CloddsBot as optional experimental adapter only

## Target Venues

Binance, Hyperliquid, Coinbase, Interactive Brokers, Polymarket

## Key Design Principles

1. **Deterministic execution** — LLMs never place trades directly
2. **Core-adapter separation** — replaceable venue adapters
3. **Strategy lifecycle discipline** — idea → spec → code → backtest → paper → micro-live → scaled
4. **Layered risk governance** — global, venue, strategy, instrument, portfolio, operational
5. **Research-to-live consistency** — same logic across all stages
6. **Auditability** — every trade, order, config change, AI proposal traceable
7. **Operator simplicity** — complex internals, simple AI-assisted interface

## OpenClaw Role

- Operations supervisor — not trading authority
- Monitors dashboards/logs, runs checklists, detects anomalies, generates reports, coordinates Cursor/Codex tasks, escalates issues
- **Cannot:** place trades, override risk governor, deploy unvalidated strategies, modify live configs

## LLM Council Role

- Research and review intelligence layer — not execution authority
- Generates proposals, not executable commands
- Proposals pass through deterministic validators, backtests, risk governor, human approval

## Autonomy Levels (0–6)

0: Research Only → 1: Backtest Only → 2: Paper/Sandbox → 3: Shadow Live → 4: Micro-Capital → 5: Controlled Live → 6: Scaled Live

## Current Status

Planning stage. Manual defines full architecture across 12 sections. No implementation started yet.

## Additional Scope (beyond software setup)

- Research trading strategies
- Define risk policies and risk strategies
- Define overall trading process and rules
- These are Carlos's items to work through, not just software implementation
