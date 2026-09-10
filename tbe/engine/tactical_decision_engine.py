"""
tactical_decision_engine.py
----------------------------
An illustrative, runnable skeleton of the pipeline described in
03_DECISION_ENGINE_ARCHITECTURE.md (Part CN — Final Master Architecture).

This operates on small, hand-built toy input (a handful of players and one
possession moment) so that every pipeline stage is a real, executable function
you can inspect, test, and extend with real tracking-data ingestion -- it is
NOT a claim that the heuristic scoring inside it is empirically validated
(see 02_EXPLAINABLE_AI_AND_UNCERTAINTY.md Part CM: this entire module is
Source Class F, "model assumption").

Run directly for a worked example:
    python tactical_decision_engine.py
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple
import math


# ---------------------------------------------------------------------------
# 1. Data structures (mirrors data_model/*.csv at a conceptual level)
# ---------------------------------------------------------------------------

@dataclass
class Player:
    player_id: str
    team_id: str
    role: str
    x: float
    y: float
    speed_mps: float = 3.0
    attributes: Dict[str, float] = field(default_factory=dict)  # 0-1 scale


@dataclass
class MatchMoment:
    ball_x: float
    ball_y: float
    possession_team_id: str
    players: List[Player]
    phase: str = "attacking_organisation"
    score_state: str = "0-0"


PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0


# ---------------------------------------------------------------------------
# 2. Space / pressure / pitch-control models (01_CONCEPTUAL_MODELS.md)
# ---------------------------------------------------------------------------

def distance(x1, y1, x2, y2) -> float:
    return math.hypot(x2 - x1, y2 - y1)


def goal_proximity_score(x, y, attacking_direction_x=PITCH_LENGTH) -> float:
    """Class F heuristic: closer to the opponent goal -> higher score, 0-1."""
    d = distance(x, y, attacking_direction_x, PITCH_WIDTH / 2)
    max_d = distance(0, 0, PITCH_LENGTH, PITCH_WIDTH / 2)
    return max(0.0, 1.0 - d / max_d)


def defender_density_inv(x, y, opponents: List[Player], radius=10.0) -> float:
    nearby = [p for p in opponents if distance(p.x, p.y, x, y) <= radius]
    return 1.0 / (1.0 + len(nearby))


def space_value(x, y, moment: MatchMoment) -> float:
    """PART BX SPACE_VALUE — INITIAL HEURISTIC WEIGHTS, see 01_CONCEPTUAL_MODELS.md."""
    opponents = [p for p in moment.players if p.team_id != moment.possession_team_id]
    teammates_here = [p for p in moment.players
                       if p.team_id == moment.possession_team_id and distance(p.x, p.y, x, y) < 3]
    goal_prox = goal_proximity_score(x, y)
    def_density_inv = defender_density_inv(x, y, opponents)
    att_density_inv = 1.0 / (1.0 + len(teammates_here))
    # passing_access, pressure_inv, player_fit are placeholders in this toy model
    passing_access = 0.6
    pressure_inv = 0.6
    player_fit = 0.5
    return (0.30 * goal_prox + 0.25 * def_density_inv + 0.10 * att_density_inv
            + 0.20 * passing_access + 0.10 * pressure_inv + 0.05 * player_fit)


def pressure_on_player(player: Player, moment: MatchMoment) -> float:
    """PART BY PRESSURE_MODEL — Class F, simplified toy version."""
    opponents = [p for p in moment.players if p.team_id != player.team_id]
    if not opponents:
        return 0.0
    nearest = min(opponents, key=lambda p: distance(p.x, p.y, player.x, player.y))
    d = distance(nearest.x, nearest.y, player.x, player.y)
    raw_pressure = max(0.0, 1.0 - d / 15.0)  # closer than 15m starts registering pressure
    nearby_defenders = len([p for p in opponents if distance(p.x, p.y, player.x, player.y) <= 8])
    compounding = 1.0 + 0.3 * max(0, nearby_defenders - 1)
    return min(1.0, raw_pressure * compounding)


def pitch_control_at(x, y, moment: MatchMoment) -> Dict[str, float]:
    """PART BZ — simplified time-to-reach based pitch control, Class F."""
    def team_min_time(team_id):
        team_players = [p for p in moment.players if p.team_id == team_id]
        if not team_players:
            return float("inf")
        times = []
        for p in team_players:
            d = distance(p.x, p.y, x, y)
            speed = max(p.speed_mps, 0.5)
            times.append(d / speed)
        return min(times)

    teams = set(p.team_id for p in moment.players)
    if len(teams) < 2:
        return {"contested": 0.0, "free": 1.0}
    t_a, t_b = list(teams)[:2]
    time_a, time_b = team_min_time(t_a), team_min_time(t_b)
    diff = time_b - time_a
    control_a = 1.0 / (1.0 + math.exp(-diff))  # sigmoid: A controls if A is faster (time_a smaller)
    return {t_a: round(control_a, 3), t_b: round(1 - control_a, 3)}


# ---------------------------------------------------------------------------
# 3. Team shape detection (PART AW)
# ---------------------------------------------------------------------------

def detect_team_shape(team_id: str, moment: MatchMoment) -> Dict:
    team_players = [p for p in moment.players if p.team_id == team_id]
    if not team_players:
        return {}
    xs = [p.x for p in team_players]
    ys = [p.y for p in team_players]
    centroid = (sum(xs) / len(xs), sum(ys) / len(ys))
    width = max(ys) - min(ys)
    length = max(xs) - min(xs)
    return {
        "team_id": team_id,
        "centroid": centroid,
        "width_m": round(width, 1),
        "length_m": round(length, 1),
        "compactness_m": round(length, 1),  # simplified proxy
        "player_count": len(team_players),
    }


# ---------------------------------------------------------------------------
# 4. Action generation & Tactical Action Value (PART BV / BW)
# ---------------------------------------------------------------------------

ACTIONS = ["pass", "dribble", "carry", "shoot", "cross", "cutback", "switch", "recycle", "through_ball", "long_ball"]


def evaluate_action(action: str, carrier: Player, moment: MatchMoment) -> Dict:
    """Scores one candidate action using the PART BW TACTICAL_ACTION_VALUE formula.
    All sub-scores are simplified, illustrative heuristics (Class F)."""
    current_sv = space_value(carrier.x, carrier.y, moment)

    # crude destination estimate per action type, for illustration only
    if action in ("pass", "through_ball", "switch"):
        dest_x, dest_y = min(carrier.x + 15, PITCH_LENGTH), PITCH_WIDTH - carrier.y if action == "switch" else carrier.y
    elif action in ("dribble", "carry"):
        dest_x, dest_y = min(carrier.x + 5, PITCH_LENGTH), carrier.y
    elif action == "shoot":
        dest_x, dest_y = PITCH_LENGTH, PITCH_WIDTH / 2
    elif action in ("cross", "cutback"):
        dest_x, dest_y = PITCH_LENGTH - 5, PITCH_WIDTH / 2
    elif action == "long_ball":
        dest_x, dest_y = min(carrier.x + 30, PITCH_LENGTH), carrier.y
    else:  # recycle
        dest_x, dest_y = max(carrier.x - 10, 0), carrier.y

    dest_sv = space_value(dest_x, dest_y, moment)
    progression = max(0.0, (dest_x - carrier.x) / PITCH_LENGTH)
    space_gained = max(0.0, dest_sv - current_sv)
    chance_creation = 1.0 if action in ("shoot",) else (0.6 if action in ("cross", "cutback", "through_ball") else 0.2)
    possession_retention = {
        "recycle": 0.95, "pass": 0.85, "dribble": 0.7, "carry": 0.8, "cutback": 0.65,
        "cross": 0.5, "switch": 0.6, "through_ball": 0.55, "long_ball": 0.45, "shoot": 0.3,
    }.get(action, 0.6)
    risk = 1.0 - possession_retention
    transition_danger = 0.3 if action in ("long_ball", "cross", "shoot") else 0.15

    value = (0.25 * progression + 0.20 * space_gained + 0.20 * chance_creation
             + 0.15 * possession_retention - 0.15 * risk - 0.05 * transition_danger)

    return {
        "action": action,
        "tactical_action_value": round(value, 3),
        "progression": round(progression, 3),
        "space_gained": round(space_gained, 3),
        "chance_creation": chance_creation,
        "possession_retention": possession_retention,
        "risk": round(risk, 3),
        "transition_danger": transition_danger,
    }


def rank_actions(carrier: Player, moment: MatchMoment) -> List[Dict]:
    scored = [evaluate_action(a, carrier, moment) for a in ACTIONS]
    return sorted(scored, key=lambda d: d["tactical_action_value"], reverse=True)


# ---------------------------------------------------------------------------
# 5. Explainable recommendation (02_EXPLAINABLE_AI_AND_UNCERTAINTY.md)
# ---------------------------------------------------------------------------

def confidence_band(top_value: float, second_value: float) -> str:
    gap = top_value - second_value
    if gap > 0.15:
        return "high"
    elif gap > 0.08:
        return "medium-high"
    elif gap > 0.03:
        return "medium"
    return "low"


def explain_recommendation(carrier: Player, moment: MatchMoment) -> Dict:
    ranked = rank_actions(carrier, moment)
    best, second = ranked[0], ranked[1]
    conf = confidence_band(best["tactical_action_value"], second["tactical_action_value"])
    return {
        "recommendation": best["action"],
        "why": [
            f"tactical_action_value={best['tactical_action_value']} (Class F, initial heuristic weights)",
            f"progression={best['progression']}, space_gained={best['space_gained']}, "
            f"chance_creation={best['chance_creation']}",
            f"possession_retention={best['possession_retention']}, risk={best['risk']}",
        ],
        "mechanism": "03_DECISION_ENGINE_ARCHITECTURE.md Part BV/BW — Action Generator + Tactical Action Value",
        "confidence": conf,
        "alternative": {
            "action": second["action"],
            "tactical_action_value": second["tactical_action_value"],
        },
        "source_class": "G",
    }


# ---------------------------------------------------------------------------
# 7. On-ball / off-ball assessment (core KB Sections 59-60) -- wired into the pipeline
# ---------------------------------------------------------------------------

def assess_on_ball_moment(carrier: Player, chosen_action: str, moment: MatchMoment) -> Dict:
    """Implements core KB Section 59's four-layer assessment model:
    pre-reception quality, technical execution, decision quality, outcome-adjusted value.
    All sub-scores here are simplified illustrative heuristics (Class F)."""
    ranked = rank_actions(carrier, moment)
    best = ranked[0]
    chosen = next((r for r in ranked if r["action"] == chosen_action), ranked[-1])

    # Layer 1: pre-reception quality -- toy proxy using pressure at reception as an inverse signal
    pressure_at_reception = pressure_on_player(carrier, moment)
    pre_reception_quality = round(max(0.0, 1.0 - pressure_at_reception), 3)

    # Layer 2: technical execution -- placeholder, would come from real event/tracking data
    technical_execution = carrier.attributes.get("technical_execution", 0.7)

    # Layer 3: decision quality -- how close the chosen action's value is to the best available
    if best["tactical_action_value"] != 0:
        decision_quality = round(chosen["tactical_action_value"] / max(best["tactical_action_value"], 1e-6), 3)
    else:
        decision_quality = 0.5
    decision_quality = max(0.0, min(1.0, decision_quality))

    # Layer 4: outcome-adjusted value -- placeholder until real outcome data is attached
    outcome_adjusted_value = chosen["tactical_action_value"]

    return {
        "player_id": carrier.player_id,
        "chosen_action": chosen_action,
        "pre_reception_quality": pre_reception_quality,
        "technical_execution": technical_execution,
        "decision_quality": decision_quality,
        "outcome_adjusted_value": round(outcome_adjusted_value, 3),
        "best_available_action": best["action"],
        "best_available_value": best["tactical_action_value"],
        "reference": "core KB Section 59",
    }


def assess_off_ball_value(player: Player, moment: MatchMoment) -> Dict:
    """Implements core KB Section 60's counterfactual-removal OFF_BALL_VALUE model:
    OFF_BALL_VALUE = TEAM_SPACE_VALUE(with_player) - TEAM_SPACE_VALUE(without_player).
    Approximated here via each teammate's own current-position space value as a simple proxy
    for the team-space-value delta a full implementation would compute more rigorously."""
    teammates = [p for p in moment.players if p.team_id == player.team_id and p.player_id != player.player_id]

    with_player_sv = sum(space_value(p.x, p.y, moment) for p in teammates + [player])

    # Approximate "without" by removing the player's own space-value contribution and
    # slightly reducing nearby teammates' scores (their passing_access/defender_density_inv
    # inputs would realistically worsen without this player nearby -- toy fixed decrement here).
    without_player_sv = sum(space_value(p.x, p.y, moment) for p in teammates)
    nearby_penalty = 0.05 * len([t for t in teammates if distance(t.x, t.y, player.x, player.y) < 15])
    without_player_sv -= nearby_penalty

    off_ball_value = round(with_player_sv - without_player_sv, 3)

    return {
        "player_id": player.player_id,
        "off_ball_value": off_ball_value,
        "with_player_team_space_value": round(with_player_sv, 3),
        "without_player_team_space_value": round(without_player_sv, 3),
        "reference": "core KB Section 60.2",
    }


def full_moment_assessment(moment: MatchMoment, carrier_id: str, chosen_action: str) -> Dict:
    """Runs both assessment layers for every player at once, tagging the ball
    carrier with the on-ball assessment and all others with off-ball assessment."""
    carrier = next(p for p in moment.players if p.player_id == carrier_id)
    on_ball = assess_on_ball_moment(carrier, chosen_action, moment)
    off_ball = [assess_off_ball_value(p, moment) for p in moment.players
                if p.team_id == carrier.team_id and p.player_id != carrier_id]
    return {"on_ball_assessment": on_ball, "off_ball_assessments": off_ball}


# ---------------------------------------------------------------------------
# 8. Worked example additions (run this file directly)
# ---------------------------------------------------------------------------

def run_assessment_demo():
    moment = build_toy_moment()
    print("\n=== FULL MOMENT ASSESSMENT (on-ball + off-ball, core KB Sections 59-60) ===")
    result = full_moment_assessment(moment, carrier_id="p_a1", chosen_action="pass")
    print("\n-- On-ball assessment --")
    for k, v in result["on_ball_assessment"].items():
        print(f"{k}: {v}")
    print("\n-- Off-ball assessments (teammates) --")
    for entry in result["off_ball_assessments"]:
        print(entry)



def build_toy_moment() -> MatchMoment:
    players = [
        Player("p_a1", "A", "mezzala", x=55, y=40, speed_mps=6.5, attributes={"composure": 0.8}),
        Player("p_a2", "A", "inverted_winger", x=80, y=55, speed_mps=7.2),
        Player("p_a3", "A", "target_man", x=95, y=34, speed_mps=5.0),
        Player("p_a4", "A", "cb", x=30, y=34, speed_mps=6.0),
        Player("p_b1", "B", "ball_winning_midfielder", x=58, y=38, speed_mps=6.8),
        Player("p_b2", "B", "full_back", x=82, y=50, speed_mps=6.9),
        Player("p_b3", "B", "cb", x=90, y=34, speed_mps=6.1),
    ]
    return MatchMoment(ball_x=55, ball_y=40, possession_team_id="A", players=players,
                        phase="attacking_organisation")


def run_pipeline_demo():
    moment = build_toy_moment()
    carrier = moment.players[0]  # p_a1, in possession

    print("=== TEAM SHAPE ===")
    print(detect_team_shape("A", moment))
    print(detect_team_shape("B", moment))

    print("\n=== PITCH CONTROL AT CARRIER LOCATION ===")
    print(pitch_control_at(carrier.x, carrier.y, moment))

    print("\n=== PRESSURE ON CARRIER ===")
    print(f"pressure = {round(pressure_on_player(carrier, moment), 3)}")

    print("\n=== RANKED ACTIONS ===")
    for r in rank_actions(carrier, moment):
        print(r)

    print("\n=== EXPLAINABLE RECOMMENDATION ===")
    rec = explain_recommendation(carrier, moment)
    for k, v in rec.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    run_pipeline_demo()
    run_assessment_demo()
