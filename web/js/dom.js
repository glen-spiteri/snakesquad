// Minimal DOM helpers. No framework: the app is a linear stage machine, so
// screens just build a subtree and hand it back to the router.

/**
 * el('div', {class: 'card'}, 'text', childNode)
 * Props: `class`, `text`, `html`, `style` (object), `on` (event map), anything
 * else is set as an attribute.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'on') for (const [ev, fn] of Object.entries(value)) node.addEventListener(ev, fn);
    else node.setAttribute(key, value === true ? '' : value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** A screen container: `.screen` plus any extra classes. */
export function screen(extraClasses, ...children) {
  return el('div', { class: `screen ${extraClasses || ''}`.trim() }, ...children);
}

export function button(label, className, onClick, options = {}) {
  return el('button', {
    class: `btn ${className}`,
    text: label,
    disabled: options.disabled || false,
    on: { click: onClick },
  });
}

/** Paragraphs from an array of strings. */
export function paragraphs(texts) {
  return texts.map((t) => el('p', { text: t }));
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Presents a full-screen sheet (policy document, researcher panel).
 * Returns a dismiss function; `onDismiss` runs after it closes.
 */
export function presentSheet(build, onDismiss) {
  const host = document.getElementById('sheet-host');
  const sheet = el('div', { class: 'sheet' });
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    sheet.remove();
    if (onDismiss) onDismiss();
  };

  sheet.append(build(dismiss));
  host.append(sheet);
  return dismiss;
}

/** Standard sheet layout: a title bar with a Done button, plus a scrolling body. */
export function sheetFrame(title, dismiss, body, doneLabel = 'Done') {
  return el('div', { class: 'sheet-inner', style: { display: 'contents' } },
    el('div', { class: 'sheet-bar' },
      el('span', { text: title }),
      el('button', { text: doneLabel, on: { click: dismiss } })),
    body);
}

/**
 * In-app confirmation. Deliberately not window.confirm(): a native dialog in a
 * standalone web app is styled differently and can name the origin, which would
 * break the "ordinary mobile game" framing.
 */
export function confirmDialog({ title, message, confirmLabel, destructive = true }) {
  return new Promise((resolve) => {
    const overlay = el('div', {
      class: 'overlay',
      style: { position: 'fixed', zIndex: '60', background: 'rgba(15, 23, 38, 0.75)' },
    });

    const card = el('div', { class: 'card stack' },
      el('h3', { text: title }),
      el('p', { text: message }),
      el('div', { class: 'stack tight', style: { marginTop: '6px' } },
        button(confirmLabel, destructive ? 'destructive' : 'primary', () => { overlay.remove(); resolve(true); }),
        button('Cancel', 'secondary', () => { overlay.remove(); resolve(false); })));

    overlay.append(card);
    document.getElementById('sheet-host').append(overlay);
  });
}

/** Fires `handler` on the third tap within 600ms — the hidden researcher gesture. */
export function onTripleTap(node, handler) {
  let count = 0;
  let timer = null;
  node.addEventListener('click', () => {
    count += 1;
    clearTimeout(timer);
    if (count >= 3) {
      count = 0;
      handler();
      return;
    }
    timer = setTimeout(() => { count = 0; }, 600);
  });
}
