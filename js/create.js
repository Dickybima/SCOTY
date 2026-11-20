(function () {
  const { CFG, W, Store, logoSVG, esc, short } = window.SCOTY;
  const $ = (id) => document.getElementById(id);
  const state = { chain: CFG.chains[0], image: null, seed: "" };

  const IDEAS = [
    "a cat coin that trades memes from the couch",
    "a frog who only buys the dip on Mondays",
    "a sleepy panda that stakes while it naps",
    "an astronaut dog planting flags on every chart",
    "a coffee token for devs shipping at 3am",
    "a pixel dragon guarding the liquidity pool",
    "a grandma who discovered crypto and won't stop posting",
    "a tiny robot that cleans up rug pulls",
    "a pizza slice orbiting the moon",
    "a duck that quacks every time the price pumps",
  ];

  // ── Local "AI" package generator (rule-based) ─────────────
  const STOP = new Set("a an the that who which with from for of on in to and or only every is are be at by it its my your our this coin token".split(" "));
  const SUFFIX = ["", " Club", " Protocol", " Inu", " Labs", " World", " DAO", " Finance"];
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

  function generate(idea) {
    const words = idea.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
    const r = Math.random();
    const core = words.slice(0, 2);
    let name = core.map(cap).join(" ") || "Scoty";
    name = (name + SUFFIX[Math.floor(r * SUFFIX.length)]).slice(0, 32);
    let symbol = core.length > 1 ? (core[0].slice(0, 3) + core[1].slice(0, 2)) : (core[0] || "SCOTY").slice(0, 5);
    symbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") || "SCOTY";
    const lines = [
      `${name} is ${idea.replace(/^(a|an|the)\s+/i, "the ")}. Born on Robinhood Chain, owned by the community.`,
      `No team allocation, no presale — just ${name} and the people who believe in it.`,
    ];
    return { name, symbol, desc: lines.join(" ") };
  }

  // ── Step 01 ───────────────────────────────────────────────
  const idea = $("idea");
  idea.addEventListener("input", () => ($("generate").disabled = idea.value.trim().length < 3));
  idea.addEventListener("keydown", (e) => { if (e.key === "Enter" && !$("generate").disabled) $("generate").click(); });
  $("roulette").onclick = () => {
    idea.value = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    $("generate").disabled = false;
    $("generate").click();
  };
  $("generate").onclick = () => {
    const btn = $("generate");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Generating…';
    setTimeout(() => {
      const p = generate(idea.value.trim());
      $("name").value = p.name;
      $("symbol").value = p.symbol;
      $("desc").value = p.desc;
      state.image = null;
      state.seed = p.symbol + p.name;
      ["p2", "p3", "p4"].forEach((id) => $(id).classList.remove("locked"));
      renderLogo(); renderSummary();
      btn.disabled = false;
      btn.innerHTML = "✦ Regenerate";
      $("p2").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 650);
  };

  // ── Step 02 ───────────────────────────────────────────────
  function renderLogo() {
    $("logo").innerHTML = state.image ? `<img src="${state.image}" alt="logo">` : logoSVG(state.seed, $("symbol").value);
  }
  $("symbol").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); renderLogo(); renderSummary(); });
  ["name", "desc"].forEach((id) => $(id).addEventListener("input", renderSummary));
  $("reroll").onclick = () => { state.image = null; state.seed = Math.random().toString(36); renderLogo(); };
  $("upload").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) { alert("Please choose an image under 1 MB."); return; }
    const rd = new FileReader();
    rd.onload = () => { state.image = rd.result; renderLogo(); };
    rd.readAsDataURL(f);
  };

  // ── Step 03 ───────────────────────────────────────────────
  function renderChains() {
    $("chains").innerHTML = CFG.chains.map((c) =>
      `<button type="button" class="chain ${c.key === state.chain.key ? "on" : ""}" data-k="${c.key}">
        <b>${esc(c.name)}</b><small>chain ${c.chainId} · ${c.factory ? "live" : "demo"}</small></button>`).join("");
    $("chains").querySelectorAll(".chain").forEach((b) => (b.onclick = () => {
      state.chain = CFG.chains.find((c) => c.key === b.dataset.k);
      renderChains(); renderSummary(); renderDemo();
    }));
  }

  // ── Step 04 ───────────────────────────────────────────────
  function renderSummary() {
    $("summary").innerHTML = `
      <div><span>Token  </span> ${esc($("name").value || "—")} ($${esc($("symbol").value || "—")})</div>
      <div><span>Network</span> ${esc(state.chain.name)}</div>
      <div><span>Creator</span> ${W.address ? short(W.address) : "connect wallet"}</div>`;
    $("deploy").textContent = W.address ? "🚀 Launch token" : "Connect wallet to launch";
  }
  function renderDemo() {
    $("demoNote").innerHTML = state.chain.factory ? "" :
      `<span class="demo">DEMO MODE — no launch contract configured for ${esc(state.chain.name)}; launches are simulated locally</span>`;
  }
  W.onChange(renderSummary);

  const setStatus = (msg, cls = "") => { const s = $("status"); s.className = "status " + cls; s.innerHTML = msg; };

  $("deploy").onclick = async () => {
    const name = $("name").value.trim(), symbol = $("symbol").value.trim(), desc = $("desc").value.trim();
    if (!name || !symbol) return setStatus("Name and ticker are required.", "err");
    if (!W.address && !(await W.connect().catch(() => false))) return;
    const btn = $("deploy");
    btn.disabled = true;
    const chain = state.chain;
    const image = state.image || "data:image/svg+xml;utf8," + encodeURIComponent(logoSVG(state.seed, symbol));
    const meta = { name, symbol, description: desc, image, twitter: $("x").value.trim(), website: $("web").value.trim() };

    try {
      let address, tx = null;
      if (chain.factory && window.ethers) {
        if (W.chainId !== chain.chainId) { setStatus("Switching network…"); await W.switchChain(chain); }
        setStatus("Confirm the transaction in your wallet…");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const factory = new ethers.Contract(chain.factory, CFG.factoryAbi, signer);
        const uri = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(meta))));
        const sent = await factory.createToken(name, symbol, uri, { value: ethers.parseEther(CFG.launchFee || "0") });
        tx = sent.hash;
        setStatus(`Waiting for confirmation… <a href="${chain.explorer}/tx/${tx}" target="_blank" rel="noopener">view tx</a>`);
        const rc = await sent.wait();
        for (const log of rc.logs) {
          try { const ev = factory.interface.parseLog(log); if (ev && ev.name === "TokenCreated") { address = ev.args.token; break; } } catch (_) {}
        }
      } else {
        setStatus("Simulating launch (demo mode)…");
        await new Promise((r) => setTimeout(r, 1200));
        address = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
      }
      Store.add({ ...meta, image: state.image, address, tx, chain: chain.key, creator: W.address, createdAt: Date.now(), mcap: 4200, change: 0, progress: 1, mine: true, demo: !chain.factory });
      setStatus(`✅ $${esc(symbol)} launched${chain.factory ? "" : " (demo)"} at <span class="addr">${esc(address || "pending")}</span>. <a href="index.html?new=1"><b>See it on Explore →</b></a>`, "ok");
    } catch (e) {
      console.error(e);
      setStatus("Launch failed: " + esc(e.shortMessage || e.message || e), "err");
    } finally {
      btn.disabled = false;
    }
  };

  renderChains(); renderDemo(); renderSummary();
})();
