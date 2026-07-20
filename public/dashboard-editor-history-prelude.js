(() => {
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    const textEditing = target instanceof HTMLTextAreaElement
      || (target instanceof HTMLInputElement && !['button','checkbox','color','file','radio','range','reset','submit'].includes(target.type))
      || (target instanceof HTMLElement && target.isContentEditable);
    if (textEditing && ['z','y'].includes(event.key.toLowerCase())) event.stopPropagation();
  }, true);
})();
