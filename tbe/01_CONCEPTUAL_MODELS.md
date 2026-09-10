# 01 — CONCEPTUAL MODELS, PRINCIPLES & GLOSSARY EXTENSION

**Classification reminder:** every model in this file is Class **F (model assumption)** or **E (derived metric)** per the source classification in `02_EXPLAINABLE_AI_AND_UNCERTAINTY.md` — none of it is a football law (A) or an empirically validated formula. Weights shown are **INITIAL HEURISTIC WEIGHTS**, meant to be tuned against real match outcome data (Section 37 of the core KB), not treated as fixed truths.

---

## PART 4 (extension) — DEFENDING PRINCIPLES OF PLAY

The core KB's Section 17 covers attacking principles in depth. This table completes the pairing with defending principles, in the same PRINCIPLE → PURPOSE → PLAYER BEHAVIOUR → TEAM BEHAVIOUR → OPPONENT RESPONSE → RISK → COUNTER format.

| Principle | Purpose | Player Behaviour | Team Behaviour | Opponent Response | Risk | Counter |
|---|---|---|---|---|---|---|
| Delay | Slow the attack to allow recovery/organisation | Jockey rather than commit to a tackle | Whole shape drops/resets while delay buys time | Attacker probes for a mistimed lunge | Delaying too passively cedes territory without ever regaining the ball | Attacker uses a skill move (Section 48.3) to exploit an overly passive delay |
| Compactness | Reduce exploitable space between and across lines | Hold assigned distance to nearest teammates | Lines shift as a unit, vertically and horizontally | Attacker looks to stretch the block wide/deep before attacking centrally | Extreme compactness cedes the flanks entirely | Sustained wide overloads (Section 7.1) against an over-compact central block |
| Cover | Provide a second line of defence behind the first defender | Position at an angle, not directly behind, the engaged defender | At least one covering player behind every engaged duel | Attacker looks to draw both the presser and cover out simultaneously | Cover too central leaves both flanks thin | Combination play that drags the cover defender out of position first |
| Balance | Maintain defenders on the weak side even while committing numbers to the ball side | Weak-side players hold central/half-space positions rather than fully shifting | Team never commits 100% of its shape to one side | Attacker switches play to exploit an unbalanced shift | Over-committing to balance can under-support the actual ball-side duel | Overload-to-isolate (Section 7.1) specifically targets teams that balance too rigidly |
| Pressure | Force a rushed or lower-quality decision from the ball-carrier | Close down at an angle that removes the most dangerous option | Coordinated pressing trigger, not an individual decision (Section 11-12) | Ball-carrier looks for the third-man release before pressure arrives | Uncoordinated individual pressure opens gaps elsewhere | A team with quick, secure combination play bypasses uncoordinated pressure |
| Control | Dictate where the attack is allowed to progress, rather than reacting to it | Show the attacker down a specific, less dangerous channel | Collective shape funnels play toward a chosen zone (e.g. the touchline, Section 42) | Attacker resists being shown and looks to cut back against the grain | If the "controlled" channel isn't actually well covered, control becomes a trap for the defence, not the attacker | A technically composed attacker beats the show with a body feint (Section 48.3) |
| Restraint | Avoid unnecessary risk/overcommitment, especially in a favourable game state | Decline a 50/50 duel if losing it creates a bigger problem than winning it solves | Team accepts territorial concession to protect defensive integrity | Attacker is given time/space but not necessarily quality chances | Excessive restraint can concede total control of the match | A patient possession team eventually finds cracks in a purely restrained defence |
| Marking | Deny time/space to a specific individual (man-oriented) or zone (zonal) | Track an assigned player or hold an assigned zone (Section 53.2's logic applies broadly) | Consistent marking scheme applied across phases | Attacker uses rotation/blocking to disrupt the assigned marking | Man-marking is vulnerable to rotation; zonal marking is vulnerable to overloads within a zone | Match the marking scheme's specific weakness (Section 21) |
| Screening | Deny a passing lane without committing to a tackle | Position body between the ball and the passing option, not between the ball and the passer | Coordinated with the presser's cover-shadow angle (Section 11) | Ball-carrier looks for the remaining, unscreened option | Screening one lane still leaves others open if not part of a coordinated scheme | Overload the defender's screening responsibility with 3+ simultaneous options |
| Protection (of central zone / of depth) | Prioritize denying the highest-value zones (central, in-behind) over lower-value ones (wide, in front) | Bias positioning toward the centre and toward covering in-behind runs first | Defensive block explicitly prioritizes central/behind-the-line danger over wide areas | Attacker is funnelled toward lower-value wide zones by design | Over-prioritizing the centre can under-protect a wide overload if the opponent is genuinely elite in wide areas | A team with elite wide 1v1 quality specifically targets a central-protection-biased defence |
| Directional control | Force the attack into a predictable, prepared direction rather than allowing free choice | Use body shape and press angle to remove all but one option | Team has pre-planned traps (Section 53.2/Section 11's "trigger press") waiting in the direction play is funnelled toward | Ball-carrier who recognizes the funnel may deliberately avoid the "obvious" channel | If the trap isn't actually set up correctly, directional control simply hands the opponent a predictable but *open* route | A team that scouts the funnel in advance (Section 63 below) plays around it deliberately |

---

## PART BX — SPACE VALUE MODEL

`SPACE_VALUE(zone)` — a conceptual score (Class F) estimating how valuable a given zone is to occupy at a given moment.

**Heuristic components (each 0-1, combined as a weighted sum — INITIAL HEURISTIC WEIGHTS, not validated coefficients):**

| Component | Logic | Initial Weight |
|---|---|---|
| Goal proximity | Distance from the zone's centroid to the opponent's goal, inverted and normalized | 0.30 |
| Defender density | Number of opposition defenders within a fixed radius of the zone, inverted (fewer defenders = higher value) | 0.25 |
| Attacker density | Number of teammates already occupying the zone, inverted (avoids double-counting an already-occupied zone) | 0.10 |
| Passing access | Number of currently-open passing lanes into the zone from the current ball location | 0.20 |
| Pressure on a receiver | Estimated closing time of the nearest defender if a teammate received in this zone, inverted | 0.10 |
| Player quality fit | Whether the type of space (wide/central/in-behind) matches the attribute profile of the player likely to occupy it (Section 22 of the core KB) | 0.05 |

```
SPACE_VALUE = 0.30*goal_proximity + 0.25*defender_density_inv + 0.10*attacker_density_inv
            + 0.20*passing_access + 0.10*pressure_inv + 0.05*player_fit
```

**Usage note:** this score is directly analogous to, but simpler than, Expected Threat (xT, see below) — SPACE_VALUE estimates the value of an *empty zone*, while xT estimates the value of the *ball actually arriving there*.

---

## PART BY — PRESSURE MODEL

`PRESSURE(player_with_ball)` — a conceptual, contextual estimate (Class F) of how much pressure a ball-carrier is currently under.

| Factor | Logic |
|---|---|
| Distance to nearest defender | Primary driver — inverse relationship, closer defender = higher pressure |
| Closing speed | A defender rapidly closing distance creates more pressure than one holding a static distance, even if momentarily further away |
| Closing angle | A defender approaching from the ball-carrier's blind side or cutting off the preferred escape direction creates more effective pressure than a direct frontal approach the carrier can see and react to |
| Number of defenders within pressing range | More than one nearby defender compounds pressure non-linearly — a 2-defender press is not simply "2x" a 1-defender press, since it removes escape angles entirely |
| Support available to the carrier | Number of open, unpressured passing options — high support meaningfully reduces *effective* pressure even if the raw defender distance is unchanged |
| Passing lanes still open | Directly reduces effective pressure regardless of proximity — a tightly marked but completely open passing lane still allows an easy escape |
| Body orientation of the carrier | A carrier already oriented toward an escape option experiences lower effective pressure than one who would need to reorient first (ties directly to Section 47.2 of the core KB) |

```
EFFECTIVE_PRESSURE = f(distance, closing_speed, closing_angle, defender_count)
                     reduced_by(support_available, open_lanes, favorable_body_orientation)
```

**Explicit non-claim:** no specific numeric formula for this combination is presented as scientifically validated; this is a conceptual structure for a Tactical Battle Engine to implement and calibrate, per Part BY's instruction.

---

## PART BZ — PITCH CONTROL (CONCEPTUAL)

`PITCH_CONTROL(x, y)` — for any point on the pitch, a conceptual estimate of which team could reach and control the ball there first if it were played to that point right now.

**Assumptions this model makes explicit (Class F):**
1. Control is estimated primarily from each player's time-to-reach the point, derived from their current position, speed, and assumed maximum acceleration/velocity — not from a literal physics simulation of a real match.
2. Team A control and Team B control at a given point are not necessarily complementary to exactly 100% — a "contested" classification is used when both teams could plausibly reach the point within a similar time window, and "free" (uncontrolled) space is possible if neither team is within realistic reach.
3. Goalkeepers are typically excluded from outfield pitch-control calculations except within/near their own penalty area.
4. This model does not account for ball physics (pass speed, curve, bounce) unless a specific pass/shot is being separately evaluated — it estimates space control independent of any specific ball movement.

| Output Category | Meaning |
|---|---|
| Team A control | Estimated probability Team A reaches/controls this point first |
| Team B control | Estimated probability Team B reaches/controls this point first |
| Contested | Neither team has a clear time-to-reach advantage |
| Free | Neither team can realistically reach the point in a relevant timeframe (e.g., deep in a team's own unthreatened defensive corner) |

**Relationship to other models:** Pitch control is the spatial substrate SPACE_VALUE and PRESSURE are evaluated against — a high-SPACE_VALUE zone that is also under strong opponent pitch control is a *contested* high-value zone (worth attacking but high-risk), while a high-SPACE_VALUE zone under strong own-team control is a *safe* progression target.

---

## PART CA-CB — DANGEROUSITY (THREAT) & EXPECTED THREAT (xT), CONCEPTUAL

**Explicit distinction from real xT:** the real-world xT metric referenced descriptively in the core KB's Section 39 is a published, data-derived model (Karun Singh's expected threat framework and its descendants) fitted on large volumes of real event data. What follows is a *conceptual structure* for how a Tactical Battle Engine could construct its own internal version — it is Class F (model assumption), not a restatement of the published model's actual fitted values.

**Conceptual xT construction:**
1. Divide the pitch into the 30-zone grid (core KB Section 1.5).
2. For each zone, estimate a base **shot probability** (likelihood the current possession, if it stayed in this zone, ends in a shot) and a **shot-success value** (likelihood a shot from this zone becomes a goal, i.e., zone-average xG).
3. Estimate, for each zone, a **transition matrix** of probabilities that a successful pass/carry from this zone lands in each other zone.
4. Recursively estimate each zone's value as: `zone_value = shot_prob * shot_success_value + sum(move_prob(zone→other) * zone_value(other))` for all other zones, iterated until the values converge.
5. `xT` of a specific action = `zone_value(destination) - zone_value(origin)`.

**DANGEROUSITY (single-moment threat, distinct from xT's possession-value framing):**

```
DANGEROUSITY = f(zone_value, pitch_control_at_zone, pressure_on_next_receiver, attacker_density_in_zone)
```

Used to answer "how threatening is the position *right now*" rather than xT's "how much value would moving the ball here add."

---

## PART CC-CD — MATCH DOMINANCE & FIELD TILT

**TACTICAL_DOMINANCE (Class F, explicitly multi-dimensional):**

Possession percentage alone is an unreliable dominance proxy (a team can hold 65% possession entirely in low-value zones against a well-organized low block while creating little threat). A more complete dominance construct combines:

| Dimension | What It Captures |
|---|---|
| Field tilt | Share of attacking-third possession relative to total final-third possession (both teams combined) |
| xT accumulation rate | How much threat value is being generated per unit time, not just how much of the ball is held |
| Territorial pitch control | Average pitch-control share across the middle and attacking thirds, not just raw possession |
| Duel win rate | Share of physical contests won, a proxy for match tempo control independent of ball possession |
| Shot/big-chance differential | The actual output dominance should eventually translate to |

**FIELD_TILT — explicit limitations:**
- Field tilt measures *territorial* dominance, not quality of chances created within that territory — a team can tilt the field heavily while still generating only low-value, blocked, or hopeful crosses.
- It is biased toward possession-heavy teams by construction (more time in the attacking third naturally follows from more overall possession), so it should be read alongside a possession-adjusted or per-possession metric, not as a standalone dominance score.
- It says nothing about defensive solidity — a team can tilt the field heavily in one direction and still be vulnerable to a fast counter-attack through the space its own commitment leaves open (directly related to Section 16's rest-defence logic in the core KB).

---

## PART CE-CF — TACTICAL SIGNATURES

**TEAM_TACTICAL_SIGNATURE** — a structured profile (Class E/F) summarizing a team's observed tactical identity across a sample of matches:

```json
{
  "formation_primary": "4-3-3",
  "formation_secondary": ["4-2-3-1", "3-4-3"],
  "buildup_style": "possession_through_press",
  "progression_preference": {"central": 0.35, "half_space": 0.40, "wide": 0.25},
  "press_height_avg_ppda": 8.4,
  "defensive_block_default": "mid_block",
  "width_avg_m": 62,
  "tempo_passes_per_possession": 6.2,
  "risk_tolerance": "medium_high",
  "movement_signature": ["inverted_fullbacks", "false_nine_rotation"],
  "rest_defence_shape": "3+2"
}
```

**PLAYER_TACTICAL_SIGNATURE** — same principle at the individual level:

```json
{
  "player_role_primary": "mezzala",
  "movement_tendency": {"half_space_entries_p90": 8.1, "box_arrivals_p90": 2.4},
  "passing_profile": {"progressive_pass_share": 0.28, "risk_pass_share": 0.15},
  "pressing_profile": {"pressures_p90": 14.2, "pressure_regain_pct": 0.31},
  "defending_profile": {"tackle_success_pct": 0.62, "duels_won_pct": 0.55},
  "dribbling_profile": {"take_ons_p90": 2.8, "take_on_success_pct": 0.58},
  "decision_signature": {"scan_frequency_relative": "above_average", "first_touch_direction_quality": "high"},
  "role_flexibility": ["mezzala", "box_to_box", "carrilero"]
}
```

**TEAM_FLEXIBILITY / PLAYER_FLEXIBILITY (Part CG):** measured as the number of distinct formations/roles/pressing structures a team or player can execute at a defined competence threshold without a measurable drop in the underlying signature metrics above — a team that can only maintain its passing/pressing profile in exactly one formation has low flexibility even if that one formation is executed extremely well.

---

## PART BM — COACHING ADJUSTMENTS (Worked Examples)

Format: OBSERVATION → PROBLEM → CAUSE → ADJUSTMENT → PLAYER INSTRUCTION → FORMATION CHANGE → EXPECTED EFFECT

| # | Observation | Problem | Cause | Adjustment | Player Instruction | Formation Change | Expected Effect |
|---|---|---|---|---|---|---|---|
| 1 | Opponent's double pivot is completely unpressed and dictating tempo | Team cannot regain the ball in midfield | Front three press CBs only, leaving the pivot free (numbers mismatch, Section 12) | Push the #10/nearest 8 to press the pivot directly | "Press the deepest central midfielder, not the CB" | 4-2-3-1 → temporary 4-4-2 press shape | Forces the pivot into rushed passes or bypasses, regains territorial control |
| 2 | Full-back is repeatedly isolated 2v1 on the wing | Conceding cheap wide chances | Winger not tracking back to double up (Section 42/PR014) | Instruct the winger to prioritize recovery tracking over holding advanced position | "Track back to form a 2v1 in our favor" | None — instruction only | Neutralizes the specific wide overload without sacrificing formation shape |
| 3 | Team is dominating possession but creating no chances against a low block | Overly horizontal, non-penetrative possession | No movement in behind to stretch the low block vertically (Section 14) | Introduce a higher line of engagement for the striker's runs, encourage direct dribbles at the last line | "Attack the space in behind on the first sign of a gap, don't always look for the killer pass" | None, or 4-2-3-1 → 4-2-4 temporarily | Forces the low block to defend deeper/more honestly, opening cutback zones |
| 4 | Conceding from repeated central overloads in the half-spaces | Central midfield numerically outnumbered | Formation mismatch — 2-man central mid vs opponent's 3 | Switch to a 3-man central midfield | "Both 8s tuck in to match their extra central body" | 4-4-2 → 4-3-3 or 4-2-3-1 | Restores central numerical parity, reduces half-space overloads conceded |
| 5 | Losing the ball immediately after regaining it in transition | Rushed, low-quality decisions the instant possession is won | No clear "secure vs fast break" rule (Section 26 TP030) | Establish a explicit rule: counter only if a clear passing/dribbling lane exists within 2 seconds, otherwise reset | "If there's no clean forward option immediately, keep it simple and recycle" | None | Reduces turnovers in dangerous transition moments, at the cost of some counter-attacking speed |
| 6 | Team is being bypassed by direct long balls over a high press | High line + committed press leaves space in behind | Press committed without an offside trap/cover discipline (Section 2's offside logic) | Either drop the defensive line slightly or add a covering sweeper role behind the line | "Hold the offside line together, don't step individually" | None, or introduce a temporary sweeper-CB instruction | Reduces the frequency/quality of successful long balls in behind |
| 7 | Losing individual defensive duels wide against a technical dribbler | A specific 1v1 mismatch is being exploited repeatedly | The marking full-back's profile doesn't match the winger's skill set (Section 21 counter matrix logic) | Double up on that specific flank rather than defending 1v1 | "Winger, help the full-back double-team their best dribbler" | Temporary shift to a back five on that side | Removes the individual mismatch at the cost of thinner coverage elsewhere |

*(This pattern — OBSERVATION → PROBLEM → CAUSE → ADJUSTMENT → INSTRUCTION → FORMATION CHANGE → EFFECT — is a stable schema; further entries can be generated for any specific in-match problem using the same structure. See `rule_generator.py` for programmatic expansion tied to specific zone/role combinations.)*

---

## PART BN — OPPOSITION ANALYSIS FRAMEWORK

A scouting template a Tactical Battle Engine should populate per opponent, before recommending a gameplan:

```json
{
  "opponent_id": "string",
  "buildup": {"preferred_structure": "GK+2CB", "primary_outlet": "inverted_fullback", "weak_link": "left_CB_under_pressure"},
  "progression": {"primary_channel": "half_space", "carrier": "regista", "bypass_method": "direct_diagonal_to_striker"},
  "final_third": {"primary_pattern": "overlap_cross", "primary_threat_player": "id_string", "secondary_pattern": "cutback"},
  "press": {"trigger": "back_pass", "height": "mid_block", "intensity_ppda": 10.2, "weakness": "central_mids_narrow_leaves_half_space"},
  "defensive_block": {"shape": "4-4-2_low", "compactness": "high", "weakness": "full_backs_slow_to_recover"},
  "transition": {"offensive_speed": "high", "key_outlet": "winger_id", "defensive_transition_weakness": "advanced_fullbacks_caught_upfield"},
  "set_pieces": {"corner_scheme": "zonal_near_post_man_far", "key_aerial_threat": "id_string", "weakness": "short_corner_routine_underprepared"},
  "key_players": ["id_1", "id_2"],
  "exploitable_space": ["left_half_space_behind_advanced_fullback", "zone_between_pivot_and_back_four"],
  "tactical_traps_to_set": ["bait_the_press_centrally_then_switch", "isolate_their_weaker_fullback_2v1"]
}
```

This schema is deliberately identical in spirit to `TEAM_TACTICAL_SIGNATURE` (Part CE) — opposition analysis is simply the same signature schema populated for an upcoming opponent specifically, with an added `exploitable_space` / `tactical_traps_to_set` layer derived by cross-referencing the opponent's signature against the core KB's Section 21 Tactical Counter Matrix and Section 30 Formation Counter Database.

---

## GLOSSARY EXTENSION (New Terms Beyond Core KB §38)

Format: TERM | DEFINITION | TACTICAL PURPOSE | EXAMPLE | RELATED TERMS | COUNTER-CONCEPT

| Term | Definition | Tactical Purpose | Example | Related Terms | Counter-Concept |
|---|---|---|---|---|---|
| Line of confrontation | The vertical height on the pitch where the pressing team first meaningfully engages the opponent | Defines press height/intensity independent of the resting defensive line | A team with a line of confrontation at the halfway line is pressing from a mid-block trigger point | Line of engagement, pressing height | Line of restraint (see below) |
| Line of engagement | Near-synonym for line of confrontation, sometimes used specifically for the first committed press action | Same as above | — | Line of confrontation | Line of restraint |
| Line of restraint | The defensive line's height, kept deliberately deeper than the line of confrontation to protect space in behind while still pressing higher up | Balances an aggressive press with protection against being played over the top | A team presses from the halfway line (confrontation) but keeps its back line at the edge of its own box (restraint) | Defensive line height, rest defence | Ultra-high line (confrontation and restraint at the same height) |
| Free player | An attacker with no direct marker, created via overload, rotation, or a defensive marking error | The direct objective of most positional-play rotations (Section 7.1) | A false nine drops and is not followed, becoming the free player between the lines | Free-player creation, third-man | Man-marking discipline (denies free players by design) |
| Directional pressing | Pressing specifically designed to force the ball in one pre-chosen direction (usually the touchline) rather than simply pressuring the ball | The foundation of the sideline trap (core KB §Section 42/53) | Curved pressing run showing a CB only toward the touchline | Cover shadow, sideline trap | Central-denial pressing (forces play centrally into a trap instead) |
| Second ball | The loose ball resulting from an aerial duel, blocked shot, or knockdown that neither team has secured | A statistically significant, often under-coached source of possession regains/losses | A long ball is headed away by a CB; midfielders contest the resulting second ball | Aerial duel, knockdown, box occupation | Clean regain (no contested second ball occurs) |
| Rest defence | The defensive/covering structure a team maintains *while in possession*, specifically to protect against the moment possession is lost | Directly determines counter-attack vulnerability (core KB §16) | A 3+2 rest defence shape behind a committed attack | Counterpress, defensive transition | Total commitment (no rest defence retained) |
| Escape lane | A passing or dribbling route that remains open despite active pressure | The specific target of "press escape" methods (core KB) | A third-man pass through the one lane a curved press failed to close | Third-man, press escape, cover shadow | Full lane denial (no escape lane exists) |
| Handover (defensive) | Two defenders exchanging marking/covering responsibility as a runner crosses between their zones | Maintains coverage during rotations/underlaps without both defenders following the same player | A full-back hands off a tracking winger to the covering CB as the winger cuts infield | Zonal marking, cover, rotation | Miscommunicated handover (the specific failure mode this concept exists to prevent) |
| Pass runner (defensive instruction) | An instruction for a defender to follow/track a specific off-ball run rather than the ball | Prevents blind-side/decoy runs from going unmarked | A CB tracks a striker's run into the channel rather than watching the ball | Blind-side run, marking, zonal defending | Ball-watching (the failure this instruction exists to prevent) |
| Tempo manipulation | Deliberately varying the speed of play (slow circulation vs sudden acceleration) to unbalance the opponent's press/shape | A core deception tool distinct from spatial deception (core KB §41) | A team circulates slowly for 8 passes then plays a first-time vertical ball the instant the press relaxes | Baiting the press, deception | Constant tempo (removes the unpredictability this concept relies on) |
| Fixing (defenders) | Occupying a defender's attention through positioning alone, without necessarily moving, to prevent them covering elsewhere | Distinct from pinning (which specifically denies a defender the ability to step out); fixing is the broader category | A winger holding wide position "fixes" the opposing full-back to that flank | Pinning, occupying space | Defender ignoring the fix (only possible if the fixed defender is confident cover exists) |
| Pitch control | See `01_CONCEPTUAL_MODELS.md` Part BZ | Spatial-dominance modelling | — | Space value, dangerousity | Contested space (the explicit "neither team controls" state) |
| Counterfactual simulation | Modelling "what if" alternative actions/movements to evaluate a decision against the alternatives that weren't taken | Core to explainable tactical recommendations (Part CK) | "What if the winger had stayed wide instead of inverting?" evaluated against the actual chosen action | Explainable AI, tactical decision engine | Outcome-only evaluation (judges the actual result without considering alternatives) |
| Tactical memory | The retained record of what has and hasn't worked earlier in a specific match against a specific opponent | Enables in-match adaptation rather than static pre-match planning alone | A team notices its right-wing overload has failed 3 times and switches focus to the left | Adaptation, coaching adjustments | Static gameplan (no memory-informed adjustment) |

*(This extension adds genuinely new terms not already defined in core KB §38. Further glossary expansion is realistically bounded by how many genuinely distinct football concepts exist — most additional "terms" beyond this point become synonyms, regional-language variants, or role labels already covered in Sections 3/51 of the core KB. I'd rather flag that honestly than pad the glossary with duplicates.)*

---
*Continue to `02_EXPLAINABLE_AI_AND_UNCERTAINTY.md`.*
