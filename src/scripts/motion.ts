// Motion layer for the LemmaComputer landing page. GSAP + ScrollTrigger load
// globally from CDN in BaseLayout, so we read them off window rather than
// importing an npm package (keeps the first-party JS budget near-zero).
// Everything degrades gracefully: under prefers-reduced-motion the CSS keeps
// all [data-r] content visible and the deck/governance render in their final
// static state, and this file skips the animated paths.
declare const gsap: any;
declare const ScrollTrigger: any;

const g = (window as any).gsap as any;
const ST = (window as any).ScrollTrigger as any;

if (g && ST) {
  g.registerPlugin(ST);

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  const DESKTOP = matchMedia('(min-width: 901px)').matches;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;
  const qsa = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
    ([] as T[]).slice.call(root.querySelectorAll(sel));

  /* THEME TOGGLE — flip + a small verdigris knob pop on click. */
  const tgl = $('tgl');
  if (tgl) {
    tgl.onclick = () => {
      const r = document.documentElement;
      r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
      if (!RM) g.fromTo(tgl, { scale: 0.9 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
    };
  }

  /* NAV STATE — frosted bar drops the difference blend once scrolled. */
  const nav = $('nav');
  function navState() {
    if (nav) nav.classList.toggle('on', scrollY > 40);
  }
  addEventListener('scroll', navState, { passive: true });
  navState();

  /* REVEALS — one-shot fade/rise. Suppressed under reduced motion (CSS keeps
     [data-r] visible), so nothing is ever stranded at opacity 0. */
  if (!RM)
    g.utils.toArray('[data-r]').forEach(function (el: HTMLElement) {
      g.from(el, {
        opacity: 0,
        y: 24,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

  /* HERO WORD STAGGER — each word is its own .w span; rise them in behind a
     line clip. Falls back to the plain [data-r] reveal under RM. */
  const heroH = document.querySelector('[data-hero-h]') as HTMLElement | null;
  if (heroH && !RM) {
    const words = qsa('.w', heroH);
    g.set(words, { yPercent: 110 });
    g.to(words, {
      yPercent: 0,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.07,
      delay: 0.1,
    });

    /* SIGNATURE DRAW-ON — a single verdigris stroke draws left→right under
       "One governed computer." CSS ships the drawn state (offset 0), so this
       resets the offset to the full dash length, then tweens it back to 0. The
       draw starts at 1.15s — as the last word's rise (starts ~0.38s, ends
       ~1.48s) is settling — so the underline reads as the closing stroke of one
       gesture, not a separate beat. Only runs with motion on (block is !RM). */
    const sig = heroH.querySelector('.hero-sig-line') as SVGElement | null;
    if (sig) {
      g.set(sig, { strokeDashoffset: 320 });
      g.to(sig, {
        strokeDashoffset: 0,
        duration: 0.9,
        ease: 'power2.inOut',
        delay: 1.15,
      });
    }
  }

  /* SCROLL-PROGRESS HAIRLINE — scaleX tracks document scroll. */
  const bar = $('scrollbar');
  if (bar && !RM) {
    ST.create({
      start: 0,
      end: 'max',
      onUpdate: (self: any) => g.set(bar, { scaleX: self.progress }),
    });
  }

  /* MAGNETIC PRIMARY BUTTONS — pointer nudges the button toward the cursor.
     Fine pointers only; transform-only; off under RM. */
  if (FINE && !RM) {
    qsa('.btn-p').forEach((btn) => {
      const xTo = g.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = g.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.4);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.5);
      });
      btn.addEventListener('pointerleave', () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* GENTLE PARALLAX — tiny transform-only drift on cards. */
  if (!RM)
    qsa('.card').forEach((el) => {
      g.fromTo(
        el,
        { yPercent: 4 },
        {
          yPercent: -4,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        }
      );
    });

  /* MODEL MODE CYCLE — the Auto/Lite/Balanced/Pro pills softly cycle to hint
     the mode is selectable. Decorative; off under RM. */
  const modes = qsa('.mode-pill');
  if (modes.length && !RM) {
    let cur = 0;
    modes[0]!.classList.add('is-on');
    setInterval(function () {
      modes[cur]!.classList.remove('is-on');
      cur = (cur + 1) % modes.length;
      modes[cur]!.classList.add('is-on');
    }, 2200);
  } else if (modes.length) {
    modes[0]!.classList.add('is-on');
  }

  /* ------------------------------------------------------------------ *
   * SHOT DECK — pinned two-column scrollytelling carousel.
   * The six product shots sit side-by-side in one horizontal .deck-track;
   * pinning the .deck-stage and scrubbing the track's xPercent turns vertical
   * scroll into a horizontal pan. The right-hand feature rail highlights the
   * shot currently centered (and fills its ring marker + swaps the caption);
   * clicking a rail feature — or a #computer/#schedules "See the … screen ↑"
   * anchor — scroll-jumps the page to that shot's slice of the pin. Arrow keys
   * on the rail do the same. Under reduced motion / non-desktop the CSS lays
   * every shot + feature out in flow and this early-returns (mobile gets a
   * native scroll-snap swiper; nothing is pinned or scroll-jacked).
   * ------------------------------------------------------------------ */
  function initDeckScroll() {
    const deck = document.querySelector('[data-deck]') as HTMLElement | null;
    if (!deck) return;
    const stage = deck.querySelector('.deck-stage') as HTMLElement | null;
    const track = deck.querySelector('[data-deck-track]') as HTMLElement | null;
    const feats = qsa<HTMLButtonElement>('.deck-feat', deck);
    const panes = qsa('.deck-pane', deck);
    const cap = deck.querySelector('.deck-cap') as HTMLElement | null;
    const capMap = new Map<string, string>();
    qsa('[data-cap-for]', deck).forEach((el) => {
      const id = el.getAttribute('data-cap-for');
      if (id) capMap.set(id, el.textContent || '');
    });
    const n = feats.length;
    if (!stage || !track || n === 0) return;

    const RING = 2 * Math.PI * 16;
    let active = 0;

    const paneIdOf = (feat: HTMLButtonElement) =>
      (feat.getAttribute('aria-controls') || '').replace(/^pane-/, '');
    const ringFg = (i: number) => feats[i]?.querySelector('.ring-fg') as SVGElement | null;

    // Reflect the centered shot into the rail: highlight its feature, fill its
    // ring, mark its pane .is-on, and swap the live caption. Pure reflection of
    // scroll state — never drives the scroll itself.
    function markActive(i: number) {
      if (i === active) return;
      active = i;
      feats.forEach((f, k) => {
        const on = k === i;
        f.classList.toggle('is-on', on);
        f.setAttribute('aria-selected', on ? 'true' : 'false');
        f.tabIndex = on ? 0 : -1;
        const fg = ringFg(k);
        if (fg) g.set(fg, { strokeDashoffset: on ? 0 : RING });
      });
      panes.forEach((p, k) => p.classList.toggle('is-on', k === i));
      const id = paneIdOf(feats[i]!);
      if (cap && capMap.has(id)) cap.textContent = capMap.get(id)!;
    }

    // Reduced motion / non-desktop: no pin, no scrub. Show all features lit and
    // let the CSS present the shots in flow (or as a swipe scroller on mobile).
    if (RM || !DESKTOP) {
      feats.forEach((f, k) => {
        f.tabIndex = k === 0 ? 0 : -1;
        const fg = ringFg(k);
        if (fg) g.set(fg, { strokeDashoffset: 0 });
      });
      return;
    }

    // Pin the stage from its own top and scrub the track left. ~120% of the
    // fold per shot gives an unhurried pan without dead scroll at the end.
    const pinLen = () => stage.offsetHeight * 1.2 * (n - 1);
    const st = ST.create({
      trigger: stage,
      start: 'top top',
      end: () => '+=' + pinLen(),
      pin: stage,
      scrub: 0.6,
      invalidateOnRefresh: true,
      // Refresh AFTER the earlier pins (arch, proof) so this pin's start is
      // measured against a document that already includes their pin-spacers.
      // Descending priority = top-to-bottom refresh order (arch 30 > proof 20 >
      // deck 10); without it the sequential pins miscompute and overlap.
      refreshPriority: 10,
      onUpdate: (self: any) => {
        g.set(track, { xPercent: -100 * (n - 1) * self.progress });
        markActive(Math.round(self.progress * (n - 1)));
      },
    });

    // Scroll the PAGE so the pin lands on shot i (scrub then centers it).
    // Native smooth scroll — no ScrollToPlugin dependency (only gsap +
    // ScrollTrigger are loaded from the CDN).
    function goToShot(i: number) {
      const idx = Math.max(0, Math.min(n - 1, i));
      const start = st.start as number;
      const len = (st.end as number) - start;
      const y = start + (len * idx) / (n - 1);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    feats.forEach((feat, i) => {
      feat.addEventListener('click', () => goToShot(i));
      feat.addEventListener('keydown', (e: KeyboardEvent) => {
        let t = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') t = i + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') t = i - 1;
        else if (e.key === 'Home') t = 0;
        else if (e.key === 'End') t = n - 1;
        if (t >= 0 && t < n) {
          e.preventDefault();
          feats[t]!.focus();
          goToShot(t);
        }
      });
    });

    // Thin #computer / #schedules anchor links jump to their shot.
    qsa<HTMLAnchorElement>('[data-select-tab]').forEach((a) => {
      a.addEventListener('click', () => {
        const id = a.getAttribute('data-select-tab');
        if (!id) return;
        const idx = feats.findIndex((f) => paneIdOf(f) === id);
        if (idx >= 0) setTimeout(() => goToShot(idx), 60);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * DESKTOP PROOF — pinned two-panel horizontal pan.
   * The two full-Ubuntu-desktop shots sit side by side; pinning the stage and
   * scrubbing the track from 0 → -100% pans from the first to the second under
   * vertical scroll. No rail, no captions to swap (each figure keeps its own).
   * Same desktop-only guard as the deck; mobile/RM get the native scroller.
   * ------------------------------------------------------------------ */
  function initProofRail() {
    const stage = document.querySelector('[data-proof]') as HTMLElement | null;
    const track = stage?.querySelector('[data-proof-track]') as HTMLElement | null;
    if (!stage || !track) return;
    if (RM || !DESKTOP) return;

    ST.create({
      trigger: stage,
      start: 'top top',
      end: '+=120%',
      pin: stage,
      scrub: 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 20, // refresh after arch (30), before deck (10) — DOM order
      onUpdate: (self: any) => g.set(track, { xPercent: -100 * self.progress }),
    });
  }

  /* ------------------------------------------------------------------ *
   * ARCHITECTURE HERO — scroll-driven "assemble → swap → run" story.
   * The centerpiece: any agent plugs into one governed VM sandbox; everyday
   * work flows through; the risky moves (web/egress, tools/MCP) are caught.
   * Beats: 1 ASSEMBLE (boundary draws, guardrails fade in) → 2 SWAP (agent
   * chips weave into the socket) → 3 RUN (a good + a risky action leave the
   * agent; the risky one is stopped at a watched path, the good one is
   * recorded to the signed trail). Straight x/y + class-toggle only — no
   * MotionPathPlugin. Under RM / narrow screens the CSS shows the final
   * assembled, fully-lit state and this early-returns.
   * ------------------------------------------------------------------ */
  function initArch() {
    const stage = document.querySelector('[data-arch]') as HTMLElement | null;
    const section = $('governance');
    if (!stage || !section) return;
    if (RM || !DESKTOP) return; // desktop-only pinned timeline; mobile uses initArchMobile, RM stays static

    const node = (n: string) => stage.querySelector(`[data-node="${n}"]`) as HTMLElement | null;
    const notes = qsa('.arch-note', section);
    const socket = stage.querySelector('[data-arch-socket]') as HTMLElement | null;
    const boundary = stage.querySelector('[data-boundary]') as HTMLElement | null;
    const chips = qsa('.arch-chip', stage);
    const edgeIn = stage.querySelector('[data-edge="in"]') as HTMLElement | null;
    const run = node('run');
    const web = node('web');
    const tools = node('tools');
    const trail = node('trail');
    const pktAgent = stage.querySelector('[data-pkt="agent"]') as HTMLElement | null;
    const good = stage.querySelector('[data-pkt="good"]') as HTMLElement | null;
    const risk = stage.querySelector('[data-pkt="risk"]') as HTMLElement | null;
    const trailRow = stage.querySelector('[data-trail-row]') as HTMLElement | null;

    const litNote = (i: number) => notes.forEach((b, k) => b.classList.toggle('lit', k === i));

    // Chips start stacked out of the socket; swap = each docks then yields.
    g.set(chips, { autoAlpha: 0, y: -14 });
    g.set([good, risk, pktAgent], { autoAlpha: 0 });

    // Pin the STAGE from its own top (not the section's): the head scrolls
    // away first, then the diagram pins alone, centered, filling the fold.
    // Pinning from the section top froze the stage far below the fold (head +
    // nav + padding pushed it down), leaving a ~217px dead gap above it.
    const tl = g.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: '+=360%',
        pin: stage,
        scrub: 0.6,
        invalidateOnRefresh: true,
        refreshPriority: 30, // first pinned section → refresh first (proof 20, deck 10 follow)
      },
    });

    // 1 · ASSEMBLE — boundary draws, sandbox + guardrails + trail light in.
    tl.to(boundary, { onStart: () => boundary?.classList.add('drawn'), duration: 0.01 }, 0)
      .to(stage, { onStart: () => stage.classList.add('assembled'), duration: 0.01 }, 0.05)
      .add(() => litNote(0), 0.05);

    // 2 · SWAP — the freedom beat. Claude docks, Codex slides over it, then
    //     Hermes; the socket keeps whichever is last (the "…or your own" ghost
    //     stays as a hint). Shows: bring any agent; nothing else changes.
    chips.forEach((chip, i) => {
      const at = 0.4 + i * 0.28;
      tl.to(chip, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, at);
      if (i < chips.length - 1)
        tl.to(chip, { autoAlpha: 0.28, y: 0, duration: 0.18 }, at + 0.2);
    });
    tl.to(socket, { onStart: () => socket?.classList.add('lit'), duration: 0.01 }, 0.5)
      .add(() => litNote(1), 1.3);

    // connector agent → sandbox draws; the agent packet rides in and the
    // running-agent node lights ("runs in").
    tl.to(edgeIn, { '--fill': 1, duration: 0.4 }, 1.5)
      .fromTo(pktAgent, { autoAlpha: 0, x: 0 }, { autoAlpha: 1, x: 54, duration: 0.4, ease: 'none' }, 1.55)
      .to(pktAgent, { autoAlpha: 0, duration: 0.15 }, 1.95)
      .to(run, { onStart: () => run?.classList.add('lit'), duration: 0.01 }, 1.95);

    // 3 · RUN — two actions leave the running agent: everyday (good) + risky.
    tl.add(() => litNote(2), 2.1)
      .fromTo(good, { autoAlpha: 0, x: 0, y: 0 }, { autoAlpha: 1, duration: 0.2 }, 2.15)
      .fromTo(risk, { autoAlpha: 0, x: 0, y: 0 }, { autoAlpha: 1, duration: 0.2 }, 2.15)
      // risky one climbs to the WEB & EGRESS watched path and is stopped.
      .to(risk, { x: 150, y: -70, duration: 0.55, ease: 'none' }, 2.3)
      .to(web, { onStart: () => web?.classList.add('watching'), duration: 0.01 }, 2.7)
      .to(risk, { x: '+=5', duration: 0.05, repeat: 5, yoyo: true }, 2.85)
      .to(web, { onStart: () => web?.classList.add('blocked'), duration: 0.01 }, 2.9)
      .to(risk, { autoAlpha: 0, scale: 0.4, duration: 0.35 }, 3.0)
      .to(web, { onComplete: () => web?.classList.remove('blocked'), duration: 0.01 }, 3.35)
      // the everyday one passes to the signed trail and stamps a row.
      .to(good, { x: 150, y: 74, duration: 0.6, ease: 'none' }, 2.7)
      .to(tools, { onStart: () => tools?.classList.add('watching'), duration: 0.01 }, 2.95)
      .to(trail, { onStart: () => trail?.classList.add('lit'), duration: 0.01 }, 3.3)
      .to(good, { autoAlpha: 0, duration: 0.25 }, 3.35)
      .to(trailRow, { onStart: () => trailRow?.classList.add('stamped'), duration: 0.01 }, 3.4)
      .add(() => litNote(3), 3.3);

    // Reverse-scrub sync: class toggles GSAP can't tween back on their own.
    tl.eventCallback('onUpdate', () => {
      const p = tl.progress();
      boundary?.classList.toggle('drawn', p > 0);
      stage.classList.toggle('assembled', p > 0.02);
      socket?.classList.toggle('lit', p > 0.13);
      run?.classList.toggle('lit', p > 0.52);
      web?.classList.toggle('watching', p > 0.72);
      tools?.classList.toggle('watching', p > 0.78);
      trail?.classList.toggle('lit', p > 0.88);
      trailRow?.classList.toggle('stamped', p > 0.9);
      // the block flash only lives in a narrow band of the run beat
      if (p > 0.76 && p < 0.9) web?.classList.add('blocked');
      else web?.classList.remove('blocked');
    });
  }

  /* ------------------------------------------------------------------ *
   * ARCHITECTURE HERO — MOBILE sequential scroll-reveal.
   * On narrow screens the pinned scrub timeline can't run, so instead of
   * showing a pre-lit static diagram we light each beat in order as the
   * stacked diagram scrolls into view: boundary draws → agent socket +
   * chips → running agent → the two watched paths (amber) → signed trail
   * stamps. No pin, no horizontal packet flight, and no oxide "blocked"
   * flash (no packet travels on mobile — the paths simply read as watched).
   * Reuses the same .drawn/.lit/.watching/.stamped classes the desktop
   * timeline toggles. Under RM the CSS holds the fully-lit static state and
   * this early-returns.
   * ------------------------------------------------------------------ */
  function initArchMobile() {
    const stage = document.querySelector('[data-arch]') as HTMLElement | null;
    const section = $('governance');
    if (!stage || !section) return;
    if (RM || DESKTOP) return; // desktop path handled by initArch; RM stays static

    const node = (n: string) => stage.querySelector(`[data-node="${n}"]`) as HTMLElement | null;
    const socket = stage.querySelector('[data-arch-socket]') as HTMLElement | null;
    const boundary = stage.querySelector('[data-boundary]') as HTMLElement | null;
    const trailRow = stage.querySelector('[data-trail-row]') as HTMLElement | null;
    const notes = qsa('.arch-note', section);

    // One-shot reveal: add `cls` to `el` the first time it scrolls into view.
    const revealAt = (el: Element | null, cls: string, start = 'top 80%') => {
      if (!el) return;
      ST.create({ trigger: el, start, once: true, onEnter: () => el.classList.add(cls) });
    };

    // Beats, in reading order down the stacked column.
    revealAt(boundary, 'drawn', 'top 82%');
    if (boundary)
      ST.create({ trigger: boundary, start: 'top 82%', once: true, onEnter: () => stage.classList.add('assembled') });
    if (socket)
      ST.create({
        trigger: socket,
        start: 'top 82%',
        once: true,
        onEnter: () => {
          socket.classList.add('lit');
          socket.classList.add('chips-in'); // CSS fades the four chips in with a stagger
        },
      });
    revealAt(node('run'), 'lit');
    revealAt(node('web'), 'watching');
    revealAt(node('tools'), 'watching');
    revealAt(node('trail'), 'lit');
    revealAt(trailRow, 'stamped');
    notes.forEach((n) => revealAt(n, 'lit', 'top 85%'));
  }

  /* ------------------------------------------------------------------ *
   * BACKDROP ARTIFACT FIELD — three fixed depth planes of drifting
   * governance artifacts (signed hashes, costs, timestamps, verdict glyphs,
   * tiny socket/lock/shield motifs). Ported from the LemmaLabs build and
   * retuned for this light surface: ~30% fewer glyphs, a gentler blur cap
   * (~2px), and mineral tinting. Planes parallax at three rates, each glyph
   * idle-rotates, and the whole field motion-blurs with scroll velocity then
   * settles. Skipped entirely under reduced motion. On coarse pointers /
   * mobile we keep a faint static-drift set (parallax only — no blur, no
   * per-glyph rotation) for battery + jank.
   * ------------------------------------------------------------------ */
  const hex = '0123456789abcdef';
  const rnd = (n: number) => Array.from({ length: n }, () => hex[(Math.random() * 16) | 0]).join('');
  const p2 = (n: number) => String(n).padStart(2, '0');
  const now = () => {
    const d = new Date(Date.now() - Math.random() * 9e6);
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  };
  // Verdict / proof glyphs — signed (✓), pending (⧗), blocked (⨯) plus the
  // logic marks the LemmaLabs field uses (∎ QED, ⊢ turnstile).
  const GLYPH = ['✓', '⧗', '⨯', '∎', '⊢', '∴'];
  // A few tiny governed motifs drawn inline: socket ring, padlock, shield.
  const MOTIF = [
    '<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="11"/><circle cx="17" cy="17" r="3.4"/></svg>',
    '<svg width="30" height="34" viewBox="0 0 30 34"><rect x="6" y="14" width="18" height="14" rx="2.5"/><path d="M10 14v-4a5 5 0 0 1 10 0v4"/></svg>',
    '<svg width="30" height="36" viewBox="0 0 30 36"><path d="M15 3l11 4v9c0 8-5 13-11 16-6-3-11-8-11-16V7z"/><path d="M10 18l4 4 7-8"/></svg>',
  ];

  function buildArtifacts(host: HTMLElement | null, count: number, size: [number, number], op: [number, number]) {
    if (!host) return;
    for (let n = 0; n < count; n++) {
      const el = document.createElement('div');
      el.className = 'af';
      const r = Math.random();
      if (r < 0.4) {
        // proof glyph (serif) — a slice tinted verdigris/amber like the ledger.
        el.textContent = GLYPH[(Math.random() * GLYPH.length) | 0]!;
        el.classList.add('serifglyph');
        const t = Math.random();
        if (t < 0.16) el.classList.add('ok');
        else if (t < 0.24) el.classList.add('amb');
      } else if (r < 0.62) {
        // signed hash fragment
        el.textContent = 'did:key:z' + rnd(6);
      } else if (r < 0.78) {
        // cost chip
        el.textContent = 'S$' + (Math.random() * 0.9 + 0.05).toFixed(2);
      } else if (r < 0.9) {
        // timestamp
        el.textContent = now();
      } else {
        // a governed motif (socket / lock / shield)
        el.innerHTML = MOTIF[(Math.random() * MOTIF.length) | 0]!;
      }
      const sz = size[0] + Math.random() * (size[1] - size[0]);
      el.style.fontSize = sz + 'px';
      el.style.left = Math.random() * 104 - 2 + '%';
      el.style.top = Math.random() * 190 - 45 + '%';
      el.style.opacity = (op[0] + Math.random() * (op[1] - op[0])).toFixed(3);
      el.style.transform = 'translate(-50%,-50%) rotate(' + (Math.random() * 30 - 15).toFixed(1) + 'deg)';
      el.dataset.rot = (Math.random() * 24 - 12).toFixed(1);
      host.appendChild(el);
    }
  }

  function initArtifacts() {
    if (RM) return; // no field at all under reduced motion
    const d1 = $('d1');
    const d2 = $('d2');
    const d3 = $('d3');
    const MOB = !DESKTOP;
    // Restrained counts on this light surface (ref used 11/11/8): 8/8/6 desktop.
    buildArtifacts(d1, MOB ? 3 : 8, MOB ? [9, 13] : [11, 19], [0.05, 0.085]);
    buildArtifacts(d2, MOB ? 3 : 8, MOB ? [11, 17] : [15, 27], [0.055, 0.1]);
    buildArtifacts(d3, MOB ? 2 : 6, MOB ? [15, 23] : [22, 40], [0.06, 0.12]);

    // Three depth rates → parallax. Scrub-linked to whole-page scroll.
    ([[d1, 0.14], [d2, 0.34], [d3, 0.62]] as [HTMLElement | null, number][]).forEach((pair) => {
      if (!pair[0]) return;
      g.to(pair[0], {
        y: () => -(document.body.scrollHeight - innerHeight) * pair[1],
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: true, invalidateOnRefresh: true },
      });
    });

    // Idle per-glyph rotation + velocity-blur are desktop/fine only.
    if (FINE && DESKTOP) {
      qsa('.af').forEach((el) => {
        g.to(el, { rotate: '+=' + el.dataset.rot, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1.4 } });
      });
      const field = $('artifacts');
      if (field) {
        let t: number;
        ST.create({
          start: 0,
          end: 'max',
          onUpdate: (self: any) => {
            // gentler cap than the ref (2px vs 3px) — the light surface shows more.
            const v = Math.min(Math.abs(self.getVelocity()) / 440, 2);
            g.set(field, { filter: 'blur(' + v.toFixed(2) + 'px)' });
            clearTimeout(t);
            t = window.setTimeout(() => {
              g.to(field, { filter: 'blur(0px)', duration: 0.6, ease: 'sine.out' });
            }, 90);
          },
        });
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * HERO WAVE FIELD — the interactive "wavy" backdrop behind the hero.
   * A set of SSR'd verdigris contour lines + two soft glow blooms (see
   * .hero-field in index.astro). Each contour ripples on its own cadence and
   * drifts slowly sideways so the field reads as a living topographic wave;
   * the blooms wander on long lazy loops. On desktop+fine the whole field
   * parallaxes gently toward the cursor (only while the hero is on screen).
   * Under reduced motion this early-returns and the CSS keeps the field a
   * faint static texture. Purely decorative; the H1 above is authoritative.
   * ------------------------------------------------------------------ */
  function initHeroField() {
    const field = document.querySelector('[data-hero-field]') as HTMLElement | null;
    if (!field || RM) return;
    // Desktop only: on mobile the field stays a static SSR texture. Continuous
    // ripple/drift/glow tweens compete with touch-scroll compositing and make
    // the whole page feel laggy on phones; the static field reads the same.
    if (!DESKTOP) return;
    const lines = qsa('.hf-line', field);
    const glows = qsa('.hf-glow', field);

    // (a) ripple — each contour breathes vertically on its own cadence.
    lines.forEach((el, i) => {
      g.to(el, {
        y: i % 2 ? 9 : -9,
        duration: 4 + (i % 5),
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.12,
      });
      // (a2) slow lateral drift of alternating lines → the flowing read.
      g.to(el, {
        x: i % 2 ? 14 : -14,
        duration: 9 + (i % 4),
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    // (b) drifting glow blooms — long, lazy, opposed loops.
    glows.forEach((el, i) => {
      g.to(el, {
        x: i ? -70 : 80,
        y: i ? 54 : -46,
        duration: 14 + i * 4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    // (c) cursor parallax — desktop + fine pointer only, gated to the hero view
    // so we stop tracking (and stop tweening) once it has scrolled away.
    if (FINE && DESKTOP) {
      const qx = g.quickTo(field, 'x', { duration: 0.9, ease: 'power2.out' });
      const qy = g.quickTo(field, 'y', { duration: 0.9, ease: 'power2.out' });
      // Only parallax while the hero is on screen. The field is absolutely
      // positioned to the hero box, so its bottom edge tells us when the hero
      // has scrolled past — cheaper and more robust than a ScrollTrigger on an
      // absolutely-positioned element (whose start/end mis-measure).
      addEventListener(
        'pointermove',
        (e) => {
          if (field.getBoundingClientRect().bottom <= 0) return; // hero gone
          qx((e.clientX / innerWidth - 0.5) * 44); // ±22px
          qy((e.clientY / innerHeight - 0.5) * 44);
        },
        { passive: true }
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * LEDGER TICKER — a live governed-trail marquee pinned to the bottom.
   * CSS animates the scroll (@keyframes flow); JS just fills + refreshes the
   * content. Paused under reduced motion (CSS sets animation:none there).
   * ------------------------------------------------------------------ */
  function initTicker() {
    const flow = $('flow');
    if (!flow) return;
    const ACTS = [
      'action signed', 'scope checked', 'egress denied', 'approval recorded',
      'credential rotated', 'record verified', 'policy re-checked',
    ];
    const items = () =>
      Array.from({ length: 16 }, () =>
        '<span>' + now() + ' · ' + ACTS[(Math.random() * ACTS.length) | 0]! + ' · <b>' + rnd(10) + '</b></span>'
      ).join('');
    flow.innerHTML = items() + items(); // doubled → seamless -50% marquee loop
    if (!RM) setInterval(() => { flow.innerHTML = items() + items(); }, 48000);
  }

  /* ------------------------------------------------------------------ *
   * OBJECTION WALL — pinned scrub. The two setup lines rise, dim; the
   * questions every security team asks scatter in from random; the big
   * question lands; all dim; the answer resolves. Idle-drift per question
   * (desktop+fine only). Under reduced motion we skip the whole timeline and
   * the CSS override shows the setup lines + answer statically instead.
   * Ported from the LemmaResearch wall, re-storied to the governed computer.
   * ------------------------------------------------------------------ */
  function initWall() {
    const qField = $('qField');
    const wl1 = $('wl1');
    const wl2 = $('wl2');
    const qAns = $('qAns');
    if (!qField || !wl1 || !wl2 || !qAns) return;
    const MOB = !DESKTOP;

    // [text, kind] — kind sets the type treatment (m = mono, s = serif italic,
    // n = plain). The questions a CISO/CIO actually asks about agent actions.
    const QS: [string, string][] = [
      ['Which agent touched production?', 's'], ['Was that inside policy?', 'n'],
      ['Who approved the egress?', 'm'], ['Can we prove it to the auditor?', 's'],
      ['What did that run cost us?', 'n'], ['Which identity signed it?', 'm'],
      ['Did a human review this?', 's'], ['Can we undo what it did?', 'n'],
      ['Where did that data go?', 'm'], ['Is this within the scope we granted?', 's'],
      ['Why did it choose this action?', 'n'], ['Which model made the call?', 'm'],
      ['What if it’s wrong and nobody catches it?', 's'], ['Who is watching the tokens?', 'm'],
      ['Will this hold up in a review?', 'n'],
    ];
    const POS = [[15, 18], [79, 15], [25, 76], [86, 70], [10, 46], [63, 9], [38, 90], [90, 38], [19, 63], [71, 84], [7, 85], [53, 20], [33, 36], [81, 53], [46, 68]];
    const MPOS = [[26, 14], [74, 22], [22, 80], [78, 74], [16, 50], [60, 9], [42, 90], [84, 42]];
    const useQ = MOB ? QS.slice(0, 8) : QS;
    const useP = MOB ? MPOS : POS;
    useQ.forEach((item, n) => {
      const d = document.createElement('div');
      d.className = 'q ' + item[1];
      d.textContent = item[0];
      d.style.left = useP[n]![0] + '%';
      d.style.top = useP[n]![1] + '%';
      qField.appendChild(d);
    });
    const bigQ = document.createElement('div');
    bigQ.className = 'q big';
    bigQ.textContent = 'Can you answer for everything your agents do?';
    bigQ.style.left = '50%';
    bigQ.style.top = '50%';
    qField.appendChild(bigQ);

    if (RM) return; // static setup-lines + answer come from the CSS RM override

    const qEls = qsa('.q:not(.big)', qField);
    g.timeline({ scrollTrigger: { trigger: '#wall', start: 'top top', end: 'bottom bottom', scrub: 0.7 } })
      .to(wl1, { opacity: 1, duration: 0.5 })
      .to(wl2, { opacity: 1, duration: 0.5 }, '+=.3')
      .to([wl1, wl2], { opacity: 0.12, y: -28, duration: 0.8 }, '+=.5')
      .to(qEls, { opacity: 1, duration: 0.5, stagger: { each: 0.11, from: 'random' } }, '-=.6')
      .to(bigQ, { opacity: 1, duration: 0.6 }, '+=.2')
      .to(qEls, { opacity: 0.1, duration: 0.5 }, '+=.4')
      .to(bigQ, { opacity: 0.1, duration: 0.5 }, '<')
      .to([wl1, wl2], { opacity: 0, duration: 0.5 }, '<') // clear the setup lines so the answer stands alone
      .to(qAns, { opacity: 1, duration: 0.7 }, '-=.2')
      .to(qEls.concat([bigQ]), { opacity: 0, duration: 0.6 }, '+=.4');

    // Idle drift — each question breathes on its own cadence (desktop+fine).
    if (FINE && DESKTOP)
      qEls.forEach((el, n) => {
        g.to(el, {
          y: '+=' + (n % 2 ? 13 : -13), x: '+=' + (n % 3 ? 7 : -7),
          duration: 5 + (n % 4), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: n * 0.14,
        });
      });
  }

  /* ------------------------------------------------------------------ *
   * INIT + ScrollTrigger robustness
   * ------------------------------------------------------------------ */
  initArtifacts();
  initHeroField();
  initTicker();
  initWall();
  initProofRail();
  initDeckScroll();
  initArch();
  initArchMobile();

  // Pinning depends on final document height. Refresh after fonts swap and
  // after the eager deck/hero images decode, or the governance pin jumps.
  (document as any).fonts?.ready.then(() => ST.refresh());
  addEventListener('load', function () {
    ST.refresh();
  });
  Promise.all(
    qsa<HTMLImageElement>('img')
      .filter((img) => img.loading === 'eager')
      .map((img) => (img.complete ? Promise.resolve() : img.decode?.().catch(() => {})))
  ).then(() => ST.refresh());
}
