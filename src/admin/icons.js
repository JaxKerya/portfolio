/**
 * Lucide icon helper — returns inline SVG string
 * Uses the global `lucide` object loaded via CDN
 */
export function icon(name, size = 16) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;"></i>`;
}

/**
 * Call after dynamically inserting HTML with data-lucide attributes
 */
export function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
