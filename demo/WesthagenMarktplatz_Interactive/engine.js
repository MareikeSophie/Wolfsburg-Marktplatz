(function(){
  "use strict";

  const STAGE_ISO = [
    "00 ISO.png","01 ISO.png","02 ISO.png","03 ISO.png","04 ISO.png","05 ISO.png",
    "06 ISO.png","07 ISO.png","08 ISO.png","09 ISO.png","10 ISO.png","11 ISO.png",
    "12 FINAL ISO.png"
  ];
  const STAGE_MATERIALS = [
    "0 Materials.png","1 Materials.png","2 Materials.png","3 Materials.png","4 Materials.png",
    "5 Materials.png","6 Materials.png","7 Materials.png","8 Materials.png","9 Materials.png",
    "10 Materials.png","11 Materials.png","FINAL ISO Materials.png"
  ];
  const RENDERINGS_DIR = "../../assets/Renderings/";
  const MATERIALS_DIR = "../../assets/Materials/";
  const STORAGE_KEY = "westhagenMarktplatzInteractive.v1";

  const chatbody = document.getElementById("chatbody");
  const stageIsoEl = document.getElementById("stageIso");
  const stageMaterialsEl = document.getElementById("stageMaterials");
  const stageCaptionEl = document.getElementById("stageCaption");
  const restartBtn = document.getElementById("restartBtn");

  // iPad Safari can briefly report viewport metrics from the wrong
  // orientation on the very first paint after a fresh load, self-correcting
  // only once something forces a reflow (a scroll, a resize, an image
  // finishing loading...). The CSS (min(76vh,660px) on .phone-frame) is the
  // primary sizing and is fine on its own once that settles — this just
  // nudges the correction along proactively instead of waiting on the user
  // to scroll into it, by re-applying an explicit inline height a few times
  // shortly after load using the true visible size from visualViewport.
  const phoneFrameEl = document.querySelector(".phone-frame");
  function correctPhoneFrameHeight(){
    if(!phoneFrameEl || !window.visualViewport) return;
    // mirrors the CSS min(76vh,660px) rule, just computed from the visible
    // viewport directly instead of trusting the browser's own vh timing
    phoneFrameEl.style.height = Math.min(window.visualViewport.height * 0.76, 660) + "px";
  }
  [0, 150, 500, 1200].forEach(delay => setTimeout(correctPhoneFrameHeight, delay));
  window.addEventListener("resize", correctPhoneFrameHeight);
  window.addEventListener("orientationchange", () => setTimeout(correctPhoneFrameHeight, 200));
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", correctPhoneFrameHeight);
  }

  let cursor = START_NODE;
  let stageIndex = 0;
  let finished = false;
  let awaitingChoice = false;
  let scrollScheduled = false;

  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function persist(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastId: cursor,
        finished,
        awaitingChoice,
        pollAnswers: state ? state.pollAnswers : {},
        choiceAnswers: state ? state.choiceAnswers : {}
      }));
    }catch(e){ /* storage unavailable, ignore */ }
  }

  function setStageImages(idx){
    stageIsoEl.classList.remove("shown");
    stageMaterialsEl.classList.remove("shown");
    stageIsoEl.src = RENDERINGS_DIR + STAGE_ISO[idx];
    stageMaterialsEl.src = MATERIALS_DIR + STAGE_MATERIALS[idx];
    requestAnimationFrame(() => {
      stageIsoEl.classList.add("shown");
      stageMaterialsEl.classList.add("shown");
    });
  }

  function findBaselineVotes(pollId, optionCount){
    const startNode = STORY[pollId];
    let id = startNode.next;
    let found = null;
    let guard = 0;
    while(id && guard < 80){
      const n = STORY[id];
      if(!n || n.type === "poll") break;
      if(Array.isArray(n.pollVotes) && n.pollVotes.length === optionCount){
        found = n.pollVotes;
      }
      id = n.next;
      guard++;
    }
    return found;
  }

  function el(tag, className, html){
    const e = document.createElement(tag);
    if(className) e.className = className;
    if(html !== undefined) e.innerHTML = html;
    return e;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  function reactionsHtml(reactions){
    if(!reactions || !reactions.length) return "";
    const pills = reactions.map(r => `<span class="reaction-pill">${r.emoji} ${r.count}</span>`).join("");
    return `<div class="msg-reactions">${pills}</div>`;
  }

  function appendRow(rowEl, instant){
    rowEl.classList.add(instant ? "instant" : "in");
    chatbody.appendChild(rowEl);
  }

  // ── renderers per node type ──────────────────────────────────────────

  function renderMsg(node, instant){
    const outgoing = !!node.isMe;
    const row = el("div", "row" + (outgoing ? " outgoing" : "") + (node.reactions ? " has-reactions" : ""));
    if(!outgoing){
      const av = el("div", "av", node.initial || "?");
      av.style.background = node.bg || "#888";
      av.style.color = node.fg || "#fff";
      row.appendChild(av);
    }
    const bubble = el("div", "bubble" + (outgoing ? " outgoing" : ""));
    let inner = "";
    if(!outgoing) inner += `<div class="name" style="color:${node.bg || "#333"}">${escapeHtml(node.sender)}</div>`;
    inner += `<div class="text">${escapeHtml(node.text)}<span class="time">${node.time || ""}</span></div>`;
    inner += reactionsHtml(node.reactions);
    bubble.innerHTML = inner;
    row.appendChild(bubble);
    appendRow(row, instant);
  }

  function renderSystem(node, instant){
    const wrap = el("div", "system" + (node.memberJoin ? "" : ""));
    wrap.innerHTML = `<span>${escapeHtml(node.text)}</span>`;
    appendRow(wrap, instant);
  }

  function renderEvent(node, instant){
    const wrap = el("div", "system event");
    wrap.innerHTML = `<span>${escapeHtml(node.text)}</span>`;
    appendRow(wrap, instant);
  }

  function renderDate(node, instant){
    const wrap = el("div", "date-sep");
    wrap.innerHTML = `<span>${escapeHtml(node.text)}</span>`;
    appendRow(wrap, instant);
  }

  function renderImage(node, instant){
    stageIndex = Math.min(stageIndex + 1, STAGE_ISO.length - 1);
    setStageImages(stageIndex);
    if(stageCaptionEl) stageCaptionEl.textContent = node.caption || "";

    const row = el("div", "row");
    const av = el("div", "av", node.initial || "?");
    av.style.background = node.bg || "#888";
    av.style.color = node.fg || "#fff";
    row.appendChild(av);
    const bubble = el("div", "img-msg-bubble");
    bubble.innerHTML = `
      <div class="name" style="color:${node.bg || "#333"}">${escapeHtml(node.sender)}</div>
      <div class="img-wrap"><img src="${RENDERINGS_DIR}${STAGE_ISO[stageIndex]}" alt="Design stage"></div>
      ${node.caption ? `<div class="caption">${escapeHtml(node.caption)}</div>` : ""}
    `;
    row.appendChild(bubble);
    appendRow(row, instant);
  }

  function renderFile(node, instant){
    const row = el("div", "row");
    const av = el("div", "av", node.initial || "?");
    av.style.background = node.bg || "#888";
    av.style.color = node.fg || "#fff";
    row.appendChild(av);
    const bubble = el("div", "file-msg-bubble");
    bubble.innerHTML = `
      <div class="name" style="color:${node.bg || "#333"}">${escapeHtml(node.sender)}</div>
      <div class="file-card">
        <div class="file-icon">&#128196;</div>
        <div class="file-meta">
          <div class="file-name">${escapeHtml(node.fileName || "document.pdf")}</div>
          <div class="file-sub">${escapeHtml(node.fileSub || "")}</div>
        </div>
      </div>
    `;
    row.appendChild(bubble);
    appendRow(row, instant);
  }

  function renderPoll(node, instant){
    const row = el("div", "row");
    const av = el("div", "av", node.initial || "?");
    av.style.background = node.bg || "#888";
    av.style.color = node.fg || "#fff";
    row.appendChild(av);

    const bubble = el("div", "poll-bubble");
    bubble.innerHTML = `<div class="name" style="color:${node.bg || "#333"}">${escapeHtml(node.sender)}</div>
      <div class="poll-q">${escapeHtml(node.question)}</div>`;

    const optsWrap = el("div", "poll-opts");
    const optionEls = node.options.map((label, i) => {
      const opt = el("div", "poll-opt" + (node.multi ? " multi" : ""));
      opt.dataset.index = String(i);
      opt.innerHTML = `
        <div class="poll-fill"></div>
        <div class="poll-opt-row">
          <span class="dot"></span>
          <span class="poll-label">${escapeHtml(label)}</span>
          <span class="poll-pct"></span>
        </div>`;
      optsWrap.appendChild(opt);
      return opt;
    });
    bubble.appendChild(optsWrap);

    const meta = el("div", "poll-meta", `<span class="poll-total-votes"></span>`);
    bubble.appendChild(meta);

    let submitBtn = null;
    if(node.multi){
      submitBtn = el("button", "poll-submit", "Vote");
      submitBtn.type = "button";
      bubble.appendChild(submitBtn);
    }

    const savedAnswer = state && state.pollAnswers ? state.pollAnswers[node.id] : null;
    const baseline = findBaselineVotes(node.id, node.options.length) || node.options.map(() => 6);

    function lockIn(selectedIndices){
      const totals = baseline.slice();
      selectedIndices.forEach(i => { totals[i] = (totals[i] || 0) + 1; });
      const sum = totals.reduce((a,b) => a+b, 0) || 1;
      optionEls.forEach((opt, i) => {
        opt.classList.add("voted", "disabled");
        if(selectedIndices.includes(i)) opt.querySelector(".dot").classList.add("selected");
        const pct = Math.round((totals[i] / sum) * 100);
        const fill = opt.querySelector(".poll-fill");
        const pctEl = opt.querySelector(".poll-pct");
        pctEl.textContent = pct + "%";
        if(instant){
          fill.style.transition = "none";
          fill.style.width = pct + "%";
        }else{
          requestAnimationFrame(() => { fill.style.width = pct + "%"; });
        }
      });
      meta.querySelector(".poll-total-votes").textContent =
        sum.toLocaleString("en-US") + " votes";
      if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = "Voted"; }
      if(!state) state = { pollAnswers:{}, choiceAnswers:{} };
      if(!state.pollAnswers) state.pollAnswers = {};
      state.pollAnswers[node.id] = selectedIndices;
      persist();
    }

    if(savedAnswer){
      lockIn(savedAnswer);
    }else if(node.multi){
      const selected = new Set();
      optionEls.forEach((opt, i) => {
        opt.addEventListener("click", () => {
          if(opt.classList.contains("disabled")) return;
          if(selected.has(i)){ selected.delete(i); opt.querySelector(".dot").classList.remove("selected"); }
          else{ selected.add(i); opt.querySelector(".dot").classList.add("selected"); }
        });
      });
      submitBtn.addEventListener("click", () => {
        if(selected.size === 0) return;
        lockIn(Array.from(selected));
      });
    }else{
      optionEls.forEach((opt, i) => {
        opt.addEventListener("click", () => lockIn([i]));
      });
    }

    row.appendChild(bubble);
    appendRow(row, instant);
  }

  function renderChoice(node, instant){
    const block = el("div", "choice-block");
    let html = "";
    if(node.prompt) html += `<div class="choice-prompt">${escapeHtml(node.prompt)}</div>`;
    html += `<div class="choice-buttons"></div>`;
    block.innerHTML = html;
    const btnWrap = block.querySelector(".choice-buttons");
    const buttons = node.options.map((opt, i) => {
      const btn = el("button", "choice-btn", escapeHtml(opt.label));
      btn.type = "button";
      btnWrap.appendChild(btn);
      return btn;
    });

    const savedIndex = state && state.choiceAnswers ? state.choiceAnswers[node.id] : undefined;

    function choose(i){
      buttons.forEach((b, bi) => {
        b.disabled = true;
        if(bi === i) b.classList.add("chosen");
      });
      if(!state) state = { pollAnswers:{}, choiceAnswers:{} };
      if(!state.choiceAnswers) state.choiceAnswers = {};
      state.choiceAnswers[node.id] = i;
      awaitingChoice = false;
      cursor = node.options[i].next;
      if(!cursor) finished = true;
      persist();
      if(!instant) fillViewport();
    }

    if(savedIndex !== undefined){
      choose(savedIndex);
    }else{
      buttons.forEach((btn, i) => btn.addEventListener("click", () => choose(i)));
    }

    appendRow(block, instant);
    return savedIndex !== undefined; // true = resolved synchronously (replay), false = waiting for a click
  }

  function renderEnding(node, instant){
    const block = el("div", "ending-block");
    block.innerHTML = `
      <div class="ending-title">${escapeHtml(node.title || "The story ends here")}</div>
      <div class="ending-text">${escapeHtml(node.text || "")}</div>
    `;
    appendRow(block, instant);
  }

  // note: "choice" is deliberately not in this map — it needs its resolved/paused
  // return value, so step() calls renderChoice directly instead of going through here.
  const RENDERERS = {
    msg: renderMsg,
    system: renderSystem,
    event: renderEvent,
    date: renderDate,
    image: renderImage,
    file: renderFile,
    poll: renderPoll,
    ending: renderEnding
  };

  function renderNode(node, instant){
    const fn = RENDERERS[node.type];
    if(fn) fn(node, instant);
    // transition / fastForward carry no visible content in the scroll-driven version
  }

  // ── traversal ─────────────────────────────────────────────────────────

  function step(instant){
    if(finished || awaitingChoice) return;
    const node = STORY[cursor];
    if(!node){ finished = true; return; }

    if(node.type === "choice"){
      const resolved = renderChoice(node, instant);
      if(!resolved){
        awaitingChoice = true;
        persist();
      }
      // if resolved, choose() already advanced cursor and persisted
      return;
    }

    renderNode(node, instant);
    cursor = node.next;
    if(!cursor) finished = true;
    persist();
  }

  function fillViewport(){
    let guard = 0;
    while(!finished && !awaitingChoice && guard < 300){
      const remaining = chatbody.scrollHeight - chatbody.scrollTop - chatbody.clientHeight;
      if(remaining > 140) break;
      step(false);
      guard++;
    }
  }

  function replayInstant(){
    if(!state) return;
    if(state.finished){
      // lastId is null once the story is fully read — replay everything, instantly, to the end
      let guard = 0;
      while(cursor && !finished && !awaitingChoice && guard < 5000){
        step(true);
        guard++;
      }
      return;
    }
    if(!state.lastId) return; // no progress was ever persisted
    let reachedLast = false;
    let guard = 0;
    while(cursor && !finished && !awaitingChoice && !reachedLast && guard < 5000){
      if(cursor === state.lastId) reachedLast = true;
      step(true);
      guard++;
    }
  }

  function onScroll(){
    if(scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => { scrollScheduled = false; fillViewport(); });
  }

  function restart(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    location.reload();
  }

  function init(){
    setStageImages(0);
    if(state && (state.lastId || state.finished)){
      replayInstant();
    }
    chatbody.addEventListener("scroll", onScroll);
    window.addEventListener("resize", () => fillViewport());
    restartBtn.addEventListener("click", restart);
    fillViewport();
  }

  init();
})();
