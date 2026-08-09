// Trimmed motion layer for the LemmaComputer landing page. GSAP + ScrollTrigger
// load globally from CDN in BaseLayout, so we read them off window rather than
// importing an npm package. Everything degrades gracefully: under reduced motion
// the CSS keeps all [data-r] content visible, and this file simply skips reveals.
declare const gsap: any;
declare const ScrollTrigger: any;

const g = (window as any).gsap as any;
const ST = (window as any).ScrollTrigger as any;

if (g && ST) {
  g.registerPlugin(ST);

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

  /* THEME TOGGLE */
  const tgl = $('tgl');
  if (tgl) {
    tgl.onclick = () => {
      const r = document.documentElement;
      r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
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

  /* MODEL MODE CYCLE — the four Auto/Lite/Balanced/Pro pills in §agents softly
     cycle their active state to hint that the mode is selectable. Purely
     decorative; off under reduced motion. */
  const modes = ([] as HTMLElement[]).slice.call(document.querySelectorAll('.mode-pill'));
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

  addEventListener('load', function () {
    ST.refresh();
  });
}
