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
   * TABBED SHOT DECK
   * ------------------------------------------------------------------ */
  function initDeck() {
    const deck = document.querySelector('[data-deck]') as HTMLElement | null;
    if (!deck) return;
    const tabs = qsa<HTMLButtonElement>('.deck-tab', deck);
    const panes = qsa('.deck-pane', deck);
    const cap = deck.querySelector('.deck-cap') as HTMLElement | null;
    const capMap = new Map<string, string>();
    qsa('[data-cap-for]', deck).forEach((el) => {
      const id = el.getAttribute('data-cap-for');
      if (id) capMap.set(id, el.textContent || '');
    });
    if (!tabs.length) return;

    const autoMs = parseInt(deck.getAttribute('data-auto') || '4200', 10);
    const RING = 2 * Math.PI * 16;
    let active = 0;
    let pinned = false; // permanently stops the timer once the user interacts
    let paused = false; // transient (hover / offscreen)
    let onScreen = true;
    let timer: any = null; // the ring tween

    function paneIdOf(tab: HTMLButtonElement) {
      return (tab.getAttribute('aria-controls') || '').replace(/^pane-/, '');
    }

    function ringFg(i: number) {
      return tabs[i]?.querySelector('.ring-fg') as SVGElement | null;
    }

    function select(i: number, focus = false) {
      if (i === active) return;
      const prevFg = ringFg(active);
      if (prevFg) g.set(prevFg, { strokeDashoffset: RING });
      active = i;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panes.forEach((p, k) => {
        const on = k === i;
        p.classList.toggle('is-on', on);
        if (on) p.removeAttribute('hidden');
        else p.setAttribute('hidden', '');
      });
      const id = paneIdOf(tabs[i]!);
      if (cap && capMap.has(id)) cap.textContent = capMap.get(id)!;
      if (focus) tabs[i]!.focus();
      // decode the next image ahead of time so its future advance is instant
      const nextImg = panes[(i + 1) % panes.length]?.querySelector('img') as
        | HTMLImageElement
        | undefined;
      if (nextImg && 'requestIdleCallback' in window)
        (window as any).requestIdleCallback(() => nextImg.decode?.().catch(() => {}));
    }

    function stopTimer() {
      if (timer) {
        timer.kill();
        timer = null;
      }
    }

    function runTimer() {
      if (RM || pinned || paused || !onScreen) return;
      stopTimer();
      const fg = ringFg(active);
      if (!fg) return;
      g.set(fg, { strokeDashoffset: RING });
      timer = g.to(fg, {
        strokeDashoffset: 0,
        duration: autoMs / 1000,
        ease: 'none',
        onComplete: () => {
          select((active + 1) % tabs.length);
          runTimer();
        },
      });
    }

    function pin() {
      pinned = true;
      stopTimer();
      const fg = ringFg(active);
      if (fg) g.set(fg, { strokeDashoffset: RING });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        pin();
        select(i);
      });
      tab.addEventListener('keydown', (e: KeyboardEvent) => {
        let n = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n >= 0) {
          e.preventDefault();
          pin();
          select(n, true);
        }
      });
    });

    // Hover pauses the auto-advance (does not permanently pin).
    deck.addEventListener('pointerenter', () => {
      paused = true;
      stopTimer();
    });
    deck.addEventListener('pointerleave', () => {
      paused = false;
      runTimer();
    });

    // Only run the loop while the deck is on screen.
    ST.create({
      trigger: deck,
      start: 'top 85%',
      end: 'bottom 15%',
      onEnter: () => {
        onScreen = true;
        runTimer();
      },
      onEnterBack: () => {
        onScreen = true;
        runTimer();
      },
      onLeave: () => {
        onScreen = false;
        stopTimer();
      },
      onLeaveBack: () => {
        onScreen = false;
        stopTimer();
      },
    });

    // Thin #computer / #schedules anchor links select their deck tab.
    function selectTabById(paneId: string) {
      const idx = tabs.findIndex((t) => paneIdOf(t) === paneId);
      if (idx >= 0) {
        pin();
        select(idx);
      }
    }
    qsa<HTMLAnchorElement>('[data-select-tab]').forEach((a) => {
      a.addEventListener('click', () => {
        const id = a.getAttribute('data-select-tab');
        if (id) setTimeout(() => selectTabById(id), 60);
      });
    });

    if (!RM) runTimer();
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

    const tl = g.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=360%',
        pin: stage,
        scrub: 0.6,
        invalidateOnRefresh: true,
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
   * INIT + ScrollTrigger robustness
   * ------------------------------------------------------------------ */
  initDeck();
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
