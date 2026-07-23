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
  const money = (p) => `${p.currency}${p.price}`;
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
     and, once shot, a 5-angle set for the rotate viewer (right page).
     angles stays empty until that look's angle photos are dropped in;
     the rotate viewer then just shows the hero as a single still frame.
     ================================================================= */
  const LOOKS = [
    {
      id: "look1", name: "black ribbon-tie dress",
      desc: "A dress the shape of a held breath — bow tied at the throat like a secret, hem cut short enough to argue back.",
      hero: "assets/img/look1%20side%20left.png",
      angles: [
        "assets/img/look1%20left.png",       // full left profile
        "assets/img/look1%20side%20left.png",// 3/4 left
        "assets/img/look1%20front.png",       // front
        "assets/img/look1%20side%20right.png",// 3/4 right
        "assets/img/look1%20right.png",       // full right profile
      ],
    },
    {
      id: "white", name: "cream ruffle blouse",
      desc: "Cream ruffle blouse, black shorts, heart-pattern socks — soft collar, quiet rebellion underneath.",
      hero: "assets/img/collection%20white.jpg", angles: [],
    },
    {
      id: "red", name: "red cutout + cargo skirt",
      desc: "Red cutout top, khaki cargo mini skirt, heart charm — new arrival, first piece not pulled from the archive.",
      hero: "assets/img/collection%20red.png", angles: [],
    },
  ];
  let currentLook = 0;

  /* =================================================================
     ROTATE VIEWER — drag left/right to swing the current look through
     its angle photos; off-angle frames sit as faint ghosts either side
     of the active one. setFrames() swaps in a different look's angles.
     ================================================================= */
  let setRotateFrames = () => {};
  function initRotateViewer(root) {
    const viewer = $("#rotateViewer", root);
    if (!viewer) return;
    const track = $(".rotate-track", viewer);
    const STEP_PX = 90;
    let frames = [], count = 0, center = 0, pos = 0, settleAnim = null;

    // pos is continuous (not snapped) while dragging, so the trail actually
    // tracks the pointer 1:1 instead of jumping between discrete photos —
    // that continuous blend is what reads as "rotating" rather than swapping.
    const layout = (p) => {
      frames.forEach((el, i) => {
        const d = i - p;
        const abs = Math.abs(d);
        el.classList.toggle("is-active", Math.round(p) === i);
        el.style.zIndex = String(Math.round((1 - abs) * 100));
        el.style.opacity = String(clamp(1 - abs * 0.55, 0, 1));
        const scale = clamp(1 - abs * 0.18, 0.55, 1);
        // arrange frames on a curved arc (depth + rotation + slight vertical
        // dip) instead of a flat horizontal slide, so it reads as swinging
        // around the figure rather than panning left/right.
        const rotY = clamp(d * 24, -60, 60);
        const z = -abs * 110;
        const y = abs * 14;
        el.style.transform = `translateX(${d * 24}%) translateY(${y}px) translateZ(${z}px) rotateY(${rotY}deg) scale(${scale})`;
      });
    };

    setRotateFrames = (images) => {
      cancelAnimationFrame(settleAnim);
      track.innerHTML = "";
      frames = images.map((src) => {
        const el = document.createElement("div");
        el.className = "rotate-frame";
        el.innerHTML = `<img src="${src}" alt="" draggable="false" />`;
        track.appendChild(el);
        return el;
      });
      count = frames.length;
      center = Math.floor((count - 1) / 2);
      pos = center;
      layout(pos);
    };

    let dragging = false, startX = 0, startPos = pos;
    const pointX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
    const onDown = (e) => {
      if (count < 2) return;
      cancelAnimationFrame(settleAnim);
      dragging = true; startX = pointX(e); startPos = pos;
      viewer.classList.add("dragging");
    };
    const onMove = (e) => {
      if (!dragging) return;
      const delta = pointX(e) - startX;
      pos = clamp(startPos - delta / STEP_PX, 0, count - 1);
      layout(pos);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false; viewer.classList.remove("dragging");
      const target = clamp(Math.round(pos), 0, count - 1);
      const from = pos, dist = Math.abs(target - from), D = 200 + dist * 80;
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / D, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        pos = from + (target - from) * eased;
        layout(pos);
        if (t < 1) settleAnim = requestAnimationFrame(step);
      };
      settleAnim = requestAnimationFrame(step);
    };

    viewer.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /* =================================================================
     LOOK PICKER (left page) — the active look sits big and centred;
     the other looks flank it, ghosted in grayscale, same visual
     language as the rotate-viewer's angle trail opposite. Click a
     flanking look to bring it to the centre and reload the viewer.
     ================================================================= */
  function initLookbook(root) {
    const stage = $("#lookbookStage", root);
    if (!stage) return;
    const track = $(".lookbook-track", stage);
    const kickerEl = $("#lookbookKicker", root);
    const nameEl = $("#lookbookName", root);
    const vdescEl = $("#lookbookVdesc", root);

    const frames = LOOKS.map((look, i) => {
      const btn = document.createElement("button");
      btn.className = "look-frame";
      btn.innerHTML = `<img src="${look.hero}" alt="${look.name}" />`;
      btn.addEventListener("click", () => {
        currentLook = i;
        layout();
        setRotateFrames(look.angles.length ? look.angles : [look.hero]);
      });
      track.appendChild(btn);
      return btn;
    });

    const N = frames.length;
    const layout = () => {
      frames.forEach((el, i) => {
        let d = i - currentLook;                       // signed steps from the active look
        if (d > N / 2) d -= N;                          // wrap around so looks split
        if (d < -N / 2) d += N;                          // evenly to both sides, not just one
        const abs = Math.abs(d);
        el.classList.toggle("is-active", d === 0);
        el.style.zIndex = String(10 - abs);
        el.style.opacity = abs === 0 ? "1" : abs === 1 ? ".6" : ".35";
        const scale = abs === 0 ? 1 : abs === 1 ? .56 : .42;
        el.style.transform = `translateX(${d * 34}%) scale(${scale})`;
      });
      if (kickerEl) kickerEl.textContent = `look ${String(currentLook + 1).padStart(2, "0")}`;
      if (nameEl) nameEl.textContent = LOOKS[currentLook].name;
      if (vdescEl) vdescEl.textContent = LOOKS[currentLook].desc || "";
    };
    layout();
    setRotateFrames(LOOKS[currentLook].angles.length ? LOOKS[currentLook].angles : [LOOKS[currentLook].hero]);
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
  initRotateViewer(document);
  initLookbook(document);

  /* keywords + issue lines */
  const keywordList = $("#keywordList");
  if (keywordList) keywordList.innerHTML = DATA.keywords.map((k) => `<li>${k}</li>`).join("");
  const issueStr = `${DATA.issue.no} · ${DATA.issue.season} ${DATA.issue.year}`;
  ["#issueLine", "#issueFoot", "#imprintIssue", "#mastIssue"].forEach((s) => { const e = $(s); if (e) e.textContent = issueStr; });

  /* archive filters + wall */
  const categories = ["all", ...new Set(pieces.map((p) => p.category))];
  $("#filters").innerHTML = categories.map((c, i) =>
    `<button class="filter${i === 0 ? " active" : ""}" data-cat="${c}" role="tab">${c}</button>`).join("");
  const wall = $("#archiveWall");
  function renderWall(cat = "all") {
    const list = cat === "all" ? pieces : pieces.filter((p) => p.category === cat);
    wall.innerHTML = list.map((p) => `
      <button class="arch-item" data-id="${p.id}" aria-label="${p.name}">
        <figure class="pinned-photo ${p.image ? "photo-real" : `tone-${p.tone}`}">
          ${plate(p)}
          <span class="arch-pin${isPinned(p.id) ? " pinned" : ""}" data-pin="${p.id}" title="pin this piece">${isPinned(p.id) ? "✓" : "+"}</span>
          <figcaption>${p.caption}</figcaption>
        </figure>
        <div class="arch-meta">
          <p class="arch-house">${p.house}</p>
          <p class="arch-name">${p.name}</p>
          <div class="arch-line"><span class="arch-era">${p.era}</span><span class="arch-price">${money(p)}</span></div>
        </div>
      </button>`).join("");
  }
  renderWall();

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
  $("#detailBag").addEventListener("click", () => {
    if (!currentDetail) return;
    if (!isPinned(currentDetail)) togglePin(currentDetail);
    const b = $("#detailPin"); b.classList.add("pinned"); b.textContent = "pinned ✓";
    toast("added to your bag");
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
        <div class="board-thumb ${p.image ? "photo-real" : `tone-${p.tone}`}">${plate(p)}<span class="safety-pin" aria-hidden="true"></span></div>
        <div class="board-info"><h4>${p.name}</h4><p>${p.house} · ${p.era}</p><div class="bprice">${money(p)}</div></div>
        <button class="board-remove" data-remove="${p.id}">unpin</button>
      </div>`).join("");
    const total = list.reduce((s, p) => s + p.price, 0);
    foot.innerHTML = `
      <div class="board-total"><span class="lbl">${list.length} piece${list.length > 1 ? "s" : ""} pinned</span><span class="val">${pieces[0].currency}${total}</span></div>
      <button class="cta solid" style="width:100%" id="boardCheckout">reserve the board</button>`;
    $("#boardCheckout").addEventListener("click", () => toast("reservation is a demo — but the taste is real"));
  }

  /* board preview + count + pin badges */
  function syncPinUI() {
    $("#boardCount").textContent = pins.length;
    $$(".arch-pin").forEach((el) => {
      const on = isPinned(el.dataset.pin);
      el.classList.toggle("pinned", on); el.textContent = on ? "✓" : "+";
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
     EVENT DELEGATION
     ================================================================= */
  document.addEventListener("click", (e) => {
    const pinEl = e.target.closest("[data-pin]");
    if (pinEl) { e.stopPropagation(); toast(togglePin(pinEl.dataset.pin) ? "pinned to your board" : "removed from board"); return; }
    const item = e.target.closest(".arch-item"); if (item) return openDetail(item.dataset.id);
    const rm = e.target.closest("[data-remove]"); if (rm) { togglePin(rm.dataset.remove); toast("removed from board"); return; }
    const f = e.target.closest(".filter");
    if (f) { $$(".filter").forEach((x) => x.classList.remove("active")); f.classList.add("active"); renderWall(f.dataset.cat); return; }
    if (e.target.closest("[data-close]")) return closeDetail();
    if (e.target.closest("[data-board-close]")) return closeBoard();
  });
  $("#openBoard").addEventListener("click", openBoard);
  $("#openBoard2").addEventListener("click", openBoard);
  $("#featureCta").addEventListener("click", () => openDetail("p05"));
  $("#navSearch").addEventListener("click", () => { goToSpread(3); toast("browse the shelf — live search coming soon"); });
  $("#navAccount").addEventListener("click", () => toast("account — demo, no sign-in yet"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!overlay.hidden) closeDetail(); else if (!boardPanel.hidden) closeBoard(); return; }
    if (mode === "flip" && overlay.hidden && boardPanel.hidden && !animating) {
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
      if (!overlay.hidden || !boardPanel.hidden) return;   // let modals scroll
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
