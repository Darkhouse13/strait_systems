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

    // pointer — pointer* events cover both mouse and touch (finger drag)
    let mx = -9999, my = -9999, inside = false;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      inside = true;
    });
    hero.addEventListener('pointerleave', () => {
      inside = false; mx = my = -9999;
    });
    hero.addEventListener('pointercancel', () => {
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
      // the under-layer is fully occluded while every slat is closed —
      // skip the expensive sphere render until something can actually show
      const underVisible = inside || resetting || slats.some((s) => s.open > 0.002);
      if (underVisible) drawUnder(t, P);
      else { ctx1.fillStyle = P.bg; ctx1.fillRect(0, 0, W, H); }

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
      const sec = Math.ceil(remaining);
      if ($timer && sec !== timerShown) {
        timerShown = sec;
        $timer.textContent = `0:${String(sec).padStart(2, '0')}`;
      }
    }

    const $timer = document.getElementById('resetTimer');
    let timerShown = -1;

    // The loop is deferred: one static frame paints immediately, then the
    // continuous animation starts on first interaction (or shortly after
    // load for idle visitors) and pauses whenever the hero is off-screen.
    // Keeps the load main-thread quiet — and the wow intact.
    let rafId = 0, running = false, engaged = false, heroVisible = true;
    function loop(now) {
      frame(now);
      rafId = requestAnimationFrame(loop);
    }
    function start() {
      if (running) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(loop);
    }
    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
    }

    // initial sizing + static paint in their own frame, off the eval task
    requestAnimationFrame((now) => {
      resize();
      new ResizeObserver(resize).observe(hero);
      frame(now);   // static first paint (cheap — slats closed, sphere skipped)
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduceMotion.matches) {
      const kick = () => { engaged = true; if (heroVisible) start(); };
      ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll']
        .forEach((ev) => window.addEventListener(ev, kick, { once: true, passive: true }));
      const armTimer = () => setTimeout(kick, 4000);
      if (document.readyState === 'complete') armTimer();
      else window.addEventListener('load', armTimer, { once: true });

      new IntersectionObserver((entries) => {
        heroVisible = entries.some((e) => e.isIntersecting);
        if (!heroVisible) stop();
        else if (engaged) start();
      }).observe(hero);
    }
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

  // kick off — but only once the sandbox actually scrolls into view, so the
  // log stream schedules no timers (and mutates no DOM) during page load
  if ($log) {
    const sandboxSection = $log.closest('section') || $log;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        startStream(activeKey);
      }
    }, { rootMargin: '160px' });
    io.observe(sandboxSection);
  }

  // ── Canal d'admission ────────────────────────────────────────────────────
  // The contact CTAs open a console-styled intake modal. On submit, a
  // deployment trace streams (reusing the .log aesthetic) and resolves into a
  // receipt — but only after the submission is genuinely delivered.
  (function channel() {
    const modal = document.getElementById('channel');
    const form = document.getElementById('channelForm');
    if (!modal || !form) return;

    // Web3Forms access key — submissions are emailed to the address the key is
    // registered with (mohamed.zitan@straitsystems.com). This is a public
    // submission key (safe in client source); spam is caught by the honeypot.
    const WEB3FORMS_KEY = 'cc83da37-dd0a-42be-b329-ab285739d1e5';
    const ENDPOINT = 'https://api.web3forms.com/submit';
    const FALLBACK_EMAIL = 'mohamed.zitan@straitsystems.com';

    const panel = modal.querySelector('.channel-panel');
    const trace = document.getElementById('channelTrace');
    const receipt = document.getElementById('channelReceipt');
    const logEl = document.getElementById('channelLog');
    const traceActions = document.getElementById('channelTraceActions');
    const stageEl = document.getElementById('channelStage');
    const sessionEl = document.getElementById('channelSession');
    const submitLabel = document.querySelector('#channelSubmit .channel-submit-label');
    const liveEl = document.getElementById('channelLive');
    const slugEl = document.getElementById('channelSlug');
    const kickerEl = document.getElementById('channelKicker');
    const titleEl = document.getElementById('channelTitle');
    const subEl = document.getElementById('channelSub');
    const refEl = document.getElementById('channelRef');
    const receiptStatus = document.getElementById('channelReceiptStatus');
    const receiptMsg = document.getElementById('channelReceiptMsg');
    const retryBtn = document.getElementById('channelRetry');
    const mailtoLink = document.getElementById('channelMailto');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const hex4 = () =>
      ((Math.random() * 65536) | 0).toString(16).padStart(4, '0').toUpperCase();

    const COPY = {
      deploy: {
        slug: 'deploiement',
        kicker: 'Séquence de déploiement',
        title: 'Initier une séquence de déploiement.',
        sub: "Décrivez le périmètre. Strait route votre demande vers l'architecte concerné — réponse depuis Tanger.",
        submit: 'Initier le déploiement',
        refPrefix: 'STRAIT-DPL',
        intentLabel: 'Déploiement',
        receiptStatus: 'Dossier verrouillé',
        receiptMsg: "Votre demande est routée vers l'architecte concerné. Réponse depuis Tanger sous un jour ouvré.",
      },
      briefing: {
        slug: 'briefing',
        kicker: 'Demande de briefing',
        title: 'Programmer un briefing.',
        sub: "Trente minutes avec l'équipe qui opère la pile — une lecture technique de votre contexte, pas une présentation commerciale.",
        submit: 'Verrouiller le briefing',
        refPrefix: 'STRAIT-BRF',
        intentLabel: 'Briefing',
        receiptStatus: 'Briefing verrouillé',
        receiptMsg: "Votre créneau est réservé. L'équipe qui opère la pile vous contacte sous un jour ouvré.",
      },
    };

    let intent = 'deploy';
    let lastFocused = null;
    let runId = 0;
    let busy = false;

    function showState(state) {
      form.hidden = state !== 'form';
      trace.hidden = state !== 'trace';
      receipt.hidden = state !== 'receipt';
      if (panel) panel.scrollTop = 0;
    }

    function open(which) {
      intent = COPY[which] ? which : 'deploy';
      const c = COPY[intent];
      slugEl.textContent = c.slug;
      kickerEl.textContent = c.kicker;
      titleEl.textContent = c.title;
      subEl.textContent = c.sub;
      submitLabel.textContent = c.submit;
      sessionEl.textContent = hex4().toLowerCase();
      traceActions.hidden = true;
      showState('form');
      modal.hidden = false;
      document.body.classList.add('channel-open');
      lastFocused = document.activeElement;
      window.requestAnimationFrame(() => document.getElementById('ch-name')?.focus());
    }

    function close() {
      runId += 1;          // cancel any in-flight stream
      busy = false;
      modal.hidden = true;
      document.body.classList.remove('channel-open');
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    // ── validation ──
    function setError(input, on) {
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      const err = form.querySelector('[data-error-for="' + input.id + '"]');
      if (err) err.classList.toggle('show', on);
    }
    function validate() {
      let firstBad = null;
      ['ch-name', 'ch-email', 'ch-org'].forEach((id) => {
        const input = document.getElementById(id);
        const bad = !input.value.trim() ||
          (input.type === 'email' && !input.checkValidity());
        setError(input, bad);
        if (bad && !firstBad) firstBad = input;
      });
      if (firstBad) firstBad.focus();
      return !firstBad;
    }

    // ── one trace line, same DOM shape as the sandbox log ──
    function traceLine(elapsed, lvl, source, msg) {
      const el = document.createElement('div');
      el.className = 'log-line';

      const t = document.createElement('span');
      t.className = 't';
      t.textContent = '+' + elapsed.toFixed(2).padStart(5, '0');
      el.appendChild(t);

      const lv = document.createElement('span');
      lv.className = 'lvl ' + lvl;
      lv.textContent = lvl.toUpperCase();
      el.appendChild(lv);

      const m = document.createElement('span');
      m.className = 'msg';
      const b = document.createElement('b');
      b.textContent = source + ' ';
      m.appendChild(b);
      m.appendChild(document.createTextNode(msg));
      el.appendChild(m);

      logEl.appendChild(el);
      logEl.scrollTop = logEl.scrollHeight;
    }

    async function sendRequest(payload) {
      const keyMissing = !WEB3FORMS_KEY || WEB3FORMS_KEY.indexOf('REPLACE_WITH') === 0;
      if (keyMissing) {
        // Preview affordance: on localhost / file:// the trace + receipt stay
        // demoable before the Web3Forms key is set. On any real host an unset
        // key resolves to the failure path — nothing pretends to have sent.
        const local =
          ['localhost', '127.0.0.1', '[::1]', ''].indexOf(location.hostname) !== -1;
        if (local) {
          console.warn('[canal] aperçu local — clé Web3Forms absente, aucun e-mail envoyé.');
        }
        return { ok: local };
      }
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json.success === true };
      } catch (e) {
        return { ok: false };
      }
    }

    function showReceipt(ref) {
      const c = COPY[intent];
      refEl.textContent = ref;
      receiptStatus.textContent = c.receiptStatus;
      receiptMsg.textContent = c.receiptMsg;
      showState('receipt');
      liveEl.textContent = c.receiptStatus + ' — référence ' + ref + '. ' + c.receiptMsg;
    }

    function showFailure(payload, ref) {
      traceActions.hidden = false;
      const body =
        'Référence ' + ref + '\n' +
        'Directive : ' + payload.directive + '\n' +
        'Identité : ' + payload.name + '\n' +
        'Entité : ' + payload.organisation + '\n' +
        'Canal de retour : ' + payload.email + '\n\n' +
        'Périmètre :\n' + payload.perimetre + '\n';
      mailtoLink.href =
        'mailto:' + FALLBACK_EMAIL +
        '?subject=' + encodeURIComponent('Strait · ' + COPY[intent].intentLabel + ' [' + ref + ']') +
        '&body=' + encodeURIComponent(body);
      liveEl.textContent = 'La transmission a échoué. Réessayez ou écrivez-nous directement.';
    }

    async function submit() {
      if (busy || !validate()) return;
      const c = COPY[intent];
      const data = new FormData(form);
      if (data.get('botcheck')) return;          // honeypot tripped

      const ref = c.refPrefix + '-' + hex4();
      const directive = String(data.get('directive') || '—');
      const myRun = ++runId;
      busy = true;

      const payload = {
        access_key: WEB3FORMS_KEY,
        subject: 'Strait · ' + c.intentLabel + ' · ' + data.get('organisation') + ' [' + ref + ']',
        from_name: String(data.get('name') || ''),
        name: String(data.get('name') || ''),
        email: String(data.get('email') || ''),
        organisation: String(data.get('organisation') || ''),
        directive: directive,
        perimetre: String(data.get('perimetre') || '').trim() || '—',
        intent: intent,
        ref: ref,
      };

      logEl.innerHTML = '';
      traceActions.hidden = true;
      stageEl.textContent = 'transmission…';
      showState('trace');
      liveEl.textContent = 'Transmission en cours…';

      // fire the request now; let the trace play while it resolves
      const request = sendRequest(payload);
      const animate = !reduceMotion.matches;

      traceLine(0.04, 'exec', '[intake]', 'canal sécurisé établi · TGR-HQ');
      if (animate) await wait(360);
      if (myRun !== runId) return;
      traceLine(0.22, 'info', '[route]', 'requête chiffrée transmise · eu-tgr-1');
      if (animate) await wait(380);
      if (myRun !== runId) return;
      traceLine(0.55, 'info', '[triage]', 'périmètre classé · ' + directive);
      if (animate) await wait(300);
      if (myRun !== runId) return;

      const result = await request;
      if (myRun !== runId) { busy = false; return; }

      if (result.ok) {
        traceLine(1.08, 'ok', '[assign]',
          intent === 'briefing' ? 'créneau de briefing · ouvert'
                                : 'architecte principal · disponible');
        if (animate) await wait(380);
        if (myRun !== runId) { busy = false; return; }
        traceLine(1.31, 'ok', '[lock]',
          (intent === 'briefing' ? 'briefing' : 'dossier') + ' verrouillé · réf ' + ref);
        stageEl.textContent = 'verrouillé';
        if (animate) await wait(420);
        if (myRun !== runId) { busy = false; return; }
        showReceipt(ref);
      } else {
        traceLine(1.10, 'err', '[abort]', 'transmission interrompue · canal fermé');
        stageEl.textContent = 'échec';
        showFailure(payload, ref);
      }
      busy = false;
    }

    // ── wiring ──
    document.querySelectorAll('[data-channel-open]').forEach((btn) => {
      btn.addEventListener('click', () => open(btn.getAttribute('data-channel-open')));
    });
    modal.querySelectorAll('[data-channel-close]').forEach((el) => {
      el.addEventListener('click', close);
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    retryBtn.addEventListener('click', () => {
      runId += 1;
      busy = false;
      traceActions.hidden = true;
      showState('form');
      document.getElementById('ch-name')?.focus();
    });
    ['ch-name', 'ch-email', 'ch-org'].forEach((id) => {
      document.getElementById(id)
        ?.addEventListener('input', (e) => setError(e.target, false));
    });

    // keyboard — Escape closes, Tab is trapped within the panel
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])'
      )).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  })();

  // ── Nav scroll-spy ───────────────────────────────────────────────────────
  // Moves the accent underline onto the nav link whose section is in view.
  // Without this, .active stays on whichever link is hard-coded in the HTML.
  (function navSpy() {
    const nav = document.querySelector('.nav');
    const links = Array.from(document.querySelectorAll('.nav-link'));
    if (!nav || !links.length) return;

    // pair each link with the element it targets (document/vertical order)
    const targets = links
      .map((link) => {
        const id = (link.getAttribute('href') || '').replace(/^#/, '');
        const el = id && document.getElementById(id);
        return el ? { link, el } : null;
      })
      .filter(Boolean);
    if (!targets.length) return;

    let ticking = false;
    function update() {
      ticking = false;
      // a line just below the sticky nav — the section crossing it is "current"
      const marker = nav.offsetHeight + 24;
      let current = targets[0];
      for (const t of targets) {
        if (t.el.getBoundingClientRect().top <= marker) current = t;
      }
      links.forEach((l) => l.classList.toggle('active', l === current.link));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();
})();
