// Bottom dock, header status, loader and Zen mode.
const fmt = new Intl.NumberFormat('en-US');

export function initUI({ onRaj, onLight, onView }) {
  const $ = (id) => document.getElementById(id);
  const dock = $('dock');
  const loader = $('loader');
  const slider = $('rajSlider');
  const rajValue = $('rajValue');
  const stats = $('weaveStats');

  // Tabs
  for (const tab of dock.querySelectorAll('.tab[data-panel]')) {
    tab.addEventListener('click', () => {
      if (dock.classList.contains('collapsed')) setCollapsed(false);
      for (const t of dock.querySelectorAll('.tab[data-panel]')) {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
      }
      for (const p of dock.querySelectorAll('.panel')) p.classList.toggle('active', p.dataset.panel === tab.dataset.panel);
    });
  }

  const toggle = $('dockToggle');
  const setCollapsed = (c) => {
    dock.classList.toggle('collapsed', c);
    toggle.setAttribute('aria-expanded', !c);
    toggle.setAttribute('aria-label', c ? 'Expand controls' : 'Collapse controls');
  };
  toggle.addEventListener('click', () => setCollapsed(!dock.classList.contains('collapsed')));

  // Raj: the label follows the thumb; the weave rebuilds once the value rests.
  let rajTimer = 0;
  slider.addEventListener('input', () => {
    rajValue.textContent = slider.value;
    clearTimeout(rajTimer);
    rajTimer = setTimeout(() => onRaj(Number(slider.value)), 90);
  });

  for (const b of $('lightSeg').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      for (const o of $('lightSeg').querySelectorAll('button')) o.classList.toggle('active', o === b);
      onLight(b.dataset.light);
    });
  }

  for (const b of $('presets').querySelectorAll('button')) {
    b.addEventListener('click', () => {
      for (const o of $('presets').querySelectorAll('button')) o.classList.toggle('active', o === b);
      onView(b.dataset.view);
    });
  }

  const setZen = (on) => document.body.classList.toggle('zen', on);
  $('zenBtn').addEventListener('click', () => setZen(true));
  $('zenExit').addEventListener('click', () => setZen(false));
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.key !== 'Escape') return;
    if (e.key === 'z' || e.key === 'Z') setZen(!document.body.classList.contains('zen'));
    if (e.key === 'Escape') setZen(false);
  });

  return {
    setLoading(text) {
      $('loaderText').textContent = text;
    },
    hideLoader() {
      loader.classList.add('done');
      setTimeout(() => loader.remove(), 1400);
    },
    setSource(source, count) {
      const dot = $('sourceDot');
      dot.classList.add(source);
      dot.title = source === 'live'
        ? `${count} quatrains fetched live from Ganjoor`
        : `Ganjoor unreachable: woven from ${count} archived Ganjoor quatrains`;
    },
    setStats({ rows, words, unique }) {
      stats.textContent = `${rows} rows · ${fmt.format(words)} word-knots · ${fmt.format(unique)} unique words`;
    },
  };
}
