type Attrs = Record<string, string | number | boolean | undefined>;

export function h<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  attrs?: Attrs | null,
  ...kids: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[T] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue;
      if (key === 'class') node.className = String(value);
      else if (key === 'text') node.textContent = String(value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const kid of kids) {
    if (kid == null) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', { text: label }), control);
}
