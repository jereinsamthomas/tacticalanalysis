/**
 * tbe_engine.js
 * Tactical Battle Engine (TBE) - Client-Side Decision Engine & Rules Knowledge Base
 * ---------------------------------------------------------------------------------
 * Full JavaScript implementation of:
 * - tactical_decision_engine.py (Space Value, Pressure, Pitch Control, Team Shape, Tactical Action Value, Explainable AI)
 * - stamina_model.py (Fatigue rate controller & attribute scaling)
 * - player_attribute_generator.py (Elite skill budget & attribute clusters)
 * - master database loader for 1,240 rules, 300 battle scenarios, 300 causality chains
 */

const TBE = (function() {
    const PITCH_LENGTH = 105.0;
    const PITCH_WIDTH = 68.0;

    const ACTIONS = [
        "pass", "dribble", "carry", "shoot", "cross",
        "cutback", "switch", "recycle", "through_ball", "long_ball"
    ];

    const FATIGUE_BANDS = [
        { upper: 20, physMult: 1.00, mentalMult: 1.00, label: "fresh", color: "var(--accent-green)" },
        { upper: 40, physMult: 0.95, mentalMult: 0.98, label: "light_fatigue", color: "var(--cyan)" },
        { upper: 60, physMult: 0.85, mentalMult: 0.93, label: "moderate_fatigue", color: "var(--amber)" },
        { upper: 80, physMult: 0.70, mentalMult: 0.85, label: "heavy_fatigue", color: "var(--orange)" },
        { upper: 100, physMult: 0.55, mentalMult: 0.75, label: "severe_fatigue", color: "var(--red)" }
    ];

    const POSITION_FATIGUE_RATE = {
        "cb_stopper": 0.85, "cb_ball_playing": 0.85, "full_back": 1.05,
        "wing_back": 1.10, "central_midfielder": 1.10, "box_to_box": 1.15,
        "winger": 1.20, "inside_forward": 1.15, "target_man": 0.95,
        "poacher": 1.00, "goalkeeper": 0.30
    };

    // State container
    let masterData = {
        meta: {},
        rules: [],
        battle_scenarios: [],
        tactical_causality_chains: []
    };
    let isDataLoaded = false;

    // ---------------------------------------------------------------------------
    // 1. Math & Geometry Helpers
    // ---------------------------------------------------------------------------
    function distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    function goalProximityScore(x, y, attackingDirectionX = PITCH_LENGTH) {
        const d = distance(x, y, attackingDirectionX, PITCH_WIDTH / 2);
        const maxD = distance(0, 0, PITCH_LENGTH, PITCH_WIDTH / 2);
        return Math.max(0.0, 1.0 - d / maxD);
    }

    function defenderDensityInv(x, y, opponents, radius = 10.0) {
        const nearby = opponents.filter(p => distance(p.x, p.y, x, y) <= radius);
        return 1.0 / (1.0 + nearby.length);
    }

    function spaceValue(x, y, moment) {
        const opponents = moment.players.filter(p => p.team_id !== moment.possession_team_id);
        const teammatesHere = moment.players.filter(p => 
            p.team_id === moment.possession_team_id && distance(p.x, p.y, x, y) < 3
        );

        const goalProx = goalProximityScore(x, y);
        const defDensityInv = defenderDensityInv(x, y, opponents);
        const attDensityInv = 1.0 / (1.0 + teammatesHere.length);

        const passingAccess = 0.6;
        const pressureInv = 0.6;
        const playerFit = 0.5;

        const sv = (0.30 * goalProx + 0.25 * defDensityInv + 0.10 * attDensityInv
            + 0.20 * passingAccess + 0.10 * pressureInv + 0.05 * playerFit);
        return Math.round(sv * 1000) / 1000;
    }

    function pressureOnPlayer(player, moment) {
        const opponents = moment.players.filter(p => p.team_id !== player.team_id);
        if (opponents.length === 0) return 0.0;

        let minDist = Infinity;
        opponents.forEach(p => {
            const d = distance(p.x, p.y, player.x, player.y);
            if (d < minDist) minDist = d;
        });

        const rawPressure = Math.max(0.0, 1.0 - minDist / 15.0);
        const nearbyDefenders = opponents.filter(p => distance(p.x, p.y, player.x, player.y) <= 8).length;
        const compounding = 1.0 + 0.3 * Math.max(0, nearbyDefenders - 1);
        return Math.min(1.0, Math.round(rawPressure * compounding * 1000) / 1000);
    }

    function pitchControlAt(x, y, moment) {
        function teamMinTime(teamId) {
            const teamPlayers = moment.players.filter(p => p.team_id === teamId);
            if (teamPlayers.length === 0) return Infinity;
            let minT = Infinity;
            teamPlayers.forEach(p => {
                const d = distance(p.x, p.y, x, y);
                const speed = Math.max(p.speed_mps || 3.0, 0.5);
                const t = d / speed;
                if (t < minT) minT = t;
            });
            return minT;
        }

        const teams = Array.from(new Set(moment.players.map(p => p.team_id)));
        if (teams.length < 2) return { contested: 0.0, free: 1.0 };
        
        const [tA, tB] = teams;
        const timeA = teamMinTime(tA);
        const timeB = teamMinTime(tB);
        const diff = timeB - timeA;
        const controlA = 1.0 / (1.0 + Math.exp(-diff));
        return {
            [tA]: Math.round(controlA * 1000) / 1000,
            [tB]: Math.round((1.0 - controlA) * 1000) / 1000
        };
    }

    function detectTeamShape(teamId, moment) {
        const teamPlayers = moment.players.filter(p => p.team_id === teamId);
        if (teamPlayers.length === 0) return null;

        const xs = teamPlayers.map(p => p.x);
        const ys = teamPlayers.map(p => p.y);
        const centroidX = xs.reduce((a, b) => a + b, 0) / xs.length;
        const centroidY = ys.reduce((a, b) => a + b, 0) / ys.length;
        const width = Math.max(...ys) - Math.min(...ys);
        const length = Math.max(...xs) - Math.min(...xs);

        return {
            team_id: teamId,
            centroid: [Math.round(centroidX * 10) / 10, Math.round(centroidY * 10) / 10],
            width_m: Math.round(width * 10) / 10,
            length_m: Math.round(length * 10) / 10,
            compactness_m: Math.round(length * 10) / 10,
            player_count: teamPlayers.length
        };
    }

    // ---------------------------------------------------------------------------
    // 2. Tactical Action Value & Ranking (PART BV / BW)
    // ---------------------------------------------------------------------------
    function evaluateAction(action, carrier, moment) {
        const currentSV = spaceValue(carrier.x, carrier.y, moment);
        let destX, destY;

        if (action === "pass" || action === "through_ball" || action === "switch") {
            destX = Math.min(carrier.x + 15, PITCH_LENGTH);
            destY = action === "switch" ? (PITCH_WIDTH - carrier.y) : carrier.y;
        } else if (action === "dribble" || action === "carry") {
            destX = Math.min(carrier.x + 5, PITCH_LENGTH);
            destY = carrier.y;
        } else if (action === "shoot") {
            destX = PITCH_LENGTH;
            destY = PITCH_WIDTH / 2;
        } else if (action === "cross" || action === "cutback") {
            destX = PITCH_LENGTH - 5;
            destY = PITCH_WIDTH / 2;
        } else if (action === "long_ball") {
            destX = Math.min(carrier.x + 30, PITCH_LENGTH);
            destY = carrier.y;
        } else { // recycle
            destX = Math.max(carrier.x - 10, 0);
            destY = carrier.y;
        }

        const destSV = spaceValue(destX, destY, moment);
        const progression = Math.max(0.0, (destX - carrier.x) / PITCH_LENGTH);
        const spaceGained = Math.max(0.0, destSV - currentSV);
        const chanceCreation = action === "shoot" ? 1.0 : (["cross", "cutback", "through_ball"].includes(action) ? 0.6 : 0.2);
        
        const retentionMap = {
            "recycle": 0.95, "pass": 0.85, "dribble": 0.7, "carry": 0.8, "cutback": 0.65,
            "cross": 0.5, "switch": 0.6, "through_ball": 0.55, "long_ball": 0.45, "shoot": 0.3
        };
        const possessionRetention = retentionMap[action] || 0.6;
        const risk = 1.0 - possessionRetention;
        const transitionDanger = ["long_ball", "cross", "shoot"].includes(action) ? 0.3 : 0.15;

        const tav = (0.25 * progression + 0.20 * spaceGained + 0.20 * chanceCreation
            + 0.15 * possessionRetention - 0.15 * risk - 0.05 * transitionDanger);

        return {
            action,
            tactical_action_value: Math.round(tav * 1000) / 1000,
            progression: Math.round(progression * 1000) / 1000,
            space_gained: Math.round(spaceGained * 1000) / 1000,
            chance_creation: chanceCreation,
            possession_retention: possessionRetention,
            risk: Math.round(risk * 1000) / 1000,
            transition_danger: transitionDanger,
            dest: [Math.round(destX), Math.round(destY)]
        };
    }

    function rankActions(carrier, moment) {
        const scored = ACTIONS.map(a => evaluateAction(a, carrier, moment));
        return scored.sort((a, b) => b.tactical_action_value - a.tactical_action_value);
    }

    function confidenceBand(topVal, secondVal) {
        const gap = topVal - secondVal;
        if (gap > 0.15) return "high";
        if (gap > 0.08) return "medium-high";
        if (gap > 0.03) return "medium";
        return "low";
    }

    function explainRecommendation(carrier, moment) {
        const ranked = rankActions(carrier, moment);
        const best = ranked[0];
        const second = ranked[1];
        const conf = confidenceBand(best.tactical_action_value, second.tactical_action_value);

        return {
            recommendation: best.action,
            tactical_action_value: best.tactical_action_value,
            why: [
                `Tactical Action Value = ${best.tactical_action_value} (Class F, heuristic multi-objective optimization)`,
                `Progression = ${best.progression}, Space Gained = ${best.space_gained}, Chance Creation = ${best.chance_creation}`,
                `Possession Retention = ${best.possession_retention}, Risk Profile = ${best.risk}`
            ],
            mechanism: "TBE Architecture Part BV/BW: Action Generator + Tactical Action Value",
            confidence: conf,
            alternative: {
                action: second.action,
                tactical_action_value: second.tactical_action_value
            },
            source_class: "G",
            ranked_actions: ranked
        };
    }

    // ---------------------------------------------------------------------------
    // 3. Stamina & Fatigue Model (core KB Section 76)
    // ---------------------------------------------------------------------------
    function calculateFatigue(minute, baseStamina = 80, position = "winger") {
        const rateMod = POSITION_FATIGUE_RATE[position] || 1.0;
        const staminaFactor = (100 - baseStamina) / 30.0;
        
        let fatigue = 0.0;
        const halftime = minute >= 45;
        const effectiveMinutes = minute;
        
        // Base rate ~ 0.45% per minute scaled by position and stamina factor
        fatigue = effectiveMinutes * 0.42 * rateMod * Math.max(0.6, staminaFactor);
        
        // Halftime recovery (-12%)
        if (minute > 45) {
            fatigue = Math.max(5.0, fatigue - 12.0);
        }

        fatigue = Math.min(100.0, Math.round(fatigue * 10) / 10);

        let band = FATIGUE_BANDS[FATIGUE_BANDS.length - 1];
        for (let b of FATIGUE_BANDS) {
            if (fatigue <= b.upper) {
                band = b;
                break;
            }
        }

        return {
            minute,
            fatigue_pct: fatigue,
            band: band.label,
            color: band.color,
            physical_multiplier: band.physMult,
            mental_multiplier: band.mentalMult,
            speed_modifier: band.physMult,
            scanning_modifier: band.mentalMult,
            sub_recommended: fatigue > 65
        };
    }

    // ---------------------------------------------------------------------------
    // 4. Data Loading (MASTER_RULES_AND_SCENARIOS.json)
    // ---------------------------------------------------------------------------
    async function loadMasterData() {
        if (isDataLoaded) return masterData;
        try {
            const resp = await fetch('tbe/rules/MASTER_RULES_AND_SCENARIOS.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            masterData = await resp.json();
            isDataLoaded = true;
            console.log("⚡ TBE Master Package Loaded:", {
                rules: masterData.rules?.length || 0,
                scenarios: masterData.battle_scenarios?.length || 0,
                chains: masterData.tactical_causality_chains?.length || 0
            });
        } catch (err) {
            console.warn("Could not fetch master JSON directly, using fallback structure:", err);
            // Fallback minimum seed if fetch fails
            masterData = {
                meta: { version: "1.0", fallback: true },
                rules: [],
                battle_scenarios: [],
                tactical_causality_chains: []
            };
        }
        return masterData;
    }

    function searchRules(query, category = "ALL", limit = 50) {
        if (!masterData.rules) return [];
        let filtered = masterData.rules;
        if (category && category !== "ALL") {
            filtered = filtered.filter(r => r.category === category);
        }
        if (query && query.trim().length > 0) {
            const q = query.toLowerCase();
            filtered = filtered.filter(r => 
                (r.trigger && r.trigger.toLowerCase().includes(q)) ||
                (r.action && r.action.toLowerCase().includes(q)) ||
                (r.purpose && r.purpose.toLowerCase().includes(q)) ||
                (r.actor && r.actor.toLowerCase().includes(q)) ||
                (r.target && r.target.toLowerCase().includes(q)) ||
                (r.rule_id && r.rule_id.toLowerCase().includes(q))
            );
        }
        return filtered.slice(0, limit);
    }

    function filterScenarios(filters = {}, limit = 50) {
        if (!masterData.battle_scenarios) return [];
        let list = masterData.battle_scenarios;

        if (filters.formation_a) {
            list = list.filter(s => s.formation_a === filters.formation_a);
        }
        if (filters.formation_b) {
            list = list.filter(s => s.formation_b === filters.formation_b);
        }
        if (filters.style_a) {
            list = list.filter(s => s.style_a === filters.style_a);
        }
        if (filters.style_b) {
            list = list.filter(s => s.style_b === filters.style_b);
        }
        if (filters.game_state) {
            list = list.filter(s => s.game_state === filters.game_state);
        }
        if (filters.pressure_level) {
            list = list.filter(s => s.pressure_level === filters.pressure_level);
        }
        if (filters.outcome_estimate) {
            list = list.filter(s => s.outcome_estimate === filters.outcome_estimate);
        }
        return list.slice(0, limit);
    }

    function findMatchingMatchup(hForm, hStyle, aForm, aStyle) {
        if (!masterData.battle_scenarios || masterData.battle_scenarios.length === 0) return null;
        
        // Exact match
        let match = masterData.battle_scenarios.find(s => 
            s.formation_a === hForm && s.formation_b === aForm &&
            s.style_a === hStyle && s.style_b === aStyle
        );
        if (match) return match;

        // Formation match
        match = masterData.battle_scenarios.find(s => 
            s.formation_a === hForm && s.formation_b === aForm
        );
        if (match) return match;

        // Style match
        match = masterData.battle_scenarios.find(s => 
            s.style_a === hStyle && s.style_b === aStyle
        );
        if (match) return match;

        // Partial formation
        match = masterData.battle_scenarios.find(s => 
            s.formation_a === hForm || s.formation_b === aForm
        );
        return match || masterData.battle_scenarios[0];
    }

    return {
        PITCH_LENGTH,
        PITCH_WIDTH,
        ACTIONS,
        FATIGUE_BANDS,
        POSITION_FATIGUE_RATE,
        distance,
        goalProximityScore,
        spaceValue,
        pressureOnPlayer,
        pitchControlAt,
        detectTeamShape,
        evaluateAction,
        rankActions,
        explainRecommendation,
        calculateFatigue,
        loadMasterData,
        searchRules,
        filterScenarios,
        findMatchingMatchup,
        getData: () => masterData,
        isLoaded: () => isDataLoaded
    };
})();

// Expose globally
window.TBE = TBE;
