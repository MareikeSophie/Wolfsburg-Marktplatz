(function(){
  "use strict";

  const STAGE_ISO = [
    "00 ISO.png","01 ISO.png","02 ISO.png","03 ISO.png","04 ISO.png","05 ISO.png",
    "06 ISO.png","07 ISO.png","08 ISO.png","09 ISO.png","10 ISO.png","11 ISO.png",
    "12 FINAL ISO.png"
  ];
  const RENDERINGS_DIR = "../../assets/Renderings/";
  const STORAGE_KEY = "westhagenMarktplatzInteractive.v1";

  const chatbody = document.getElementById("chatbody");
  const restartBtn = document.getElementById("restartBtn");
  const cameraVideoEl = document.getElementById("cameraFeed");
  const cameraEnableBtn = document.getElementById("cameraEnableBtn");
  const cameraStatusEl = document.getElementById("cameraStatus");

  // iPad Safari can briefly report viewport metrics from the wrong
  // orientation on the very first paint after a fresh load, and its compact
  // toolbar can change the visible height after load too — raw vh/dvh/svh on
  // body proved unreliable for both. body's height is set directly from
  // visualViewport instead (re-applied a few times shortly after load and on
  // resize/orientationchange); .layout/.camera-col/.phone-frame all inherit
  // a normal percentage-height chain from that in CSS.
  const screenEl = document.querySelector(".screen");
  const CHAT_REFERENCE_WIDTH = 375; // the width the chat's em-based sizing was designed at

  function correctLayoutSizing(){
    if(window.visualViewport){
      document.body.style.height = window.visualViewport.height + "px";
    }
    // --chat-scale drives .screen's font-size (em-based sizing cascades from
    // it). Measured directly via getBoundingClientRect right after setting
    // body's height above, so it reflects the real rendered width immediately —
    // no dependency on the browser's own container-query resolution timing,
    // which is what made cqw-based sizing balloon on first paint here.
    if(screenEl){
      const w = screenEl.getBoundingClientRect().width;
      if(w > 0) document.documentElement.style.setProperty("--chat-scale", w / CHAT_REFERENCE_WIDTH);
    }
  }
  [0, 150, 500, 1200].forEach(delay => setTimeout(correctLayoutSizing, delay));
  window.addEventListener("resize", correctLayoutSizing);
  window.addEventListener("orientationchange", () => setTimeout(correctLayoutSizing, 200));
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", correctLayoutSizing);
  }
  correctLayoutSizing();

  // ── camera placeholder ──────────────────────────────────────────────
  async function enableCamera(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      if(cameraStatusEl){ cameraStatusEl.textContent = "Camera not supported in this browser."; cameraStatusEl.hidden = false; }
      return;
    }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      cameraVideoEl.srcObject = stream;
      cameraEnableBtn.hidden = true;
      if(cameraStatusEl) cameraStatusEl.hidden = true;
    }catch(err){
      if(cameraStatusEl){ cameraStatusEl.textContent = "Camera unavailable (" + err.message + ")"; cameraStatusEl.hidden = false; }
    }
  }
  if(cameraEnableBtn) cameraEnableBtn.addEventListener("click", enableCamera);

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

  // A permanently-present blank spacer at the end of the chat keeps chatbody
  // scrollable even when only one message has been revealed so far — without
  // it, short content has no overflow and the scroll listener never fires.
  // New rows are inserted before it, so it always stays last. Its height is a
  // small fixed CSS value (not tied to chatbody's own height) — making it as
  // tall as the screen meant scrolling through a near-empty screen's worth of
  // nothing before each new message, instead of messages filling up normally.
  const revealSpacer = el("div", "reveal-spacer");
  chatbody.appendChild(revealSpacer);

  // Play the rise-in animation only once a row actually scrolls into view,
  // not the moment it's inserted (it's usually inserted just below the fold,
  // so animating immediately meant the animation had already finished by
  // the time the user scrolled far enough to see it land).
  const animObserver = ("IntersectionObserver" in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if(entry.isIntersecting){
            entry.target.classList.add("in");
            animObserver.unobserve(entry.target);
          }
        });
      }, { root: chatbody, threshold: 0.15 })
    : null;

  function appendRow(rowEl, instant){
    chatbody.insertBefore(rowEl, revealSpacer);
    if(instant || !animObserver){
      rowEl.classList.add(instant ? "instant" : "in");
    }else{
      animObserver.observe(rowEl);
    }
  }

  function renderTypingIndicator(node){
    const outgoing = !!node.isMe;
    const row = el("div", "row" + (outgoing ? " outgoing" : ""));
    if(!outgoing){
      const av = el("div", "av", node.initial || "?");
      av.style.background = node.bg || "#888";
      av.style.color = node.fg || "#fff";
      row.appendChild(av);
    }
    const bubble = el("div", "typing-bubble" + (outgoing ? " outgoing" : ""),
      '<span class="dot"></span><span class="dot"></span><span class="dot"></span>');
    row.appendChild(bubble);
    chatbody.insertBefore(row, revealSpacer);
    row.classList.add("in");
    return row;
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

  let revealing = false;

  // Reveals exactly one node (with a "typing…" beat first if it warrants
  // one), then calls back. Shared by the scripted intro and the
  // scroll-triggered continuation below — they only differ in what decides
  // *when* to call this and what happens once it's done.
  function revealOne(cb){
    if(finished || awaitingChoice){ cb(); return; }
    const node = STORY[cursor];
    if(!node){ finished = true; cb(); return; }

    if(node.type === "choice"){
      step(false); // step() itself decides to pause (awaitingChoice) or resolve
      cb();
      return;
    }

    const showTyping = node.type === "msg" || node.type === "poll" || node.type === "image" || node.type === "file";
    if(!showTyping){
      step(false);
      cb();
      return;
    }

    revealing = true;
    const typingRow = renderTypingIndicator(node);
    const delay = 550 + Math.random() * 350;
    setTimeout(() => {
      typingRow.remove();
      revealing = false;
      step(false);
      cb();
    }, delay);
  }

  // The chat opens with a short scripted intro (join notice + a handful of
  // messages) that plays on its own, then pauses with a "scroll to join"
  // hint instead of continuing to auto-fill the whole screen — scrolling
  // from then on is what drives every further reveal.
  const AUTO_INTRO_COUNT = 7; // through Petra's message (m1-m7: join notice + first 5 messages)
  let introDone = false;
  let introRevealed = 0;
  let introHintEl = null;

  function renderIntroHint(){
    // arrow points up: the gesture that continues the chat is swiping up
    // (finger moves up the screen, content advances) — same direction that
    // already drives every later reveal, just made explicit here
    const hint = el("div", "intro-hint",
      '<div class="intro-hint-text">Swipe up to continue</div><div class="intro-hint-arrow">&#8593;</div>');
    chatbody.insertBefore(hint, revealSpacer);
    hint.classList.add("in");
    return hint;
  }

  function playIntro(){
    if(finished || awaitingChoice || introRevealed >= AUTO_INTRO_COUNT){
      introDone = true;
      if(!finished && !awaitingChoice) introHintEl = renderIntroHint();
      return;
    }
    revealOne(() => {
      introRevealed++;
      playIntro();
    });
  }

  function fillViewport(){
    if(!introDone || revealing || finished || awaitingChoice) return;
    const remaining = chatbody.scrollHeight - chatbody.scrollTop - chatbody.clientHeight;
    if(remaining > 60) return;
    if(introHintEl){ introHintEl.remove(); introHintEl = null; }
    revealOne(() => fillViewport());
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
    if(state && (state.lastId || state.finished)){
      replayInstant();
      introDone = true; // resuming a session skips the scripted intro entirely
    }
    chatbody.addEventListener("scroll", onScroll);
    window.addEventListener("resize", () => fillViewport());
    restartBtn.addEventListener("click", restart);
    if(introDone) fillViewport();
    else playIntro();
  }

  init();
})();
