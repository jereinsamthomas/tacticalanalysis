"""
player_attribute_generator.py
------------------------------
Implements core KB Section 75 -- the Elite-Skill Budget Model -- as real,
runnable code. Generates realistic player attribute profiles where each
player has only 2-3 "elite" attributes (88-99), rather than being uniformly
excellent across every attribute relevant to their role.

Can be used standalone, or imported to populate the `Player.attributes` dict
in tactical_decision_engine.py with realistic values instead of placeholders.

Run directly for worked examples:
    python player_attribute_generator.py
"""

import random
from dataclasses import dataclass, field
from typing import Dict, List


# ---------------------------------------------------------------------------
# 1. Attribute universe & clusters (core KB Section 74.2 / 22)
# ---------------------------------------------------------------------------

ALL_ATTRIBUTES = [
    "pace", "acceleration", "agility", "strength", "jumping", "balance", "stamina",
    "first_touch", "dribbling", "ball_control", "finishing", "heading", "crossing",
    "short_passing", "long_passing", "vision", "tackling", "interceptions",
    "positioning", "anticipation", "decision_making", "composure", "work_rate",
    "aggression", "off_ball_movement",
]

CLUSTERS = {
    "explosive_physical": ["pace", "acceleration", "agility"],
    "power_physical": ["strength", "jumping", "balance"],
    "technical_ball": ["first_touch", "dribbling", "ball_control"],
    "passing_vision": ["vision", "short_passing", "long_passing"],
    "finishing": ["finishing", "composure", "off_ball_movement"],
    "defensive_positional": ["positioning", "anticipation", "interceptions"],
    "defensive_physical": ["tackling", "strength", "aggression"],
    "mental_composure": ["decision_making", "composure", "work_rate"],
}

# Tier bands (core KB Section 75.1 / renumbered from the original draft's 74.1)
TIER_BANDS = {
    "elite": (88, 99),
    "very_good": (75, 87),
    "good_average": (55, 74),
    "weak": (35, 54),
}

ELITE_SLOT_COUNT_RANGE = (2, 3)  # the hard constraint requested: 2 or 3, never more

TIER_BUDGET_CAPS = {  # core KB Section 78.2: total attribute sum ceiling per tier
    "world_class": 1750,
    "very_good": 1550,
    "squad_player": 1350,
    "backup": 1150,
}

TIER_RATING_CEILINGS = {  # core KB Section 78.3
    "world_class": 94,
    "very_good": 87,
    "squad_player": 79,
    "backup": 69,
}

# Right-skewed elite-tier sampling weights (core KB Section 77.3): most elite
# rolls land in the low end of the elite band, very few near the 98-99 ceiling
ELITE_SKEW_BUCKETS = [
    ((88, 91), 0.55),
    ((92, 94), 0.30),
    ((95, 97), 0.12),
    ((98, 99), 0.03),
]

# Position-based elite-pool exclusions (core KB Section 75.3)
POSITION_ELITE_EXCLUSIONS = {
    "cb_stopper": ["dribbling", "agility"],
    "target_man": ["pace", "acceleration", "agility"],
    "goalkeeper": ["dribbling", "finishing", "crossing", "heading"],
    "poacher": ["long_passing", "vision"],
    "ball_winning_midfielder": ["vision", "long_passing"],
}

# Typical elite-cluster affinity per archetype (used to bias which cluster the
# 2-3 elite slots are drawn from -- core KB Section 74.2's clustering rule)
ARCHETYPE_CLUSTER_AFFINITY = {
    "poacher": ["finishing"],
    "regista": ["passing_vision"],
    "cb_stopper": ["defensive_physical", "defensive_positional"],
    "target_man": ["power_physical"],
    "winger": ["explosive_physical", "technical_ball"],
    "inside_forward": ["technical_ball", "finishing"],
    "ball_winning_midfielder": ["defensive_physical"],
    "deep_lying_playmaker": ["passing_vision", "mental_composure"],
    "false_nine": ["technical_ball", "passing_vision"],
    "goalkeeper": ["mental_composure", "defensive_positional"],
}


@dataclass
class PlayerAttributeProfile:
    archetype: str
    attributes: Dict[str, int] = field(default_factory=dict)
    elite_attributes: List[str] = field(default_factory=list)
    very_good_attributes: List[str] = field(default_factory=list)

    def summary(self) -> str:
        lines = [f"Archetype: {self.archetype}",
                 f"Elite (2-3 max): {', '.join(f'{a}={self.attributes[a]}' for a in self.elite_attributes)}",
                 f"Very good: {', '.join(f'{a}={self.attributes[a]}' for a in self.very_good_attributes)}"]
        return "\n".join(lines)


def _sample_in_band(rng: random.Random, band, skew: bool = False) -> int:
    """Core KB Section 77.3: within the elite tier specifically, sampling should
    be right-skewed (dense near the bottom of the band, sparse near the top)
    rather than flat -- a flat distribution still produces too many 97s/98s
    even with a hard ceiling of 99. Uses a triangular distribution biased
    toward the low end of the band when skew=True."""
    lo, hi = band
    if not skew:
        return rng.randint(lo, hi)
    # Triangular distribution: mode near the low third of the band, matching
    # Section 77.3's stated split (~55% in the bottom third, ~3% in the top ~2 points)
    mode = lo + (hi - lo) * 0.25
    value = rng.triangular(lo, hi, mode)
    return int(round(value))


def enforce_population_cap(profile: "PlayerAttributeProfile", rng: random.Random,
                            max_top3_sum: int = 280) -> "PlayerAttributeProfile":
    """Core KB Section 77.4: the combined top-3 attributes must not exceed a
    total budget (default 280, i.e. average ~93.3), preventing a player who is
    technically compliant with the 2-3-elite rule (Section 75) from still being
    unrealistically dominant by having every elite roll land near the scale's
    ceiling simultaneously. Rare overshoots (<2% of players) are permitted by
    the knowledge base's own rule -- modelled here as a small rng chance to skip
    the correction entirely."""
    if rng.random() < 0.02:
        return profile  # the explicitly allowed rare exception (Section 77.4)

    top3_keys = sorted(profile.attributes, key=lambda k: profile.attributes[k], reverse=True)[:3]
    top3_sum = sum(profile.attributes[k] for k in top3_keys)

    if top3_sum > max_top3_sum:
        overshoot = top3_sum - max_top3_sum
        # Trim proportionally from the top-3, floored at the elite band's own minimum (88)
        for k in top3_keys:
            if overshoot <= 0:
                break
            trim = min(overshoot, profile.attributes[k] - TIER_BANDS["elite"][0])
            trim = max(0, trim)
            profile.attributes[k] -= trim
            overshoot -= trim

    return profile


def generate_player_attributes(archetype: str, overall_quality: str = "world_class",
                                seed: int = None) -> PlayerAttributeProfile:
    """Generates a full attribute profile respecting the elite-skill budget
    (core KB Section 75.1: exactly 2-3 elite-tier attributes, never more),
    cluster consistency (75.2: elite slots biased toward 1-2 related clusters
    plus at most one outlier), and position-based exclusions (75.3).

    overall_quality in {"world_class", "very_good", "squad_player", "backup"}
    shifts how many attributes land in the very_good tier vs good/weak tiers,
    WITHOUT changing the hard 2-3 elite cap -- per Section 75.1's explicit
    rule that the elite budget does not scale with overall quality.
    """
    rng = random.Random(seed)

    excluded = set(POSITION_ELITE_EXCLUSIONS.get(archetype, []))
    affinity_clusters = ARCHETYPE_CLUSTER_AFFINITY.get(archetype, list(CLUSTERS.keys()))

    # --- Step 1: choose the elite slot count (hard constraint: 2 or 3) ---
    n_elite = rng.randint(*ELITE_SLOT_COUNT_RANGE)

    # --- Step 2: pick elite attributes biased toward 1-2 affinity clusters,
    #     with at most one outlier from a different cluster (Section 74.2 rule) ---
    primary_cluster_name = rng.choice(affinity_clusters)
    primary_pool = [a for a in CLUSTERS[primary_cluster_name] if a not in excluded]

    elite_attrs: List[str] = []
    # Fill as many elite slots as possible from the primary cluster first
    rng.shuffle(primary_pool)
    for attr in primary_pool:
        if len(elite_attrs) >= n_elite:
            break
        elite_attrs.append(attr)

    # If the primary cluster didn't have enough eligible attributes, pull from
    # a second affinity cluster (still "cluster consistent", not a random outlier)
    if len(elite_attrs) < n_elite and len(affinity_clusters) > 1:
        secondary_cluster_name = rng.choice([c for c in affinity_clusters if c != primary_cluster_name])
        secondary_pool = [a for a in CLUSTERS[secondary_cluster_name]
                           if a not in excluded and a not in elite_attrs]
        rng.shuffle(secondary_pool)
        for attr in secondary_pool:
            if len(elite_attrs) >= n_elite:
                break
            elite_attrs.append(attr)

    # If still short, allow exactly one true outlier from anywhere else (the
    # "surprising elite trait" case explicitly allowed by Section 74.2)
    if len(elite_attrs) < n_elite:
        remaining_pool = [a for a in ALL_ATTRIBUTES if a not in excluded and a not in elite_attrs]
        rng.shuffle(remaining_pool)
        for attr in remaining_pool:
            if len(elite_attrs) >= n_elite:
                break
            elite_attrs.append(attr)

    # --- Step 3: assign very-good tier (quality-dependent count) ---
    very_good_counts = {"world_class": 6, "very_good": 5, "squad_player": 3, "backup": 2}
    n_very_good = very_good_counts.get(overall_quality, 4)
    remaining = [a for a in ALL_ATTRIBUTES if a not in elite_attrs]
    rng.shuffle(remaining)
    very_good_attrs = remaining[:n_very_good]
    remaining = remaining[n_very_good:]

    # --- Step 4: assign good/average and weak tiers for everything else ---
    n_weak = rng.randint(1, 4)
    weak_attrs = []
    good_attrs = list(remaining)
    # Weak slots preferentially drawn from excluded (structurally irrelevant) attrs
    excluded_remaining = [a for a in remaining if a in excluded]
    other_remaining = [a for a in remaining if a not in excluded]
    rng.shuffle(other_remaining)
    weak_attrs = (excluded_remaining + other_remaining)[:n_weak]
    good_attrs = [a for a in remaining if a not in weak_attrs]

    # --- Step 5: sample numeric ratings within each tier's band ---
    # Elite tier uses Section 77.3's right-skewed distribution -- values near
    # the tier ceiling (98-99) should be rare, not routine.
    attributes: Dict[str, int] = {}
    for a in elite_attrs:
        attributes[a] = _sample_in_band(rng, TIER_BANDS["elite"], skew=True)
    for a in very_good_attrs:
        attributes[a] = _sample_in_band(rng, TIER_BANDS["very_good"])
    for a in good_attrs:
        attributes[a] = _sample_in_band(rng, TIER_BANDS["good_average"])
    for a in weak_attrs:
        attributes[a] = _sample_in_band(rng, TIER_BANDS["weak"])

    profile = PlayerAttributeProfile(
        archetype=archetype,
        attributes=attributes,
        elite_attributes=elite_attrs,
        very_good_attributes=very_good_attrs,
    )

    # Section 77.4: cap the combined top-3 attributes so a technically-compliant
    # player (2-3 elite, correct clusters) still can't be unrealistically
    # dominant by having every elite roll land near the scale's ceiling at once.
    profile = enforce_population_cap(profile, rng)

    # Section 78: cap the TOTAL attribute budget and overall rating so a
    # player can't be "legal" on elite-count/top-3 alone while still having
    # every other attribute inflated (an unrealistically high floor).
    profile = enforce_budget_and_rating_cap(profile, overall_quality)

    return profile


def validate_elite_budget(profile: PlayerAttributeProfile) -> bool:
    """Sanity check: confirms no more than 3 attributes are in the elite band,
    enforcing core KB Section 75.1's hard constraint even on externally-supplied
    or hand-edited attribute dicts."""
    elite_lo, _ = TIER_BANDS["elite"]
    elite_count = sum(1 for v in profile.attributes.values() if v >= elite_lo)
    return elite_count <= max(ELITE_SLOT_COUNT_RANGE)


def validate_population_cap(profile: PlayerAttributeProfile, max_top3_sum: int = 280) -> bool:
    """Core KB Section 77.4 check: confirms the combined top-3 attributes stay
    within the realistic power budget."""
    top3 = sorted(profile.attributes.values(), reverse=True)[:3]
    return sum(top3) <= max_top3_sum


def population_distribution_report(archetype: str, n: int = 500) -> Dict:
    """Core KB Section 77.3's claim, verified empirically: generates n players
    and reports what fraction of their elite-tier attribute values land in the
    98-99 'should be rare' range, to confirm the skewed sampling is actually
    producing population-level rarity, not just a per-player cap."""
    near_ceiling_count = 0
    total_elite_values = 0
    top3_sums = []

    for i in range(n):
        profile = generate_player_attributes(archetype, seed=i * 7919)  # arbitrary spread
        for a in profile.elite_attributes:
            total_elite_values += 1
            if profile.attributes[a] >= 98:
                near_ceiling_count += 1
        top3_sums.append(sum(sorted(profile.attributes.values(), reverse=True)[:3]))

    return {
        "archetype": archetype,
        "n_players": n,
        "elite_values_sampled": total_elite_values,
        "pct_at_98_or_99": round(100 * near_ceiling_count / max(total_elite_values, 1), 2),
        "avg_top3_sum": round(sum(top3_sums) / n, 1),
        "max_top3_sum_observed": max(top3_sums),
        "reference": "core KB Section 77.3 target: well under 1-3% at 98-99",
    }


def compute_overall_rating(attributes: Dict[str, int]) -> float:
    """Simple unweighted-average overall rating for illustration (core KB
    Section 78.3). A production system would weight by role-relevance
    (core KB Section 22) instead of a flat average."""
    if not attributes:
        return 0.0
    return round(sum(attributes.values()) / len(attributes), 1)


def enforce_budget_and_rating_cap(profile: PlayerAttributeProfile,
                                   overall_quality: str) -> PlayerAttributeProfile:
    """Core KB Section 78.4's enforcement algorithm: scales down ONLY
    non-elite attributes (never the 2-3 elite slots) until both the total
    attribute budget (78.2) and the overall rating ceiling (78.3) are
    satisfied. This is the whole-profile complement to enforce_population_cap
    (which only bounds the top-3) -- it stops a player from being 'legal' on
    elite-count and top-3 sum while still having every OTHER attribute
    inflated (e.g. 22 attributes all sitting at 80+)."""
    budget_cap = TIER_BUDGET_CAPS.get(overall_quality, TIER_BUDGET_CAPS["squad_player"])
    rating_ceiling = TIER_RATING_CEILINGS.get(overall_quality, TIER_RATING_CEILINGS["squad_player"])

    elite_set = set(profile.elite_attributes)
    non_elite_keys = [a for a in profile.attributes if a not in elite_set]

    def total_budget():
        return sum(profile.attributes.values())

    def rescale_non_elite(factor: float):
        for k in non_elite_keys:
            # never scale below the "weak" tier floor, avoiding implausibly
            # zeroed-out attributes purely to satisfy a budget
            profile.attributes[k] = max(20, round(profile.attributes[k] * factor))

    guard = 0
    while total_budget() > budget_cap and guard < 25:
        non_elite_sum = sum(profile.attributes[k] for k in non_elite_keys) or 1
        elite_sum = sum(profile.attributes[k] for k in elite_set)
        target_non_elite_sum = max(1, budget_cap - elite_sum)
        factor = target_non_elite_sum / non_elite_sum
        rescale_non_elite(factor)
        guard += 1

    guard = 0
    while compute_overall_rating(profile.attributes) > rating_ceiling and guard < 25:
        rescale_non_elite(0.95)
        guard += 1

    return profile


def validate_budget_and_rating(profile: PlayerAttributeProfile, overall_quality: str) -> Dict:
    """Reports whether a profile complies with core KB Section 78's two caps,
    for use as a post-generation or import-time sanity check."""
    budget_cap = TIER_BUDGET_CAPS.get(overall_quality, TIER_BUDGET_CAPS["squad_player"])
    rating_ceiling = TIER_RATING_CEILINGS.get(overall_quality, TIER_RATING_CEILINGS["squad_player"])
    total = sum(profile.attributes.values())
    rating = compute_overall_rating(profile.attributes)
    return {
        "total_attribute_sum": total,
        "budget_cap": budget_cap,
        "within_budget": total <= budget_cap,
        "overall_rating": rating,
        "rating_ceiling": rating_ceiling,
        "within_rating_ceiling": rating <= rating_ceiling,
        "reference": "core KB Section 78",
    }



def apply_age_decay(profile: PlayerAttributeProfile, career_stage: str) -> PlayerAttributeProfile:
    """Implements core KB Section 75.4: physical-cluster elite slots decay first
    and fastest; mental/passing-vision clusters are the most durable."""
    physical_attrs = set(CLUSTERS["explosive_physical"] + CLUSTERS["power_physical"])
    decay_by_stage = {"early_career": 0, "peak_career": 0, "late_career": 12, "veteran": 22}
    decay = decay_by_stage.get(career_stage, 0)

    new_attrs = dict(profile.attributes)
    for a in list(new_attrs.keys()):
        if a in physical_attrs and a in profile.elite_attributes:
            new_attrs[a] = max(30, new_attrs[a] - decay)
        elif a in physical_attrs:
            new_attrs[a] = max(20, new_attrs[a] - decay // 2)

    profile.attributes = new_attrs
    # Recompute which attributes still qualify as elite after decay
    elite_lo, _ = TIER_BANDS["elite"]
    profile.elite_attributes = [a for a in profile.elite_attributes if new_attrs[a] >= elite_lo]
    return profile


# ---------------------------------------------------------------------------
# 2. Worked examples (run this file directly)
# ---------------------------------------------------------------------------

def run_demo():
    print("=== ELITE-SKILL BUDGET MODEL: WORKED EXAMPLES ===\n")
    for archetype in ["poacher", "regista", "cb_stopper", "target_man", "winger"]:
        profile = generate_player_attributes(archetype, overall_quality="world_class", seed=hash(archetype) % 10000)
        print(profile.summary())
        print(f"Elite budget respected (<=3): {validate_elite_budget(profile)}")
        print()

    print("=== AGE DECAY: SAME WINGER, THREE CAREER STAGES ===\n")
    for stage in ["peak_career", "late_career", "veteran"]:
        profile = generate_player_attributes("winger", overall_quality="world_class", seed=42)
        decayed = apply_age_decay(profile, stage)
        print(f"-- {stage} --")
        print(decayed.summary())
        print()

    print("=== SECTION 77 VALIDATION: POPULATION-LEVEL RARITY CHECK (500 players/archetype) ===\n")
    for archetype in ["winger", "poacher", "cb_stopper", "regista"]:
        report = population_distribution_report(archetype, n=500)
        print(report)

    print("\n=== SECTION 78 VALIDATION: BUDGET & OVERALL RATING CAP ===\n")
    for archetype in ["winger", "poacher", "cb_stopper", "regista"]:
        profile = generate_player_attributes(archetype, overall_quality="world_class", seed=hash(archetype) % 9999)
        check = validate_budget_and_rating(profile, "world_class")
        print(f"{archetype}: {check}")


if __name__ == "__main__":
    run_demo()
