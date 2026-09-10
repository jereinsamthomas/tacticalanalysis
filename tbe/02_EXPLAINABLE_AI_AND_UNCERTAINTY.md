# 02 — EXPLAINABLE AI, UNCERTAINTY & SOURCE CLASSIFICATION

## PART CM — SOURCE / KNOWLEDGE CLASSIFICATION SCHEMA

Every concept in this knowledge base package (including the core KB's 54 sections) falls into exactly one of these classes. A Tactical Battle Engine should tag its internal knowledge store with this classification and **never present C/D/E/F/G output with the confidence appropriate to A/B**.

| Class | Meaning | Examples From This Knowledge Base |
|---|---|---|
| **A — Football law** | Defined by IFAB's Laws of the Game; not subject to tactical interpretation | Offside definition, penalty area dimensions, number of players, card thresholds (core KB §2) |
| **B — Established football principle** | Near-universal tactical logic accepted across essentially all coaching traditions | "Half-spaces offer better shooting angles than wings" (core KB §1.3); "risk tolerance should rise as the ball nears the opponent goal" (core KB §1.2) |
| **C — Coaching heuristic** | Common, widely-taught guidance that is nonetheless a style choice or rule of thumb, not a universal law | "Show the attacker onto their weak foot" (core KB §Section 42); most named player roles (core KB §3, §51) are heuristic profiles, not fixed categories |
| **D — Observed match data** | A specific, measured fact from actual matches — only as reliable as its sample size and source | PPDA bands (core KB §46.1), physical output benchmarks (§46.2), duel/crossing benchmarks (§50) |
| **E — Derived metric** | A number calculated from raw observed data using a defined (often external, published) methodology | xG, xA, xT as referenced descriptively in core KB §39 — the *published* versions, not this package's internal re-implementation |
| **F — Model assumption** | A structure or formula this knowledge base proposes for a Tactical Battle Engine to implement and calibrate itself; explicitly not claimed as scientifically validated | SPACE_VALUE, PRESSURE_MODEL, PITCH_CONTROL, internal xT construction, TACTICAL_ACTION_VALUE (all in `01_CONCEPTUAL_MODELS.md`) |
| **G — AI prediction** | An output the engine generates at inference time (a recommended action, a predicted opponent response) — inherently uncertain and must always ship with a confidence/uncertainty statement (Part CL below) | Any live recommendation the engine produces from the decision pipeline in `03_DECISION_ENGINE_ARCHITECTURE.md` |

**Governing rule:** Classes C, E, F, and G must never be presented to an end user or downstream system as if they were Class A or B. A UI/output layer built on this knowledge base should visibly tag confidence-sensitive content (e.g., a small "heuristic" or "model estimate" label), not bury the distinction only in this document.

---

## PART CK — EXPLAINABLE AI OUTPUT FORMAT

Every tactical recommendation the engine produces must be structured as:

```
RECOMMENDATION: <the specific suggested action>

WHY:
- <observed condition 1, tagged with its source class>
- <observed condition 2, tagged with its source class>
- <observed condition 3, tagged with its source class>
- ...

MECHANISM: <the underlying tactical principle this recommendation applies — cross-referenced
            to the relevant core KB section, e.g. "Section 7.1: Overload-to-isolate">

CONFIDENCE: <see Part CL format below>

ALTERNATIVE: <the next-best action that was considered and not chosen, and why>
```

### Worked Example

```
RECOMMENDATION: Switch play to the weak-side winger (Z25).

WHY:
- Opponent has shifted 6 outfield players to the ball-side half of the pitch [Class D — observed positional data]
- Weak-side full-back is currently the only defender covering Z24/Z25 [Class D — observed positional data]
- A 1v1 in space is a high-value outcome in the attacking third given current risk tolerance [Class B — established principle, core KB §1.2]
- Our weak-side winger has a qualitative dribbling advantage over their weak-side full-back based on this season's take-on success rate [Class D — observed data]

MECHANISM: Overload-to-isolate (core KB Section 7.1) — the opponent's ball-side commitment
           has structurally created a weak-side numbers-down situation; the switch converts
           that structural advantage into a direct 1v1.

CONFIDENCE: Medium-high. The passing lane for the switch is currently open, but a long
            diagonal pass carries inherent technical risk (core KB §8.1's "risk pass" category),
            and the opponent's weak-side full-back has recovered similar switches successfully
            in 2 of the last 3 observed instances this match.

ALTERNATIVE: Continue combining centrally through the half-space overload already in progress —
             lower risk (short passing range) but lower reward (no clean 1v1 created), and the
             opponent's compact central shape currently makes progress there slower.
```

---

## PART CL — UNCERTAINTY FORMAT

The engine must never state a prediction as a certainty. Every predictive (Class G) output uses this structure:

```
PREDICTION: <what the engine expects to happen>
CONFIDENCE: <qualitative band: low / medium / medium-high / high — deliberately not a false-precision
             decimal probability unless the underlying model has actually been calibrated against
             real outcome data (Class E), per Part CL's instruction not to overclaim>
UNCERTAINTY: <the specific factors that could invalidate the prediction>
ALTERNATIVE: <what happens instead if the prediction is wrong, and how the engine would detect it>
REASON: <the chain of evidence/logic behind the confidence level, referencing source classes>
```

### Worked Example

```
PREDICTION: The opponent's press will most likely trigger on our next back-pass to the goalkeeper.

CONFIDENCE: Medium-high.

UNCERTAINTY: This is based on the opponent's press-trigger pattern observed in this match's
             first 20 minutes (a small in-match sample, Class D) combined with their season-long
             tendency toward back-pass-triggered pressing (Class D, larger sample but a different
             match context). A change in opponent game state (e.g., they go a goal down) could
             alter their pressing risk tolerance mid-match (core KB §24).

ALTERNATIVE: If the press does not trigger, the more likely explanation is fatigue-driven pressing
             pacing (core KB §46.2's fatigue/pacing note) rather than a genuine change in pressing
             identity — this would be re-evaluated after the next 2-3 similar situations, not
             assumed permanent from a single non-event.

REASON: Pattern observed 4 of 5 times this match (Class D, small sample) + consistent with
        pre-match opposition analysis (Class D/C, Part BN) → medium-high rather than high,
        specifically because in-match sample size is still small.
```

**Confidence-band definitions (Class C — coaching/analytical heuristic, not a fixed statistical standard):**

| Band | Rough Meaning |
|---|---|
| Low | Based on a single observation, a small sample, or conflicting evidence |
| Medium | Based on a consistent pattern across a moderate sample, with some plausible alternative explanations remaining |
| Medium-high | Based on a consistent pattern across a good sample, corroborated by pre-existing scouting/season-long data |
| High | Based on a strong, repeated, multiply-corroborated pattern with no significant conflicting evidence — reserved for genuinely well-supported cases, not the default output |

---
*Continue to `03_DECISION_ENGINE_ARCHITECTURE.md`.*
