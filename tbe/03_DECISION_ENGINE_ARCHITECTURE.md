# 03 — TACTICAL DECISION ENGINE, CHAIN REASONING & MASTER ARCHITECTURE

## PART BR — TACTICAL DECISION ENGINE (Per-Moment Reasoning Checklist)

For every possession moment, the engine evaluates these 19 questions in order (matches Part CO's final-question list exactly, with the pipeline stage each answers noted):

| # | Question | Answered By (see `03` architecture below) |
|---|---|---|
| 1 | Current phase | Phase Detector |
| 2 | Ball location | Ball Tracking |
| 3 | Our team shape (actual, not nominal) | Team Shape Detector |
| 4 | Opponent shape (actual, not nominal) | Team Shape Detector |
| 5 | Available space | Space/Pitch-Control Model |
| 6 | Dangerous space | Dangerousity Model |
| 7 | Numerical superiority | Zone-Count Comparator |
| 8 | Positional superiority | Zone-Value Comparator (Section 7 core KB) |
| 9 | Qualitative superiority | Player Attribute Comparator (Section 22 core KB) |
| 10 | Passing lanes (open/blocked) | Passing Lane Model |
| 11 | Pressure | Pressure Model |
| 12 | Player attributes | Player Signature Store |
| 13 | Game state | Game State Tracker (core KB §24) |
| 14 | Available actions | Action Generator (Part BV) |
| 15 | Best action | Tactical Action Value Ranker (Part BW) |
| 16 | Alternative action | Second-ranked output of the same ranker |
| 17 | Risk | Risk component of Tactical Action Value |
| 18 | Opponent's probable response | Opponent Response Model |
| 19 | Our response to that response | Chain Reasoning Engine (see below) |

## PART BV — PLAYER DECISION MODEL (Action Generator)

At every possession moment, the following action set is evaluated (not all are legal/relevant in every situation — illegality/irrelevance is filtered before ranking):

`PASS | DRIBBLE | CARRY | TURN | SHOOT | CROSS | CUTBACK | SWITCH | RECYCLE | THROUGH_BALL | LONG_BALL`

Each candidate action is scored across these components before ranking:

| Component | What It Measures |
|---|---|
| Progression | How much the action advances the ball toward goal (ties to core KB §8.1's progressive-pass definition) |
| Space gained | Change in SPACE_VALUE (Part BX) between origin and destination |
| Chance creation | Estimated contribution to a shot occurring within the next 1-3 actions |
| Possession retention | Estimated completion/success probability of the action itself |
| Risk | Estimated cost if the action fails, weighted by zone (core KB §1.2's universal risk principle) |
| Transition danger | Estimated exposure if possession is lost immediately after this specific action, given current rest defence shape (core KB §16) |

## PART BW — TACTICAL ACTION VALUE (Class F — Initial Heuristic Weights)

```
TACTICAL_ACTION_VALUE = 0.25*progression + 0.20*space_gained + 0.20*chance_creation
                       + 0.15*possession_retention - 0.15*risk - 0.05*transition_danger_exposure
```

**Explicit non-claim:** these weights are starting points for calibration against real outcome data (core KB §37's dataset schema), not empirically validated coefficients. A production system should fit these weights (or replace the linear form entirely with a learned model) against actual match outcomes rather than deploying the initial values as-is.

---

## PART BS — TACTICAL CHAIN REASONING (Worked Multi-Step Examples)

The engine must never stop at ACTION → RESULT. Below are worked examples of the required ACTION → OPPONENT RESPONSE → ADAPTATION → ... → OUTCOME chain. Each demonstrates the pattern once, in full analytical depth; `rule_generator.py` produces further chains at scale by substituting the same underlying mechanisms across different zone/role/formation combinations.

### Chain 1 — Central overload baiting a mid-block press
1. **ACTION:** Team A's double pivot repeatedly circulates the ball centrally in the middle third, deliberately inviting pressure (core KB §26 TP039).
2. **OPPONENT RESPONSE:** Team B's central midfield commits two players to press the ball centrally, believing the central overload is genuinely vulnerable.
3. **TEAM ADAPTATION:** Team A's ball-near winger tucks into the half-space just vacated by Team B's committed press, becoming a free player (glossary, `01_CONCEPTUAL_MODELS.md`).
4. **SECOND ACTION:** A quick lay-off from the pressed pivot player into the now-free half-space player.
5. **OPPONENT ADAPTATION:** Team B's weak-side central midfielder attempts to recover across to cover the half-space.
6. **THIRD ACTION:** The half-space receiver plays an immediate first-time diagonal pass into the space the recovering midfielder just vacated, releasing the striker turning to face goal.
7. **OUTCOME:** A line-broken, forward-facing possession in the attacking third — the press has been fully bypassed via three connected actions rather than a single pass, at the cost of the possession retention risk carried at each link.

### Chain 2 — Wide overload forcing a defensive rotation failure
1. **ACTION:** Team A overloads the right flank with the winger, overlapping full-back, and a tucked-in mezzala (core KB §7.1 "Overload-to-isolate").
2. **OPPONENT RESPONSE:** Team B's entire defensive block shifts across to match the numbers, including the weak-side full-back tucking in slightly.
3. **TEAM ADAPTATION:** Team A immediately switches play with a long diagonal to the now-isolated weak-side winger.
4. **SECOND ACTION:** The weak-side winger receives in space and drives directly at the recovering, momentarily unbalanced weak-side full-back.
5. **OPPONENT ADAPTATION:** Team B's ball-far centre-back shifts wide to provide emergency cover, since the full-back alone cannot recover in time.
6. **THIRD ACTION:** The winger cuts the ball back rather than continuing to the byline, since the covering CB has now vacated the central channel.
7. **OUTCOME:** A cutback into a temporarily under-marked central zone (core KB §18) — the central defensive gap only existed because of the *second* defensive reaction, not the first, illustrating why chain reasoning beyond a single response is necessary.

### Chain 3 — Counterpress triggered immediately after a turnover
1. **ACTION:** Team A loses possession in the middle third attempting a line-breaking pass that is intercepted.
2. **OPPONENT RESPONSE:** Team B's intercepting player looks immediately to counter-attack directly through the vacated central channel.
3. **TEAM ADAPTATION:** Team A's nearest three players to the ball (core KB §11's counterpressing logic) immediately swarm the new ball-carrier rather than retreating.
4. **SECOND ACTION:** Under the counterpress, Team B's carrier is forced into a rushed, backward pass rather than the intended forward release.
5. **OPPONENT ADAPTATION:** Team B resets into a controlled build-up rather than continuing the counter, accepting the transition opportunity is gone.
6. **THIRD ACTION:** Team A, having won the ball back via the counterpress, now has its own front players still advanced from the original attack — an immediate second-phase attacking opportunity.
7. **OUTCOME:** The original turnover, rather than becoming a conceded counter-attack, becomes a converted counterpress regain in a dangerous zone — the defining value proposition of counterpressing as a system (core KB §11).

### Chain 4 — High line offside trap vs a timed run
1. **ACTION:** Team A's back line steps up in unison as the ball is played backward by Team B, attempting to catch a forward runner offside (core KB §2, §26 TP012).
2. **OPPONENT RESPONSE:** Team B's striker, anticipating the trap, delays his run fractionally to stay onside rather than sprinting immediately.
3. **TEAM ADAPTATION:** Team A's back line, having stepped up, is now positioned higher than intended with the ball about to be played forward.
4. **SECOND ACTION:** Team B plays the through ball the instant the delayed striker is level with the last defender, now onside.
5. **OPPONENT ADAPTATION (from Team A's perspective, defending the follow-up):** Team A's goalkeeper, who adjusted starting position anticipating the high line (core KB §54.3), rushes out to narrow the angle.
6. **THIRD ACTION:** The striker, seeing the goalkeeper committed to closing the angle early, opts to take an extra touch and go around rather than shoot early.
7. **OUTCOME:** A clean 1v1 that the attacking team ultimately wins — illustrating that a mistimed offside trap doesn't fail at the moment of the pass, but at the earlier moment the defensive line misjudged the striker's deliberately delayed run.

### Chain 5 — Set-piece blocking routine countered by a switch of marking
1. **ACTION:** Team A runs a rehearsed corner routine where an attacker screens (legally blocks, core KB §53.1) the man-marker assigned to their primary aerial target.
2. **OPPONENT RESPONSE:** Team B's defence, using a hybrid marking scheme (core KB §53.2), has the near-post zonal defender switch onto the now-free aerial target rather than the blocked original marker chasing around the screen.
3. **TEAM ADAPTATION:** Team A's delivery, prepared for a fully free header, instead finds the target now covered by the switched zonal defender.
4. **SECOND ACTION:** The delivery taker adjusts mid-flight-planning (a pre-planned contingency, not an improvisation) to the secondary far-post runner instead.
5. **OPPONENT ADAPTATION:** Team B's far-post zonal defender, positioned for exactly this contingency, is already goal-side of the secondary runner.
6. **OUTCOME:** The routine is fully defended — illustrating that a well-drilled hybrid marking scheme (core KB §53.2) with pre-planned defensive switches can neutralize even a well-designed blocking routine, provided the defensive rotation itself is rehearsed and not improvised.

*(Five chains shown in full analytical depth. `rule_generator.py`'s `generate_tactical_chains(n)` function produces further chains at scale by combinatorially varying the trigger, zone, formation pairing, and specific tactical mechanism from the core KB's Section 26-30 rule databases — each generated chain is tied to a real, distinct mechanism rather than being a cosmetic relabeling.)*

---

## PART BQ — COUNTERFACTUAL SIMULATION

The engine should be able to answer "what if" questions by re-running the decision pipeline (Part BR above) with one input deliberately altered, holding all other inputs constant, and comparing the resulting TACTICAL_ACTION_VALUE and predicted opponent response.

| Counterfactual Question | Altered Input | What Changes in the Re-Evaluation |
|---|---|---|
| What if the winger stays wide instead of inverting? | Winger's zone assignment | Space value/passing-lane model re-evaluated with width maintained; likely trades a central passing option for a wide crossing option (core KB §3.4's Winger vs Inverted Winger comparison) |
| What if the full-back inverts? | Full-back's zone assignment | Re-evaluates central passing density gained against wide space/overlap threat lost (core KB §Section 45 formation-specific full-back logic) |
| What if the striker drops? | Striker's zone assignment | Re-evaluates central combination gained against last-line/in-behind threat lost (False Nine vs Target Man trade-off, core KB §3.4) |
| What if the defensive line rises? | Back-line height parameter | Re-evaluates compactness/press-support gained against space-in-behind risk (core KB §13-14's block-height trade-offs) |
| What if the team stops pressing? | Press-height parameter set to low | Re-evaluates territorial concession against fatigue/foul-risk reduction (core KB §46.2, §50.4) |
| What if the opponent changes formation? | Opponent's formation input | Re-runs the Formation Counter Database (core KB §30) and Tactical Counter Matrix (§21) against the new shape |
| What if the team switches play? | Ball location input | Re-evaluates SPACE_VALUE and pitch control on the weak side against the switch's own completion risk |
| What if the team attacks the weak side? | Attacking focus parameter | Directly tests the overload-to-isolate mechanism (core KB §7.1) against the opponent's actual current defensive shift |

Each counterfactual output should be presented using the Explainable AI format from `02_EXPLAINABLE_AI_AND_UNCERTAINTY.md`, explicitly comparing the counterfactual's TACTICAL_ACTION_VALUE to the action actually taken/recommended.

---

## PART BO/BP — TACTICAL MEMORY & ADAPTATION LOOP

**Tactical memory** — the engine retains, per match, a running log of:

```json
{
  "successful_patterns": [{"pattern": "overload_to_isolate_right", "count": 3, "avg_outcome_value": 0.62}],
  "failed_patterns": [{"pattern": "central_combination_low_block", "count": 4, "avg_outcome_value": 0.11}],
  "successful_presses": [{"trigger": "back_pass", "success_rate": 0.7}],
  "failed_presses": [{"trigger": "wide_reception", "success_rate": 0.2}],
  "dangerous_zones_conceded": ["left_half_space_Z17"],
  "weak_opponent_players": [{"player_id": "string", "exploited_via": "pace_mismatch_wide"}],
  "opponent_adjustments_observed": [{"minute": 34, "change": "switched_to_back_five"}]
}
```

**Adaptation loop (Part BP):**

```
PLAN (pre-match gameplan, from Opposition Analysis, Part BN)
  → OBSERVE (in-match data accumulates into Tactical Memory, above)
  → IDENTIFY PROBLEM (a pattern in Tactical Memory crosses a failure threshold, e.g. a plan repeatedly scores low TACTICAL_ACTION_VALUE outcomes)
  → ADJUST (Coaching Adjustment library, Part BM, matched to the identified problem)
  → TEST (the adjustment is applied and its own outcomes begin logging to Tactical Memory)
  → MEASURE (compare post-adjustment outcome values to pre-adjustment baseline)
  → ADAPT AGAIN (loop continues; if the adjustment itself underperforms, a further adjustment or reversion is triggered)
```

This loop should run continuously, not just at half-time — the engine's own confidence outputs (Part CL) should widen (move toward "low"/"medium") when Tactical Memory shows a recent pattern shift that hasn't yet been fully incorporated into the current gameplan.

---

## PART CN — FINAL MASTER ARCHITECTURE

```
MATCH DATA
  ↓
PLAYER TRACKING            (raw positional/event data — Class D)
  ↓
EVENT DETECTION            (passes, shots, tackles, etc. tagged — Class D)
  ↓
BALL LOCATION  +  PLAYER LOCATIONS
  ↓
PLAYER ATTRIBUTES          (Player Signature Store — Class D/C, core KB §22)
  ↓
TEAM SHAPE   +   OPPONENT SHAPE     (actual, phase-dependent — core KB §5's principle)
  ↓
TACTICAL PHASE DETECTION    (attacking org. / defensive org. / off. transition / def. transition / set piece)
  ↓
SPACE ANALYSIS              (SPACE_VALUE, PITCH_CONTROL, DANGEROUSITY — 01_CONCEPTUAL_MODELS.md)
  ↓
PASSING NETWORK  +  PASSING LANE MODEL
  ↓
PRESSURE MODEL
  ↓
TACTICAL RULE ENGINE         (rules/tactical_rules_seed.json + core KB §26-30 databases)
  ↓
PLAYER DECISION ENGINE       (Part BV/BW — Action Generator + Tactical Action Value)
  ↓
OPPONENT RESPONSE ENGINE     (Tactical Counter Matrix, core KB §21 + Formation Counter DB, §30)
  ↓
TACTICAL ADAPTATION          (Part BP's loop, informed by Tactical Memory, Part BO)
  ↓
COUNTERFACTUAL SIMULATION    (Part BQ)
  ↓
TACTICAL BATTLE SCORE        (core KB §35's 0-100 scoring model, informed by TACTICAL_DOMINANCE, 01_CONCEPTUAL_MODELS.md Part CC)
  ↓
EXPLAINABLE RECOMMENDATION   (02_EXPLAINABLE_AI_AND_UNCERTAINTY.md format, tagged with source class + confidence)
```

**Implementation note:** `engine/tactical_decision_engine.py` implements this pipeline as a working (illustrative-scale) Python skeleton — each pipeline stage above is a function/class, operating on toy input data, so the architecture is not just a diagram but runnable code you can extend with real tracking-data ingestion.

---
*See `data_model/` for the 13-table CSV schema (Part CH) and `rules/` for the machine-readable rule schema (Part CI).*
