/* =====================================================================
   pinned — a fashion archive you flip through
   3D page-turn book (scroll-scrubbed) + pin board + detail overlay
   ===================================================================== */
(function () {
  "use strict";
  const DATA = window.PINNED_DATA;
  const { pieces } = DATA;
  const byId = (id) => pieces.find((p) => p.id === id);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const money = (p) => `${p.price.toLocaleString()}${p.currency}`;
  const plate = (piece, seed) => piece.image
    ? `<div class="plate-fill photo"><img src="${piece.image}" alt="${piece.name}" loading="lazy" /></div>`
    : `<div class="plate-fill">${window.plateSVG(piece.shape, { seed: seed || piece.id.charCodeAt(2) })}</div>`;

  /* ---- pin board state ------------------------------------------- */
  const STORE = "pinned.board.v1";
  let pins = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } })();
  const savePins = () => localStorage.setItem(STORE, JSON.stringify(pins));
  const isPinned = (id) => pins.includes(id);
  const togglePin = (id) => {
    pins = isPinned(id) ? pins.filter((x) => x !== id) : [...pins, id];
    savePins(); syncPinUI(); return isPinned(id);
  };

  let toastTimer;
  const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  };

  /* =================================================================
     MODE — 3D flip book vs plain vertical scroll (mobile / reduced)
     ================================================================= */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const computeMode = () => (window.innerWidth > 820 && !reduce ? "flip" : "scroll");
  let mode = computeMode();
  document.body.classList.add(`mode-${mode}`);

  const src = $("#pageSource");
  const book = $("#book");
  const bookScroll = $("#bookScroll");
  const PER_PAGE = 1400;         // ms to turn one page — higher = slower
  let leaves = [], numLeaves = 0, numSpreads = 0, currentSpread = 0;

  function buildBook() {
    const pages = [...src.children];        // authored in reading order
    numSpreads = pages.length / 2;
    numLeaves = numSpreads - 1;
    const last = pages.length - 1;

    const mk = (cls, child) => { const d = document.createElement("div"); d.className = cls; if (child) d.appendChild(child); return d; };
    book.innerHTML = "";
    book.appendChild(mk("page-base left", pages[0]));
    book.appendChild(mk("page-base right", pages[last]));

    leaves = [];
    for (let i = 0; i < numLeaves; i++) {
      const leaf = document.createElement("div");
      leaf.className = "leaf";
      leaf.appendChild(mk("leaf-face front", pages[2 * i + 1]));
      leaf.appendChild(mk("leaf-face back", pages[2 * i + 2]));
      book.appendChild(leaf);
      leaves.push(leaf);
    }
    src.remove();                            // pages now live in the book
  }

  /* =================================================================
     PLATES — inject silhouette SVGs into every authored figure
     ================================================================= */
  function injectPlates(root) {
    $$("[data-shape]", root).forEach((el) => {
      if (el.querySelector(".plate-fill")) return;
      const shape = el.dataset.shape, seed = el.dataset.seed || 1;
      el.insertAdjacentHTML("afterbegin", `<div class="plate-fill">${window.plateSVG(shape, { seed })}</div>`);
    });
  }

  /* =================================================================
     LOOKS — one entry per look: a hero shot for the picker (left page)
     and a 5-angle set laid out flat opposite (no angles = single still).
     ================================================================= */
  const ANGLE_LABELS = ["side", "3/4", "front", "3/4", "back"];
  const LOOKS = [
    {
      id: "look1", name: "black ribbon-tie dress",
      desc: "허리 라인을 강조하고 목에 레이스 리본 포인트를 더한 미니 원피스",
      color: "BLACK", fabric: "POLYESTER 95%  SPAN 5%", size: "S  M",
      hero: "assets/img/look1%20front.webp",
      angleLabels: ["side", "3/4", "front", "3/4", "back"],
      angles: [
        "assets/img/look1%20left.webp",       // full left profile
        "assets/img/look1%20side%20left.webp",// 3/4 left
        "assets/img/look1%20front.webp",       // front
        "assets/img/look1%20side%20right.webp",// 3/4 right
        "assets/img/look1%20right.webp",       // full right profile
      ],
      // no separate macro shoot yet — reframe existing shots as stand-in crops
      details: [
        { label: "레이스 리본 타이", src: "assets/img/look1%20details_1.webp", pos: "center", scale: 1 },
        { label: "허리 셔링 디자인", src: "assets/img/look1%20details_2.webp", pos: "center", scale: 1 },
        { label: "플레어 밑단 디테일", src: "assets/img/look1%20details_3.webp", pos: "center", scale: 1 },
        { label: "뒷면 버튼 클로징", src: "assets/img/look1%20details_4.webp", pos: "center", scale: 1 },
      ],
    },
    {
      id: "look2", name: "off-shoulder sweater",
      desc: "한쪽 어깨를 드러낸 셔츠와 컷오프 데님 반바지를 매치한 캐주얼룩.",
      color: "NAVY", fabric: "COTTON 80%  POLYESTER 20%", size: "S  M  L",
      hero: "assets/img/look2%20front%201.webp",
      angles: [
        "assets/img/look2%20left.webp",       // full left profile
        "assets/img/look2%20side%20left.webp",// 3/4 left
        "assets/img/look2%20front%201.webp",   // front
        "assets/img/look2%20side%20right.webp",// 3/4 right
        "assets/img/look2%20back.webp",        // full back
      ],
      details: [
        { label: "레이어드 숄더 디자인", src: "assets/img/look2%20details_1.webp", pos: "center", scale: 1 },
        { label: "레이어드 밑단 디테일", src: "assets/img/look2%20details_2.webp", pos: "center", scale: 1 },
        { label: "셔츠 커프스 포인트", src: "assets/img/look2%20details_3.webp", pos: "center", scale: 1 },
        { label: "언밸런스 백 라인", src: "assets/img/look2%20details_4.webp", pos: "center", scale: 1 },
      ],
    },
    {
      id: "look3", name: "khaki overall dress",
      desc: "밑단을 비대칭으로 컷팅한 데님 오버올 원피스에 블랙 오프숄더 이너로 포인트를 더했습니다.",
      color: "KHAKI", fabric: "COTTON 100%", size: "S  M",
      hero: "assets/img/look3%20front.webp",
      angles: [
        "assets/img/look3%20left.webp",       // full left profile
        "assets/img/look3%20side%20left.webp",// 3/4 left
        "assets/img/look3%20front.webp",       // front
        "assets/img/look3%20side%20right.webp",// 3/4 right
        "assets/img/look3%20back.webp",        // full back
      ],
      details: [
        { label: "오버올 스트랩 버클 디테일", src: "assets/img/look3%20details_1.webp", pos: "center", scale: 1 },
        { label: "프론트 포켓 디테일", src: "assets/img/look3%20details_2.webp", pos: "center", scale: 1 },
        { label: "비대칭 밑단 디테일", src: "assets/img/look3%20details_3.webp", pos: "center", scale: 1 },
        { label: "뒷면 스트랩 디자인", src: "assets/img/look3%20details_4.webp", pos: "center", scale: 1 },
      ],
    },
  ];
  let currentLook = 0;

  /* =================================================================
     ANGLE ROW (right page) — every photographed angle laid out flat,
     side by side, labelled underneath. No drag: just swaps to match
     whichever look is active in the picker opposite.
     ================================================================= */
  let renderAngles = () => {};
  let renderDetails = () => {};
  function initAnglesRow(root) {
    const row = $("#lookbookAnglesRow", root);
    const detailsRow = $("#lookbookDetailsRow", root);
    if (!row) return;
    renderAngles = (look) => {
      const images = look.angles.length ? look.angles : [look.hero];
      const labels = look.angleLabels || ANGLE_LABELS;
      row.innerHTML = images.map((src, i) => `
        <div class="lookbook-angle-item">
          <img src="${src}" alt="" />
          <span class="lookbook-angle-label">${labels[i] || ""}</span>
        </div>`).join("");
    };
    renderDetails = (look) => {
      if (!detailsRow) return;
      const details = look.details || [];
      detailsRow.innerHTML = details.map((d) => `
        <div class="lookbook-detail-item">
          <div class="lookbook-detail-crop">
            <img src="${d.src}" alt="" style="object-position:${d.pos}; transform:scale(${d.scale});" />
          </div>
          <span class="lookbook-detail-label">${d.label}</span>
        </div>`).join("");
    };
  }

  /* =================================================================
     LOOK PICKER (left page) — hero shot + spec panel + filmstrip.
     Selecting a filmstrip thumbnail (or prev/next) swaps the hero,
     specs, and the angle row opposite.
     ================================================================= */
  function initLookbook(root) {
    const heroImg = $("#lookbookHeroImg", root);
    const filmstrip = $("#lookbookFilmstrip", root);
    if (!heroImg || !filmstrip) return;
    const kickerEl = $("#lookbookKicker", root);
    const nameEl = $("#lookbookName", root);
    const descEl = $("#lookbookDesc", root);
    const colorEl = $("#lookbookColor", root);
    const fabricEl = $("#lookbookFabric", root);
    const sizeEl = $("#lookbookSize", root);

    const N = LOOKS.length;
    filmstrip.innerHTML = LOOKS.map((look, i) => `
      <button class="lookbook-filmstrip-item" data-look="${i}" aria-label="${look.name}">
        <span class="lookbook-filmstrip-num">${String(i + 1).padStart(2, "0")}</span>
        <img src="${look.angles[2] || look.hero}" alt="" />
      </button>`).join("");
    const thumbs = $$(".lookbook-filmstrip-item", filmstrip);
    thumbs.forEach((btn) => btn.addEventListener("click", () => select(+btn.dataset.look)));

    function select(i) {
      currentLook = clamp(i, 0, N - 1);
      render();
    }
    function render() {
      const look = LOOKS[currentLook];
      heroImg.src = look.hero;
      heroImg.alt = look.name;
      if (kickerEl) kickerEl.textContent = `look ${String(currentLook + 1).padStart(2, "0")}`;
      if (nameEl) nameEl.textContent = look.name;
      if (descEl) descEl.textContent = look.desc || "";
      if (colorEl) colorEl.textContent = look.color || "";
      if (fabricEl) fabricEl.textContent = look.fabric || "";
      if (sizeEl) sizeEl.textContent = look.size || "";
      thumbs.forEach((btn, i) => btn.classList.toggle("is-active", i === currentLook));
      renderAngles(look);
      renderDetails(look);
    }
    render();
  }

  /* =================================================================
     BUILD or SHOW pages, then populate dynamic content
     ================================================================= */
  if (mode === "flip") {
    buildBook();
  } else {
    src.hidden = false;                      // reveal as vertical stack
  }
  injectPlates(document);
  initAnglesRow(document);
  initLookbook(document);

  /* keywords + issue lines */
  const keywordList = $("#keywordList");
  if (keywordList) keywordList.innerHTML = DATA.keywords.map((k) => `<li>${k}</li>`).join("");
  const issueStr = `${DATA.issue.no} · ${DATA.issue.season} ${DATA.issue.year}`;
  ["#issueLine", "#issueFoot", "#imprintIssue", "#mastIssue"].forEach((s) => { const e = $(s); if (e) e.textContent = issueStr; });

  /* =================================================================
     SHOP — left page (category filters + featured piece) and right
     page (sortable grid). Categories are grouped for display (skirts
     read as "bottoms"; bags/shoes/accessories collapse into one
     "accessories" filter) since the catalog is small.
     ================================================================= */
  const SHOP_GROUP = { tops: "tops", skirts: "bottoms", shorts: "bottoms", pants: "bottoms", dresses: "dresses", bags: "accessories", accessories: "accessories", shoes: "shoes" };
  const SHOP_ORDER = ["all", "tops", "bottoms", "dresses", "accessories", "shoes"];
  const shopGroups = SHOP_ORDER.filter((c) => c === "all" || pieces.some((p) => (SHOP_GROUP[p.category] || p.category) === c));
  const shopFiltersEl = $("#shopFilters");
  const shopFilterGroupsEl = $("#shopFilterGroups");
  const shopColorOptionsEl = $("#shopColorOptions");
  const shopSizeOptionsEl = $("#shopSizeOptions");
  const shopPriceOptionsEl = $("#shopPriceOptions");
  const shopGridEl = $("#shopGrid");
  const shopPaginationEl = $("#shopPagination");
  const SHOP_PAGE_SIZE = 4;
  const SHOP_PIN_OUTLINE_SRC = "assets/img/PushPin.png";
  const SHOP_PIN_FILL_SRC = "assets/img/PushPin_fill.png";
  const SHOP_PRICE_RANGES = [
    { id: "u2", label: "20,000원 미만", test: (p) => p.price < 20000 },
    { id: "20-30", label: "20,000 – 30,000원", test: (p) => p.price >= 20000 && p.price < 30000 },
    { id: "30-40", label: "30,000 – 40,000원", test: (p) => p.price >= 30000 && p.price < 40000 },
    { id: "o4", label: "40,000원 이상", test: (p) => p.price >= 40000 },
  ];
  let shopCat = "all";
  let shopPage = 0;
  const shopFacets = { color: new Set(), size: new Set(), price: new Set() };

  const shopFacetOk = (p) => {
    if (shopFacets.color.size && !shopFacets.color.has(p.color)) return false;
    if (shopFacets.size.size && !shopFacets.size.has(p.size)) return false;
    if (shopFacets.price.size) {
      const ok = Array.from(shopFacets.price).some((id) => SHOP_PRICE_RANGES.find((r) => r.id === id)?.test(p));
      if (!ok) return false;
    }
    return true;
  };
  const shopMatches = (p, cat) => (cat === "all" || (SHOP_GROUP[p.category] || p.category) === cat) && shopFacetOk(p);

  function renderShopFilters() {
    if (!shopFiltersEl) return;
    shopFiltersEl.innerHTML = shopGroups.map((c) => {
      const count = pieces.filter((p) => shopMatches(p, c)).length;
      return `<button class="shop-filter${c === shopCat ? " active" : ""}" data-cat="${c}" role="tab">${c}<span class="count">${count}</span></button>`;
    }).join("");
    $$(".shop-filter", shopFiltersEl).forEach((btn) => btn.addEventListener("click", () => {
      shopCat = btn.dataset.cat;
      shopPage = 0;
      renderShopFilters();
      renderShopGrid();
    }));
  }

  function renderShopFilterOptions() {
    if (!shopFilterGroupsEl) return;
    const colors = Array.from(new Set(pieces.map((p) => p.color))).sort();
    const sizes = Array.from(new Set(pieces.map((p) => p.size))).sort();
    const option = (group, value, label) => `
      <label class="shop-filter-option">
        <input type="checkbox" data-group="${group}" value="${value}" ${shopFacets[group].has(value) ? "checked" : ""} />
        <span>${label}</span>
      </label>`;
    const wrap = (html) => `<div class="shop-filter-options-inner">${html}</div>`;
    if (shopColorOptionsEl) shopColorOptionsEl.innerHTML = wrap(colors.map((c) => option("color", c, c)).join(""));
    if (shopSizeOptionsEl) shopSizeOptionsEl.innerHTML = wrap(sizes.map((s) => option("size", s, s)).join(""));
    if (shopPriceOptionsEl) shopPriceOptionsEl.innerHTML = wrap(SHOP_PRICE_RANGES.map((r) => option("price", r.id, r.label)).join(""));

    $$(".shop-filter-group-head", shopFilterGroupsEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.closest(".shop-filter-group");
        const panel = group.querySelector(".shop-filter-options");
        const isOpen = group.classList.toggle("open");
        const toggle = btn.querySelector(".shop-filter-toggle");
        if (toggle) toggle.textContent = isOpen ? "–" : "+";
        panel.style.maxHeight = isOpen ? `${panel.scrollHeight}px` : "0px";
      });
    });
    $$(".shop-filter-option input", shopFilterGroupsEl).forEach((input) => {
      input.addEventListener("change", () => {
        const set = shopFacets[input.dataset.group];
        if (input.checked) set.add(input.value); else set.delete(input.value);
        shopPage = 0;
        renderShopFilters();
        renderShopGrid();
      });
    });
  }

  function renderShopGrid() {
    if (!shopGridEl) return;
    const list = pieces.filter((p) => shopMatches(p, shopCat));
    const pageCount = Math.max(1, Math.ceil(list.length / SHOP_PAGE_SIZE));
    shopPage = clamp(shopPage, 0, pageCount - 1);
    const pageItems = list.slice(shopPage * SHOP_PAGE_SIZE, shopPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE);

    shopGridEl.innerHTML = pageItems.map((p) => `
      <button class="shop-item" data-id="${p.id}" aria-label="${p.name}">
        <figure class="pinned-photo ${p.image ? "photo-real" : `tone-${p.tone}`}">
          ${plate(p)}
          <span class="shop-item-pin${isPinned(p.id) ? " pinned" : ""}" data-pin="${p.id}" title="pin this piece"><img src="${isPinned(p.id) ? SHOP_PIN_FILL_SRC : SHOP_PIN_OUTLINE_SRC}" alt="" /></span>
        </figure>
        <div class="shop-item-meta">
          <p class="shop-item-name">${p.name}</p>
          <p class="shop-item-price">${money(p)}</p>
        </div>
      </button>`).join("");

    if (shopPaginationEl) {
      if (pageCount <= 1) {
        shopPaginationEl.innerHTML = "";
      } else {
        const nums = Array.from({ length: pageCount }, (_, i) => `<button class="shop-page-btn${i === shopPage ? " active" : ""}" data-page="${i}">${i + 1}</button>`).join("");
        shopPaginationEl.innerHTML = `
          <button class="shop-page-btn" data-page="${shopPage - 1}"${shopPage === 0 ? " disabled" : ""}>←</button>
          ${nums}
          <button class="shop-page-btn" data-page="${shopPage + 1}"${shopPage === pageCount - 1 ? " disabled" : ""}>→</button>`;
        $$(".shop-page-btn", shopPaginationEl).forEach((btn) => {
          if (btn.disabled) return;
          btn.addEventListener("click", () => { shopPage = +btn.dataset.page; renderShopGrid(); });
        });
      }
    }
  }

  renderShopFilters();
  renderShopFilterOptions();
  renderShopGrid();

  /* =================================================================
     PRODUCT DETAIL overlay
     ================================================================= */
  const overlay = $("#detailOverlay");
  let currentDetail = null;
  function openDetail(id) {
    const p = byId(id); if (!p) return;
    currentDetail = id;
    $("#detailFigure").className = p.image ? "pinned-photo photo-real" : `pinned-photo tone-${p.tone}`;
    $("#detailPlate").className = p.image ? "plate-fill photo" : "plate-fill";
    $("#detailPlate").innerHTML = p.image
      ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
      : window.plateSVG(p.shape, { seed: 3 });
    $("#detailCaption").textContent = p.caption;
    $("#detailHouse").textContent = p.house;
    $("#detailName").textContent = p.name;
    $("#detailEra").textContent = `${p.era} · ${p.category}`;
    $("#detailNote").textContent = p.note;
    $("#detailPrice").textContent = money(p);
    $("#detailSpecs").innerHTML =
      `<dt>condition</dt><dd>${p.condition}</dd><dt>material</dt><dd>${p.material}</dd><dt>size</dt><dd>${p.size}</dd><dt>house</dt><dd>${p.house}</dd>`;
    const pinBtn = $("#detailPin");
    pinBtn.classList.toggle("pinned", isPinned(id));
    pinBtn.textContent = isPinned(id) ? "pinned ✓" : "pin this piece";
    overlay.hidden = false; document.body.style.overflow = "hidden";
  }
  const closeDetail = () => { overlay.hidden = true; currentDetail = null; document.body.style.overflow = ""; };

  $("#detailPin").addEventListener("click", () => {
    if (!currentDetail) return;
    const now = togglePin(currentDetail);
    const b = $("#detailPin");
    b.classList.toggle("pinned", now); b.textContent = now ? "pinned ✓" : "pin this piece";
    toast(now ? "pinned to your board" : "removed from board");
  });
  $("#detailBuy").addEventListener("click", () => {
    if (!currentDetail) return;
    toast("checkout is a demo — but the taste is real");
  });

  /* =================================================================
     BOARD slide-over
     ================================================================= */
  const boardPanel = $("#boardPanel");
  const openBoard = () => { renderBoard(); boardPanel.hidden = false; document.body.style.overflow = "hidden"; };
  const closeBoard = () => { boardPanel.hidden = true; document.body.style.overflow = ""; };
  function renderBoard() {
    const body = $("#boardBody"), foot = $("#boardFooter");
    if (!pins.length) {
      body.innerHTML = `<div class="board-empty">nothing pinned yet.<br />find a piece and tap <em>pin this piece</em>.<br />one of one — when it's gone, it's gone.</div>`;
      foot.innerHTML = ""; return;
    }
    const list = pins.map(byId).filter(Boolean);
    body.innerHTML = list.map((p) => `
      <div class="board-row">
        <div class="board-thumb ${p.image ? "photo-real" : `tone-${p.tone}`}">${plate(p)}</div>
        <div class="board-info"><h4>${p.name}</h4><p>${p.category} · ${p.color}</p><div class="bprice">${money(p)}</div></div>
        <button class="board-remove" data-remove="${p.id}">remove</button>
      </div>`).join("");
    const total = list.reduce((s, p) => s + p.price, 0);
    foot.innerHTML = `
      <div class="board-total"><span class="lbl">${list.length} piece${list.length > 1 ? "s" : ""} pinned</span><span class="val">${total.toLocaleString()}${list[0].currency}</span></div>
      <button class="cta solid" style="width:100%" id="boardCheckout">checkout</button>`;
    $("#boardCheckout").addEventListener("click", () => toast("checkout is a demo — but the taste is real"));
  }

  /* board preview + count + pin badges */
  function syncPinUI() {
    $("#boardCount").textContent = pins.length;
    $$(".shop-item-pin").forEach((el) => {
      const on = isPinned(el.dataset.pin);
      el.classList.toggle("pinned", on);
      const img = el.querySelector("img");
      if (img) img.src = on ? SHOP_PIN_FILL_SRC : SHOP_PIN_OUTLINE_SRC;
    });
    const prev = $("#boardPreview");
    if (prev) {
      prev.innerHTML = pins.length
        ? pins.slice(0, 8).map((id) => { const p = byId(id); return `<div class="bp-thumb ${p.image ? "photo-real" : `tone-${p.tone}`}">${plate(p)}</div>`; }).join("")
        : `<span class="bp-empty">no pieces pinned yet — your board fills as you go.</span>`;
    }
    if (!boardPanel.hidden) renderBoard();
  }

  /* =================================================================
     SEARCH dropdown
     ================================================================= */
  const searchPanel = $("#searchPanel");
  const searchInput = $("#searchInput");
  const searchBody = $("#searchBody");

  function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    const list = !q ? [] : pieces.filter((p) =>
      [p.name, p.color, p.category, p.material].join(" ").toLowerCase().includes(q));

    if (!q) {
      searchBody.innerHTML = `<div class="board-empty">search by name, color, category, or material.<br />try “skirt”, “black”, or “tops”.</div>`;
      return;
    }
    if (!list.length) {
      searchBody.innerHTML = `<div class="board-empty">no pieces match “${query}”.<br />try a different word.</div>`;
      return;
    }
    searchBody.innerHTML = `<p class="search-count">${list.length} piece${list.length === 1 ? "" : "s"} found</p>
      <div class="search-results-grid">` +
      list.map((p) => `
        <button class="search-result" data-id="${p.id}">
          <figure class="pinned-photo search-result-photo ${p.image ? "photo-real" : `tone-${p.tone}`}">${plate(p)}</figure>
          <p class="search-result-name">${p.name}</p>
          <p class="search-result-price">${money(p)}</p>
        </button>`).join("") +
      `</div>`;
  }

  const openSearch = () => {
    searchPanel.hidden = false; document.body.style.overflow = "hidden";
    searchInput.value = ""; renderSearchResults("");
    setTimeout(() => searchInput.focus(), 50);
  };
  const closeSearch = () => { searchPanel.hidden = true; document.body.style.overflow = ""; };
  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));

  /* =================================================================
     EVENT DELEGATION
     ================================================================= */
  document.addEventListener("click", (e) => {
    const pinEl = e.target.closest("[data-pin]");
    if (pinEl) { e.stopPropagation(); toast(togglePin(pinEl.dataset.pin) ? "pinned to your board" : "removed from board"); return; }
    const searchResult = e.target.closest(".search-result");
    if (searchResult) { closeSearch(); openDetail(searchResult.dataset.id); return; }
    const item = e.target.closest(".shop-item"); if (item) return openDetail(item.dataset.id);
    const rm = e.target.closest("[data-remove]"); if (rm) { togglePin(rm.dataset.remove); toast("removed from board"); return; }
    if (e.target.closest("[data-close]")) return closeDetail();
    if (e.target.closest("[data-board-close]")) return closeBoard();
    if (e.target.closest("[data-search-close]")) return closeSearch();
  });
  $("#openBoard").addEventListener("click", openBoard);
  const openBoard2 = $("#openBoard2");
  if (openBoard2) openBoard2.addEventListener("click", openBoard);
  $("#featureCta").addEventListener("click", () => openDetail("p05"));
  $("#navSearch").addEventListener("click", openSearch);
  $("#navAccount").addEventListener("click", () => toast("account — demo, no sign-in yet"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!overlay.hidden) closeDetail();
      else if (!boardPanel.hidden) closeBoard();
      else if (!searchPanel.hidden) closeSearch();
      return;
    }
    if (mode === "flip" && overlay.hidden && boardPanel.hidden && searchPanel.hidden && !animating) {
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goToSpread(currentSpread + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goToSpread(currentSpread - 1); }
    }
  });

  /* =================================================================
     FLIP CONTROLLER — GNB navigation + inertial, eased page turns
     ================================================================= */
  const bar = $("#progressBar");
  const gnb = $("#gnb");
  const pageFaces = mode === "scroll" ? $$(".page-face") : null;
  const spreadCount = mode === "flip" ? numSpreads : pageFaces.length / 2;

  /* GNB items are authored in the masthead (data-spread maps each to a page);
     the active item follows the spread you're on */
  const gnbBtns = $$(".gnb button");
  const setActiveGNB = (k) => gnbBtns.forEach((b) => b.classList.toggle("active", +b.dataset.spread === k));

  // gentle sine ease — no fast whip through the middle, like a real page turn
  const ease = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;
  let cur = 0, animating = false, animId = null;   // cur = flip progress (0..numLeaves)

  const renderFlip = () => {
    leaves.forEach((leaf, i) => {
      const f = clamp(cur - i, 0, 1);
      leaf.style.setProperty("--f", f.toFixed(3));
      leaf.style.transform = `rotateY(${(-180 * ease(f)).toFixed(2)}deg)`;
      leaf.style.zIndex = f <= 0 ? numLeaves - i + 1 : f >= 1 ? i + 1 : numLeaves + 20;
    });
    currentSpread = Math.round(cur);
    bar.style.width = `${(cur / numLeaves) * 100}%`;
    setActiveGNB(currentSpread);
  };

  /* one scroll / key / GNB click = one slow, animated page turn */
  function goToSpread(k) {
    if (mode !== "flip") {
      k = clamp(k, 0, spreadCount - 1);
      const el = pageFaces[Math.min(k * 2, pageFaces.length - 1)];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveGNB(k);
      return;
    }
    k = clamp(k, 0, numLeaves);
    const from = cur, to = k, dist = Math.abs(to - from);
    if (dist < 0.001) return;
    cancelAnimationFrame(animId);
    // jumping several spreads (GNB nav) shouldn't visibly flip through every
    // page in between — snap instantly to just before the target and only
    // animate the final single page turn, so it reads as "go there" in one flip.
    let animFrom = from;
    if (dist > 1) {
      animFrom = to > from ? to - 1 : to + 1;
      cur = animFrom;
      renderFlip();
    }
    const D = PER_PAGE * Math.pow(Math.abs(to - animFrom), 0.65);
    const t0 = performance.now();
    animating = true;
    const step = (now) => {
      const p = clamp((now - t0) / D, 0, 1);
      cur = animFrom + (to - animFrom) * p;           // linear in time; the page turn itself is eased
      renderFlip();
      if (p < 1) { animId = requestAnimationFrame(step); }
      else { cur = to; currentSpread = to; animating = false; renderFlip(); }
    };
    animId = requestAnimationFrame(step);
  }
  gnb.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) goToSpread(+b.dataset.spread); });
  $("#goCover").addEventListener("click", (e) => { e.preventDefault(); goToSpread(0); });

  if (mode === "flip") {
    // wheel: one gesture turns one page; momentum is absorbed until it settles
    let wheelLock = false, settleTimer;
    window.addEventListener("wheel", (e) => {
      if (!overlay.hidden || !boardPanel.hidden || !searchPanel.hidden) return;   // let modals scroll
      e.preventDefault();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { wheelLock = false; }, 160);
      if (animating || wheelLock || Math.abs(e.deltaY) < 4) return;
      const next = currentSpread + (e.deltaY > 0 ? 1 : -1);
      if (next < 0 || next > numLeaves) return;
      wheelLock = true;
      goToSpread(next);
    }, { passive: false });
    window.addEventListener("resize", renderFlip);
    renderFlip();
  } else {
    const onScroll = () => {
      const doc = document.documentElement;
      bar.style.width = `${clamp(doc.scrollTop / (doc.scrollHeight - doc.clientHeight || 1), 0, 1) * 100}%`;
      let idx = 0;
      pageFaces.forEach((el, i) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.5) idx = i; });
      setActiveGNB(clamp(Math.round(idx / 2), 0, spreadCount - 1));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* rebuild if we cross the flip/scroll breakpoint */
  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => { if (computeMode() !== mode) location.reload(); }, 250);
  });

  syncPinUI();
})();
