"""
stamina_model.py
-----------------
Implements core KB Section 76 -- Stamina-Controlled Movement Model.
Stamina is a real-time RATE CONTROLLER on top of a player's static attribute
profile (see player_attribute_generator.py), not a standalone stat. Current
fatigue level scales physical and mental/technical attributes independently,
and directly gates the movement mechanics defined across the knowledge base
(sprint speed, pressing distance, recovery-run speed, scanning frequency,
dribbling success rate).

Run directly for worked examples:
    python stamina_model.py
"""

from dataclasses import dataclass

# Fatigue -> multiplier bands (core KB Section 76.3)
FATIGUE_BANDS = [
    # (fatigue_upper_bound_pct, physical_multiplier, mental_technical_multiplier, label)
    (20, 1.00, 1.00, "fresh"),
    (40, 0.95, 0.98, "light_fatigue"),
    (60, 0.85, 0.93, "moderate_fatigue"),
    (80, 0.70, 0.85, "heavy_fatigue"),
    (100, 0.55, 0.75, "severe_fatigue"),
]

# Position-based fatigue accumulation rate modifiers (core KB Section 76.2,
# grounded in core KB Section 73.7's sourced high-intensity/sprint data:
# wingers highest HI/sprint output, centre-backs lowest)
POSITION_FATIGUE_RATE_MODIFIER = {
    "cb_stopper": 0.85,
    "cb_ball_playing": 0.85,
    "full_back": 1.05,
    "wing_back": 1.10,
    "central_midfielder": 1.10,
    "box_to_box": 1.15,
    "winger": 1.20,
    "inside_forward": 1.15,
    "target_man": 0.95,
    "poacher": 1.00,
    "goalkeeper": 0.30,
}

PHYSICAL_ATTRIBUTES = {"pace", "acceleration", "agility", "jumping", "balance", "strength"}
MENTAL_TECHNICAL_ATTRIBUTES = {"decision_making", "first_touch", "short_passing", "long_passing",
                                "vision", "composure", "dribbling", "ball_control"}


@dataclass
class FatigueState:
    player_id: str
    base_stamina_attribute: int  # 0-99, higher = slower fatigue accumulation
    position: str
    minute: int = 0
    current_fatigue_pct: float = 0.0
    half_time_recovery_applied: bool = False

    def band(self):
        for upper, phys_mult, mental_mult, label in FATIGUE_BANDS:
            if self.current_fatigue_pct <= upper:
                return upper, phys_mult, mental_mult, label
        return FATIGUE_BANDS[-1]

    def physical_multiplier(self) -> float:
        return self.band()[1]

    def mental_technical_multiplier(self) -> float:
        return self.band()[2]

    def fatigue_label(self) -> str:
        return self.band()[3]


def advance_minute(state: FatigueState, activity_intensity: float = 1.0) -> FatigueState:
    """Advances fatigue by one simulated minute.
    activity_intensity: 1.0 = average match intensity for this minute;
    >1.0 = high-intensity phase (sustained press/transition), <1.0 = low-tempo phase.
    Core KB Section 76.2's rate factors: base stamina, position modifier, match activity."""
    state.minute += 1

    # Half-time partial recovery (core KB Section 76.2)
    if state.minute == 46 and not state.half_time_recovery_applied:
        state.current_fatigue_pct = max(0.0, state.current_fatigue_pct - 15.0)
        state.half_time_recovery_applied = True

    stamina_factor = (100 - state.base_stamina_attribute) / 100.0  # lower stamina -> higher factor
    position_factor = POSITION_FATIGUE_RATE_MODIFIER.get(state.position, 1.0)

    # Base per-minute fatigue accrual, tuned so a stamina=99 CB barely fatigues
    # over 90 minutes and a stamina=50 winger fatigues heavily -- illustrative constants (Class F)
    base_rate_per_minute = 0.75
    increment = base_rate_per_minute * (0.4 + stamina_factor) * position_factor * activity_intensity

    state.current_fatigue_pct = min(100.0, state.current_fatigue_pct + increment)
    return state


def apply_fatigue_to_attributes(attributes: dict, state: FatigueState) -> dict:
    """Applies the current fatigue multipliers to a static attribute profile
    (e.g. from player_attribute_generator.py), producing the player's
    CURRENTLY AVAILABLE output for this exact moment of the match --
    core KB Section 76.1's central formula."""
    phys_mult = state.physical_multiplier()
    mental_mult = state.mental_technical_multiplier()

    live_attributes = {}
    for attr, value in attributes.items():
        if attr in PHYSICAL_ATTRIBUTES:
            live_attributes[attr] = round(value * phys_mult, 1)
        elif attr in MENTAL_TECHNICAL_ATTRIBUTES:
            live_attributes[attr] = round(value * mental_mult, 1)
        else:
            # Attributes outside both lists (e.g. tackling, heading) get a blended,
            # slightly gentler multiplier since they combine physical + technique
            live_attributes[attr] = round(value * ((phys_mult + mental_mult) / 2), 1)
    return live_attributes


def movement_speed_modifier(state: FatigueState) -> float:
    """Direct answer to 'control movements': returns the multiplier that should
    scale a player's effective sprint/closing/recovery speed right now
    (core KB Section 76.4)."""
    return state.physical_multiplier()


def scanning_frequency_modifier(state: FatigueState) -> float:
    """Core KB Section 76.4: scanning frequency is a discretionary cognitive
    behavior that degrades faster than raw reaction time under heavy fatigue."""
    label = state.fatigue_label()
    return {"fresh": 1.0, "light_fatigue": 0.95, "moderate_fatigue": 0.85,
            "heavy_fatigue": 0.70, "severe_fatigue": 0.55}[label]


def run_demo():
    print("=== STAMINA-CONTROLLED MOVEMENT: 90-MINUTE SIMULATION ===\n")
    players = [
        FatigueState(player_id="cb_1", base_stamina_attribute=82, position="cb_stopper"),
        FatigueState(player_id="winger_1", base_stamina_attribute=70, position="winger"),
        FatigueState(player_id="winger_2", base_stamina_attribute=92, position="winger"),
    ]

    checkpoints = [15, 45, 60, 75, 90]
    for state in players:
        print(f"-- {state.player_id} (stamina={state.base_stamina_attribute}, position={state.position}) --")
        for cp in checkpoints:
            intensity = 1.3 if state.position == "winger" else 1.0
            while state.minute < cp:
                advance_minute(state, activity_intensity=intensity)
            print(f"  min {cp:>2}: fatigue={state.current_fatigue_pct:5.1f}% "
                  f"({state.fatigue_label():<16}) speed_modifier={movement_speed_modifier(state):.2f} "
                  f"scan_modifier={scanning_frequency_modifier(state):.2f}")
        print()

    print("=== ATTRIBUTE PROFILE UNDER FATIGUE (winger_1 at minute 90) ===\n")
    tired_winger = players[1]
    sample_attributes = {"pace": 94, "acceleration": 97, "dribbling": 83,
                          "decision_making": 82, "crossing": 76}
    print("Base attributes:      ", sample_attributes)
    print("Live (fatigued) output:", apply_fatigue_to_attributes(sample_attributes, tired_winger))


if __name__ == "__main__":
    run_demo()
