/* ========================================================================
   Strait Systems — interactivity
   - Theme toggle (persists)
   - Hero convergence visual (SVG nodes + animated streams)
   - Sandbox tabs with rotating log stream + metrics
   ======================================================================== */

(function () {
  const root = document.documentElement;
  const STORAGE_THEME = 'strait.theme';

  // ── Theme ────────────────────────────────────────────────────────────────
  const applyTheme = (t) => {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(STORAGE_THEME, t); } catch (e) {}
  };
  try {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved === 'light' || saved === 'dark') applyTheme(saved);
  } catch (e) {}

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // Expose for the Tweaks panel
  window.straitApplyTheme = applyTheme;

  // ── Hero E4 · Volets blindés ───────────────────────────────────────────
  // Two stacked canvases:
  //   #under — rotating 3D wireframe + compass ring (the "vault core")
  //   #veil  — vertical louvered shutters that split apart under the cursor
  (function heroE4() {
    const hero = document.getElementById('hero');
    const cv1 = document.getElementById('under');
    const cv2 = document.getElementById('veil');
    if (!hero || !cv1 || !cv2) return;
    const ctx1 = cv1.getContext('2d');
    const ctx2 = cv2.getContext('2d');
    const PI2 = Math.PI * 2;
    let W = 0, H = 0, dpr = 1;

    // theme palettes — picked at the top of each frame so toggling
    // data-theme on the html element updates the canvas live
    const PALETTES = {
      dark: {
        bg: '#02060d',
        halo: ['rgba(77,217,255,.13)', 'rgba(94,255,214,.05)', 'rgba(0,0,0,0)'],
        edge: (d) => `rgba(77,217,255,${0.10 + d * 0.35})`,
        vert: (d) => `rgba(94,255,214,${0.3 + d * 0.6})`,
        glyphMark: 'rgba(77,217,255,.7)',
        glyphDot:  'rgba(120,160,220,.32)',
        slatTop: '#0d1422',
        slatMid: '#161e30',
        slatBot: '#0a101b',
        slatEdge: 'rgba(255,255,255,0.06)',
        slatSeam: 'rgba(0,0,0,0.5)',
        rivet:    'rgba(120,140,170,.32)',
        glow:    (a) => `rgba(77,217,255,${a})`,
        cursor:  ['rgba(77,217,255,.18)', 'rgba(77,217,255,.06)', 'rgba(77,217,255,0)'],
      },
      light: {
        bg: '#e6ebf3',
        halo: ['rgba(0,123,182,.10)', 'rgba(0,169,138,.04)', 'rgba(255,255,255,0)'],
        edge: (d) => `rgba(0,123,182,${0.18 + d * 0.45})`,
        vert: (d) => `rgba(0,140,108,${0.35 + d * 0.55})`,
        glyphMark: 'rgba(0,123,182,.85)',
        glyphDot:  'rgba(120,140,180,.38)',
        slatTop: '#f6f8fc',
        slatMid: '#e3e8f1',
        slatBot: '#c8d1de',
        slatEdge: 'rgba(255,255,255,0.65)',
        slatSeam: 'rgba(30,42,68,0.32)',
        rivet:    'rgba(80,100,130,.45)',
        glow:    (a) => `rgba(0,123,182,${a})`,
        cursor:  ['rgba(0,123,182,.20)', 'rgba(0,123,182,.07)', 'rgba(0,123,182,0)'],
      },
    };
    function currentPalette() {
      return document.documentElement.getAttribute('data-theme') === 'light'
        ? PALETTES.light
        : PALETTES.dark;
    }

    // ── UNDER: rotating wireframe sphere + outer compass glyphs ──
    let verts = [], edges = [];
    function initMesh() {
      verts = []; edges = [];
      const N_THETA = 12, N_PHI = 10;
      for (let i = 1; i < N_PHI; i++) {
        const phi = (i / N_PHI) * Math.PI;
        const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
        for (let j = 0; j < N_THETA; j++) {
          const th = (j / N_THETA) * PI2;
          verts.push({
            x: sinPhi * Math.cos(th),
            y: cosPhi,
            z: sinPhi * Math.sin(th),
            ring: i, idx: j,
          });
        }
      }
      for (let v = 0; v < verts.length; v++) {
        const A = verts[v];
        for (let w = v + 1; w < verts.length; w++) {
          const B = verts[w];
          const sameRing = (A.ring === B.ring) &&
            (Math.abs(A.idx - B.idx) === 1 || Math.abs(A.idx - B.idx) === N_THETA - 1);
          const nextRing = (B.ring === A.ring + 1) &&
            (A.idx === B.idx || (A.idx + 1) % N_THETA === B.idx);
          if (sameRing || nextRing) edges.push([v, w]);
        }
      }
    }

    function drawUnder(t, P) {
      ctx1.fillStyle = P.bg;
      ctx1.fillRect(0, 0, W, H);

      const g = ctx1.createRadialGradient(W * 0.55, H * 0.5, 0, W * 0.55, H * 0.5, Math.max(W, H) * 0.55);
      g.addColorStop(0, P.halo[0]);
      g.addColorStop(0.4, P.halo[1]);
      g.addColorStop(1, P.halo[2]);
      ctx1.fillStyle = g;
      ctx1.fillRect(0, 0, W, H);

      const cx = W * 0.55, cy = H * 0.50;
      const R = Math.min(W, H) * 0.42;
      const ay = t * 0.30, ax = Math.sin(t * 0.13) * 0.35;
      const cay = Math.cos(ay), say = Math.sin(ay);
      const cax = Math.cos(ax), sax = Math.sin(ax);
      const proj = verts.map((v) => {
        const rx = v.x * cay + v.z * say;
        const rz = -v.x * say + v.z * cay;
        const ry = v.y;
        const ry2 = ry * cax - rz * sax;
        const rz2 = ry * sax + rz * cax;
        return { px: cx + rx * R, py: cy + ry2 * R, depth: (rz2 + 1) / 2 };
      });

      for (const [i, j] of edges) {
        const A = proj[i], B = proj[j];
        const dep = Math.min(A.depth, B.depth);
        ctx1.strokeStyle = P.edge(dep);
        ctx1.lineWidth = 0.8 + dep * 0.8;
        ctx1.beginPath();
        ctx1.moveTo(A.px, A.py); ctx1.lineTo(B.px, B.py);
        ctx1.stroke();
      }
      for (const p of proj) {
        ctx1.fillStyle = P.vert(p.depth);
        const r = 1 + p.depth * 1.8;
        ctx1.beginPath();
        ctx1.arc(p.px, p.py, r, 0, PI2);
        ctx1.fill();
      }

      const ringR = R * 1.18;
      ctx1.font = '10px "JetBrains Mono", monospace';
      ctx1.textAlign = 'center';
      ctx1.textBaseline = 'middle';
      const M = 36;
      for (let i = 0; i < M; i++) {
        const a = (i / M) * PI2 + t * 0.08;
        const x = cx + Math.cos(a) * ringR;
        const y = cy + Math.sin(a) * ringR;
        const tag = (i % 6 === 0) ? '◆' : '·';
        ctx1.fillStyle = tag === '◆' ? P.glyphMark : P.glyphDot;
        ctx1.fillText(tag, x, y);
      }
    }

    // ── VEIL: vertical metal louvers that split open ──
    const SLAT_W = 44;
    let slats = [];
    function rebuild() {
      slats = [];
      const cols = Math.ceil(W / SLAT_W) + 1;
      for (let c = 0; c < cols; c++) {
        slats.push({ x: c * SLAT_W, open: 0, target: 0, resetDelay: -1 });
      }
    }

    const RESET_INTERVAL = 9;
    let lastResetT = 0, resetting = false, resetStart = 0;
    function startReset(tNow) {
      resetting = true;
      resetStart = tNow;
      const leftToRight = Math.random() < 0.5;
      for (const s of slats) {
        if (s.open <= 0) { s.resetDelay = -1; continue; }
        const p = leftToRight ? (s.x / W) : (1 - s.x / W);
        s.resetDelay = p * 0.7;
        s.target = 0;
      }
      const el = document.getElementById('layerId');
      if (el) el.textContent = ((Math.random() * 65536) | 0).toString(16).padStart(4, '0').toUpperCase();
    }
    function updateReset(tNow, dt) {
      if (!resetting) return;
      const elapsed = tNow - resetStart;
      let pending = false;
      for (const s of slats) {
        if (s.resetDelay < 0) continue;
        if (elapsed > s.resetDelay) {
          s.open -= dt * 3.2;
          if (s.open <= 0) { s.open = 0; s.resetDelay = -1; }
          else pending = true;
        } else pending = true;
      }
      if (!pending) resetting = false;
    }

    // pointer
    let mx = -9999, my = -9999, inside = false;
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      inside = true;
    });
    hero.addEventListener('mouseleave', () => {
      inside = false; mx = my = -9999;
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      for (const c of [cv1, cv2]) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      ctx1.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
      initMesh();
    }

    let last = 0;
    function frame(now) {
      const t = now / 1000;
      const dt = Math.min(0.05, last ? t - last : 0.016);
      last = t;

      if (!resetting && (t - lastResetT) > RESET_INTERVAL) {
        lastResetT = t;
        if (slats.some((s) => s.open > 0)) startReset(t);
      }

      if (!resetting) {
        const R = 140;
        for (const s of slats) {
          const cx = s.x + SLAT_W / 2;
          const dx = cx - mx;
          const distX = Math.abs(dx);
          if (inside && distX < R) {
            s.target = (1 - distX / R);
          } else {
            s.target = Math.max(0, s.target - dt * 0.8);
          }
          const speed = (s.target > s.open ? 4.5 : 1.8);
          s.open += (s.target - s.open) * dt * speed;
          if (s.open < 0) s.open = 0;
          if (s.open > 1) s.open = 1;
        }
      }
      updateReset(t, dt);

      const P = currentPalette();
      drawUnder(t, P);

      ctx2.clearRect(0, 0, W, H);
      for (const s of slats) {
        const open = s.open;
        if (open >= 0.999) continue;
        const half = SLAT_W / 2;
        const shift = open * half;
        const lw = Math.max(0, half - shift);
        const rwx = s.x + half + shift;
        const rw = Math.max(0, half - shift);

        const grad = ctx2.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, P.slatTop);
        grad.addColorStop(0.5, P.slatMid);
        grad.addColorStop(1, P.slatBot);
        ctx2.fillStyle = grad;
        if (lw > 0) ctx2.fillRect(s.x, 0, lw, H);
        if (rw > 0) ctx2.fillRect(rwx, 0, rw, H);

        if (open > 0.02) {
          const glow = ctx2.createLinearGradient(s.x + half - 16, 0, s.x + half + 16, 0);
          glow.addColorStop(0, P.glow(0));
          glow.addColorStop(0.5, P.glow(0.25 + open * 0.35));
          glow.addColorStop(1, P.glow(0));
          ctx2.fillStyle = glow;
          ctx2.fillRect(s.x + half - 16, 0, 32, H);
        }

        ctx2.fillStyle = P.slatEdge;
        if (lw > 0) ctx2.fillRect(s.x + lw - 1, 0, 1, H);
        if (rw > 0) ctx2.fillRect(rwx, 0, 1, H);
        ctx2.fillStyle = P.slatSeam;
        ctx2.fillRect(s.x, 0, 1, H);

        ctx2.fillStyle = P.rivet;
        ctx2.beginPath();
        ctx2.arc(s.x + half, 16, 1.5, 0, PI2);
        ctx2.arc(s.x + half, H - 16, 1.5, 0, PI2);
        ctx2.fill();
      }

      if (inside) {
        ctx2.globalCompositeOperation = 'source-atop';
        const grad = ctx2.createRadialGradient(mx, my, 0, mx, my, 160);
        grad.addColorStop(0, P.cursor[0]);
        grad.addColorStop(0.5, P.cursor[1]);
        grad.addColorStop(1, P.cursor[2]);
        ctx2.fillStyle = grad;
        ctx2.fillRect(0, 0, W, H);
        ctx2.globalCompositeOperation = 'source-over';
      }

      const remaining = Math.max(0, RESET_INTERVAL - (t - lastResetT));
      const el = document.getElementById('resetTimer');
      if (el) el.textContent = `0:${String(Math.ceil(remaining)).padStart(2, '0')}`;
      requestAnimationFrame(frame);
    }

    resize();
    new ResizeObserver(resize).observe(hero);
    requestAnimationFrame(frame);
  })();

  // ── Sandbox ─────────────────────────────────────────────────────────────
  const SANDBOX = {
    'db-sync': {
      title: 'Optimisation de sync base de données',
      desc: "Synchronisation bidirectionnelle continue entre un cluster Oracle on-prem et un ensemble de répliques Postgres multi-régions. L'orchestrateur Strait détecte la dérive de schéma et reroute les écritures sans perdre de transactions en vol.",
      slug: 'db-sync',
      agent: 'db-sync',
      metrics: { throughput: '12 840 req/s', latency: '42 ms', nodes: '12 / 12', errors: '0,002 %' },
      lines: [
        ['info', '[orchestrateur]', 'liaison à', { k: 'eu-tgr-1.strait.internal', v: ':9443' }],
        ['ok',   '[handshake]',    'mTLS établi avec', { k: 'oracle-primary', v: '#a31f' }],
        ['info', '[orchestrateur]', 'topologie shard résolue · ', { v: '12 shards · poids=équilibrés' }],
        ['exec', '$ strait sync',  '--profile=throughput --auto-rebalance'],
        ['info', '[flux:01]',      'lecture position WAL', { v: '0x00ff34a1' }],
        ['ok',   '[flux:01]',      'répliqué', { v: '14 221 lignes' }, 'en', { v: '38 ms' }],
        ['info', '[flux:04]',      'dérive de schéma détectée sur la table', { k: 'orders' }, '· auto-migration'],
        ['warn', '[flux:04]',      'colonne', { k: 'orders.region_code' }, 'élargie ', { v: 'VARCHAR(2)→VARCHAR(3)' }],
        ['ok',   '[flux:04]',      'migration appliquée à', { v: '12/12 shards · 0 erreur' }],
        ['info', '[routeur]',      'reroutage des écritures via', { k: 'eu-fra-2', v: '· p99 ↘ 38 ms' }],
        ['ok',   '[santé]',        'toutes les répliques convergées · checkpoint', { v: '0x00ff34c8' }],
        ['info', '[ordonnanceur]', 'prochaine fenêtre de sync dans', { v: '00:00:14' }],
      ],
    },
    'market-agent': {
      title: 'Analyse de marché autonome',
      desc: "Un ensemble de quatre agents qui surveille les flux actions, FX et matières premières, rédige un briefing quotidien et soumet ses hypothèses de stratégie à un relecteur humain. Fonctionne 24/7 sur trois fuseaux horaires.",
      slug: 'market-agent',
      agent: 'market-analyst',
      metrics: { throughput: '348 sig/h', latency: '1,2 s', nodes: '4 / 4', errors: '0,04 %' },
      lines: [
        ['info', '[superviseur]',   "instanciation de l'ensemble · ", { v: '4 agents · ttl=24h' }],
        ['ok',   '[agent:scout]',   'abonné au flux', { k: 'eurex.xetra.l2' }],
        ['ok',   '[agent:scout]',   'abonné au flux', { k: 'cme.fx.eur-mad' }],
        ['info', '[agent:scout]',   "score d'anomalie sur", { k: 'TGRMA.MAD', v: '0,81' }, '· escalade'],
        ['exec', '> analyste :',    'investigate( ticker="TGRMA.MAD", window=4h )'],
        ['info', '[agent:analyste]', "récupération de l'historique 4h · ", { v: '14 802 échantillons' }],
        ['ok',   '[agent:analyste]', 'pic de volume corrélé à', { k: 'shipping.gibraltar', v: 'σ=2,4' }],
        ['info', '[agent:rédacteur]','rédaction du briefing · ', { v: 'sections=3 · est=800 mots' }],
        ['ok',   '[agent:rédacteur]','briefing terminé · en attente de relecture humaine · ', { v: 'rév#481' }],
        ['warn', '[garde-fou]',     'assertion à faible confiance signalée · ', { k: 'attente relecteur' }],
        ['info', '[superviseur]',   'ensemble inactif · prochain tick', { v: '00:00:06' }],
      ],
    },
    'legacy-migration': {
      title: 'Migration ETL legacy',
      desc: "Remplacement d'un pipeline SSIS de 14 ans chez un assureur casablancais. Strait exécute l'ancien et le nouveau pipeline en parallèle, réconcilie les différences ligne à ligne et ne bascule que lorsque la dérive sur 14 jours passe sous 0,001 %.",
      slug: 'legacy-migration',
      agent: 'etl-migrator',
      metrics: { throughput: '4,2 M lignes/h', latency: '110 ms', nodes: '6 / 6', errors: '0,0008 %' },
      lines: [
        ['info', '[migrateur]',  'exécution parallèle · jour', { v: '11 / 14' }],
        ['info', '[migrateur]',  "ingestion de l'export SSIS legacy depuis", { k: 'casa-fs-01' }],
        ['ok',   '[transform]',  'normalisé', { v: '4 201 820 lignes' }, '· encodage ', { v: 'cp1256→utf8' }],
        ['info', '[réconcil]',   'comparaison des checksums · ', { v: '12 partitions' }],
        ['warn', '[réconcil]',   'dérive détectée sur', { k: 'claims.policy_no' }, '· 14 lignes diffèrent'],
        ['exec', '$ strait diff','--table=claims --since=2026-05-01'],
        ['ok',   '[diff]',       'cause racine · ', { v: "espaces de fin dans l'export legacy" }],
        ['ok',   '[transform]',  'règle de trim appliquée à', { k: 'claims.policy_no' }],
        ['ok',   '[réconcil]',   'dérive 14j désormais', { v: '0,0008 % · < seuil 0,001' }],
        ['info', '[migrateur]',  'prêt pour cutover ', { v: 'CONFIRMÉ' }, '· validation humaine requise'],
      ],
    },
    'supply-chain': {
      title: "Maillage d'agents supply chain",
      desc: "Un maillage de 23 agents négociateurs représentant transporteurs, entrepôts, courtiers en douane et autorités portuaires. Replanifie automatiquement le corridor Tanger→Marseille quand la confiance d'ETA chute sous 92 %.",
      slug: 'supply-chain',
      agent: 'mesh-orchestrator',
      metrics: { throughput: '23 agents', latency: '420 ms', nodes: '23 / 23', errors: '0,01 %' },
      lines: [
        ['info', '[maillage]',       'topologie · ', { v: '23 agents · 8 transporteurs · 4 ports' }],
        ['ok',   '[carrier:CMA]',    'devis reçu · ', { v: 'TGR→MRS · 38 h · 2 140 EUR' }],
        ['ok',   '[carrier:MSK]',    'devis reçu · ', { v: 'TGR→MRS · 41 h · 1 980 EUR' }],
        ['info', '[prévision]',      "confiance ETA sur conteneur", { k: 'CONT-04812', v: '88 %' }],
        ['warn', '[prévision]',      'sous le seuil · ', { v: 'replanification' }],
        ['exec', '> orchestrateur :', 'negotiate( legs=[TGR,VAL,MRS], target_eta="38h" )'],
        ['ok',   '[douane:MA]',      'pré-dédouanement approuvé · ', { v: 'doc#TG-26-08812' }],
        ['ok',   '[port:VAL]',       'créneau de quai réservé · ', { v: '2026-05-21 04:30 UTC' }],
        ['ok',   '[maillage]',       'nouveau plan accepté par', { v: '5 / 5 parties prenantes' }],
        ['info', '[maillage]',       'surveillance · prochain replan ', { v: '< 92 % confiance' }],
      ],
    },
  };

  const $tabs = document.getElementById('sandboxTabs');
  const $log = document.getElementById('log');
  const $title = document.getElementById('sbTitle');
  const $desc = document.getElementById('sbDesc');
  const $slug = document.getElementById('pathSlug');
  const $agent = document.getElementById('sbAgent');
  const $session = document.getElementById('sbSession');
  const $count = document.getElementById('sbCount');
  const $metrics = document.getElementById('sbMetrics');

  let activeKey = 'db-sync';
  let currentRun = 0;
  let eventCount = 0;
  const MAX_LINES = 14;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function nowStamp() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,'0')}`;
  }

  function renderLine(line) {
    const [lvl, source, ...rest] = line;
    const el = document.createElement('div');
    el.className = 'log-line';

    const t = document.createElement('span');
    t.className = 't';
    t.textContent = nowStamp();
    el.appendChild(t);

    const lv = document.createElement('span');
    lv.className = `lvl ${lvl}`;
    lv.textContent = lvl.toUpperCase();
    el.appendChild(lv);

    const msg = document.createElement('span');
    msg.className = 'msg';
    const src = document.createElement('b');
    src.textContent = source + ' ';
    msg.appendChild(src);
    rest.forEach((bit) => {
      if (typeof bit === 'string') {
        msg.appendChild(document.createTextNode(bit + ' '));
      } else if (bit && typeof bit === 'object') {
        if (bit.k) {
          const s = document.createElement('span');
          s.className = 'k';
          s.textContent = bit.k + ' ';
          msg.appendChild(s);
        }
        if (bit.v) {
          const s = document.createElement('span');
          s.className = 'v';
          s.textContent = bit.v + ' ';
          msg.appendChild(s);
        }
      }
    });
    el.appendChild(msg);
    return el;
  }

  function trimLog() {
    while ($log.children.length > MAX_LINES) {
      $log.removeChild($log.firstChild);
    }
  }

  async function startStream(key) {
    currentRun += 1;
    const myRun = currentRun;
    const data = SANDBOX[key];
    if (!data) return;

    $title.textContent = data.title;
    $desc.textContent = data.desc;
    $slug.textContent = data.slug;
    $agent.textContent = data.agent;
    $session.textContent = Math.random().toString(16).slice(2, 6);
    eventCount = 0;
    $count.textContent = '0 événements';
    $log.innerHTML = '';

    // metrics
    if ($metrics && data.metrics) {
      $metrics.querySelectorAll('[data-k]').forEach((el) => {
        const k = el.getAttribute('data-k');
        if (data.metrics[k]) el.textContent = data.metrics[k];
      });
    }

    let i = 0;
    while (myRun === currentRun) {
      const line = data.lines[i % data.lines.length];
      const node = renderLine(line);
      $log.appendChild(node);
      trimLog();
      $log.scrollTop = $log.scrollHeight;
      eventCount += 1;
      $count.textContent = eventCount + ' événements';
      i += 1;
      // jitter so it feels like a real log, not a metronome
      const delay = 380 + Math.random() * 720;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  $tabs?.addEventListener('click', (e) => {
    const btn = e.target.closest('.sandbox-tab');
    if (!btn) return;
    const key = btn.dataset.tab;
    if (key === activeKey) return;
    $tabs.querySelectorAll('.sandbox-tab').forEach((b) => b.classList.toggle('active', b === btn));
    activeKey = key;
    startStream(key);
  });

  // kick off
  startStream(activeKey);
})();
