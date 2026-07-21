/* pinned — garment silhouettes
 * Simple line/fill silhouettes stand in for photography. They give each
 * plate a recognisable fashion shape without shipping real images.
 * Every silhouette draws with currentColor so the plate controls tone.
 */
window.PINNED_SILHOUETTES = {
  model: `
    <path d="M100 34c9 0 15 7 15 17 0 8-4 14-9 17 8 3 15 9 18 20l14 78c1 6-3 9-8 9-4 0-7-3-8-8l-8-44-2 60 6 74c1 6-3 10-9 10-5 0-8-3-9-9l-6-70-6 70c-1 6-4 9-9 9-6 0-10-4-9-10l6-74-2-60-8 44c-1 5-4 8-8 8-5 0-9-3-8-9l14-78c3-11 10-17 18-20-5-3-9-9-9-17 0-10 6-17 15-17z"/>`,
  coat: `
    <path d="M70 24c8 6 22 6 30 0l8 6 30 20-10 24-10-6v98c0 6-4 10-10 10H62c-6 0-10-4-10-10V68l-10 6-10-24 30-20z"/>
    <path d="M100 30v130" stroke="currentColor" stroke-width="2" fill="none" opacity=".35"/>`,
  dress: `
    <path d="M78 26c4 6 18 6 22 0l4 3 8 22-8 5 30 120c1 5-2 8-7 8H63c-5 0-8-3-7-8l30-120-8-5 8-22z"/>`,
  bag: `
    <path d="M62 70c0-24 12-40 38-40s38 16 38 40" fill="none" stroke="currentColor" stroke-width="9"/>
    <path d="M48 74h104l10 84c1 8-4 12-11 12H49c-7 0-12-4-11-12z"/>`,
  boot: `
    <path d="M84 24h26v70l34 44c6 8 2 22-10 22H82c-8 0-14-6-14-14V38c0-8 6-14 16-14z"/>
    <path d="M70 156h78v10H70z"/>`,
  top: `
    <path d="M66 30l34 10 34-10 28 22-14 22-14-8v70c0 5-3 8-8 8H74c-5 0-8-3-8-8V88l-14 8-14-22z"/>`,
  skirt: `
    <path d="M70 34h60v20l24 100c1 6-3 10-9 10H55c-6 0-10-4-9-10l24-100z"/>
    <path d="M70 54h60" stroke="#fff" stroke-width="2" fill="none" opacity=".4"/>`,
  belt: `
    <rect x="24" y="86" width="152" height="28" rx="6"/>
    <rect x="86" y="78" width="44" height="44" rx="8" fill="none" stroke="currentColor" stroke-width="9"/>`,
};

/* Build an inline SVG plate for a garment shape + tone. */
window.plateSVG = function (shape, opts = {}) {
  const s = window.PINNED_SILHOUETTES[shape] || window.PINNED_SILHOUETTES.dress;
  const seed = opts.seed || 1;
  return `
  <svg class="plate-svg" viewBox="0 0 200 220" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <g transform="translate(0 -6)">${s}</g>
    <g class="plate-grain" data-seed="${seed}"></g>
  </svg>`;
};
