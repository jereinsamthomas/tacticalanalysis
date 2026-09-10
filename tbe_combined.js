/**
 * tbe_combined.js
 * ─────────────────────────────────────────────────────────────────────────
 * Tactical Battle Engine — combined engine + UI layer for TACTICS OS.
 *
 * This file merges the previous two-file setup (tbe_engine.js + tbe_ui.js)
 * into a single script. Load ONE <script src="tbe_combined.js"> tag instead
 * of two, then call TBE_UI.init() as before.
 *
 * ── WHAT CHANGED VS. THE TWO-FILE VERSION ─────────────────────────────────
 * 1. MERGED: engine + UI now live in one file. window.TBE and window.TBE_UI
 *    are both still exposed, so any existing host page keeps working as-is
 *    for everything except the two items below.
 *
 * 2. "TEAM" REMOVED — REPLACED WITH "POSITION + STYLE, PER FORMATION":
 *    The old Battle Scenarios model paired two whole teams against each
 *    other (formation_a vs formation_b, style_a vs style_b, team_shape_a /
 *    opponent_shape_b). That's gone. A scenario is now framed around ONE
 *    formation at a time:
 *        formation  ->  one specific position slot in that formation
 *                   ->  a playing style assigned to that position
 *                   ->  a tactical role compatible with that position
 *    See FORMATION_POSITIONS (formation -> ordered position slots) and
 *    POSITION_ROLE_MAP (position -> compatible roles) below. The old
 *    TBE.findMatchingMatchup(hF,hS,aF,aS) two-team lookup has been replaced
 *    by TBE.findMatchingPositionScenario(formation, position, style).
 *
 * 3. DATASET LINKING — PLANNED, NOT IMPLEMENTED:
 *    Everything below still runs fully self-contained off the seeded
 *    procedural generators (no network calls, no external files). A
 *    "DATASET LINKING (PLANNED)" block near the bottom documents the shape
 *    a future TBE.loadDataset() would take to swap in a real dataset
 *    later — it is a plan/placeholder only, intentionally not wired up.
 */
(function (global) {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════
    // 0. SEEDED RNG — deterministic generation (mulberry32)
    // ═══════════════════════════════════════════════════════════════════
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function seededShuffle(arr, rng) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function choice(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
    function sample(arr, n, rng) { return seededShuffle(arr, rng).slice(0, n); }

    // ═══════════════════════════════════════════════════════════════════
    // 1. REFERENCE LISTS (core KB Section 1.5 zone grid, Section 3/51 roles)
    // ═══════════════════════════════════════════════════════════════════
    const ZONES = Array.from({ length: 30 }, (_, i) => 'Z' + (i + 1));

    const ROLES = [
        'target_man', 'poacher', 'complete_forward', 'false_nine', 'pressing_forward', 'advanced_forward',
        'inside_forward', 'inverted_winger', 'traditional_winger', 'wide_playmaker', 'shadow_striker',
        'deep_lying_forward', 'raumdeuter', 'wide_target_man', 'defensive_winger',
        'destroyer', 'ball_winning_midfielder', 'anchor_man', 'regista', 'deep_playmaker', 'box_to_box',
        'mezzala', 'carrilero', 'advanced_playmaker', 'number_10', 'segundo_volante', 'trequartista', 'half_back',
        'stopper', 'cover_defender', 'ball_playing_cb', 'wide_cb', 'full_back', 'attacking_fb', 'inverted_fb',
        'false_fb', 'wing_back', 'complete_wing_back',
        'shot_stopper', 'sweeper_keeper', 'ball_playing_gk', 'aggressive_gk'
    ];

    const MOVEMENT_TYPES = [
        'check_toward_ball', 'check_away', 'run_in_behind', 'diagonal_run', 'curved_run', 'straight_run',
        'blind_side_run', 'double_movement', 'dummy_run', 'decoy_run', 'support_run', 'overlap',
        'underlap', 'inversion', 'rotation', 'drop', 'spin', 'pin', 'drift', 'occupy', 'vacate'
    ];

    const PRESSING_TRIGGERS = [
        'bad_first_touch', 'back_pass', 'slow_pass', 'loose_pass', 'receiver_facing_own_goal',
        'weak_foot_receiver', 'isolated_player', 'sideline_reception', 'gk_possession', 'cb_possession',
        'fb_possession', 'midfielder_receiving', 'poor_body_orientation', 'long_pass_in_flight',
        'aerial_duel_contested', 'second_ball_loose'
    ];

    const DEFENSIVE_RESPONSES = [
        'shift_across', 'drop_off', 'step_up_together', 'press_immediately',
        'hand_over_marking', 'double_team', 'recover_goal_side', 'hold_shape'
    ];

    const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-2-2-2', '4-4-2_diamond', '3-1-4-2'];
    const STYLES = ['tiki_taka', 'positional_play', 'gegenpressing', 'high_press', 'low_block', 'counterattacking', 'direct_football', 'possession_football', 'wing_play', 'total_football'];
    const GAME_STATES = ['0-0', '1-0', '0-1', '2-0', '0-2', '2-1', '1-2', 'must_win', 'protect_lead', 'chase_goal'];

    // ═══════════════════════════════════════════════════════════════════
    // 1b. NEW — FORMATION → POSITION SLOTS, POSITION → COMPATIBLE ROLES
    //     This is what replaces "team vs team" with "position + style,
    //     per formation" throughout the scenario/chain generators below.
    // ═══════════════════════════════════════════════════════════════════
    const FORMATION_POSITIONS = {
        '4-4-2':          ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
        '4-3-3':          ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
        '4-2-3-1':        ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LW', 'RW', 'ST'],
        '3-5-2':          ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'],
        '3-4-3':          ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
        '5-3-2':          ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CM', 'ST', 'ST'],
        '4-1-4-1':        ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST'],
        '4-2-2-2':        ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'CAM', 'ST', 'ST'],
        '4-4-2_diamond':  ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST'],
        '3-1-4-2':        ['GK', 'CB', 'CB', 'CB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST']
    };

    const POSITION_ROLE_MAP = {
        GK:  ['shot_stopper', 'sweeper_keeper', 'ball_playing_gk', 'aggressive_gk'],
        CB:  ['stopper', 'cover_defender', 'ball_playing_cb', 'wide_cb'],
        LB:  ['full_back', 'attacking_fb', 'inverted_fb', 'false_fb'],
        RB:  ['full_back', 'attacking_fb', 'inverted_fb', 'false_fb'],
        LWB: ['wing_back', 'complete_wing_back', 'attacking_fb'],
        RWB: ['wing_back', 'complete_wing_back', 'attacking_fb'],
        CDM: ['destroyer', 'ball_winning_midfielder', 'anchor_man', 'regista', 'deep_playmaker', 'half_back'],
        CM:  ['box_to_box', 'mezzala', 'carrilero', 'deep_playmaker', 'segundo_volante'],
        CAM: ['advanced_playmaker', 'number_10', 'trequartista', 'shadow_striker'],
        LM:  ['traditional_winger', 'inverted_winger', 'wide_playmaker', 'defensive_winger'],
        RM:  ['traditional_winger', 'inverted_winger', 'wide_playmaker', 'defensive_winger'],
        LW:  ['inside_forward', 'inverted_winger', 'traditional_winger', 'raumdeuter', 'wide_target_man', 'defensive_winger'],
        RW:  ['inside_forward', 'inverted_winger', 'traditional_winger', 'raumdeuter', 'wide_target_man', 'defensive_winger'],
        ST:  ['target_man', 'poacher', 'complete_forward', 'false_nine', 'pressing_forward', 'advanced_forward', 'deep_lying_forward', 'shadow_striker'],
        CF:  ['target_man', 'poacher', 'complete_forward', 'false_nine', 'pressing_forward', 'advanced_forward', 'deep_lying_forward', 'shadow_striker']
    };

    function getFormationPositions(formationName) {
        return (FORMATION_POSITIONS[formationName] || ['GK', 'CB', 'CB', 'CM', 'CM', 'CM', 'LW', 'RW', 'ST']).slice();
    }
    function getRolesForPosition(position) {
        return (POSITION_ROLE_MAP[position] || ROLES).slice();
    }
    // Reverse lookup used to attach a plausible position onto data that is
    // only tagged with a role (e.g. the causality chains below).
    function positionForRole(role) {
        for (const pos in POSITION_ROLE_MAP) {
            if (POSITION_ROLE_MAP[pos].indexOf(role) !== -1) return pos;
        }
        return 'CM';
    }

    const OVERLOAD_TYPES = ['wide_overload', 'half_space_overload', 'central_overload', 'box_overload'];
    const THIRD_MAN_CONTEXTS = ['build_up', 'press_escape', 'progression', 'final_third', 'counterattack'];

    const FAILURE_CAUSES = [
        'pressing_unit_uncoordinated', 'marking_assignment_miscommunicated', 'cover_shadow_angle_wrong',
        'rest_defence_understaffed', 'weak_side_ball_watching', 'offside_line_stepped_individually',
        'wing_back_committed_with_no_cover', 'gk_distributed_without_scanning',
        'central_overload_unrecognized', 'handover_between_defenders_missed'
    ];
    const SUCCESS_MECHANISMS = [
        'overload_to_isolate', 'third_man_press_escape', 'false_nine_disruption', 'counterpress_to_shot',
        'blocking_run_set_piece', 'baited_press_then_switch', 'half_space_rotation_overload',
        'direct_run_in_behind_low_block', 'weak_foot_isolation', 'delayed_offside_beating_run', 'cutback_over_cross'
    ];
    const MANIPULATION_MECHANISMS = [
        ['dragging_defenders', "makes a sudden run to drag the marker out of position"],
        ['fixing_defenders', "holds position to occupy a defender by proximity alone"],
        ['pinning_defenders', "maintains disciplined weak-side width to pin the far defender"],
        ['pulling_midfielders', "drops deep to bait an opposing midfielder out of position"],
        ['forcing_defensive_shift', "sustains a ball-side overload to force a full defensive shift"],
        ['creating_gaps', "rotates into a teammate's zone to force a defensive handover"],
        ['creating_weak_side_space', "commits numbers ball-side to open the far side"],
        ['creating_passing_lanes', "shifts laterally out of a defender's cover shadow"],
        ['moving_defenders_from_danger_zones', "screens the opponent's key defender away from the delivery zone"],
        ['luring_into_pressing_traps', "plays a deliberate low-risk pass to bait an aggressive press"]
    ];

    // ═══════════════════════════════════════════════════════════════════
    // 2. PROCEDURAL GENERATORS (ported from engine/rule_generator.py)
    // ═══════════════════════════════════════════════════════════════════

    function generateMovementRules(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const m of MOVEMENT_TYPES) for (const r of ROLES) for (const z of ZONES) combos.push([m, r, z]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([movement, role, zone], i) => {
            const destZone = choice(ZONES.filter(z => z !== zone), rng);
            return {
                rule_id: 'MV' + String(i + 1).padStart(5, '0'),
                category: 'MOVEMENT',
                trigger: `${role}_positioned_in_${zone}`,
                condition: `defensive_response_available_is_${choice(DEFENSIVE_RESPONSES, rng)}`,
                actor: role,
                action: movement,
                target: destZone,
                purpose: `execute a ${movement.replace(/_/g, ' ')} from ${zone} to manipulate marker positioning toward ${destZone}`,
                expected_result: `${role} gains separation or space value in ${destZone}`,
                risk: 'mistimed execution allows the defender to recover before the movement completes',
                counter: 'defender anticipates the movement pattern and delays commitment rather than reacting immediately',
                confidence: 'medium', source_class: 'C'
            };
        });
    }

    function generatePressingTriggers(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const t of PRESSING_TRIGGERS) for (const z of ZONES) for (const r of ROLES) combos.push([t, z, r]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([trigger, zone, presser], i) => ({
            rule_id: 'PT' + String(i + 1).padStart(5, '0'),
            category: 'PRESSING',
            trigger, condition: `ball_in_${zone}`, actor: presser,
            action: 'trigger_coordinated_press', target: zone,
            purpose: `exploit the ${trigger.replace(/_/g, ' ')} moment to force a turnover or rushed action`,
            expected_result: 'regain possession or force a lower-quality action from the ball carrier',
            risk: 'uncoordinated press leaves space elsewhere if only one player engages',
            counter: 'ball carrier releases via a pre-planned escape lane (third-man, bounce pass, or direct long ball)',
            confidence: 'medium', source_class: 'C'
        }));
    }

    function generateThirdManPatterns(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const ctx of THIRD_MAN_CONTEXTS) for (const a of ROLES) for (const b of ROLES) for (const c of ROLES) {
            if (a !== b && b !== c && a !== c) combos.push([ctx, a, b, c]);
        }
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([context, a, b, c], i) => {
            const [za, zb, zc] = sample(ZONES, 3, rng);
            return {
                rule_id: 'TM' + String(i + 1).padStart(5, '0'),
                category: 'PASSING',
                trigger: `${a}_in_possession_in_${za}_under_pressure`,
                condition: `${c}_positioned_to_receive_in_${zc}_unmarked`,
                actor: a, action: `pass_to_${b}_who_lays_off_to_${c}`, target: zc,
                purpose: `a third-man combination (${context.replace(/_/g, ' ')}) moving the ball from ${za} through ${zb} to ${zc} to bypass the nearest defensive line`,
                expected_result: `${c} receives progressed and facing forward in ${zc}`,
                risk: 'requires precise timing across three players; any one mistimed touch breaks the pattern',
                counter: "the defending team's covering midfielder anticipates the lay-off and intercepts the third pass",
                confidence: 'medium', source_class: 'C'
            };
        });
    }

    function generateOverloadIsolation(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const ot of OVERLOAD_TYPES) for (const z of ZONES) for (const r of ROLES) combos.push([ot, z, r]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([overloadType, zone, isolatedRole], i) => {
            const weakZone = choice(ZONES.filter(z => z !== zone), rng);
            return {
                rule_id: 'OI' + String(i + 1).padStart(5, '0'),
                category: 'ATTACKING',
                trigger: `${overloadType}_created_in_${zone}`,
                condition: 'opponent_shifts_numbers_to_match_the_overload',
                actor: isolatedRole, action: 'switch_of_play_to_isolate_1v1', target: weakZone,
                purpose: `use the ${overloadType.replace(/_/g, ' ')} in ${zone} to draw defensive numbers away from ${weakZone}, then isolate ${isolatedRole} there`,
                expected_result: `${isolatedRole} receives 1v1 in space in ${weakZone}`,
                risk: 'the switch itself carries technical execution risk (long diagonal ball)',
                counter: 'opponent delays its own defensive shift specifically to avoid over-committing to the overload',
                confidence: 'medium', source_class: 'C'
            };
        });
    }

    function generateFailurePatterns(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const c of FAILURE_CAUSES) for (const z of ZONES) for (const r of ROLES) combos.push([c, z, r]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([cause, zone, role], i) => ({
            rule_id: 'FL' + String(i + 1).padStart(5, '0'),
            category: 'DEFENDING',
            trigger: cause, condition: `occurs_in_${zone}_involving_${role}`, actor: role,
            action: 'correction_required', target: zone,
            purpose: `identify and correct the failure mode '${cause.replace(/_/g, ' ')}' before it is repeatedly exploited`,
            expected_result: 'the specific exploited gap in that zone is closed',
            risk: "the correction itself typically reallocates coverage from elsewhere",
            counter: 'opponent probes a different zone/mechanism once this specific failure is corrected',
            confidence: 'medium', source_class: 'C'
        }));
    }

    function generateSuccessPatterns(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const m of SUCCESS_MECHANISMS) for (const z of ZONES) for (const r of ROLES) combos.push([m, z, r]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([mechanism, zone, role], i) => ({
            rule_id: 'SC' + String(i + 1).padStart(5, '0'),
            category: 'ATTACKING',
            trigger: `conditions_favorable_for_${mechanism}_in_${zone}`,
            condition: `executed_by_${role}`, actor: role, action: mechanism, target: zone,
            purpose: `apply the ${mechanism.replace(/_/g, ' ')} pattern in ${zone}`,
            expected_result: 'a structural or individual advantage is converted into a tangible attacking outcome',
            risk: 'success depends on precise timing/execution; a mistimed attempt wastes the structural advantage created',
            counter: 'opponent recognizes the pattern after repeated use and pre-emptively adjusts',
            confidence: 'medium', source_class: 'C'
        }));
    }

    function generateManipulationChains(n, seed) {
        const rng = mulberry32(seed);
        const combos = [];
        for (const mech of MANIPULATION_MECHANISMS) for (const z of ZONES) for (const r of ROLES) for (const f of FORMATIONS) combos.push([mech, z, r, f]);
        const shuffled = seededShuffle(combos, rng).slice(0, n);
        return shuffled.map(([[mechId, mechDesc], zone, role, formation], i) => {
            const destZone = choice(ZONES.filter(z => z !== zone), rng);
            return {
                chain_id: 'CC' + String(i + 1).padStart(5, '0'),
                category: 'TACTICAL_CAUSALITY',
                mechanism: mechId,
                context_formation: formation,
                // NEW — grounds the chain in a position slot (derived from the
                // role involved) instead of leaving it team-agnostic.
                context_position: positionForRole(role),
                step_1_player_movement: `${role} in ${zone} ${mechDesc}`,
                step_2_space: `a spatial change occurs relative to ${zone}`,
                step_3_opponent_response: choice(DEFENSIVE_RESPONSES, rng),
                step_4_team_adaptation: `a teammate exploits the resulting gap near ${destZone}`,
                step_5_second_opponent_response: choice(DEFENSIVE_RESPONSES, rng),
                step_6_counter: `a follow-up action targets ${destZone} before the second response completes`,
                step_7_outcome: choice(['progression', 'chance_created', 'turnover_forced', 'territorial_gain'], rng),
                source_class: 'C'
            };
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // REPLACES generateBattleScenarios(): no more team-vs-team pairing.
    // Each scenario is now: one formation -> one position slot in that
    // formation -> a playing style + compatible role assigned to that slot.
    // ─────────────────────────────────────────────────────────────────────
    function generatePositionScenarios(n, seed) {
        const rng = mulberry32(seed);
        const out = [];
        for (let i = 0; i < n; i++) {
            const formation = choice(FORMATIONS, rng);
            const positions = getFormationPositions(formation);
            const slotIndex = Math.floor(rng() * positions.length);
            const position = positions[slotIndex];
            const styleForPosition = choice(STYLES, rng);
            const roleForPosition = choice(getRolesForPosition(position), rng);
            out.push({
                scenario_id: 'SC' + String(i + 1).padStart(5, '0'),
                game_state: choice(GAME_STATES, rng),
                formation,
                position,
                position_slot: slotIndex + 1,
                style_for_position: styleForPosition,
                role_for_position: roleForPosition,
                ball_zone: choice(ZONES, rng),
                formation_shape: `${formation}_${rng() > 0.5 ? 'possession' : 'defensive'}_shape`,
                pressure_level: choice(['low', 'medium', 'high'], rng),
                space_value_estimate: Math.round((0.1 + rng() * 0.8) * 100) / 100,
                numerical_state: choice(['even', 'attacker_plus_1', 'defender_plus_1'], rng),
                available_actions: ['pass', 'dribble', 'cross', 'switch', 'recycle'],
                best_action_estimate: choice(['pass', 'dribble', 'cross', 'switch', 'recycle'], rng),
                opponent_response_estimate: choice(DEFENSIVE_RESPONSES, rng),
                counter_estimate: 're-evaluate via counterfactual simulation',
                outcome_estimate: choice(['progression', 'turnover', 'shot_created', 'possession_reset'], rng),
                source_class: 'F'
            });
        }
        return out;
    }

    // ── Build the full dataset once, matching the exact volumes referenced
    //    throughout the knowledge base and the dashboard's stat pills ──
    const rules = [].concat(
        generateMovementRules(300, 1001),
        generatePressingTriggers(260, 1002),
        generateThirdManPatterns(150, 1003),
        generateOverloadIsolation(110, 1004),
        generateFailurePatterns(200, 1005),
        generateSuccessPatterns(200, 1006),
        generateManipulationChains(20, 1007) // small slice also folded into the rules pool for the Rules tab
    );
    const scenarios = generatePositionScenarios(300, 2001);
    const chains = generateManipulationChains(300, 3001);

    // ═══════════════════════════════════════════════════════════════════
    // 3. SEARCH / MATCH HELPERS (used by the Match Analyzer / Battle Engine UI)
    // ═══════════════════════════════════════════════════════════════════

    function searchRules(keyword, category, limit) {
        limit = limit || 10;
        const kw = (keyword || '').toLowerCase();
        let pool = rules;
        if (category && category !== 'ALL') pool = pool.filter(r => r.category === category);
        if (kw) {
            pool = pool.filter(r =>
                (r.trigger + ' ' + r.actor + ' ' + r.action + ' ' + r.purpose).toLowerCase().includes(kw)
            );
        }
        return pool.slice(0, limit);
    }

    /**
     * REPLACES findMatchingMatchup(hFormation,hStyle,aFormation,aStyle).
     * That function matched two whole teams against each other. There is no
     * "team vs team" concept anymore — this looks up the closest-matching
     * generated scenario for a single formation + position + style combo.
     */
    function findMatchingPositionScenario(formationName, positionCode, styleName) {
        const norm = s => (s || '').toLowerCase().replace(/[\s-]+/g, '_');
        const f = norm(formationName);
        const p = (positionCode || '').toUpperCase();
        const s = norm(styleName);

        let best = null, bestScore = -1;
        for (const sc of scenarios) {
            let score = 0;
            if (sc.formation === f || sc.formation.replace(/_diamond/, '') === f) score++;
            if (sc.position === p) score++;
            if (sc.style_for_position === s) score++;
            if (score > bestScore) { bestScore = score; best = sc; }
        }
        return best; // always returns the closest-matching scenario (graceful fallback, never null given scenarios.length > 0)
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. DECISION-ENGINE MODELS (ported from engine/tactical_decision_engine.py)
    //    Pitch assumed 105m x 68m, attacking left-to-right (core KB convention)
    // ═══════════════════════════════════════════════════════════════════
    const PITCH_LENGTH = 105, PITCH_WIDTH = 68;

    function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

    function goalProximityScore(x, y) {
        const d = dist(x, y, PITCH_LENGTH, PITCH_WIDTH / 2);
        const maxD = dist(0, 0, PITCH_LENGTH, PITCH_WIDTH / 2);
        return Math.max(0, 1 - d / maxD);
    }

    // Part BX — SPACE_VALUE (Class F, initial heuristic weights)
    function spaceValue(x, y, ctx) {
        ctx = ctx || {};
        const defenderCount = ctx.defenderCount || 0;
        const goalProx = goalProximityScore(x, y);
        const defDensityInv = 1 / (1 + defenderCount);
        const attDensityInv = 1; // no teammate-crowding data at this granularity
        const passingAccess = ctx.passingAccess != null ? ctx.passingAccess : 0.6;
        const pressureInv = 1 - (ctx.pressure != null ? ctx.pressure : 0.4);
        const playerFit = 0.5;
        return 0.30 * goalProx + 0.25 * defDensityInv + 0.10 * attDensityInv
             + 0.20 * passingAccess + 0.10 * pressureInv + 0.05 * playerFit;
    }

    // Part BY — PRESSURE_MODEL (Class F)
    function pressureAt(carrier, ctx) {
        ctx = ctx || {};
        const d = ctx.nearestDefenderDist != null ? ctx.nearestDefenderDist : 8;
        const nearbyDefenders = ctx.defenderCount || 1;
        const rawPressure = Math.max(0, 1 - d / 15);
        const compounding = 1 + 0.3 * Math.max(0, nearbyDefenders - 1);
        return Math.min(1, rawPressure * compounding);
    }

    // Part BZ — PITCH_CONTROL (simplified time-to-reach sigmoid, Class F)
    function pitchControlAt(x, y, ctx) {
        ctx = ctx || {};
        const attackerTime = (ctx.nearestDefenderDist || 8) / 2; // toy: assume ~2 m/s wall-clock closing reference
        const defenderTime = (ctx.nearestDefenderDist || 8) / (ctx.defenderSpeed || 6.5);
        const diff = defenderTime - attackerTime;
        const controlAttacking = 1 / (1 + Math.exp(-diff));
        return { attacking_team: Math.round(controlAttacking * 1000) / 1000, defending_team: Math.round((1 - controlAttacking) * 1000) / 1000 };
    }

    const ACTIONS = ['pass', 'dribble', 'carry', 'shoot', 'cross', 'cutback', 'switch', 'recycle', 'through_ball', 'long_ball'];

    // Part BW — TACTICAL_ACTION_VALUE (Class F, initial heuristic weights)
    function evaluateAction(action, carrierCtx) {
        const { x, y } = carrierCtx;
        const currentSV = spaceValue(x, y, carrierCtx);

        let destX = x, destY = y;
        if (['pass', 'through_ball', 'switch'].includes(action)) {
            destX = Math.min(x + 15, PITCH_LENGTH);
            destY = action === 'switch' ? PITCH_WIDTH - y : y;
        } else if (['dribble', 'carry'].includes(action)) {
            destX = Math.min(x + 5, PITCH_LENGTH);
        } else if (action === 'shoot') {
            destX = PITCH_LENGTH; destY = PITCH_WIDTH / 2;
        } else if (['cross', 'cutback'].includes(action)) {
            destX = PITCH_LENGTH - 5; destY = PITCH_WIDTH / 2;
        } else if (action === 'long_ball') {
            destX = Math.min(x + 30, PITCH_LENGTH);
        } else { // recycle
            destX = Math.max(x - 10, 0);
        }

        const destSV = spaceValue(destX, destY, Object.assign({}, carrierCtx, { defenderCount: Math.max(0, (carrierCtx.defenderCount || 0) - 1) }));
        const progression = Math.max(0, (destX - x) / PITCH_LENGTH);
        const spaceGained = Math.max(0, destSV - currentSV);
        const chanceCreation = action === 'shoot' ? 1.0 : (['cross', 'cutback', 'through_ball'].includes(action) ? 0.6 : 0.2);
        const retentionTable = { recycle: 0.95, pass: 0.85, dribble: 0.7, carry: 0.8, cutback: 0.65, cross: 0.5, switch: 0.6, through_ball: 0.55, long_ball: 0.45, shoot: 0.3 };
        const possessionRetention = retentionTable[action] != null ? retentionTable[action] : 0.6;
        const risk = 1 - possessionRetention;
        const transitionDanger = ['long_ball', 'cross', 'shoot'].includes(action) ? 0.3 : 0.15;

        const value = 0.25 * progression + 0.20 * spaceGained + 0.20 * chanceCreation
                    + 0.15 * possessionRetention - 0.15 * risk - 0.05 * transitionDanger;

        return {
            action, tactical_action_value: Math.round(value * 1000) / 1000,
            progression: Math.round(progression * 1000) / 1000,
            space_gained: Math.round(spaceGained * 1000) / 1000,
            chance_creation: chanceCreation, possession_retention: possessionRetention,
            risk: Math.round(risk * 1000) / 1000, transition_danger: transitionDanger
        };
    }

    function rankActions(carrierCtx) {
        return ACTIONS.map(a => evaluateAction(a, carrierCtx)).sort((a, b) => b.tactical_action_value - a.tactical_action_value);
    }

    function explainRecommendation(carrierCtx) {
        const ranked = rankActions(carrierCtx);
        const [best, second] = ranked;
        const gap = best.tactical_action_value - second.tactical_action_value;
        const confidence = gap > 0.15 ? 'high' : gap > 0.08 ? 'medium-high' : gap > 0.03 ? 'medium' : 'low';
        return {
            recommendation: best.action,
            why: [
                `tactical_action_value=${best.tactical_action_value} (Class F, initial heuristic weights)`,
                `progression=${best.progression}, space_gained=${best.space_gained}, chance_creation=${best.chance_creation}`,
                `possession_retention=${best.possession_retention}, risk=${best.risk}`
            ],
            mechanism: 'Tactical Decision Engine Part BV/BW — Action Generator + Tactical Action Value',
            confidence, alternative: { action: second.action, tactical_action_value: second.tactical_action_value },
            ranked, source_class: 'G'
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. STAMINA / FATIGUE MODEL (ported from engine/stamina_model.py, KB Section 76)
    // ═══════════════════════════════════════════════════════════════════
    const FATIGUE_BANDS = [
        [20, 1.00, 1.00, 'fresh'],
        [40, 0.95, 0.98, 'light_fatigue'],
        [60, 0.85, 0.93, 'moderate_fatigue'],
        [80, 0.70, 0.85, 'heavy_fatigue'],
        [100, 0.55, 0.75, 'severe_fatigue']
    ];

    const POSITION_FATIGUE_RATE = {
        cb_stopper: 0.85, cb_ball_playing: 0.85, full_back: 1.05, wing_back: 1.10,
        central_midfielder: 1.10, box_to_box: 1.15, winger: 1.20, inside_forward: 1.15,
        target_man: 0.95, poacher: 1.00, goalkeeper: 0.30
    };

    function bandFor(fatiguePct) {
        for (const [upper, phys, mental, label] of FATIGUE_BANDS) {
            if (fatiguePct <= upper) return { upper, phys, mental, label };
        }
        return { upper: 100, phys: 0.55, mental: 0.75, label: 'severe_fatigue' };
    }

    /**
     * Integrates fatigue minute-by-minute up to `minute` (mirrors
     * advance_minute() in stamina_model.py, including the half-time partial
     * recovery at minute 46), returning the same shape of output the
     * Python model's FatigueState produces.
     */
    function computeFatigue(minute, baseStamina, position, activityIntensity) {
        activityIntensity = activityIntensity || (position === 'winger' ? 1.3 : 1.0);
        const staminaFactor = (100 - baseStamina) / 100;
        const positionFactor = POSITION_FATIGUE_RATE[position] != null ? POSITION_FATIGUE_RATE[position] : 1.0;
        const baseRatePerMinute = 0.75;

        let fatigue = 0;
        let halfTimeApplied = false;
        for (let m = 1; m <= minute; m++) {
            if (m === 46 && !halfTimeApplied) {
                fatigue = Math.max(0, fatigue - 15);
                halfTimeApplied = true;
            }
            const increment = baseRatePerMinute * (0.4 + staminaFactor) * positionFactor * activityIntensity;
            fatigue = Math.min(100, fatigue + increment);
        }

        const band = bandFor(fatigue);
        return {
            minute, base_stamina_attribute: baseStamina, position,
            current_fatigue_pct: Math.round(fatigue * 10) / 10,
            fatigue_band: band.label,
            physical_multiplier: band.phys,
            mental_technical_multiplier: band.mental,
            scanning_frequency_modifier: { fresh: 1.0, light_fatigue: 0.95, moderate_fatigue: 0.85, heavy_fatigue: 0.70, severe_fatigue: 0.55 }[band.label],
            substitution_advisory: fatigue >= 65,
            source_class: 'F'
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. DATASET LINKING — ACTIVE MASTER DATASET & CSV LOADER
    // ═══════════════════════════════════════════════════════════════════
    let datasetConfig = {
        type: 'local-json',
        path_or_url: 'tbe/rules/MASTER_RULES_AND_SCENARIOS.json'
    };
    let isDatasetLinked = false;
    let datasetMeta = null;

    const DATA_MODEL_TABLES = [
        'players', 'formations', 'team_shapes', 'movements', 'passes',
        'pressing', 'shots', 'transitions', 'events', 'player_tracking',
        'set_pieces', 'tactical_decisions', 'tactical_outcomes', 'tactical_states',
        'tactical_rules', 'battle_scenarios', 'tactical_causality_chains'
    ];

    function setDatasetSource(config) {
        if (typeof config === 'string') {
            datasetConfig.path_or_url = config;
        } else if (config && typeof config === 'object') {
            Object.assign(datasetConfig, config);
        }
    }

    function positionForZone(zone, positions) {
        const num = parseInt(String(zone || '').replace(/\D/g, ''), 10) || 15;
        if (num <= 3) return positions.find(p => p === 'GK') || 'GK';
        if (num <= 6) return positions.find(p => ['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(p)) || 'CB';
        if (num <= 18) {
            if (num % 3 === 1) return positions.find(p => ['LM', 'LW', 'LB'].includes(p)) || 'LM';
            if (num % 3 === 0) return positions.find(p => ['RM', 'RW', 'RB'].includes(p)) || 'RM';
            return positions.find(p => ['CM', 'CDM', 'CAM'].includes(p)) || 'CM';
        }
        if (num % 3 === 1) return positions.find(p => ['LW', 'LM'].includes(p)) || 'LW';
        if (num % 3 === 0) return positions.find(p => ['RW', 'RM'].includes(p)) || 'RW';
        return positions.find(p => ['ST', 'CF', 'CAM'].includes(p)) || 'ST';
    }

    async function loadDataset(url) {
        const targetUrl = url || datasetConfig.path_or_url;
        try {
            const resp = await fetch(targetUrl);
            if (!resp.ok) {
                console.warn(`TBE: Dataset HTTP response status ${resp.status}`);
                return false;
            }
            const data = await resp.json();
            datasetMeta = data.meta || { source: 'tbe/rules/MASTER_RULES_AND_SCENARIOS.json', version: '1.0' };

            // 1. Ingest Master Rules (1,240)
            if (Array.isArray(data.rules) && data.rules.length > 0) {
                rules.length = 0;
                data.rules.forEach(r => rules.push(r));
            }

            // 2. Ingest & Normalize Battle Scenarios (300)
            const rawScenarios = data.battle_scenarios || data.scenarios || [];
            if (Array.isArray(rawScenarios) && rawScenarios.length > 0) {
                scenarios.length = 0;
                rawScenarios.forEach((sc, idx) => {
                    const formation = sc.formation || sc.formation_a || choice(FORMATIONS, mulberry32(idx + 100));
                    const positions = getFormationPositions(formation);
                    const position = sc.position || positionForZone(sc.ball_zone, positions);
                    const slotIndex = positions.indexOf(position) >= 0 ? positions.indexOf(position) : (idx % positions.length);
                    const compatibleRoles = getRolesForPosition(position);
                    const role = sc.role_for_position || sc.role || compatibleRoles[idx % compatibleRoles.length];
                    const style = sc.style_for_position || sc.style_a || 'possession_football';

                    scenarios.push(Object.assign({}, sc, {
                        formation,
                        position,
                        position_slot: sc.position_slot || (slotIndex + 1),
                        style_for_position: style,
                        role_for_position: role,
                        game_state: sc.game_state || '0-0',
                        ball_zone: sc.ball_zone || 'Z14',
                        pressure_level: sc.pressure_level || 'medium',
                        space_value_estimate: sc.space_value_estimate != null ? sc.space_value_estimate : 0.45,
                        numerical_state: sc.numerical_state || 'even',
                        best_action_estimate: sc.best_action_estimate || 'pass',
                        opponent_response_estimate: sc.opponent_response_estimate || 'shift_across',
                        counter_estimate: sc.counter_estimate || 're-evaluate via counterfactual simulation',
                        outcome_estimate: sc.outcome_estimate || 'progression'
                    }));
                });
            }

            // 3. Ingest Causality Chains (300)
            const rawChains = data.tactical_causality_chains || data.causality_chains || data.chains || [];
            if (Array.isArray(rawChains) && rawChains.length > 0) {
                chains.length = 0;
                rawChains.forEach((ch, idx) => {
                    const formation = ch.context_formation || choice(FORMATIONS, mulberry32(idx + 200));
                    const pos = ch.context_position || positionForRole(ch.step_1_player_movement ? ch.step_1_player_movement.split(' ')[0] : 'CM');
                    chains.push(Object.assign({}, ch, {
                        context_formation: formation,
                        context_position: pos
                    }));
                });
            }

            isDatasetLinked = true;
            if (global.TBE && global.TBE.stats) {
                global.TBE.stats = { totalRules: rules.length, totalScenarios: scenarios.length, totalChains: chains.length };
            }
            return true;
        } catch (err) {
            console.warn("TBE: Running on procedural generators (dataset fetch bypassed or offline):", err);
            return false;
        }
    }

    async function loadDataModelTable(tableName) {
        let url = `tbe/data_model/${tableName}.csv`;
        if (['tactical_rules', 'battle_scenarios', 'tactical_causality_chains'].includes(tableName)) {
            url = `tbe/rules/csv/${tableName}.csv`;
        }
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const text = await resp.text();
            const lines = text.trim().split(/\r?\n/);
            if (lines.length === 0) return { tableName, headers: [], rows: [] };
            const headers = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim());
                const obj = {};
                headers.forEach((h, i) => { obj[h] = cols[i] != null ? cols[i] : ''; });
                return obj;
            });
            return { tableName, url, headers, rows, totalRows: rows.length };
        } catch (e) {
            console.warn(`Could not load CSV table ${tableName}:`, e);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. PUBLIC API — window.TBE
    // ═══════════════════════════════════════════════════════════════════
    global.TBE = {
        // datasets
        rules, scenarios, chains,
        ZONES, ROLES, FORMATIONS, STYLES,
        // position/formation model (new)
        FORMATION_POSITIONS, POSITION_ROLE_MAP, getFormationPositions, getRolesForPosition,
        // search / analyzer helpers
        searchRules, findMatchingPositionScenario,
        // decision engine
        spaceValue, pressureAt, pitchControlAt, rankActions, evaluateAction, explainRecommendation,
        // fatigue
        computeFatigue, FATIGUE_BANDS, POSITION_FATIGUE_RATE,
        // live dataset linking & 17 CSV tables
        loadDataset, setDatasetSource, loadDataModelTable, DATA_MODEL_TABLES,
        get isDatasetLinked() { return isDatasetLinked; },
        get datasetMeta() { return datasetMeta; },
        // meta
        stats: { totalRules: rules.length, totalScenarios: scenarios.length, totalChains: chains.length }
    };

})(typeof window !== 'undefined' ? window : globalThis);


/**
 * ─────────────────────────────────────────────────────────────────────────
 * TBE_UI — wires window.TBE into the "Battle Engine" page.
 * (Previously tbe_ui.js — now the second half of this combined file.)
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function humanize(s) { return String(s).replace(/_/g, ' '); }

    // ═══════════════════════════════════════════════════════════════════
    // 0. HEADER STAT PILLS + SUB-NAV TAB SWITCHING
    // ═══════════════════════════════════════════════════════════════════
    function initHeaderStats() {
        if (!window.TBE) return;
        const r = $('tbe-stat-rules'), s = $('tbe-stat-scen'), c = $('tbe-stat-chains');
        if (r) r.textContent = TBE.stats.totalRules.toLocaleString();
        if (s) s.textContent = TBE.stats.totalScenarios.toLocaleString();
        if (c) c.textContent = TBE.stats.totalChains.toLocaleString();
    }

    function initSubNav() {
        const buttons = document.querySelectorAll('.tbe-subtab-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tbe-tab-pane').forEach(p => p.classList.remove('active'));
                const target = $('tbe-pane-' + btn.dataset.tbeTab);
                if (target) target.classList.add('active');
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. DECISION ENGINE TAB (unchanged — no "team" concept here)
    // ═══════════════════════════════════════════════════════════════════
    function wireDecisionEngine() {
        const btn = $('tbe-run-engine-btn');
        if (!btn) return;

        function run() {
            const x = parseFloat($('tbe-carrier-x').value);
            const y = parseFloat($('tbe-carrier-y').value);
            const nearestDefenderDist = parseFloat($('tbe-pressure-dist').value);
            const defenderCount = parseInt($('tbe-def-count').value, 10);

            const pressure = TBE.pressureAt(null, { nearestDefenderDist, defenderCount });
            const ctx = { x, y, defenderCount, nearestDefenderDist, pressure, passingAccess: Math.max(0.2, 1 - defenderCount * 0.15) };

            const sv = TBE.spaceValue(x, y, ctx);
            const control = TBE.pitchControlAt(x, y, ctx);
            const rec = TBE.explainRecommendation(ctx);

            // Metric cards
            $('tbe-out-sv').textContent = sv.toFixed(3);
            $('tbe-out-pressure').textContent = Math.round(pressure * 100) + '%';
            const pbar = $('tbe-out-pressure-bar'); if (pbar) pbar.style.width = Math.round(pressure * 100) + '%';
            $('tbe-out-ctrl-a').textContent = Math.round(control.attacking_team * 100) + '%';
            $('tbe-out-ctrl-b').textContent = Math.round(control.defending_team * 100) + '%';

            // Explainable recommendation card
            const recCard = $('tbe-recommendation-card');
            if (recCard) {
                recCard.innerHTML = `
                    <div class="panel-title amber" style="margin-bottom:8px;">
                        <i class="fa-solid fa-bolt"></i> RECOMMENDATION: ${rec.recommendation.toUpperCase().replace(/_/g, ' ')}
                        <span style="margin-left:auto; font-size:9px; padding:2px 8px; border-radius:10px; background:rgba(139,92,246,0.15); color:var(--purple); border:1px solid rgba(139,92,246,0.3);">
                            CONFIDENCE: ${rec.confidence.toUpperCase()}
                        </span>
                    </div>
                    <div style="font-size:11px; color:var(--text2); line-height:1.7; margin-bottom:8px;">
                        ${rec.why.map(w => `<div>→ ${esc(w)}</div>`).join('')}
                    </div>
                    <div style="font-size:10px; color:var(--text3); border-top:1px solid var(--border); padding-top:8px;">
                        <strong style="color:var(--text2);">Mechanism:</strong> ${esc(rec.mechanism)}<br>
                        <strong style="color:var(--text2);">Alternative:</strong> ${esc(rec.alternative.action)} (value ${rec.alternative.tactical_action_value})
                    </div>`;
            }

            // Ranked action leaderboard table
            const tbody = $('tbe-actions-tbody');
            if (tbody) {
                tbody.innerHTML = rec.ranked.map((r, i) => `
                    <tr${i === 0 ? ' style="background:rgba(209,0,0,0.06);"' : ''}>
                        <td>${i + 1}</td>
                        <td style="font-weight:700; color:${i === 0 ? 'var(--amber)' : '#fff'};">${humanize(r.action)}</td>
                        <td>${r.tactical_action_value.toFixed(3)}</td>
                        <td>${r.progression.toFixed(2)}</td>
                        <td>${r.space_gained.toFixed(2)}</td>
                        <td>${r.chance_creation.toFixed(2)}</td>
                        <td>${(r.possession_retention * 100).toFixed(0)}%</td>
                        <td>${(r.risk * 100).toFixed(0)}%</td>
                    </tr>`).join('');
            }
        }

        btn.addEventListener('click', run);
        run(); // populate on first load with default slider values
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. BATTLE SCENARIOS TAB (300 procedurally generated)
    //    UPDATED: cards/filters now show formation + position + style
    //    instead of formation_a vs formation_b / style_a vs style_b.
    // ═══════════════════════════════════════════════════════════════════
    function scenarioCard(sc) {
        return `<div class="module-card" style="cursor:pointer;" onclick='TBE_UI.showScenarioDetail(${JSON.stringify(sc.scenario_id)})'>
            <div class="module-badge">${esc(sc.game_state.toUpperCase())}</div>
            <div class="module-name" style="font-size:12px;">${esc(sc.formation)} <span style="color:var(--text3);">·</span> ${esc(sc.position)}</div>
            <div class="module-desc">${humanize(sc.role_for_position)} — ${humanize(sc.style_for_position)} · Zone ${sc.ball_zone} · Pressure: ${sc.pressure_level}</div>
            <div style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
                <span class="tag amber">${sc.best_action_estimate.toUpperCase()}</span>
                <span class="tag blue">${sc.numerical_state.replace(/_/g, ' ')}</span>
                <span class="tag purple">${esc(sc.position)} SLOT ${sc.position_slot}</span>
            </div>
        </div>`;
    }

    function renderScenarios(filterText, filterForm, filterPosition, filterState) {
        const grid = $('tbe-scenarios-grid');
        if (!grid || !window.TBE) return;
        let list = TBE.scenarios;
        if (filterForm) list = list.filter(s => s.formation === filterForm);
        if (filterPosition) list = list.filter(s => s.position === filterPosition);
        if (filterState) list = list.filter(s => s.game_state === filterState);
        if (filterText) {
            const kw = filterText.toLowerCase();
            list = list.filter(s => (s.formation + ' ' + s.position + ' ' + s.style_for_position + ' ' + s.role_for_position + ' ' + s.game_state).toLowerCase().includes(kw));
        }
        $('tbe-scen-count').textContent = `Showing ${list.length} of ${TBE.scenarios.length} scenarios`;
        grid.innerHTML = list.slice(0, 60).map(scenarioCard).join('') ||
            `<div style="color:var(--text3); font-size:12px; padding:20px;">No scenarios match this filter.</div>`;
    }

    function wireScenarios() {
        const search = $('tbe-scen-search'), formSel = $('tbe-scen-form-a'), stateSel = $('tbe-scen-state');
        // NEW, OPTIONAL: a "Position" filter. Add <select id="tbe-scen-position"></select>
        // next to the existing formation/game-state filters in the host page's HTML to
        // enable it — this degrades gracefully (falls back to "all positions") if that
        // element isn't present yet.
        const posSel = $('tbe-scen-position');
        if (!search) return;

        function refreshPositionOptions() {
            if (!posSel) return;
            const formation = formSel ? formSel.value : '';
            const positions = formation
                ? [...new Set(TBE.getFormationPositions(formation))]
                : [...new Set(Object.values(TBE.FORMATION_POSITIONS).flat())].sort();
            const current = posSel.value;
            posSel.innerHTML = '<option value="">ALL POSITIONS</option>' + positions.map(p => `<option value="${p}">${p}</option>`).join('');
            if (positions.includes(current)) posSel.value = current;
        }

        const update = () => renderScenarios(search.value, formSel ? formSel.value : '', posSel ? posSel.value : '', stateSel ? stateSel.value : '');
        search.addEventListener('input', update);
        if (formSel) formSel.addEventListener('change', () => { refreshPositionOptions(); update(); });
        if (posSel) posSel.addEventListener('change', update);
        if (stateSel) stateSel.addEventListener('change', update);
        refreshPositionOptions();
        update();
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. CAUSALITY CHAINS TAB (300 procedurally generated, 7-step timeline)
    //    UPDATED: shows the derived context_position alongside context_formation.
    // ═══════════════════════════════════════════════════════════════════
    function chainSteps(ch) {
        return [
            ['1 · PLAYER/MOVEMENT', ch.step_1_player_movement],
            ['2 · SPACE', ch.step_2_space],
            ['3 · OPPONENT RESPONSE', humanize(ch.step_3_opponent_response)],
            ['4 · TEAM ADAPTATION', ch.step_4_team_adaptation],
            ['5 · SECOND OPPONENT RESPONSE', humanize(ch.step_5_second_opponent_response)],
            ['6 · COUNTER', ch.step_6_counter],
            ['7 · OUTCOME', humanize(ch.step_7_outcome)],
        ];
    }

    function renderChainVisualizer(chain) {
        const el = $('tbe-chain-visualizer');
        if (!el) return;
        if (!chain) { el.innerHTML = ''; return; }
        el.innerHTML = `
            <div class="panel accent-purple" style="margin-bottom:12px;">
                <div class="panel-title purple">${esc(chain.chain_id)} — ${humanize(chain.mechanism).toUpperCase()}</div>
                <div style="font-size:10px; color:var(--text3);">Context formation: ${esc(chain.context_formation)} · Position: ${esc(chain.context_position)}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0;">
                ${chainSteps(chain).map(([label, text], i) => `
                    <div style="display:flex; gap:14px; padding:10px 0; border-bottom:1px solid var(--border);">
                        <div style="min-width:170px; font-family:var(--fm); font-size:8px; color:var(--purple); padding-top:2px;">${label}</div>
                        <div style="flex:1; font-size:12px; color:var(--text2); line-height:1.5;">${esc(text)}</div>
                    </div>`).join('')}
            </div>`;
    }

    function wireChains() {
        const select = $('tbe-chain-select');
        if (!select || !window.TBE) return;
        select.innerHTML = TBE.chains.slice(0, 300).map(ch =>
            `<option value="${ch.chain_id}">${ch.chain_id} — ${humanize(ch.mechanism)} (${ch.context_formation} · ${ch.context_position})</option>`
        ).join('');
        select.addEventListener('change', () => {
            const chain = TBE.chains.find(c => c.chain_id === select.value);
            renderChainVisualizer(chain);
        });
        // Show the first chain by default
        if (TBE.chains.length) { select.value = TBE.chains[0].chain_id; renderChainVisualizer(TBE.chains[0]); }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. RULES DATABASE TAB (1,240 procedurally generated — unchanged)
    // ═══════════════════════════════════════════════════════════════════
    function ruleCard(r) {
        return `<div class="module-card" style="cursor:default;">
            <div class="module-badge">${esc(r.rule_id)}</div>
            <div class="module-name" style="font-size:12px;">${humanize(r.actor)} → ${humanize(r.action)}</div>
            <div class="module-desc">${esc(r.purpose)}</div>
            <div style="margin-top:6px; font-size:9px; color:var(--text3);">
                Trigger: ${humanize(r.trigger)} · Target: ${r.target}
            </div>
        </div>`;
    }

    function renderRules(filterText, category) {
        const grid = $('tbe-rules-grid');
        if (!grid || !window.TBE) return;
        const familyMap = {
            MOVEMENT: r => r.rule_id.startsWith('MV'),
            MANIPULATION_CHAINS: r => r.rule_id.startsWith('CC'),
            PRESSING_TRIGGERS: r => r.rule_id.startsWith('PT'),
            THIRD_MAN: r => r.rule_id.startsWith('TM'),
            OVERLOAD_ISOLATION: r => r.rule_id.startsWith('OI'),
            SUCCESS_PATTERNS: r => r.rule_id.startsWith('SC'),
            FAILURE_PATTERNS: r => r.rule_id.startsWith('FL'),
        };
        let list = TBE.rules;
        if (category && category !== 'ALL' && familyMap[category]) list = list.filter(familyMap[category]);
        if (filterText) {
            const kw = filterText.toLowerCase();
            list = list.filter(r => (r.trigger + ' ' + r.actor + ' ' + r.action + ' ' + r.target + ' ' + r.purpose).toLowerCase().includes(kw));
        }
        $('tbe-rules-count').textContent = `Showing ${Math.min(list.length, 60)} of ${list.length} matching rules (${TBE.rules.length} total)`;
        grid.innerHTML = list.slice(0, 60).map(ruleCard).join('') ||
            `<div style="color:var(--text3); font-size:12px; padding:20px;">No rules match this filter.</div>`;
    }

    function wireRules() {
        const search = $('tbe-rule-search'), category = $('tbe-rule-category');
        if (!search) return;
        const update = () => renderRules(search.value, category.value);
        search.addEventListener('input', update);
        category.addEventListener('change', update);
        update();
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. STAMINA & FATIGUE TAB (unchanged — already position-based, no "team")
    // ═══════════════════════════════════════════════════════════════════
    function wireFatigue() {
        const minSlider = $('tbe-fatigue-min'), posSel = $('tbe-fatigue-pos'), stamSlider = $('tbe-fatigue-stamina');
        if (!minSlider) return;

        function run() {
            const minute = parseInt(minSlider.value, 10);
            const position = posSel.value;
            const stamina = parseInt(stamSlider.value, 10);

            $('tbe-fatigue-min-val').textContent = minute + "' min";
            $('tbe-fatigue-stam-val').textContent = stamina;

            const result = TBE.computeFatigue(minute, stamina, position);

            $('tbe-fatigue-pct-display').textContent = result.current_fatigue_pct.toFixed(1) + '%';
            $('tbe-fatigue-band-display').textContent = humanize(result.fatigue_band).toUpperCase();
            $('tbe-fatigue-meter-fill').style.width = result.current_fatigue_pct + '%';

            const bandColor = { fresh: 'var(--accent-green, #10b981)', light_fatigue: '#a3e635', moderate_fatigue: 'var(--amber)', heavy_fatigue: '#f97316', severe_fatigue: 'var(--red)' }[result.fatigue_band];
            $('tbe-fatigue-band-display').style.color = bandColor;
            $('tbe-fatigue-meter-fill').style.background = bandColor;

            $('tbe-speed-mod').textContent = Math.round(result.physical_multiplier * 100) + '%';
            $('tbe-scan-mod').textContent = Math.round(result.mental_technical_multiplier * 100) + '%';

            const alert = $('tbe-sub-alert');
            if (alert) alert.style.display = result.substitution_advisory ? 'flex' : 'none';
        }

        minSlider.addEventListener('input', run);
        posSel.addEventListener('change', run);
        stamSlider.addEventListener('input', run);
        run();
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. DETAIL MODAL (used by scenario cards — unchanged; it just dumps
    //    Object.entries(sc), so the new formation/position/style fields
    //    show up automatically with no extra code needed here)
    // ═══════════════════════════════════════════════════════════════════
    function showScenarioDetail(scenarioId) {
        const sc = TBE.scenarios.find(s => s.scenario_id === scenarioId);
        if (!sc) return;
        $('tbe-modal-title').textContent = `Scenario ${sc.scenario_id}`;
        $('tbe-modal-body').innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; color:var(--text2);">
                ${Object.entries(sc).map(([k, v]) => `<div><strong style="color:var(--text3);">${humanize(k)}:</strong> ${Array.isArray(v) ? v.join(', ') : v}</div>`).join('')}
            </div>`;
        $('tbe-detail-modal').classList.add('active');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. TACTICS BOARD EVALUATION BRIDGE
    // ═══════════════════════════════════════════════════════════════════
    function setupTacticsBoardBridge() {
        window.evaluateBoardWithTBE = function () {
            if (!window.state || !window.state.players) {
                alert("Please add players and a ball to the board first!");
                return;
            }
            const players = window.state.players;
            if (players.length < 2) {
                alert("Add at least 2 players to evaluate with TBE.");
                return;
            }
            const ball = players.find(p => p.type === 'ball') || players[0];
            const activePlayers = players.filter(p => p.type === 'blue' || p.type === 'red');
            if (activePlayers.length === 0) return;

            let carrier = activePlayers[0];
            let minDist = Infinity;
            activePlayers.forEach(p => {
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (d < minDist) { minDist = d; carrier = p; }
            });

            // Convert canvas coordinates (800x550) to pitch meters (105m x 68m)
            const cx = (carrier.x / 800) * 105.0;
            const cy = (carrier.y / 550) * 68.0;
            const defenders = activePlayers.filter(p => p.type !== carrier.type);
            let nearestDist = 15;
            let defCount = 0;
            defenders.forEach(d => {
                const dx = (d.x / 800) * 105.0;
                const dy = (d.y / 550) * 68.0;
                const distM = Math.hypot(dx - cx, dy - cy);
                if (distM < nearestDist) nearestDist = distM;
                if (distM <= 8.0) defCount++;
            });
            nearestDist = Math.max(1.0, Math.min(15.0, nearestDist));
            defCount = Math.max(1, defCount);

            const pressure = TBE.pressureAt(null, { nearestDefenderDist: nearestDist, defenderCount: defCount });
            const ctx = {
                x: cx,
                y: cy,
                defenderCount: defCount,
                nearestDefenderDist: nearestDist,
                pressure,
                passingAccess: Math.max(0.2, 1 - defCount * 0.15)
            };
            const rec = TBE.explainRecommendation(ctx);
            const sv = TBE.spaceValue(cx, cy, ctx);

            const insp = document.getElementById('inspectorPanel');
            if (insp) insp.style.display = 'flex';

            let resultContainer = document.getElementById('board-tbe-result-box');
            if (!resultContainer && insp) {
                resultContainer = document.createElement('div');
                resultContainer.id = 'board-tbe-result-box';
                resultContainer.style.cssText = 'margin-top:12px; padding:10px; border-radius:6px; background:rgba(0,0,0,0.4); border:1px solid var(--accent-green, #10b981);';
                insp.appendChild(resultContainer);
            }
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div style="font-size:11px; font-weight:700; color:var(--accent-green, #10b981); display:flex; justify-content:space-between;">
                        <span><i class="fa-solid fa-bolt"></i> TBE ENGINE: ${esc(carrier.label || 'CARRIER')}</span>
                        <span>CONF: ${rec.confidence.toUpperCase()}</span>
                    </div>
                    <div style="font-size:12px; margin:6px 0; color:#fff;">
                        REC: <strong style="color:var(--accent-green, #10b981);">${rec.recommendation.toUpperCase().replace(/_/g, ' ')}</strong> (TAV: ${rec.ranked[0].tactical_action_value})
                    </div>
                    <div style="font-size:10px; color:var(--text2); display:flex; gap:10px; margin-bottom:6px;">
                        <span>Pressure: <strong>${Math.round(pressure * 100)}%</strong></span>
                        <span>Space Val: <strong>${sv.toFixed(3)}</strong></span>
                        <span>Alt: <strong>${rec.alternative.action.toUpperCase()}</strong></span>
                    </div>
                    <div style="font-size:10px; color:var(--text3); border-top:1px solid rgba(255,255,255,0.08); padding-top:4px;">
                        ${esc(rec.why[0])}
                    </div>
                `;
                resultContainer.style.display = 'block';
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7b. DATA MODEL CSV EXPLORER (17 tables from tbe/data_model/ & tbe/rules/csv/)
    // ═══════════════════════════════════════════════════════════════════
    let currentTableData = null;
    async function wireDataModel() {
        const select = $('tbe-csv-table-select');
        const search = $('tbe-csv-search');
        const count = $('tbe-csv-count');
        const thead = $('tbe-csv-thead');
        const tbody = $('tbe-csv-tbody');
        if (!select || !thead || !tbody) return;

        async function loadAndRender(tableName) {
            if (count) count.textContent = `Loading ${tableName}.csv...`;
            const data = await TBE.loadDataModelTable(tableName);
            currentTableData = data;
            if (!data || !data.headers || data.headers.length === 0) {
                if (count) count.textContent = `Empty or missing table: ${tableName}.csv`;
                thead.innerHTML = '';
                tbody.innerHTML = `<tr><td style="color:var(--text3); padding:20px;">No rows available for ${esc(tableName)}.csv</td></tr>`;
                return;
            }
            renderTableRows(search ? search.value : '');
        }

        function renderTableRows(filterText) {
            if (!currentTableData) return;
            const kw = (filterText || '').toLowerCase();
            let rows = currentTableData.rows;
            if (kw) {
                rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(kw)));
            }
            if (count) count.textContent = `Showing ${Math.min(rows.length, 100)} of ${currentTableData.rows.length} rows (${currentTableData.tableName}.csv)`;

            thead.innerHTML = `<tr>${currentTableData.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
            tbody.innerHTML = rows.slice(0, 100).map(r => `
                <tr>${currentTableData.headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>
            `).join('') || `<tr><td colspan="${currentTableData.headers.length}" style="color:var(--text3); padding:20px;">No rows match filter "${esc(kw)}".</td></tr>`;
        }

        select.addEventListener('change', () => loadAndRender(select.value));
        if (search) search.addEventListener('input', () => renderTableRows(search.value));
        loadAndRender(select.value);
    }

    function updateDatasetLinkedUI() {
        const pill = $('tbe-live-dataset-pill');
        if (pill) {
            pill.style.display = 'inline-flex';
            pill.innerHTML = '<i class="fa-solid fa-circle-check"></i> LIVE MASTER DATASET LINKED';
        }
        const title = $('tbe-engine-status-title');
        if (title) title.textContent = 'ENGINE STATUS: LIVE MASTER DATASET LINKED (ONLINE)';
        const sub = $('tbe-engine-status-sub');
        if (sub) sub.textContent = 'Source: MASTER_RULES_AND_SCENARIOS.json (1,240 Rules • 300 Scenarios • 300 Chains)';
    }

    // ═══════════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════════
    let isInitialized = false;
    async function init() {
        if (isInitialized) return;
        if (!window.TBE) { console.warn('TBE engine not loaded; Battle Engine page will not function.'); return; }
        isInitialized = true;
        initHeaderStats();
        initSubNav();
        wireDecisionEngine();
        wireScenarios();
        wireChains();
        wireRules();
        wireFatigue();
        wireDataModel();
        setupTacticsBoardBridge();

        // Asynchronously load and link master dataset
        if (TBE.loadDataset) {
            const ok = await TBE.loadDataset();
            if (ok) {
                initHeaderStats();
                wireScenarios();
                wireChains();
                wireRules();
                updateDatasetLinkedUI();
            }
        }
    }

    const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
    root.TBE_UI = { init, showScenarioDetail, setupTacticsBoardBridge, wireDataModel };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => TBE_UI.init());
        } else {
            setTimeout(() => TBE_UI.init(), 100);
        }
    }
})();
