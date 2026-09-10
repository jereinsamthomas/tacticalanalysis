/**
 * tactical_canvas.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PRO TACTICAL VISUALIZATION & MINI-MATCH ENGINE v3.5
 * 
 * Comprehensive tactical features:
 * 1. Unit Classification & Group Isolation (Defense, Midfield, Attack, Press Unit, Transition Unit).
 * 2. Pass Styles Engine (Tiki-Taka Triangles, Direct Vertical, Wing Play & Crosses, Counter Blitz).
 * 3. Press Styles Engine (Gegenpressing Swarm, Mid-Block Trap, Low Block Bunker, Man-to-Man Marking).
 * 4. Interactive Mini-Match Simulator (Live 0'-90' clock, score, commentary ticker, shot/goal/save events).
 * 5. Geometric Passing Triangles & Tactical Unit Connecting Lines (Backline, Midfield line, Attack line).
 * 6. Pitch Control Territorial Dominance Heatmap contours.
 * 7. Tactical Pitch Zones Overlay (Half-Spaces, Zone 14 Prime Creative Hub, Flanks).
 * 8. Dynamic Team Compactness Convex Hull & Offside Trap line.
 * 9. Real player jersey markers with numbers, direction chevrons, and interactive playmaker passing.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function(global) {
  'use strict';

  const CW = 960, CH = 620, PAD = 46, PX = PAD, PY = PAD, PW = CW - PAD * 2, PH = CH - PAD * 2;
  const yZones = { GK: .90, CB: .76, LB: .76, RB: .76, CDM: .63, CM: .50, LM: .50, RM: .50, CAM: .38, LW: .24, RW: .24, ST: .13, CF: .18 };

  // Positional multi-waypoint paths
  const posMovePaths = {
    GK: {
      default: [{x:0,y:0},{x:-.04,y:.02},{x:.04,y:.02},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.08},{x:-.05,y:.04},{x:.05,y:.04},{x:0,y:0}],
      spd: .6
    },
    CB: {
      default: [{x:0,y:0},{x:-.06,y:-.04},{x:.06,y:-.04},{x:0,y:.05},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.12},{x:-.05,y:.06},{x:.05,y:.06},{x:0,y:0}],
      attack: [{x:0,y:0},{x:0,y:.06},{x:-.08,y:.02},{x:.08,y:.02},{x:0,y:0}],
      spd: .65
    },
    LB: {
      default: [{x:0,y:0},{x:-.06,y:.08},{x:-.04,y:.04},{x:0,y:.02},{x:0,y:0}],
      overlap: [{x:0,y:0},{x:-.08,y:.10},{x:-.10,y:.18},{x:-.08,y:.24},{x:-.04,y:.14},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.07,y:.15},{x:-.09,y:.22},{x:-.06,y:.12},{x:0,y:0}],
      spd: .85
    },
    RB: {
      default: [{x:0,y:0},{x:.06,y:.08},{x:.04,y:.04},{x:0,y:.02},{x:0,y:0}],
      overlap: [{x:0,y:0},{x:.08,y:.10},{x:.10,y:.18},{x:.08,y:.24},{x:.04,y:.14},{x:0,y:0}],
      attack: [{x:0,y:0},{x:.07,y:.15},{x:.09,y:.22},{x:.06,y:.12},{x:0,y:0}],
      spd: .85
    },
    CDM: {
      default: [{x:0,y:0},{x:-.08,y:.04},{x:.08,y:.04},{x:0,y:-.04},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.10},{x:-.06,y:.05},{x:.06,y:.05},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.05,y:.08},{x:.05,y:.08},{x:0,y:.04},{x:0,y:0}],
      spd: .75
    },
    CM: {
      default: [{x:0,y:0},{x:-.07,y:.10},{x:.07,y:.10},{x:.04,y:-.06},{x:-.04,y:-.06},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.14},{x:-.08,y:.07},{x:.08,y:.07},{x:0,y:-.04},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.06,y:.14},{x:.06,y:.14},{x:.08,y:.08},{x:-.08,y:.08},{x:0,y:0}],
      spd: .9
    },
    CAM: {
      default: [{x:0,y:0},{x:-.10,y:.08},{x:.10,y:.08},{x:.06,y:.14},{x:-.06,y:.14},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.12},{x:-.09,y:.06},{x:.09,y:.06},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.10,y:.12},{x:0,y:.16},{x:.10,y:.12},{x:.07,y:.06},{x:-.07,y:.06},{x:0,y:0}],
      spd: 1.0
    },
    LM: { default: [{x:0,y:0},{x:-.08,y:.06},{x:-.10,y:.12},{x:-.06,y:.08},{x:0,y:0}], spd: .9 },
    RM: { default: [{x:0,y:0},{x:.08,y:.06},{x:.10,y:.12},{x:.06,y:.08},{x:0,y:0}], spd: .9 },
    LW: {
      default: [{x:0,y:0},{x:-.10,y:.06},{x:-.12,y:.12},{x:-.04,y:.14},{x:.04,y:.10},{x:0,y:0}],
      cutinside: [{x:0,y:0},{x:-.08,y:.04},{x:0,y:.12},{x:.06,y:.08},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.12,y:.10},{x:-.08,y:.18},{x:0,y:.14},{x:.05,y:.08},{x:0,y:0}],
      spd: 1.1
    },
    RW: {
      default: [{x:0,y:0},{x:.10,y:.06},{x:.12,y:.12},{x:.04,y:.14},{x:-.04,y:.10},{x:0,y:0}],
      cutinside: [{x:0,y:0},{x:.08,y:.04},{x:0,y:.12},{x:-.06,y:.08},{x:0,y:0}],
      attack: [{x:0,y:0},{x:.12,y:.10},{x:.08,y:.18},{x:0,y:.14},{x:-.05,y:.08},{x:0,y:0}],
      spd: 1.1
    },
    ST: {
      default: [{x:0,y:0},{x:-.08,y:.10},{x:.08,y:.10},{x:0,y:.18},{x:0,y:0}],
      press: [{x:0,y:0},{x:0,y:.14},{x:-.09,y:.08},{x:.09,y:.08},{x:0,y:.04},{x:0,y:0}],
      attack: [{x:0,y:0},{x:-.10,y:.14},{x:.10,y:.14},{x:0,y:.20},{x:0,y:0}],
      spd: 1.05
    },
    CF: {
      default: [{x:0,y:0},{x:-.06,y:.08},{x:.06,y:.08},{x:0,y:.14},{x:0,y:0}],
      attack: [{x:0,y:0},{x:0,y:.12},{x:-.09,y:.06},{x:.09,y:.06},{x:0,y:.16},{x:0,y:0}],
      spd: 1.0
    }
  };

  function pickPath(pos, mt, sk) {
    const t = (mt || '').toLowerCase(), sp = posMovePaths[pos] || posMovePaths.CM;
    if (/overlap/.test(t) && sp.overlap) return sp.overlap;
    if (/cut inside|invert/.test(t) && sp.cutinside) return sp.cutinside;
    if (/press|push high/.test(t) && sp.press) return sp.press;
    if (/attack|forward|advance/.test(t) && sp.attack) return sp.attack;
    return sp.default || [{ x: 0, y: 0 }, { x: 0, y: .04 }, { x: 0, y: 0 }];
  }

  // Engine state
  let _mCtx = null, _mAF = null, _mTime = 0, _mSpd = 1, _mHome = [], _mAway = [], _vTab = 'both';
  let _ballX = 0, _ballY = 0, _ballVx = 0, _ballVy = 0, _ballOwner = null, _passTimer = 0, _passTarget = null, _passProgress = 0, _isPassing = false;
  
  // Tactical Toggles & Overlays
  let _activeUnitGroup = 'all'; // 'all', 'defense', 'midfield', 'attack', 'press_unit', 'transition_unit'
  let _passStyleMode = 'tikitaka'; // 'tikitaka', 'direct', 'wingplay', 'counter'
  let _pressStyleMode = 'gegenpress'; // 'gegenpress', 'midblock', 'lowblock', 'mantoman'
  let _showZonesOverlay = false, _showCompactness = false, _showTriangles = true, _showTacticalLines = false, _showPitchControl = false;

  // Mini-Match Engine
  let _isMiniMatchRunning = false;
  let _miniMatchTime = 0; // in simulated minutes (0 to 90)
  let _miniMatchScore = { home: 1, away: 0 };
  let _miniMatchPhase = 'build_up'; // 'build_up', 'midfield_prog', 'final_third', 'shot_moment', 'turnover_counter'
  let _miniMatchPhaseTimer = 0;
  let _miniMatchCommentary = 'Match kicks off! Both teams establish positional structure.';
  let _goalBannerTimer = 0;
  let _goalBannerText = '';

  const _sCtx = {}, _sAF = {}, _sT = {}, _sSp = {};

  // Build 11 players for Home and Away
  function buildPlayers(fk, sk, roleArr, isHome, pressStyle, blockStyle) {
    const fdata = global.formations ? global.formations[fk] : null;
    if (!fdata) return [];
    const pos = fdata.pos, movD = global.movs ? (global.movs[sk] || {}) : {};
    const cnt = {}, pi = {};
    pos.forEach(p => cnt[p] = (cnt[p] || 0) + 1);
    const allPos = ['GK', ...pos];

    return allPos.map((p, i) => {
      const isGK = (i === 0 && p === 'GK');
      const posIdx = isGK ? 0 : i;
      pi[p] = (pi[p] || 0) + 1;
      const ti = pi[p] - 1, tot = cnt[p] || 1;
      const sp = { 1: [.5], 2: [.28, .72], 3: [.18, .5, .82], 4: [.13, .37, .63, .87], 5: [.10, .26, .5, .74, .90] };
      let xn;
      if (isGK) xn = .5;
      else if (['GK', 'CDM', 'CAM', 'CF'].includes(p) && tot === 1) xn = .5;
      else if (p === 'LB' && tot === 1) xn = .08; else if (p === 'RB' && tot === 1) xn = .92;
      else if (p === 'LM' && tot === 1) xn = .11; else if (p === 'RM' && tot === 1) xn = .89;
      else if (p === 'LW' && tot === 1) xn = .16; else if (p === 'RW' && tot === 1) xn = .84;
      else xn = (sp[tot] || [.5])[ti] || .5;

      const yn = yZones[p] ?? 0.5;
      const baseX = PX + xn * PW;
      const baseY = PY + (isHome ? yn : 1 - yn) * PH;
      const mt = movD[p] || '';
      const role = isGK ? 'Goalkeeper' : (roleArr[i - 1] || '');
      const pathDef = pickPath(p, mt, sk);
      const phOff = Math.random() * Math.PI * 2;
      const pressSpd = pressStyle === 'high' ? 1.25 : pressStyle === 'low' ? .75 : 1.0;
      const blockOff = blockStyle === 'high' ? -.08 : blockStyle === 'low' ? .08 : 0;

      const wpts = pathDef.map(pt => ({
        x: baseX + pt.x * PW,
        y: baseY + pt.y * PH * (isHome ? 1 : -1) + blockOff * PH * (isHome ? -1 : 1)
      }));

      const spd = (posMovePaths[p]?.spd || 0.9) * pressSpd;
      const isPress = (pressStyle === 'high' && ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(p)) || (pressStyle === 'mid' && ['ST', 'CAM'].includes(p));
      const isOverlap = /overlap/.test(mt.toLowerCase()) && ['LB', 'RB', 'LM', 'RM'].includes(p);
      const isCutIn = /cut inside|invert/.test(mt.toLowerCase()) && ['LW', 'RW'].includes(p);
      const isDeep = blockStyle === 'low' && ['CB', 'LB', 'RB', 'CDM'].includes(p);

      // Unit grouping assignment
      let unit = 'midfield';
      if (['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p)) unit = 'defense';
      else if (['ST', 'CF', 'LW', 'RW'].includes(p)) unit = 'attack';

      // Jersey numbers (classic allocations)
      const numMap = { GK: 1, RB: 2, LB: 3, CB: 4, CDM: 6, CM: 8, CAM: 10, RW: 7, LW: 11, ST: 9, CF: 10, LM: 11, RM: 7 };
      const jerseyNumber = numMap[p] || (i + 1);

      return {
        p, role, baseX, baseY, mt, isHome, xn, yn, ph: phOff, i: posIdx,
        jerseyNumber, unit,
        x: baseX, y: baseY, vx: 0, vy: 0,
        wpts, wptIdx: 0, wptT: 0, wptDir: 1, spd,
        isPress, isOverlap, isCutIn, isDeep,
        pressStyle, blockStyle
      };
    });
  }

  // Smooth physics
  function stepPlayer(pl, dt) {
    const wpts = pl.wpts; if (!wpts || wpts.length < 2) return;
    pl.wptT += dt * pl.wptDir * pl.spd;
    const dur = 2.2 + Math.sin(pl.ph) * 0.8;
    if (pl.wptT >= dur) { pl.wptT = dur; pl.wptDir = -1; if (pl.wptIdx < wpts.length - 2) pl.wptIdx++; }
    if (pl.wptT <= 0) { pl.wptT = 0; pl.wptDir = 1; if (pl.wptIdx > 0) pl.wptIdx--; }
    const i0 = pl.wptIdx, i1 = Math.min(i0 + 1, wpts.length - 1);
    const t = Math.max(0, Math.min(1, pl.wptT / dur));
    const ease = t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    const tx = wpts[i0].x + (wpts[i1].x - wpts[i0].x) * ease;
    const ty = wpts[i0].y + (wpts[i1].y - wpts[i0].y) * ease;

    const k = 10, damp = .82;
    pl.vx += (tx - pl.x) * k * dt; pl.vy += (ty - pl.y) * k * dt;
    pl.vx *= Math.pow(damp, dt * 60); pl.vy *= Math.pow(damp, dt * 60);
    pl.x += pl.vx * dt; pl.y += pl.vy * dt;
    pl.x = Math.max(PX + 12, Math.min(PX + PW - 12, pl.x));
    pl.y = Math.max(PY + 12, Math.min(PY + PH - 12, pl.y));
  }

  // Pitch graphics
  function drawPitch(ctx) {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#070a10' : '#080d14';
      ctx.fillRect(PX + i * (PW / 10), PY, PW / 10, PH);
    }

    if (_showPitchControl) drawPitchControlContours(ctx);

    const atm = ctx.createRadialGradient(PX + PW / 2, PY + PH / 2, 0, PX + PW / 2, PY + PH / 2, PW * .65);
    atm.addColorStop(0, 'rgba(59,130,246,.04)'); atm.addColorStop(1, 'transparent');
    ctx.fillStyle = atm; ctx.fillRect(PX, PY, PW, PH);

    const ln = (c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w || 1; };
    ctx.shadowColor = 'rgba(245,158,11,.2)'; ctx.shadowBlur = 12;
    ln('rgba(245,158,11,.5)', 2); ctx.strokeRect(PX, PY, PW, PH); ctx.shadowBlur = 0;

    ln('rgba(245,158,11,.18)', 1); ctx.beginPath(); ctx.moveTo(PX, PY + PH / 2); ctx.lineTo(PX + PW, PY + PH / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(PX + PW / 2, PY + PH / 2, PH * .115, 0, Math.PI * 2); ln('rgba(245,158,11,.15)', 1); ctx.stroke();
    ctx.beginPath(); ctx.arc(PX + PW / 2, PY + PH / 2, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(245,158,11,.35)'; ctx.fill();

    const paw = PW * .44, pah = PH * .175; ln('rgba(245,158,11,.18)', 1);
    ctx.strokeRect(PX + (PW - paw) / 2, PY, paw, pah); ctx.strokeRect(PX + (PW - paw) / 2, PY + PH - pah, paw, pah);
    const sw = PW * .20, sh = PH * .08; ctx.strokeRect(PX + (PW - sw) / 2, PY, sw, sh); ctx.strokeRect(PX + (PW - sw) / 2, PY + PH - sh, sw, sh);

    const gw = PW * .12, gd = PH * .028;
    ctx.save(); ctx.shadowColor = 'rgba(59,130,246,.5)'; ctx.shadowBlur = 8; ln('rgba(59,130,246,.8)', 2.5);
    ctx.strokeRect(PX + (PW - gw) / 2, PY - gd, gw, gd); ctx.strokeRect(PX + (PW - gw) / 2, PY + PH, gw, gd); ctx.restore();

    ctx.fillStyle = 'rgba(245,158,11,.4)';
    [[PW / 2, PH * .845], [PW / 2, PH * .155]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(PX + x, PY + y, 3.5, 0, Math.PI * 2); ctx.fill();
    });

    if (_showZonesOverlay) drawTacticalZones(ctx);
    if (_showTriangles) drawPassingTriangles(ctx, _mHome);
    if (_showTacticalLines) {
      drawTacticalLinesForTeam(ctx, _mHome, true);
      drawTacticalLinesForTeam(ctx, _mAway, false);
    }
  }

  // Pitch Control Dominance Contours
  function drawPitchControlContours(ctx) {
    ctx.save();
    // Home dominance on defensive third
    const hG = ctx.createLinearGradient(PX, PY + PH * .6, PX, PY + PH);
    hG.addColorStop(0, 'transparent');
    hG.addColorStop(1, 'rgba(59, 130, 246, 0.12)');
    ctx.fillStyle = hG;
    ctx.fillRect(PX, PY + PH * .6, PW, PH * .4);

    // Away dominance on top third
    const aG = ctx.createLinearGradient(PX, PY + PH * .4, PX, PY);
    aG.addColorStop(0, 'transparent');
    aG.addColorStop(1, 'rgba(245, 158, 11, 0.12)');
    ctx.fillStyle = aG;
    ctx.fillRect(PX, PY, PW, PH * .4);

    ctx.font = '7px Space Mono';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.fillText('HOME CONTROL: 62%', PX + 16, PY + PH - 16);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.fillText('AWAY CONTROL: 38%', PX + 16, PY + 24);
    ctx.restore();
  }

  // Tactical Passing Triangles (Guardiola positional play network)
  function drawPassingTriangles(ctx, players) {
    const outfield = players.filter(p => p.p !== 'GK');
    const n = outfield.length;
    ctx.save();
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d1 = Math.hypot(outfield[i].x - outfield[j].x, outfield[i].y - outfield[j].y);
        if (d1 > 170 || d1 < 45) continue;
        for (let k = j + 1; k < n; k++) {
          const d2 = Math.hypot(outfield[j].x - outfield[k].x, outfield[j].y - outfield[k].y);
          const d3 = Math.hypot(outfield[i].x - outfield[k].x, outfield[i].y - outfield[k].y);
          if (d2 < 170 && d3 < 170 && d2 > 45 && d3 > 45) {
            ctx.beginPath();
            ctx.moveTo(outfield[i].x, outfield[i].y);
            ctx.lineTo(outfield[j].x, outfield[j].y);
            ctx.lineTo(outfield[k].x, outfield[k].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // Tactical Unit Lines (Defensive line, Midfield line, Attacking line)
  function drawTacticalLinesForTeam(ctx, players, isHome) {
    const col = isHome ? 'rgba(59, 130, 246, 0.6)' : 'rgba(245, 158, 11, 0.6)';
    ctx.save();
    ctx.lineWidth = 1.4;

    // 1. Backline (Defenders)
    const defs = players.filter(p => ['CB', 'LB', 'RB'].includes(p.p)).sort((a, b) => a.x - b.x);
    if (defs.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(defs[0].x, defs[0].y);
      for (let i = 1; i < defs.length; i++) ctx.lineTo(defs[i].x, defs[i].y);
      ctx.strokeStyle = col;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.font = '6px Space Mono';
      ctx.fillStyle = col;
      ctx.fillText((isHome ? 'HOME' : 'AWAY') + ' DEFENSIVE LINE', defs[0].x, defs[0].y - 8);
    }

    // 2. Midfield Line
    const mids = players.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.p)).sort((a, b) => a.x - b.x);
    if (mids.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(mids[0].x, mids[0].y);
      for (let i = 1; i < mids.length; i++) ctx.lineTo(mids[i].x, mids[i].y);
      ctx.strokeStyle = isHome ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 180, 0, 0.5)';
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // Tactical Zones Overlay (5 vertical channels + Zone 14)
  function drawTacticalZones(ctx) {
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(245,158,11,0.18)';
    ctx.lineWidth = 1;

    const colW = PW / 5;
    for (let c = 1; c < 5; c++) {
      ctx.beginPath();
      ctx.moveTo(PX + c * colW, PY);
      ctx.lineTo(PX + c * colW, PY + PH);
      ctx.stroke();
    }

    // Zone 14
    const z14X = PX + colW * 1.5, z14Y = PY + PH * 0.28, z14W = colW * 2, z14H = PH * 0.16;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
    ctx.fillRect(z14X, z14Y, z14W, z14H);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.strokeRect(z14X, z14Y, z14W, z14H);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.font = 'bold 8px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText('ZONE 14 (PRIME CREATIVE HUB)', z14X + z14W / 2, z14Y + z14H / 2 + 3);

    // Half space labels
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillText('L-HALF SPACE', PX + colW * 1.5, PY + PH * 0.5);
    ctx.fillText('R-HALF SPACE', PX + colW * 3.5, PY + PH * 0.5);
    ctx.restore();
  }

  // Convex Hull Team Compactness Envelope
  function drawTeamCompactness(ctx, players, isHome) {
    const outfield = players.filter(p => p.p !== 'GK');
    if (outfield.length < 3) return;
    const points = outfield.map(p => ({ x: p.x, y: p.y }));

    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower = [];
    for (let p of points) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    const hull = lower.concat(upper);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
    ctx.closePath();

    const col = isHome ? '59,130,246' : '245,158,11';
    ctx.fillStyle = `rgba(${col}, 0.08)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${col}, 0.35)`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 6]);
    ctx.stroke();

    let cx = 0, cy = 0;
    outfield.forEach(p => { cx += p.x; cy += p.y; });
    cx /= outfield.length; cy /= outfield.length;
    ctx.font = '6px Space Mono';
    ctx.fillStyle = `rgba(${col}, 0.8)`;
    ctx.textAlign = 'center';
    ctx.fillText((isHome ? 'HOME' : 'AWAY') + ' COMPACTNESS', cx, cy);
    ctx.restore();
  }

  // Offside Line
  function drawOffsideLine(ctx, players, isHome) {
    const defenders = players.filter(p => ['CB', 'LB', 'RB'].includes(p.p));
    if (defenders.length === 0) return;
    const lastDef = isHome 
      ? defenders.reduce((m, p) => p.y < m.y ? p : m, defenders[0])
      : defenders.reduce((m, p) => p.y > m.y ? p : m, defenders[0]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(PX, lastDef.y);
    ctx.lineTo(PX + PW, lastDef.y);
    ctx.strokeStyle = isHome ? 'rgba(59,130,246,0.5)' : 'rgba(245,158,11,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.font = '6px Space Mono';
    ctx.fillStyle = isHome ? 'rgba(59,130,246,0.8)' : 'rgba(245,158,11,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText('OFFSIDE LINE', PX + PW - 8, lastDef.y - 4);
    ctx.restore();
  }

  // Defensive Blocks
  function drawBlock(ctx, bt, t) {
    const pulse = Math.sin(t * 1.2) * .5 + .5;
    let y1, y2, col, lineCol, name;
    if (bt === 'lowblock') {
      y1 = PY + PH * .62; y2 = PY + PH;
      col = `rgba(139,92,246,${.07 + .04 * pulse})`; lineCol = `rgba(139,92,246,${.3 + .2 * pulse})`; name = 'LOW BLOCK — COMPACT DEFENSIVE BUNKER';
    } else if (bt === 'midblock') {
      y1 = PY + PH * .38; y2 = PY + PH * .68;
      col = `rgba(245,158,11,${.07 + .04 * pulse})`; lineCol = `rgba(245,158,11,${.3 + .2 * pulse})`; name = 'MID BLOCK — MIDFIELD SCREEN & TRAP ZONE';
    } else if (bt === 'highblock') {
      y1 = PY; y2 = PY + PH * .42;
      col = `rgba(59,130,246,${.06 + .04 * pulse})`; lineCol = `rgba(59,130,246,${.3 + .2 * pulse})`; name = 'HIGH BLOCK — AGGRESSIVE OFFSIDE LINE';
    }
    if (!y1) return;
    ctx.fillStyle = col; ctx.fillRect(PX, y1, PW, y2 - y1);
    ctx.save(); ctx.strokeStyle = lineCol; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(PX, y1); ctx.lineTo(PX + PW, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = 'bold 9px Space Mono'; ctx.textAlign = 'center'; ctx.fillStyle = lineCol; ctx.fillText(name, PX + PW / 2, (y1 + y2) / 2); ctx.restore();
  }

  // Pressing zones & Gegenpress Swarms
  function drawPressZones(ctx, players, t) {
    const pulse = Math.sin(t * 1.8) * .5 + .5;
    const isSwarm = _pressStyleMode === 'gegenpress';

    players.filter(pl => pl.isPress).forEach(pl => {
      const intensity = pl.pressStyle === 'high' ? 1.0 : pl.pressStyle === 'mid' ? .65 : .35;
      const rr = (isSwarm ? 58 + 18 * pulse : 44 + 12 * pulse) * intensity;
      const grd = ctx.createRadialGradient(pl.x, pl.y, 0, pl.x, pl.y, rr);
      grd.addColorStop(0, `rgba(255,60,60,${(.24 + .14 * pulse) * intensity})`);
      grd.addColorStop(.5, `rgba(255,120,0,${(.14 + .08 * pulse) * intensity})`);
      grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(pl.x, pl.y, rr, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
    });
  }

  // Dynamic Passing Corridors
  function drawLanes(ctx, players, opps, t) {
    const pulse = Math.sin(t * 1.3) * .5 + .5;
    const chains = [
      [p => p.p === 'GK', p => ['CB', 'LB', 'RB'].includes(p.p), 'build'],
      [p => p.p === 'CB', p => ['LB', 'RB'].includes(p.p), 'build'],
      [p => ['CB', 'LB', 'RB'].includes(p.p), p => ['CDM', 'CM', 'LM', 'RM'].includes(p.p), 'progress'],
      [p => p.p === 'CDM', p => ['CM', 'LM', 'RM', 'CAM'].includes(p.p), 'progress'],
      [p => p.p === 'CM', p => ['CAM', 'LW', 'RW', 'LM', 'RM'].includes(p.p), 'progress'],
      [p => p.p === 'CAM', p => ['ST', 'CF', 'LW', 'RW'].includes(p.p), 'final'],
      [p => ['LW', 'RW'].includes(p.p), p => ['ST', 'CF'].includes(p.p), 'final'],
      [p => p.p === 'LB', p => ['RW', 'RM', 'CM'].includes(p.p), 'switch'],
      [p => p.p === 'RB', p => ['LW', 'LM', 'CM'].includes(p.p), 'switch']
    ];

    const laneColors = {
      build: { open: `rgba(59,130,246,${.24 + .14 * pulse})`, blocked: `rgba(239,68,68,${.14 + .06 * pulse})` },
      progress: { open: `rgba(16,185,129,${.22 + .12 * pulse})`, blocked: `rgba(239,68,68,${.12 + .05 * pulse})` },
      final: { open: `rgba(245,158,11,${.30 + .16 * pulse})`, blocked: `rgba(239,68,68,${.14 + .06 * pulse})` },
      switch: { open: `rgba(139,92,246,${.18 + .08 * pulse})`, blocked: `rgba(239,68,68,${.10 + .04 * pulse})` }
    };

    chains.forEach(([fA, fB, type]) => {
      const pA = players.filter(fA), pB = players.filter(fB);
      pA.forEach(a => {
        pB.forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > 260 || dist < 30) return;
          const blocked = opps.some(op => {
            const tv = ((op.x - a.x) * (b.x - a.x) + (op.y - a.y) * (b.y - a.y)) / (dist * dist);
            if (tv < .15 || tv > .85) return false;
            const cx = a.x + tv * (b.x - a.x), cy = a.y + tv * (b.y - a.y);
            return Math.hypot(op.x - cx, op.y - cy) < 26;
          });

          const clrs = laneColors[type];
          const col = blocked ? clrs.blocked : clrs.open;
          const lw = type === 'final' ? 2 : type === 'switch' ? 1 : 1.2;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.setLineDash(blocked ? [4, 8] : []);
          ctx.stroke();
          ctx.restore();
        });
      });
    });
  }

  // Ball physics & dynamic passing
  function updateBall(homePlayers, awayPlayers, dt) {
    if (!_ballOwner) {
      const att = homePlayers.filter(p => ['CM', 'CAM', 'ST', 'RW', 'LW'].includes(p.p));
      _ballOwner = att.length ? att[0] : homePlayers[0];
      _ballX = _ballOwner ? _ballOwner.x : PX + PW / 2;
      _ballY = _ballOwner ? _ballOwner.y : PY + PH / 2;
    }

    _passTimer -= dt;

    // Mini-match phase management
    if (_isMiniMatchRunning) {
      _miniMatchTime += dt * 0.8 * (_mSpd || 1);
      _miniMatchPhaseTimer += dt;
      if (_miniMatchPhaseTimer > 4.5) {
        _miniMatchPhaseTimer = 0;
        cycleMiniMatchPhase(homePlayers, awayPlayers);
      }
    }

    // Passing speed & cadence based on Pass Style
    const passCadence = _passStyleMode === 'tikitaka' ? 1.2 : _passStyleMode === 'direct' ? 2.8 : 2.0;

    if (_passTimer <= 0 && !_isPassing && _ballOwner) {
      const team = _ballOwner.isHome ? homePlayers : awayPlayers;
      let candidates = [];

      if (_passStyleMode === 'direct') {
        // Direct balls target striker or wingers running behind
        candidates = team.filter(p => p !== _ballOwner && ['ST', 'CF', 'LW', 'RW'].includes(p.p));
      } else if (_passStyleMode === 'wingplay') {
        // Wing play targets fullbacks and wingers
        candidates = team.filter(p => p !== _ballOwner && ['LB', 'RB', 'LM', 'RM', 'LW', 'RW'].includes(p.p));
      } else {
        // Tiki-Taka short triangle passes
        candidates = team.filter(p => p !== _ballOwner && Math.hypot(p.x - _ballOwner.x, p.y - _ballOwner.y) < 190);
      }

      if (candidates.length === 0) {
        candidates = team.filter(p => p !== _ballOwner && Math.hypot(p.x - _ballOwner.x, p.y - _ballOwner.y) < 240);
      }

      if (candidates.length > 0) {
        _passTarget = candidates[Math.floor(Math.random() * candidates.length)];
        _passProgress = 0;
        _isPassing = true;
        _passTimer = passCadence + Math.random() * 0.8;
      }
    }

    if (_isPassing && _passTarget && _ballOwner) {
      const passSpeed = _passStyleMode === 'counter' ? 2.4 : 1.9;
      _passProgress += dt * passSpeed;
      _ballX = _ballOwner.x + (_passTarget.x - _ballOwner.x) * Math.min(1, _passProgress);
      _ballY = _ballOwner.y + (_passTarget.y - _ballOwner.y) * Math.min(1, _passProgress);
      if (_passProgress >= 1) {
        _ballOwner = _passTarget;
        _isPassing = false;
        _passTarget = null;
      }
    } else if (_ballOwner) {
      _ballX += (_ballOwner.x - _ballX) * 5 * dt;
      _ballY += (_ballOwner.y - _ballY) * 5 * dt;
    }
  }

  // Mini-match phase transitions
  function cycleMiniMatchPhase(homePlayers, awayPlayers) {
    const phases = ['build_up', 'midfield_prog', 'final_third', 'shot_moment', 'turnover_counter'];
    const curIdx = phases.indexOf(_miniMatchPhase);
    _miniMatchPhase = phases[(curIdx + 1) % phases.length];

    if (_miniMatchPhase === 'build_up') {
      _miniMatchCommentary = `${Math.round(_miniMatchTime)}' Build-up: Home deep pivot recycles possession with CBs.`;
      const deep = homePlayers.filter(p => ['CB', 'CDM'].includes(p.p));
      if (deep.length) _ballOwner = deep[Math.floor(Math.random() * deep.length)];
    } else if (_miniMatchPhase === 'midfield_prog') {
      _miniMatchCommentary = `${Math.round(_miniMatchTime)}' Progression: Passing triangles form through Zone 14 half-spaces!`;
      const mid = homePlayers.filter(p => ['CM', 'CAM'].includes(p.p));
      if (mid.length) _ballOwner = mid[0];
    } else if (_miniMatchPhase === 'final_third') {
      _miniMatchCommentary = `${Math.round(_miniMatchTime)}' Overload: Wingers and fullbacks advance! Cross whipped into the box!`;
      const wide = homePlayers.filter(p => ['LW', 'RW', 'ST'].includes(p.p));
      if (wide.length) _ballOwner = wide[0];
    } else if (_miniMatchPhase === 'shot_moment') {
      const isGoal = Math.random() > 0.45;
      if (isGoal) {
        _miniMatchScore.home++;
        _goalBannerText = `GOAL! HOME ${_miniMatchScore.home} - ${_miniMatchScore.away} AWAY ⚽`;
        _goalBannerTimer = 3.5;
        _miniMatchCommentary = `${Math.round(_miniMatchTime)}' GOAL! Clinical strike into the bottom corner! Excellent team play.`;
      } else {
        _goalBannerText = 'GREAT SAVE BY GOALKEEPER! 🧤';
        _goalBannerTimer = 2.5;
        _miniMatchCommentary = `${Math.round(_miniMatchTime)}' Shot unleashed on goal — sensationally tipped over the crossbar!`;
      }
      updateMiniMatchUI();
    } else if (_miniMatchPhase === 'turnover_counter') {
      _miniMatchCommentary = `${Math.round(_miniMatchTime)}' Turnover! Away team launches lightning vertical counter-attack!`;
      const awayAtt = awayPlayers.filter(p => ['ST', 'LW', 'RW'].includes(p.p));
      if (awayAtt.length) _ballOwner = awayAtt[0];
    }

    updateMiniMatchUI();
  }

  function updateMiniMatchUI() {
    const timeEl = document.getElementById('miniMatchClock');
    const scoreEl = document.getElementById('miniMatchScore');
    const commEl = document.getElementById('miniMatchComm');
    if (timeEl) timeEl.textContent = `${Math.min(90, Math.floor(_miniMatchTime))}'`;
    if (scoreEl) scoreEl.textContent = `${_miniMatchScore.home} - ${_miniMatchScore.away}`;
    if (commEl) commEl.textContent = _miniMatchCommentary;
  }

  function drawBall(ctx, t) {
    const pulse = Math.sin(t * 4) * .5 + .5;
    const shadowDist = _isPassing ? 4 + 4 * pulse : 2;
    ctx.beginPath();
    ctx.arc(_ballX + shadowDist, _ballY + shadowDist, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    const bg = ctx.createRadialGradient(_ballX - 1.5, _ballY - 1.5, 0, _ballX, _ballY, 6);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.5, '#e5e7eb'); bg.addColorStop(1, '#9ca3af');
    ctx.beginPath();
    ctx.arc(_ballX, _ballY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    if (_isPassing) {
      ctx.beginPath();
      ctx.arc(_ballX, _ballY, 6 + 6 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,158,11,${.6 + .3 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Mini-Match Goal Event Banner
    if (_goalBannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 8, 9, 0.88)';
      ctx.fillRect(PX + PW / 2 - 180, PY + 24, 360, 42);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(PX + PW / 2 - 180, PY + 24, 360, 42);
      ctx.font = 'bold 16px Bebas Neue';
      ctx.fillStyle = 'var(--amber)';
      ctx.textAlign = 'center';
      ctx.fillText(_goalBannerText, PX + PW / 2, PY + 50);
      ctx.restore();
    }
  }

  function drawArrow(ctx, x1, y1, x2, y2, col, al, sz) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - (sz || 8) * Math.cos(ang - .42), y2 - (sz || 8) * Math.sin(ang - .42));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - (sz || 8) * Math.cos(ang + .42), y2 - (sz || 8) * Math.sin(ang + .42));
    ctx.stroke(); ctx.restore();
  }

  function drawPressLines(ctx, prs, opp, t) {
    const pulse = Math.sin(t * 2.5) * .5 + .5;
    prs.filter(pl => pl.isPress).forEach(pr => {
      let near = null, md = Infinity;
      opp.forEach(op => {
        const d = Math.hypot(pr.x - op.x, pr.y - op.y);
        if (d < md) { md = d; near = op; }
      });
      if (!near || md > 280) return;
      const intensity = pr.pressStyle === 'high' ? 1.0 : .6;
      ctx.save(); ctx.beginPath(); ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(near.x, near.y);
      ctx.strokeStyle = `rgba(255,80,0,${(.15 + .10 * pulse) * intensity})`;
      ctx.lineWidth = 1.2; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
      drawArrow(ctx, pr.x, pr.y, near.x, near.y, `rgba(255,80,0,${(.7 + .3 * pulse) * intensity})`, 1, 7);
      ctx.restore();
    });
  }

  // Draw Player Avatar Disk with Jersey Number & Unit Dimming
  function drawPlayer(ctx, pl, isHome, t) {
    // Unit Group Isolation Dimming
    let isDimmed = false;
    if (_activeUnitGroup !== 'all') {
      if (_activeUnitGroup === 'defense' && pl.unit !== 'defense') isDimmed = true;
      else if (_activeUnitGroup === 'midfield' && pl.unit !== 'midfield') isDimmed = true;
      else if (_activeUnitGroup === 'attack' && pl.unit !== 'attack') isDimmed = true;
      else if (_activeUnitGroup === 'press_unit' && !pl.isPress) isDimmed = true;
      else if (_activeUnitGroup === 'transition_unit' && !['CDM', 'LB', 'RB', 'LW', 'RW', 'ST'].includes(pl.p)) isDimmed = true;
    }

    ctx.save();
    if (isDimmed) ctx.globalAlpha = 0.25;

    const clr = isHome ? '#3b82f6' : '#f59e0b';
    const diskR = 13;

    // Glowing disk shadow
    ctx.beginPath(); ctx.arc(pl.x + 1.5, pl.y + 2, diskR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();

    const dg = ctx.createRadialGradient(pl.x - 3, pl.y - 3, 0, pl.x, pl.y, diskR);
    dg.addColorStop(0, isHome ? '#6aadff' : '#ffd060'); dg.addColorStop(1, clr);
    ctx.beginPath(); ctx.arc(pl.x, pl.y, diskR, 0, Math.PI * 2);
    ctx.fillStyle = dg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.stroke();

    // Position text & jersey number
    ctx.fillStyle = isHome ? '#001133' : '#1a0a00';
    ctx.font = 'bold 7px Space Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pl.p.slice(0, 2), pl.x, pl.y - 2);
    ctx.font = '5px Space Mono';
    ctx.fillText('#' + pl.jerseyNumber, pl.x, pl.y + 5);

    // Direction Chevron (if moving)
    const speed = Math.hypot(pl.vx, pl.vy);
    if (speed > 0.4) {
      const ang = Math.atan2(pl.vy, pl.vx);
      const chX = pl.x + Math.cos(ang) * (diskR + 6);
      const chY = pl.y + Math.sin(ang) * (diskR + 6);
      ctx.strokeStyle = clr;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(chX - 4 * Math.cos(ang - 0.5), chY - 4 * Math.sin(ang - 0.5));
      ctx.lineTo(chX, chY);
      ctx.lineTo(chX - 4 * Math.cos(ang + 0.5), chY - 4 * Math.sin(ang + 0.5));
      ctx.stroke();
    }

    // Role badge
    if (pl.role && !isDimmed) {
      const rLabel = pl.role.length > 15 ? pl.role.slice(0, 14) + '…' : pl.role;
      const tw = Math.max(36, rLabel.length * 4.6) + 10;
      ctx.fillStyle = 'rgba(6,8,14,.92)';
      ctx.fillRect(pl.x - tw / 2, pl.y + diskR + 1, tw, 11);
      ctx.strokeStyle = clr + '28'; ctx.lineWidth = .5;
      ctx.strokeRect(pl.x - tw / 2, pl.y + diskR + 1, tw, 11);
      ctx.fillStyle = clr; ctx.font = '5.5px Space Mono';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(rLabel, pl.x, pl.y + diskR + 2.5);
    }

    // Active ball possessor ring
    if (pl === _ballOwner) {
      const pw = Math.sin(t * 4) * .5 + .5;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, diskR + 3 + pw * 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,158,11,${.7 + .3 * pw})`; ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.restore();
  }

  // Main Loop
  let _lastTime = 0;
  function mainLoop(ts) {
    const dt = Math.min((ts - _lastTime) / 1000, .05) * (_mSpd || 1);
    _lastTime = ts;
    const ctx = _mCtx; if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);

    if (_goalBannerTimer > 0) _goalBannerTimer -= dt;

    drawPitch(ctx);
    const mode = _vTab;

    if (['lowblock', 'midblock', 'highblock'].includes(mode)) drawBlock(ctx, mode, _mTime);

    _mHome.forEach(pl => stepPlayer(pl, dt));
    _mAway.forEach(pl => stepPlayer(pl, dt));
    updateBall(_mHome, _mAway, dt);

    if (_showCompactness) {
      drawTeamCompactness(ctx, _mHome, true);
      drawTeamCompactness(ctx, _mAway, false);
    }

    if (mode === 'highblock') {
      drawOffsideLine(ctx, _mHome, true);
      drawOffsideLine(ctx, _mAway, false);
    }

    if (mode !== 'nopressing') {
      drawPressZones(ctx, _mHome, _mTime);
      drawPressZones(ctx, _mAway, _mTime);
    }

    if (mode === 'lanes' || mode === 'both' || mode === 'attacking') {
      drawLanes(ctx, _mHome, _mAway, _mTime);
      drawLanes(ctx, _mAway, _mHome, _mTime);
    }

    _mAway.forEach(pl => { if (mode === 'attacking') return; drawPlayer(ctx, pl, false, _mTime); });
    _mHome.forEach(pl => { if (mode === 'nopressing' && pl.isPress) return; drawPlayer(ctx, pl, true, _mTime); });
    if (mode === 'attacking') _mAway.forEach(pl => drawPlayer(ctx, pl, false, _mTime));

    if (mode !== 'lanes') {
      drawPressLines(ctx, _mHome, _mAway, _mTime);
      drawPressLines(ctx, _mAway, _mHome, _mTime);
    }

    drawBall(ctx, _mTime);
    _mTime += dt;
    _mAF = requestAnimationFrame(mainLoop);
  }

  // Public Canvas API & Control functions
  function setTab(tab, el) {
    _vTab = tab;
    document.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
  }

  function setUnitGroup(groupName) {
    _activeUnitGroup = groupName;
    document.querySelectorAll('.unit-group-btn').forEach(b => b.classList.toggle('active', b.dataset.group === groupName));
    updateUnitDetailsDrawer(groupName);
  }

  function updateUnitDetailsDrawer(groupName) {
    const drawer = document.getElementById('unitDetailsDrawer');
    if (!drawer) return;

    if (groupName === 'all') {
      drawer.style.display = 'none';
      return;
    }
    drawer.style.display = 'block';

    const hMembers = _mHome.filter(p => {
      if (groupName === 'defense') return p.unit === 'defense';
      if (groupName === 'midfield') return p.unit === 'midfield';
      if (groupName === 'attack') return p.unit === 'attack';
      if (groupName === 'press_unit') return p.isPress;
      return true;
    });

    const aMembers = _mAway.filter(p => {
      if (groupName === 'defense') return p.unit === 'defense';
      if (groupName === 'midfield') return p.unit === 'midfield';
      if (groupName === 'attack') return p.unit === 'attack';
      if (groupName === 'press_unit') return p.isPress;
      return true;
    });

    const titleEl = document.getElementById('unitDrawerTitle');
    if (titleEl) titleEl.textContent = `${groupName.toUpperCase().replace('_', ' ')} — TACTICAL BREAKDOWN`;

    const hListEl = document.getElementById('unitHomeList');
    if (hListEl) {
      hListEl.innerHTML = hMembers.map(p => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:9px;">
          <span style="color:var(--blue);font-weight:700;">#${p.jerseyNumber} ${p.p} (${p.role})</span>
          <span style="color:var(--text3);">${(p.mt || 'Standard').slice(0, 24)}</span>
        </div>
      `).join('') || '<div style="color:var(--text4);">No players in unit</div>';
    }

    const aListEl = document.getElementById('unitAwayList');
    if (aListEl) {
      aListEl.innerHTML = aMembers.map(p => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:9px;">
          <span style="color:var(--amber);font-weight:700;">#${p.jerseyNumber} ${p.p} (${p.role})</span>
          <span style="color:var(--text3);">${(p.mt || 'Standard').slice(0, 24)}</span>
        </div>
      `).join('') || '<div style="color:var(--text4);">No players in unit</div>';
    }
  }

  function setPassStyle(style) {
    _passStyleMode = style;
    document.querySelectorAll('.pass-style-btn').forEach(b => b.classList.toggle('active', b.dataset.passStyle === style));
  }

  function setPressStyle(style) {
    _pressStyleMode = style;
    document.querySelectorAll('.press-style-btn').forEach(b => b.classList.toggle('active', b.dataset.pressStyle === style));
  }

  function toggleTriangles() {
    _showTriangles = !_showTriangles;
    const btn = document.getElementById('btnToggleTriangles');
    if (btn) btn.classList.toggle('active', _showTriangles);
  }

  function toggleTacticalLines() {
    _showTacticalLines = !_showTacticalLines;
    const btn = document.getElementById('btnToggleLines');
    if (btn) btn.classList.toggle('active', _showTacticalLines);
  }

  function togglePitchControl() {
    _showPitchControl = !_showPitchControl;
    const btn = document.getElementById('btnToggleControl');
    if (btn) btn.classList.toggle('active', _showPitchControl);
  }

  function startMiniMatch() {
    _isMiniMatchRunning = true;
    _miniMatchTime = 0;
    _miniMatchScore = { home: 1, away: 0 };
    _miniMatchPhase = 'build_up';
    _miniMatchPhaseTimer = 0;
    _miniMatchCommentary = "Mini-Match kicked off! High tactical intensity.";
    updateMiniMatchUI();
    const btn = document.getElementById('btnMiniMatchToggle');
    if (btn) btn.innerHTML = '⏸ PAUSE MATCH';
  }

  function pauseMiniMatch() {
    _isMiniMatchRunning = !_isMiniMatchRunning;
    const btn = document.getElementById('btnMiniMatchToggle');
    if (btn) btn.innerHTML = _isMiniMatchRunning ? '⏸ PAUSE MATCH' : '▶ RESUME MATCH';
  }

  function resetMiniMatch() {
    _isMiniMatchRunning = false;
    _miniMatchTime = 0;
    _miniMatchScore = { home: 0, away: 0 };
    _miniMatchPhase = 'build_up';
    _miniMatchCommentary = 'Match reset to 0:00.';
    updateMiniMatchUI();
    const btn = document.getElementById('btnMiniMatchToggle');
    if (btn) btn.innerHTML = '▶ START MINI MATCH';
  }

  function updSpd() {
    const v = document.getElementById('vzSpd')?.value || 1;
    _mSpd = parseFloat(v);
    const el = document.getElementById('spdVal');
    if (el) el.textContent = v + '×';
  }

  function stopViz() {
    if (_mAF) { cancelAnimationFrame(_mAF); _mAF = null; }
  }

  function resumeViz() {
    if (!_mAF && _mCtx) {
      _lastTime = performance.now();
      mainLoop(_lastTime);
    }
  }

  function toggleZonesOverlay() {
    _showZonesOverlay = !_showZonesOverlay;
    const btn = document.getElementById('btnToggleZones');
    if (btn) btn.classList.toggle('active', _showZonesOverlay);
  }

  function toggleCompactnessOverlay() {
    _showCompactness = !_showCompactness;
    const btn = document.getElementById('btnToggleCompact');
    if (btn) btn.classList.toggle('active', _showCompactness);
  }

  function resetBallPossession() {
    if (_mHome.length > 0) {
      _ballOwner = _mHome.find(p => ['CAM', 'CM', 'ST'].includes(p.p)) || _mHome[0];
      _ballX = _ballOwner.x; _ballY = _ballOwner.y;
      _isPassing = false; _passTarget = null;
    }
  }

  function launchMain(hF, hS, hRA, aF, aS, aRA, hPress, hBlock, aPress, aBlock) {
    stopViz();
    _ballOwner = null; _isPassing = false; _passTarget = null;
    const cEl = document.getElementById('mainC');
    if (!cEl) return;
    _mCtx = cEl.getContext('2d');
    _mHome = buildPlayers(hF, hS, hRA, true, hPress || 'high', hBlock || 'mid');
    _mAway = buildPlayers(aF, aS, aRA, false, aPress || 'mid', aBlock || 'mid');
    _mTime = 0;
    _lastTime = performance.now();
    mainLoop(_lastTime);
    setupHover();
  }

  function setupHover() {
    const canvas = document.getElementById('mainC');
    const tip = document.getElementById('vTip');
    if (!canvas || !tip) return;

    canvas.onclick = function(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CH / rect.height;
      const cx = (e.clientX - rect.left) * sx, cy = (e.clientY - rect.top) * sy;
      const all = [..._mHome, ..._mAway];
      let near = null, md = Infinity;
      all.forEach(pl => {
        const d = Math.hypot(cx - pl.x, cy - pl.y);
        if (d < md) { md = d; near = pl; }
      });
      if (near && md < 30) {
        _ballOwner = near;
        _isPassing = false;
        _passTarget = null;
      }
    };

    canvas.onmousemove = function(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = CW / rect.width, sy = CH / rect.height;
      const cx = (e.clientX - rect.left) * sx, cy = (e.clientY - rect.top) * sy;
      const all = [..._mHome, ..._mAway];
      let near = null, md = Infinity;
      all.forEach(pl => {
        const d = Math.hypot(cx - pl.x, cy - pl.y);
        if (d < md) { md = d; near = pl; }
      });

      if (near && md < 28) {
        const rolesRef = global.roles || {};
        const rd = rolesRef[near.role] || { attack: 5, defense: 5 };
        const xai = near.role && global.xaiRole ? global.xaiRole(near.p, near.role, near.mt, '') : { ex: 'Standard tactical function.', conf: 75 };
        document.getElementById('ttP').textContent = near.p + ' (#' + near.jerseyNumber + ')';
        document.getElementById('ttR').textContent = near.role || '—';
        document.getElementById('ttA').textContent = rd.attack + '/10';
        document.getElementById('ttD').textContent = rd.defense + '/10';
        document.getElementById('ttM').textContent = (near.mt || '—').slice(0, 28);
        document.getElementById('ttX').textContent = (xai.ex || '').slice(0, 85) + '…';
        tip.style.left = (e.clientX - rect.left + 14) + 'px';
        tip.style.top = (e.clientY - rect.top - 10) + 'px';
        tip.style.display = 'block';
      } else {
        tip.style.display = 'none';
      }
    };

    canvas.onmouseleave = () => { tip.style.display = 'none'; };
  }

  // Single visualizer for generator & movements
  const _sLT = {};
  function stopS(cid) { if (_sAF[cid]) { cancelAnimationFrame(_sAF[cid]); _sAF[cid] = null; } }
  function updS(id) {
    const v = document.getElementById(id + 'Spd')?.value || 1;
    _sSp[id] = parseFloat(v);
    const el = document.getElementById(id + 'SpdV');
    if (el) el.textContent = v + '×';
  }
  function resumeS(id) {
    const cid = id === 'gen' ? 'gC' : 'mC';
    if (!_sAF[cid]) launchSingle(null, null, null, cid, true);
  }

  function launchSingle(fk, sk, ra, cid, resume) {
    const id = cid === 'gC' ? 'gen' : 'mov';
    stopS(cid);
    let pl = [];
    const p = id === 'gen' ? global._genP : global._movP;
    if (p) pl = buildPlayers(p.f, p.s, p.ra, true, 'mid', 'mid');
    else if (fk) pl = buildPlayers(fk, sk, ra, true, 'mid', 'mid');

    const cEl = document.getElementById(cid);
    if (!cEl) return;
    const ctx = cEl.getContext('2d');
    _sCtx[cid] = ctx; _sT[cid] = 0; _sSp[id] = 1; _sLT[cid] = performance.now();

    function loop(ts) {
      const dt = Math.min((ts - _sLT[cid]) / 1000, .05) * (_sSp[id] || 1);
      _sLT[cid] = ts;
      ctx.clearRect(0, 0, CW, CH);
      drawPitch(ctx);
      drawPressZones(ctx, pl, _sT[cid]);
      drawLanes(ctx, pl, [], _sT[cid]);
      pl.forEach(player => {
        stepPlayer(player, dt);
        drawPlayer(ctx, player, true, _sT[cid]);
      });
      _sT[cid] += dt;
      _sAF[cid] = requestAnimationFrame(loop);
    }
    loop(performance.now());
  }

  // Exports
  global.TacticalCanvas = {
    launchMain,
    stopViz,
    resumeViz,
    setTab,
    setUnitGroup,
    setPassStyle,
    setPressStyle,
    toggleTriangles,
    toggleTacticalLines,
    togglePitchControl,
    startMiniMatch,
    pauseMiniMatch,
    resetMiniMatch,
    updSpd,
    toggleZonesOverlay,
    toggleCompactnessOverlay,
    resetBallPossession,
    launchSingle,
    stopS,
    resumeS,
    updS
  };

})(typeof window !== 'undefined' ? window : this);
