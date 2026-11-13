/* Henderson Innovations — intake chatbot */
(function(){
  const OWNER_EMAIL = "Admin@hendersoninnovations.com";
  const STORAGE_KEY = "hi_chat_state_v1";

  const questions = [
    { key:"businessName", q:"Hi there! 👋 I'm the Henderson Innovations assistant. Let's start simple — what's your business name?" },
    { key:"businessType", q:"Nice to meet you! What kind of business is it? (e.g., bakery, salon, landscaping, consulting, shop…)" },
    { key:"about", q:"Tell me a little about what you do and who you serve." },
    { key:"currentPresence", q:"Do you currently have a website or social media presence? If yes, share any links." },
    { key:"goals", q:"What's the main goal for your new online presence? (more customers, online booking, selling products, credibility…)" },
    { key:"budget", q:"What's your rough budget range? (e.g., under $500, $500–$1,500, $1,500+)" },
    { key:"timeline", q:"When would you like to launch?" },
    { key:"contactName", q:"What's your name?" },
    { key:"contactEmail", q:"Best email to reach you?" },
    { key:"contactPhone", q:"Phone number? (type 'skip' if you'd rather not share)" },
  ];

  const messagesEl = document.getElementById("chatMessages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const resetBtn = document.getElementById("chatReset");

  let state = { step:0, answers:{}, done:false };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
  function load(){ try{ const r=localStorage.getItem(STORAGE_KEY); if(r){ state=JSON.parse(r); } }catch(e){} }

  function scrollBottom(){ messagesEl.scrollTop = messagesEl.scrollHeight; }

  function addMsg(text, who, isHtml){
    const div = document.createElement("div");
    div.className = "msg " + who;
    if(isHtml) div.innerHTML = text; else div.textContent = text;
    messagesEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function showTyping(){
    const div = document.createElement("div");
    div.className = "msg typing";
    div.textContent = "Typing…";
    messagesEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function botSay(text, delay=650){
    return new Promise(resolve=>{
      const t = showTyping();
      setTimeout(()=>{ t.remove(); addMsg(text,"bot"); resolve(); }, delay);
    });
  }

  function buildSummary(){
    const a = state.answers;
    const lines = [
      "New project inquiry — Henderson Innovations",
      "=========================================",
      "",
      "Business name: " + (a.businessName||"—"),
      "Business type: " + (a.businessType||"—"),
      "About / audience: " + (a.about||"—"),
      "Current presence: " + (a.currentPresence||"—"),
      "Goals: " + (a.goals||"—"),
      "Budget: " + (a.budget||"—"),
      "Timeline: " + (a.timeline||"—"),
      "",
      "Contact name: " + (a.contactName||"—"),
      "Contact email: " + (a.contactEmail||"—"),
      "Contact phone: " + (a.contactPhone && a.contactPhone.toLowerCase()!=="skip" ? a.contactPhone : "not provided"),
      "",
      "— Sent from hendersoninnovations.com intake chat",
    ];
    return lines.join("\n");
  }

  function mailtoUrl(summary){
    const subject = encodeURIComponent("New project inquiry: " + (state.answers.businessName||"small business"));
    const body = encodeURIComponent(summary);
    return "mailto:" + OWNER_EMAIL + "?subject=" + subject + "&body=" + body;
  }

  async function finish(){
    state.done = true;
    save();
    input.disabled = true;
    input.placeholder = "Thanks! Your info is ready to send.";
    const summary = buildSummary();
    await botSay("You're all set! Here's a summary of what you shared:");
    const s = document.createElement("div");
    s.className = "msg bot";
    const pre = document.createElement("div");
    pre.className = "summary";
    pre.textContent = summary;
    const actions = document.createElement("div");
    actions.className = "summary-actions";
    const mailBtn = document.createElement("a");
    mailBtn.className = "btn btn-primary";
    mailBtn.href = mailtoUrl(summary);
    mailBtn.textContent = "Email this to us";
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-ghost";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy summary";
    copyBtn.addEventListener("click", async ()=>{
      try{ await navigator.clipboard.writeText(summary); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy summary",1500); }
      catch(e){ copyBtn.textContent="Copy failed"; }
    });
    actions.appendChild(mailBtn);
    actions.appendChild(copyBtn);
    s.appendChild(pre);
    s.appendChild(actions);
    messagesEl.appendChild(s);
    scrollBottom();
    await botSay("Click \"Email this to us\" to send it to our inbox (your email app will open with everything pre-filled). We'll reply within a day. Thank you! 🌿", 700);
  }

  async function askCurrent(){
    if(state.step >= questions.length){ if(!state.done) await finish(); return; }
    const q = questions[state.step];
    await botSay(q.q);
  }

  async function handleAnswer(raw){
    const val = raw.trim();
    if(!val) return;
    addMsg(val, "user");
    const q = questions[state.step];
    state.answers[q.key] = val;
    state.step += 1;
    save();
    if(state.step >= questions.length){
      await finish();
    } else {
      // small delay then next question
      setTimeout(()=>{ askCurrent(); }, 250);
    }
  }

  function reset(){
    input.disabled = false;
    input.placeholder = "Type your answer…";
    state = { step:0, answers:{}, done:false };
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    messagesEl.innerHTML = "";
    askCurrent();
  }

  // init
  load();
  form.addEventListener("submit", e=>{
    e.preventDefault();
    const v = input.value;
    input.value = "";
    if(state.done){
      // allow restart via typing? just ignore
      return;
    }
    handleAnswer(v);
  });
  resetBtn.addEventListener("click", reset);

  // year
  const y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();

  // If resuming mid-conversation, replay? Simpler: if state has progress, restart fresh to avoid confusion.
  if(state.step > 0 && !state.done){
    // resume by re-asking current question without replaying
    // show a small note
    addMsg("Welcome back! Let's continue where we left off.", "bot");
    setTimeout(()=>askCurrent(), 400);
  } else if(state.done){
    input.disabled = true;
    input.placeholder = "Thanks! Your info is ready to send.";
    addMsg("You've already completed the intake. Here's your summary:", "bot");
    const pre = document.createElement("div");
    pre.className = "summary";
    pre.textContent = buildSummary();
    messagesEl.appendChild(pre);
    const actions = document.createElement("div");
    actions.className = "summary-actions";
    const mailBtn = document.createElement("a");
    mailBtn.className = "btn btn-primary";
    mailBtn.href = mailtoUrl(buildSummary());
    mailBtn.textContent = "Email this to us";
    const restart = document.createElement("button");
    restart.className = "btn btn-ghost";
    restart.type="button";
    restart.textContent="Start over";
    restart.addEventListener("click", reset);
    actions.appendChild(mailBtn);
    actions.appendChild(restart);
    messagesEl.appendChild(actions);
    scrollBottom();
  } else {
    askCurrent();
  }
})();
