/**
 * tbe_ui.js
 * Tactical Battle Engine (TBE) - UI Controllers, Renderers & Matchup Bridge
 */

const TBE_UI = (function() {
    let currentSubtab = 'engine';
    let selectedScenario = null;
    let selectedChain = null;
    let isInitialized = false;

    // ---------------------------------------------------------------------------
    // 1. Initialization
    // ---------------------------------------------------------------------------
    async function init() {
        if (isInitialized) return;
        isInitialized = true;
        console.log("⚡ Initializing TBE UI Controllers...");
        await TBE.loadMasterData();

        setupSubtabNavigation();
        setupDecisionEngineUI();
        setupScenariosUI();
        setupCausalityUI();
        setupRulesUI();
        setupFatigueUI();
        setupTacticsBoardBridge();

        // Update dashboard counters if element exists
        updateDashboardTBEWidget();
    }

    function updateDashboardTBEWidget() {
        const data = TBE.getData();
        const statEl = document.getElementById('tbe-stat-counter');
        if (statEl) {
            statEl.textContent = `${data.rules?.length || 1240} Rules • ${data.battle_scenarios?.length || 300} Scenarios`;
        }
    }

    // ---------------------------------------------------------------------------
    // 2. Subtab Navigation
    // ---------------------------------------------------------------------------
    function setupSubtabNavigation() {
        const btns = document.querySelectorAll('.tbe-subtab-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tbe-tab');
                switchSubtab(target);
            });
        });
    }

    function switchSubtab(tabName) {
        currentSubtab = tabName;
        document.querySelectorAll('.tbe-subtab-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-tbe-tab') === tabName);
        });
        document.querySelectorAll('.tbe-tab-pane').forEach(p => {
            p.classList.toggle('active', p.id === `tbe-pane-${tabName}`);
        });

        if (tabName === 'scenarios') renderScenariosList();
        if (tabName === 'causality') renderCausalityChains();
        if (tabName === 'rules') renderRulesList();
    }

    // ---------------------------------------------------------------------------
    // 3. Decision Engine Simulation UI
    // ---------------------------------------------------------------------------
    function setupDecisionEngineUI() {
        const runBtn = document.getElementById('tbe-run-engine-btn');
        if (!runBtn) return;

        runBtn.addEventListener('click', runEngineSimulation);

        // Run an initial simulation on load
        setTimeout(runEngineSimulation, 300);
    }

    function runEngineSimulation() {
        const carrierX = parseFloat(document.getElementById('tbe-carrier-x')?.value || 55);
        const carrierY = parseFloat(document.getElementById('tbe-carrier-y')?.value || 34);
        const pressureDist = parseFloat(document.getElementById('tbe-pressure-dist')?.value || 4.5);
        const defCount = parseInt(document.getElementById('tbe-def-count')?.value || 3);

        // Construct a synthetic MatchMoment based on inputs
        const carrier = {
            player_id: "p_carrier",
            team_id: "A",
            role: "attacking_midfielder",
            x: carrierX,
            y: carrierY,
            speed_mps: 4.2
        };

        const players = [
            carrier,
            { player_id: "p_a2", team_id: "A", role: "winger_left", x: Math.min(carrierX + 12, 100), y: 12, speed_mps: 4.5 },
            { player_id: "p_a3", team_id: "A", role: "striker", x: Math.min(carrierX + 22, 102), y: 34, speed_mps: 4.8 },
            { player_id: "p_a4", team_id: "A", role: "winger_right", x: Math.min(carrierX + 14, 100), y: 56, speed_mps: 4.5 },
            // Defenders
            { player_id: "p_b_press", team_id: "B", role: "central_midfielder", x: carrierX + pressureDist * 0.8, y: carrierY + pressureDist * 0.6, speed_mps: 3.8 }
        ];

        for (let i = 1; i <= defCount; i++) {
            players.push({
                player_id: `p_b_def_${i}`,
                team_id: "B",
                role: "centre_back",
                x: Math.min(carrierX + 10 + i * 4, 103),
                y: 20 + i * 10,
                speed_mps: 3.6
            });
        }

        const moment = {
            ball_x: carrierX,
            ball_y: carrierY,
            possession_team_id: "A",
            players: players,
            phase: "attacking_organisation"
        };

        // Run models
        const sv = TBE.spaceValue(carrierX, carrierY, moment);
        const pressure = TBE.pressureOnPlayer(carrier, moment);
        const control = TBE.pitchControlAt(carrierX, carrierY, moment);
        const rec = TBE.explainRecommendation(carrier, moment);
        const shapeA = TBE.detectTeamShape("A", moment);
        const shapeB = TBE.detectTeamShape("B", moment);

        // Render Outputs
        const svEl = document.getElementById('tbe-out-sv');
        const pressEl = document.getElementById('tbe-out-pressure');
        const pressBar = document.getElementById('tbe-out-pressure-bar');
        const ctrlAEl = document.getElementById('tbe-out-ctrl-a');
        const ctrlBEl = document.getElementById('tbe-out-ctrl-b');

        if (svEl) svEl.textContent = sv.toFixed(3);
        if (pressEl) pressEl.textContent = `${Math.round(pressure * 100)}%`;
        if (pressBar) pressBar.style.width = `${Math.min(100, Math.round(pressure * 100))}%`;
        if (ctrlAEl) ctrlAEl.textContent = `${Math.round((control.A || 0.5) * 100)}%`;
        if (ctrlBEl) ctrlBEl.textContent = `${Math.round((control.B || 0.5) * 100)}%`;

        // Render recommendation card
        const recEl = document.getElementById('tbe-recommendation-card');
        if (recEl) {
            recEl.innerHTML = `
                <div class="tbe-rec-header">
                    <div class="tbe-rec-badge ${rec.confidence}">
                        <i class="fa-solid fa-bolt"></i> OPTIMAL ACTION: ${rec.recommendation.toUpperCase().replace('_', ' ')}
                    </div>
                    <div class="tbe-rec-conf">Confidence: <strong>${rec.confidence.toUpperCase()}</strong> (${rec.source_class})</div>
                </div>
                <div class="tbe-rec-body">
                    <ul class="tbe-rec-why">
                        ${rec.why.map(w => `<li><i class="fa-solid fa-check text-green"></i> ${w}</li>`).join('')}
                    </ul>
                    <div class="tbe-rec-alt">
                        <span class="text-muted">Primary Alternative:</span> 
                        <strong>${rec.alternative.action.toUpperCase()}</strong> (Val: ${rec.alternative.tactical_action_value})
                    </div>
                </div>
            `;
        }

        // Render Action Ranking Table
        const tableBody = document.getElementById('tbe-actions-tbody');
        if (tableBody) {
            tableBody.innerHTML = rec.ranked_actions.map((act, idx) => {
                const isTop = idx === 0;
                return `
                    <tr class="${isTop ? 'highlight-row' : ''}">
                        <td><strong>#${idx + 1}</strong></td>
                        <td><span class="action-tag ${act.action}">${act.action.toUpperCase()}</span></td>
                        <td><strong class="text-accent">${act.tactical_action_value}</strong></td>
                        <td>${act.progression}</td>
                        <td>${act.space_gained}</td>
                        <td>${act.chance_creation}</td>
                        <td>${Math.round(act.possession_retention * 100)}%</td>
                        <td><span class="risk-badge ${act.risk > 0.4 ? 'high' : 'low'}">${act.risk}</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // ---------------------------------------------------------------------------
    // 4. Battle Scenarios Explorer (300 Scenarios)
    // ---------------------------------------------------------------------------
    function setupScenariosUI() {
        const filterFormA = document.getElementById('tbe-scen-form-a');
        const filterStyleA = document.getElementById('tbe-scen-style-a');
        const filterGameState = document.getElementById('tbe-scen-state');
        const searchInput = document.getElementById('tbe-scen-search');

        [filterFormA, filterStyleA, filterGameState].forEach(el => {
            if (el) el.addEventListener('change', renderScenariosList);
        });
        if (searchInput) {
            searchInput.addEventListener('input', renderScenariosList);
        }
    }

    function renderScenariosList() {
        const container = document.getElementById('tbe-scenarios-grid');
        if (!container) return;

        const formA = document.getElementById('tbe-scen-form-a')?.value || '';
        const styleA = document.getElementById('tbe-scen-style-a')?.value || '';
        const gameState = document.getElementById('tbe-scen-state')?.value || '';
        const search = document.getElementById('tbe-scen-search')?.value?.toLowerCase() || '';

        const filters = {};
        if (formA) filters.formation_a = formA;
        if (styleA) filters.style_a = styleA;
        if (gameState) filters.game_state = gameState;

        let scenarios = TBE.filterScenarios(filters, 100);

        if (search) {
            scenarios = scenarios.filter(s => 
                s.scenario_id.toLowerCase().includes(search) ||
                s.formation_a.toLowerCase().includes(search) ||
                s.formation_b.toLowerCase().includes(search) ||
                s.style_a.toLowerCase().includes(search) ||
                s.style_b.toLowerCase().includes(search) ||
                s.best_action_estimate.toLowerCase().includes(search)
            );
        }

        const countEl = document.getElementById('tbe-scen-count');
        if (countEl) countEl.textContent = `Showing ${scenarios.length} scenarios`;

        if (scenarios.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
                    No battle scenarios matching current filters.
                </div>
            `;
            return;
        }

        container.innerHTML = scenarios.map(s => `
            <div class="tbe-card scenario-card" onclick="TBE_UI.openScenarioModal('${s.scenario_id}')">
                <div class="tbe-card-header">
                    <span class="scen-id">${s.scenario_id}</span>
                    <span class="scen-state-pill ${s.game_state}">${s.game_state.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div class="scen-matchup">
                    <span class="team-badge home">${s.formation_a} (${s.style_a.replace('_', ' ')})</span>
                    <span class="vs">vs</span>
                    <span class="team-badge away">${s.formation_b} (${s.style_b.replace('_', ' ')})</span>
                </div>
                <div class="scen-metrics">
                    <div><span>Ball Zone:</span> <strong>${s.ball_zone}</strong></div>
                    <div><span>Pressure:</span> <strong class="text-${s.pressure_level === 'high' ? 'red' : 'green'}">${s.pressure_level.toUpperCase()}</strong></div>
                    <div><span>Space Value:</span> <strong>${s.space_value_estimate}</strong></div>
                    <div><span>Numerical:</span> <strong>${s.numerical_state.replace('_', ' ')}</strong></div>
                </div>
                <div class="scen-footer">
                    <div class="scen-best-action">
                        <i class="fa-solid fa-bullseye text-accent"></i> Best Action: <strong>${s.best_action_estimate.toUpperCase()}</strong>
                    </div>
                    <div class="scen-outcome">
                        Outcome: <em>${s.outcome_estimate}</em>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function openScenarioModal(scenarioId) {
        const scenario = TBE.getData().battle_scenarios?.find(s => s.scenario_id === scenarioId);
        if (!scenario) return;

        const modal = document.getElementById('tbe-detail-modal');
        const title = document.getElementById('tbe-modal-title');
        const body = document.getElementById('tbe-modal-body');
        if (!modal || !title || !body) return;

        title.innerHTML = `<i class="fa-solid fa-crosshairs text-accent"></i> BATTLE SCENARIO ${scenario.scenario_id}`;
        body.innerHTML = `
            <div class="tbe-modal-grid">
                <div class="modal-section">
                    <h4>Tactical Matchup</h4>
                    <p><strong>Team A:</strong> Formation ${scenario.formation_a}, Style ${scenario.style_a}, Shape ${scenario.team_shape_a}</p>
                    <p><strong>Team B:</strong> Formation ${scenario.formation_b}, Style ${scenario.style_b}, Shape ${scenario.opponent_shape_b}</p>
                    <p><strong>Game State:</strong> <span class="scen-state-pill">${scenario.game_state}</span></p>
                </div>
                <div class="modal-section">
                    <h4>Spatial & Kinetic Situation</h4>
                    <p><strong>Ball Zone:</strong> ${scenario.ball_zone}</p>
                    <p><strong>Pressure Level:</strong> ${scenario.pressure_level}</p>
                    <p><strong>Space Value Estimate:</strong> ${scenario.space_value_estimate}</p>
                    <p><strong>Numerical State:</strong> ${scenario.numerical_state}</p>
                </div>
                <div class="modal-section" style="grid-column: 1/-1;">
                    <h4>Decision Engine Projection</h4>
                    <p><strong>Available Actions:</strong> ${scenario.available_actions.join(', ')}</p>
                    <p><strong>Best Action Estimate:</strong> <span class="text-accent font-weight-bold">${scenario.best_action_estimate.toUpperCase()}</span></p>
                    <p><strong>Anticipated Opponent Response:</strong> ${scenario.opponent_response_estimate}</p>
                    <p><strong>Counter-Tactic:</strong> ${scenario.counter_estimate}</p>
                    <p><strong>Outcome Projection:</strong> ${scenario.outcome_estimate}</p>
                </div>
            </div>
        `;
        modal.classList.add('active');
    }

    // ---------------------------------------------------------------------------
    // 5. Tactical Causality Chains (300 Chains)
    // ---------------------------------------------------------------------------
    function setupCausalityUI() {
        const selector = document.getElementById('tbe-chain-select');
        if (selector) {
            selector.addEventListener('change', (e) => {
                renderChainDetail(e.target.value);
            });
        }
    }

    function renderCausalityChains() {
        const selector = document.getElementById('tbe-chain-select');
        const chains = TBE.getData().tactical_causality_chains || [];
        if (!selector || chains.length === 0) return;

        if (selector.options.length <= 1) {
            selector.innerHTML = chains.map(c => 
                `<option value="${c.chain_id}">${c.chain_id} - ${c.mechanism.replace(/_/g, ' ')} (${c.context_formation})</option>`
            ).join('');
        }

        renderChainDetail(selector.value || chains[0]?.chain_id);
    }

    function renderChainDetail(chainId) {
        const chain = TBE.getData().tactical_causality_chains?.find(c => c.chain_id === chainId);
        const container = document.getElementById('tbe-chain-visualizer');
        if (!chain || !container) return;

        const steps = [
            { num: 1, title: "1. Initial Movement", icon: "fa-person-running", text: chain.step_1_player_movement },
            { num: 2, title: "2. Spatial Distortion", icon: "fa-vector-square", text: chain.step_2_space },
            { num: 3, title: "3. Opponent Response", icon: "fa-arrows-split-up-and-left", text: chain.step_3_opponent_response },
            { num: 4, title: "4. Team Adaptation", icon: "fa-users-gear", text: chain.step_4_team_adaptation },
            { num: 5, title: "5. Second Response", icon: "fa-shield", text: chain.step_5_second_opponent_response },
            { num: 6, title: "6. Counter-Play", icon: "fa-bolt-lightning", text: chain.step_6_counter },
            { num: 7, title: "7. Tactical Outcome", icon: "fa-flag-checkered", text: chain.step_7_outcome }
        ];

        container.innerHTML = `
            <div class="chain-header-card">
                <div>
                    <span class="scen-id">${chain.chain_id}</span>
                    <h3 style="margin: 4px 0 2px;">Mechanism: ${chain.mechanism.replace(/_/g, ' ').toUpperCase()}</h3>
                    <div style="font-size: 11px; color: var(--text-secondary);">Formation Context: <strong>${chain.context_formation}</strong> • Source: Class ${chain.source_class} • Ref: ${chain.reference || 'core KB'}</div>
                </div>
            </div>
            <div class="causality-timeline">
                ${steps.map((s, idx) => `
                    <div class="timeline-step">
                        <div class="step-badge">${s.num}</div>
                        <div class="step-card">
                            <div class="step-title"><i class="fa-solid ${s.icon} text-accent"></i> ${s.title}</div>
                            <div class="step-desc">${s.text}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ---------------------------------------------------------------------------
    // 6. Rules Knowledge Base (1,240 Rules)
    // ---------------------------------------------------------------------------
    function setupRulesUI() {
        const searchInput = document.getElementById('tbe-rule-search');
        const catSelect = document.getElementById('tbe-rule-category');

        if (searchInput) searchInput.addEventListener('input', renderRulesList);
        if (catSelect) catSelect.addEventListener('change', renderRulesList);
    }

    function renderRulesList() {
        const container = document.getElementById('tbe-rules-grid');
        if (!container) return;

        const query = document.getElementById('tbe-rule-search')?.value || '';
        const cat = document.getElementById('tbe-rule-category')?.value || 'ALL';

        const rules = TBE.searchRules(query, cat, 40);
        const countEl = document.getElementById('tbe-rules-count');
        if (countEl) countEl.textContent = `Displaying ${rules.length} of ${TBE.getData().rules?.length || 1240} rules`;

        if (rules.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No tactical rules found.</div>`;
            return;
        }

        container.innerHTML = rules.map(r => `
            <div class="tbe-card rule-card">
                <div class="tbe-card-header">
                    <span class="scen-id">${r.rule_id}</span>
                    <span class="scen-state-pill ${r.category}">${r.category}</span>
                </div>
                <div style="margin: 6px 0;">
                    <strong style="color: #fff; font-size: 13px;">${r.actor?.toUpperCase()}</strong> → <span class="text-accent">${r.action?.replace(/_/g, ' ')}</span>
                </div>
                <div class="scen-metrics" style="grid-template-columns: 1fr 1fr; font-size: 11px;">
                    <div><span>Trigger:</span> <strong>${r.trigger?.replace(/_/g, ' ') || 'N/A'}</strong></div>
                    <div><span>Target Zone:</span> <strong>${r.target || 'N/A'}</strong></div>
                    <div><span>Phase:</span> <strong>${r.phase?.replace(/_/g, ' ') || 'All'}</strong></div>
                    <div><span>Confidence:</span> <strong>${r.confidence || 'medium'}</strong></div>
                </div>
                <div style="font-size: 11px; margin-top: 8px; color: var(--text2);">
                    <strong>Purpose:</strong> ${r.purpose || r.expected_result || 'Tactical exploitation'}
                </div>
                ${r.risk ? `<div style="font-size: 10px; margin-top: 4px; color: var(--red);"><strong>Risk:</strong> ${r.risk}</div>` : ''}
            </div>
        `).join('');
    }

    // ---------------------------------------------------------------------------
    // 7. Stamina & Fatigue UI
    // ---------------------------------------------------------------------------
    function setupFatigueUI() {
        const minSlider = document.getElementById('tbe-fatigue-min');
        const posSelect = document.getElementById('tbe-fatigue-pos');
        const stamSlider = document.getElementById('tbe-fatigue-stamina');

        [minSlider, posSelect, stamSlider].forEach(el => {
            if (el) el.addEventListener('input', updateFatigueUI);
        });

        updateFatigueUI();
    }

    function updateFatigueUI() {
        const minute = parseInt(document.getElementById('tbe-fatigue-min')?.value || 70);
        const position = document.getElementById('tbe-fatigue-pos')?.value || "winger";
        const stamina = parseInt(document.getElementById('tbe-fatigue-stamina')?.value || 75);

        document.getElementById('tbe-fatigue-min-val').textContent = `${minute}' min`;
        document.getElementById('tbe-fatigue-stam-val').textContent = stamina;

        const res = TBE.calculateFatigue(minute, stamina, position);

        document.getElementById('tbe-fatigue-pct-display').textContent = `${res.fatigue_pct}%`;
        document.getElementById('tbe-fatigue-band-display').textContent = res.band.toUpperCase().replace('_', ' ');
        document.getElementById('tbe-fatigue-band-display').style.color = res.color;
        document.getElementById('tbe-fatigue-meter-fill').style.width = `${res.fatigue_pct}%`;
        document.getElementById('tbe-fatigue-meter-fill').style.backgroundColor = res.color;

        document.getElementById('tbe-speed-mod').textContent = `${Math.round(res.speed_modifier * 100)}%`;
        document.getElementById('tbe-scan-mod').textContent = `${Math.round(res.scanning_modifier * 100)}%`;

        const subAlert = document.getElementById('tbe-sub-alert');
        if (subAlert) {
            subAlert.style.display = res.sub_recommended ? 'flex' : 'none';
        }
    }

    // ---------------------------------------------------------------------------
    // 8. Tactical Board Bridge (Evaluate Canvas with TBE)
    // ---------------------------------------------------------------------------
    function setupTacticsBoardBridge() {
        // Will be called from app.js or button on board inspector
        window.evaluateBoardWithTBE = function() {
            if (!window.state || !window.state.players) {
                alert("Please add players and a ball to the board first!");
                return;
            }

            const players = window.state.players;
            if (players.length < 2) {
                alert("Add at least 2 players to evaluate with TBE.");
                return;
            }

            // Find ball
            const ball = players.find(p => p.type === 'ball') || players[0];
            // Sort by distance to ball to find carrier
            const attackingPlayers = players.filter(p => p.type === 'blue' || p.type === 'red');
            if (attackingPlayers.length === 0) return;

            let carrier = attackingPlayers[0];
            let minDist = Infinity;
            attackingPlayers.forEach(p => {
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (d < minDist) {
                    minDist = d;
                    carrier = p;
                }
            });

            // Convert canvas (800x550) to TBE meters (105m x 68m)
            const tbePlayers = attackingPlayers.map(p => ({
                player_id: `p_${p.id}`,
                team_id: p.type === carrier.type ? "A" : "B",
                role: p.label || (p.type === carrier.type ? "attacker" : "defender"),
                x: (p.x / 800) * 105.0,
                y: (p.y / 550) * 68.0,
                speed_mps: 3.5
            }));

            const tbeCarrier = {
                player_id: `p_${carrier.id}`,
                team_id: "A",
                role: carrier.label || "ball_carrier",
                x: (carrier.x / 800) * 105.0,
                y: (carrier.y / 550) * 68.0,
                speed_mps: 4.0
            };

            const moment = {
                ball_x: (ball.x / 800) * 105.0,
                ball_y: (ball.y / 550) * 68.0,
                possession_team_id: "A",
                players: tbePlayers,
                phase: "attacking_organisation"
            };

            const rec = TBE.explainRecommendation(tbeCarrier, moment);
            const pressure = TBE.pressureOnPlayer(tbeCarrier, moment);
            const sv = TBE.spaceValue(tbeCarrier.x, tbeCarrier.y, moment);

            // Display floating or inline modal in Tactics Board
            showTBEBoardEvaluationResult(carrier, rec, pressure, sv);
        };
    }

    function showTBEBoardEvaluationResult(carrier, rec, pressure, sv) {
        const insp = document.getElementById('inspectorPanel');
        if (insp) {
            insp.style.display = 'flex';
        }

        let resultContainer = document.getElementById('board-tbe-result-box');
        if (!resultContainer) {
            if (insp) {
                resultContainer = document.createElement('div');
                resultContainer.id = 'board-tbe-result-box';
                resultContainer.style.cssText = 'margin-top:12px; padding:10px; border-radius:6px; background:rgba(0,0,0,0.4); border:1px solid var(--accent-green);';
                insp.appendChild(resultContainer);
            }
        }

        if (resultContainer) {
            resultContainer.innerHTML = `
                <div style="font-size:11px; font-weight:700; color:var(--accent-green); display:flex; justify-content:space-between;">
                    <span><i class="fa-solid fa-bolt"></i> TBE ENGINE: ${carrier.label || 'CARRIER'}</span>
                    <span>CONF: ${rec.confidence.toUpperCase()}</span>
                </div>
                <div style="font-size:12px; margin:6px 0; color:#fff;">
                    RECOMMENDED: <strong style="color:var(--accent-green);">${rec.recommendation.toUpperCase()}</strong> (TAV: ${rec.tactical_action_value})
                </div>
                <div style="font-size:10px; color:var(--text2); display:flex; gap:10px; margin-bottom:6px;">
                    <span>Pressure: <strong>${Math.round(pressure * 100)}%</strong></span>
                    <span>Space Val: <strong>${sv}</strong></span>
                    <span>Alt: <strong>${rec.alternative.action.toUpperCase()}</strong></span>
                </div>
                <div style="font-size:10px; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.08); padding-top:4px;">
                    ${rec.why[0]}
                </div>
            `;
            resultContainer.style.display = 'block';
        }
    }

    // ---------------------------------------------------------------------------
    // 9. Match Analyzer & Predictor Bridges
    // ---------------------------------------------------------------------------
    function enhanceMatchAnalyzer(hForm, hStyle, aForm, aStyle) {
        const matchup = TBE.findMatchingMatchup(hForm, hStyle, aForm, aStyle);
        const relatedRules = TBE.searchRules(hStyle, "MOVEMENT", 3);
        return {
            matchup,
            rules: relatedRules
        };
    }

    return {
        init,
        switchSubtab,
        runEngineSimulation,
        renderScenariosList,
        openScenarioModal,
        renderCausalityChains,
        renderRulesList,
        updateFatigueUI,
        enhanceMatchAnalyzer
    };
})();

window.TBE_UI = TBE_UI;

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TBE_UI.init());
    } else {
        setTimeout(() => TBE_UI.init(), 100);
    }
}
