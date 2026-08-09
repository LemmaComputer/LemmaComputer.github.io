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
   * GOVERNANCE — scroll-driven attack storyline down the defensive stack
   * ------------------------------------------------------------------ */
  function initGovernance() {
    const stage = document.querySelector('[data-gov]') as HTMLElement | null;
    const section = $('governance');
    if (!stage || !section) return;
    if (RM || !DESKTOP) return; // CSS renders the final assembled state statically

    const card = (n: string) => stage.querySelector(`[data-node="${n}"]`) as HTMLElement | null;
    const link = (n: string) => stage.querySelector(`[data-link="${n}"]`) as HTMLElement | null;
    const beats = qsa('.gov-beat', section);
    const agent = card('agent');
    const policy = card('policy');
    const firewall = card('firewall');
    const trail = card('trail');
    const good = stage.querySelector('[data-pkt="good"]') as HTMLElement | null;
    const rogue = stage.querySelector('[data-pkt="rogue"]') as HTMLElement | null;
    const hash = stage.querySelector('[data-hash]') as HTMLElement | null;
    const linkAP = link('a-p');
    const linkPF = link('p-f');
    const linkFT = link('f-t');

    const litBeat = (i: number) => beats.forEach((b, k) => b.classList.toggle('lit', k === i));

    // A packet rides its link from top (start) to just past the next card. The
    // link is 46px tall; overshoot a touch so it visually enters the card.
    const RIDE = 66;

    const tl = g.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=340%',
        pin: stage,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    // 1 · ISSUE — agent lights; both packets emerge and descend to policy.
    tl.to(agent, { onStart: () => agent?.classList.add('lit'), duration: 0.01 }, 0)
      .fromTo([good, rogue], { opacity: 0, y: 0 }, { opacity: 1, duration: 0.3 }, 0.05)
      .to(linkAP, { '--fill': 1, duration: 0.5 }, 0.1)
      .to([good, rogue], { y: RIDE, duration: 0.6, ease: 'none' }, 0.15);

    // 2 · POLICY — layer lights; hash types in; rogue blocked, good continues.
    tl.to(policy, { onStart: () => policy?.classList.add('lit'), duration: 0.01 }, 0.85)
      .add(typeHash(hash), 0.9)
      .add(() => litBeat(0), 0.85)
      // rogue shudders and dies at the policy layer
      .to(rogue, { x: 6, duration: 0.06, repeat: 5, yoyo: true }, 1.15)
      .to(policy, { onStart: () => policy?.classList.add('blocked'), duration: 0.01 }, 1.15)
      .to(rogue, { opacity: 0, scale: 0.4, duration: 0.4 }, 1.35)
      .to(policy, { onComplete: () => policy?.classList.remove('blocked'), duration: 0.01 }, 1.7);

    // 3 · FIREWALL — good passes policy → firewall.
    tl.to(linkPF, { '--fill': 1, duration: 0.5 }, 1.8)
      .to(good, { y: RIDE * 2, duration: 0.6, ease: 'none' }, 1.85)
      .to(firewall, { onStart: () => firewall?.classList.add('lit'), duration: 0.01 }, 2.2)
      .add(() => litBeat(1), 2.2);

    // 4 · APPROVALS beat (copy-only) then TRAIL — signed row stamps.
    tl.add(() => litBeat(2), 2.55)
      .to(linkFT, { '--fill': 1, duration: 0.5 }, 2.75)
      .to(good, { y: RIDE * 3, duration: 0.6, ease: 'none' }, 2.8)
      .to(trail, { onStart: () => trail?.classList.add('lit'), duration: 0.01 }, 3.15)
      .to(good, { opacity: 0, duration: 0.3 }, 3.2)
      .add(() => litBeat(3), 3.15);

    // Reversing scroll must undo the lit/blocked classes GSAP can't tween.
    function typeHash(el: HTMLElement | null) {
      const full = 'policy · v1·a7f39c2';
      const stub = 'policy · v1·——————';
      const proxy = { p: 0 };
      return g.to(proxy, {
        p: 1,
        duration: 0.6,
        ease: 'none',
        onUpdate: () => {
          if (!el) return;
          const n = Math.round(proxy.p * (full.length - 'policy · v1·'.length));
          el.textContent = full.slice(0, 'policy · v1·'.length + n) + stub.slice('policy · v1·'.length + n);
        },
      });
    }

    // Keep the class-based lit states in sync when scrubbing backward, since
    // onStart callbacks only fire on forward playback.
    tl.eventCallback('onUpdate', () => {
      const p = tl.progress();
      agent?.classList.toggle('lit', p > 0);
      policy?.classList.toggle('lit', p > 0.2);
      firewall?.classList.toggle('lit', p > 0.55);
      trail?.classList.toggle('lit', p > 0.78);
      if (p < 0.28 || p > 0.42) policy?.classList.remove('blocked');
      else policy?.classList.add('blocked');
    });
  }

  /* ------------------------------------------------------------------ *
   * INIT + ScrollTrigger robustness
   * ------------------------------------------------------------------ */
  initDeck();
  initGovernance();

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
