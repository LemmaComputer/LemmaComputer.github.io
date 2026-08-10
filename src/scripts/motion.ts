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
      // Crossfade in place: scroll picks which shot is centered; markActive
      // toggles its pane .is-on and the CSS opacity-transition fades it in over
      // the one before it. No x-translate — the left-to-right pan read as a
      // confusing carousel; a fade keeps focus on one capability at a time.
      onUpdate: (self: any) => {
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

    const shots = qsa('.shot-desktop', track);
    if (shots.length < 2) return;
    const [first, second] = shots;

    // Blackjack DEAL: the base card (shot 1) is already on the table; the second
    // shot is dealt onto it — it starts flung off toward the lower-right, tilted
    // and small (a card mid-flight), then slides in, rotates flat and scales up
    // to land square on the stack. The base card recedes a touch as it's covered,
    // reading as "one card dealt on top of another" rather than a crossfade.
    g.set(second!, { autoAlpha: 0, xPercent: 46, yPercent: 30, rotation: 13, scale: 0.82, transformOrigin: '50% 60%' });
    g.set(first!, { autoAlpha: 1, xPercent: 0, yPercent: 0, rotation: 0, scale: 1 });

    const tl = g.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: '+=140%',
        pin: stage,
        scrub: 0.7,
        invalidateOnRefresh: true,
        refreshPriority: 20, // refresh after arch (30), before deck (10) — DOM order
      },
    });
    // Card leaves the "deck" and becomes visible almost immediately, then flies
    // in over most of the scroll and settles flat at the end (back-ease landing).
    tl.to(second!, { autoAlpha: 1, duration: 0.12 }, 0)
      .to(second!, { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, ease: 'back.out(1.1)', duration: 1 }, 0)
      // Base card sinks slightly under the newly-dealt one, then holds.
      .to(first!, { scale: 0.965, yPercent: 2, autoAlpha: 0.82, ease: 'power1.inOut', duration: 1 }, 0);
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
   * HERO ENERGY FIELD — a self-built WebGL2 flowing-field backdrop.
   *
   * A single full-screen-triangle fragment shader (no vertex buffer, drawn off
   * gl_VertexID) renders IQ-style domain-warped simplex fbm lit by a
   * directional-derivative "raked" highlight, retinted to verdigris on
   * green-black + a touch of film grain. This is our own open-source take on
   * the Unicorn-Studio-class field on Trident's hero — no runtime, no CDN, ~a
   * few KB of shader source, well under the JS budget (GSAP is CDN).
   *
   * Motion policy:
   *   • reduced-motion or non-desktop  → paint exactly ONE frozen frame, no loop
   *   • desktop + motion               → ~30fps drift loop, paused off-screen /
   *                                       when the tab is hidden
   *   • fine pointer + desktop         → cursor warps the field (uMouse)
   * Bails silently (leaving the green-black canvas) if WebGL2 is unavailable.
   * Decorative + aria-hidden; the H1 above stays authoritative.
   * ------------------------------------------------------------------ */
  function initHeroField() {
    const cv = document.querySelector('[data-hero-field]') as HTMLCanvasElement | null;
    if (!cv || typeof cv.getContext !== 'function') return;
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false }) as WebGL2RenderingContext | null;
    if (!gl) return; // no WebGL2 → leave the CSS green-black canvas as-is

    // Variant E (locked): blend of "quiet deep" + "bolder ridges" — deep dark
    // valleys with enough flowing ridge density across the frame.
    const OCT = 2,
      SCALE = 0.6,
      SPEED = 0.038,
      WARP = 2.4,
      RAKE = 0.91,
      GRAIN = 0.019,
      ANISO = 0.48,
      CONTRAST = 2.15;
    // Verdigris #3da588 on green-black #060a09 (matches tokens.css --v-bright/--void).
    const HI = [0.239, 0.647, 0.533],
      LO = [0.024, 0.039, 0.035];

    const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;
    // Ashima simplex noise (MIT) — inlined.
    const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
  vec3 x=2.*fract(p*C.www)-1.; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}`;
    const FRAG = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform vec2 uMouse;
uniform float uMouseGlow; // 0 when cursor is away, eases to 1 while hovering
uniform vec3 uColorLo; uniform vec3 uColorHi;
out vec4 fragColor;
${SNOISE}
const mat2 M=mat2(0.8,-0.6,0.6,0.8);
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<${OCT};i++){ s+=a*snoise(p); p=M*p*1.99; a*=0.5;} return s; }
float warp(vec2 p,float t,out vec2 r){
  vec2 q=vec2(fbm(p+0.10*t), fbm(p+vec2(5.2,1.3)-0.08*t));
  r=vec2(fbm(p+${WARP.toFixed(1)}*q+vec2(1.7,9.2)), fbm(p+${WARP.toFixed(1)}*q+vec2(8.3,2.8)));
  return fbm(p+${WARP.toFixed(1)}*r);
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uResolution)/uResolution.y;
  vec2 p=uv*${SCALE.toFixed(2)}*vec2(1.0,${ANISO.toFixed(2)});

  // Cursor ACTIVATION field: a soft, tight falloff around the pointer (uMouse,
  // in this same y-normalized uv space), 1 at the cursor → 0 at ~0.28 radius,
  // scaled by uMouseGlow (eases in/out). Where act>0 the actual flow comes alive
  // — it does NOT add a separate glow disc; it gently drives the real ridge
  // structure locally. Kept restrained so the H1 stays fully legible over it.
  float act = uMouseGlow * smoothstep(0.28, 0.0, distance(uv, uMouse));

  // The base drift plus a faint LOCAL quickening: near the cursor the flow's own
  // time advances a touch faster, so the folds there stir subtly to life while
  // the rest of the field keeps its calm pace. The field reacting, not an overlay.
  float t=uTime*(${SPEED.toFixed(3)} + 0.035*act);
  vec2 r; float f=warp(p,t,r);
  vec2 L=normalize(vec2(${RAKE.toFixed(2)},${(1 - RAKE).toFixed(2)})+vec2(0.6,0.2));
  float eps=0.55; vec2 ra; float fL=warp(p+eps*L,t,ra);
  float ridge=(fL-f)/eps; ridge=smoothstep(-1.2,1.4,ridge);
  float sheet=smoothstep(-0.7,0.8,f);

  // Activation lightly amplifies the ridge highlight that already exists here —
  // the crests near the cursor catch a little more light and read crisper, so
  // the flow lines themselves brighten rather than a flat pool washing over them.
  float ridgeAmp = ridge * (1.0 + 0.45*act);
  float shade=clamp(0.55*ridgeAmp + 0.55*sheet,0.0,1.0);
  shade=pow(shade,${CONTRAST.toFixed(2)});
  vec3 col=mix(uColorLo,uColorHi,shade); col=pow(col,vec3(1.1));
  col*=1.0-0.30*dot(uv,uv);

  // A whisper of extra warmth that tracks the RIDGES within the activation zone
  // (weighted by ridge, so valleys stay dark) — the live flow shimmers along its
  // own crests rather than glowing as a uniform disc.
  col += uColorHi * act * ridge * 0.12;

  float gr=fract(sin(dot(gl_FragCoord.xy+t*57.0,vec2(12.9898,78.233)))*43758.5453);
  col+=(gr-0.5)*${GRAIN.toFixed(3)};
  fragColor=vec4(col,1.0);
}`;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[hero-field]', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, 'uResolution');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uMouseGlow = gl.getUniformLocation(prog, 'uMouseGlow');
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColorLo'), LO);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uColorHi'), HI);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
      }
    };
    resize();

    // Cursor shimmer state. mx/my are in the shader's y-normalized uv space.
    // glowT is the target (1 while the cursor is active over the hero, 0 when
    // it's away/idle); glow eases toward it so the pool of light fades in/out.
    let mx = 0,
      my = 0,
      glow = 0,
      glowT = 0;
    const draw = (tSec: number) => {
      glow += (glowT - glow) * 0.08; // smooth ease-in/out per frame
      gl.uniform1f(uTime, tSec);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uMouseGlow, glow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // Reduced motion OR non-desktop → one frozen frame, no rAF loop, no cursor.
    // A single static shader frame is cheap and reads the same; a live loop
    // fights touch-scroll compositing on phones and violates the RM contract.
    if (RM || !DESKTOP) {
      draw(8.0); // a settled, non-origin frame with pleasant fold structure
      return;
    }

    // Desktop + motion: ~30fps drift loop, paused off-screen and when hidden.
    const start = performance.now();
    let raf = 0;
    let visible = true;
    const FRAME = 1000 / 30;
    let last = -Infinity;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME) return;
      last = now;
      resize();
      draw((now - start) / 1000);
    };
    const play = () => {
      if (!raf) {
        last = -Infinity;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          visible = entries.some((en) => en.isIntersecting);
          if (visible && !document.hidden) play();
          else stop();
        },
        { threshold: 0 }
      ).observe(cv);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (visible) play();
    });
    addEventListener('resize', resize, { passive: true });
    play();

    // Cursor shimmer — fine pointer + desktop only. Feeds uMouse (position, in
    // the shader's y-normalized uv space) + uMouseGlow (intensity). The shader
    // paints a soft local pool of light there; the field itself does NOT move.
    // A short idle timeout fades the shimmer if the cursor stops, and it fades
    // out entirely once the pointer leaves the window or the hero scrolls away.
    if (FINE) {
      let idle: number | undefined;
      const toUv = (e: PointerEvent | MouseEvent) => {
        const r = cv.getBoundingClientRect();
        mx = (e.clientX - r.left - r.width / 2) / r.height;
        my = -(e.clientY - r.top - r.height / 2) / r.height;
      };
      addEventListener(
        'pointermove',
        (e) => {
          if (cv.getBoundingClientRect().bottom <= 0) {
            glowT = 0; // hero gone → let the shimmer fade out
            return;
          }
          toUv(e);
          glowT = 1;
          if (idle) clearTimeout(idle);
          idle = window.setTimeout(() => {
            glowT = 0;
          }, 1600); // fade out if the cursor rests
        },
        { passive: true }
      );
      document.addEventListener('pointerleave', () => {
        glowT = 0;
      });
    }
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
   * #approval — separation-of-duties demo.
   * The agent's request is paused in the governed workspace and pushed to a
   * separate approver's phone. Tapping Deny/Approve signs the exact request
   * (did:webvh + ed25519) and returns a verifiable decision; the left step
   * tracker advances as the decision travels + comes back. Scenario chips swap
   * the request. All state lives in classes/text — the DOM ships in its resting
   * (pending) state, so under reduced motion this early-returns and the scene
   * still reads complete. GSAP is used only for small state transitions.
   * ------------------------------------------------------------------ */
  function initApprovalDemo() {
    const maybeRoot = document.querySelector('[data-approval]') as HTMLElement | null;
    if (!maybeRoot) return;
    const root = maybeRoot; // non-null; closures below capture this narrowed binding

    // The request panel and the phone both re-render from these. Keep the two
    // views in sync (workspace copy is slightly fuller; phone copy is terser).
    const SCENARIOS: Record<
      string,
      { title: string; by: string; dest: string; digest: string; deskDesc: string; phoneDesc: string; why: string }
    > = {
      export: {
        title: 'Export customer report',
        by: 'Research workspace',
        dest: 'external.collab',
        digest: '8F2A…9C11',
        deskDesc: 'Claude wants to send a sensitive file to a destination outside the governed workspace.',
        phoneDesc: 'An agent wants to send a sensitive file outside the company workspace.',
        why: "Customer data can't leave the company without a human decision.",
      },
      prod: {
        title: 'Change production config',
        by: 'Ops workspace',
        dest: 'prod.api',
        digest: 'B41C…07E9',
        deskDesc: 'Codex wants to push a configuration change to a live production service.',
        phoneDesc: 'An agent wants to change a setting on a live production service.',
        why: 'Production changes need a human to sign off before they ship.',
      },
      repo: {
        title: 'Connect a private repo',
        by: 'Build workspace',
        dest: 'git.internal',
        digest: '3D77…A2B0',
        deskDesc: 'Hermes wants to grant the workspace read access to a private source repository.',
        phoneDesc: 'An agent wants read access to a private source repository.',
        why: 'Private code access is granted by a person, not by the agent itself.',
      },
    };

    const chips = qsa('.ap-chip', root.parentElement ?? document);
    const phoneReq = root.querySelector('[data-ap-phone-request]') as HTMLElement | null;
    const phoneRes = root.querySelector('[data-ap-phone-result]') as HTMLElement | null;
    const sentStep = root.querySelector('[data-step="sent"]') as HTMLElement | null;
    const verifiedStep = root.querySelector('[data-step="verified"]') as HTMLElement | null;

    const setText = (sel: string, value: string) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = value;
    };

    function loadScenario(key: string) {
      const s = SCENARIOS[key];
      if (!s) return;
      // Left request panel.
      setText('[data-ap-title]', s.title);
      setText('[data-ap-desc]', s.deskDesc);
      setText('[data-ap-by]', s.by);
      setText('[data-ap-dest]', s.dest);
      setText('[data-ap-digest]', s.digest);
      setText('[data-ap-why]', s.why);
      // Phone request card.
      setText('[data-ap-phone-title]', s.title);
      setText('[data-ap-phone-desc]', s.phoneDesc);
      setText('[data-ap-phone-by]', s.by);
      setText('[data-ap-phone-digest]', s.digest);
      reset();
    }

    // Return the scene to its pending resting state.
    function reset() {
      root.classList.remove('is-approved', 'is-denied');
      if (phoneRes) {
        phoneRes.hidden = true;
        phoneRes.classList.remove('is-denied');
      }
      if (phoneReq) phoneReq.hidden = false;
      sentStep?.classList.remove('is-complete');
      verifiedStep?.classList.remove('is-complete');
      setText('[data-ap-phone-sub]', 'Ready to decide');
      setText('[data-ap-outcome-label]', 'STATUS');
      setText('[data-ap-outcome-text]', 'Action paused · waiting for the approver');
      if (!RM && phoneReq) g.fromTo(phoneReq, { opacity: 0.4 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    }

    function decide(approved: boolean) {
      // Step 1 — the request reaches the phone.
      sentStep?.classList.add('is-complete');
      setText('[data-ap-phone-sub]', 'Signing the decision…');

      const commit = () => {
        // Swap the phone to its signed-result face.
        if (phoneReq) phoneReq.hidden = true;
        if (phoneRes) {
          phoneRes.hidden = false;
          phoneRes.classList.toggle('is-denied', !approved);
        }
        setText('[data-ap-res-eyebrow]', 'DECISION SIGNED');
        setText('[data-ap-res-title]', approved ? 'Approval signed' : 'Denial signed');
        setText(
          '[data-ap-res-desc]',
          approved
            ? 'The phone signed this exact request. LemmaComputer can verify the decision — it cannot change it.'
            : "The phone signed a denial of this exact request. LemmaComputer can verify it — and the action stays blocked."
        );
        setText('[data-ap-phone-sub]', approved ? 'Decision signed' : 'Denial signed');

        // Step 2 — the computer verifies the returned signature.
        verifiedStep?.classList.add('is-complete');
        root.classList.add(approved ? 'is-approved' : 'is-denied');
        setText('[data-ap-outcome-label]', approved ? 'VERIFIED' : 'BLOCKED');
        setText(
          '[data-ap-outcome-text]',
          approved
            ? 'Approval verified · this action may continue once'
            : 'Denial verified · this action stays blocked'
        );

        if (!RM && phoneRes) g.fromTo(phoneRes, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
      };

      // Under RM, commit instantly (no travel beat); otherwise let the "sent"
      // step read for a moment before the signature lands.
      if (RM) commit();
      else g.delayedCall(0.5, commit);
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-pressed', String(c === chip));
        });
        loadScenario(chip.dataset.scenario || 'export');
      });
    });

    root.querySelector('[data-ap-approve]')?.addEventListener('click', () => decide(true));
    root.querySelector('[data-ap-deny]')?.addEventListener('click', () => decide(false));
    root.querySelector('[data-ap-reset]')?.addEventListener('click', reset);
  }

  /* ------------------------------------------------------------------ *
   * INIT + ScrollTrigger robustness
   * ------------------------------------------------------------------ */
  initArtifacts();
  initHeroField();
  initApprovalDemo();
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
