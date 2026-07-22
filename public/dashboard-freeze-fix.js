(() => {
  function neutraliseSelfTrigger() {
    const label = document.querySelector('#dashboard-layout-mode-label');
    if (label) label.remove();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', neutraliseSelfTrigger, { once: true });
  else neutraliseSelfTrigger();
})();