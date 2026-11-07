// Blocking, local bootstrap prevents a flash of the wrong theme. No network.
(() => {
  const root = document.documentElement;
  try {
    const theme = localStorage.getItem('homeauto.theme.v1'); root.dataset.theme = ['05', '01', '03', '04'].includes(theme) ? theme : '05';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ({ '05':'#F8F9F7', '01':'#FAF8F2', '03':'#F8F9F6', '04':'#F7F9FE' })[root.dataset.theme]);
    root.lang = localStorage.getItem('homeauto.language.v1') === 'hi' ? 'hi' : 'en';
    for (const key of ['largeText', 'largeControls', 'reducedMotion', 'strongOutlines']) root.dataset[key] = String(localStorage.getItem('homeauto.' + key + '.v1') === 'true');
  } catch { root.dataset.theme = '05'; }
})();
