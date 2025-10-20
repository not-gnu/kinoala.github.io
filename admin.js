// --- Minimal Admin Publisher for GitHub Pages --- //
// Security: token is read at runtime and stored in sessionStorage (not persisted).
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const statusEl = $("#status");

const gh = {
  async request(path, opts = {}) {
    const token = sessionStorage.getItem("gh_token");
    if (!token) throw new Error("Missing GitHub token");
    const base = "https://api.github.com";
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json`,
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub ${res.status}: ${text}`);
    }
    return res.json();
  },
  async getContents(owner, repo, path, ref) {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this.request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${q}`);
  },
  async createOrUpdateFile(owner, repo, path, contentBase64, message, branch, sha = undefined) {
    return this.request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: contentBase64, branch, sha })
    });
  },
  async getRef(owner, repo, branch) {
    return this.request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  }
};

// --- UI state: persist form values for convenience
["owner","repo","branch","title","author","category"].forEach(id => {
  const el = $("#" + id);
  el.value = sessionStorage.getItem("adm_"+id) || el.value || "";
  el.addEventListener("input", () => sessionStorage.setItem("adm_"+id, el.value));
});

$("#token").addEventListener("change", () => {
  sessionStorage.setItem("gh_token", $("#token").value.trim());
  $("#token").value = "";
  toast("Token stored for this session.");
});

// Set today as default date
const today = new Date().toISOString().slice(0,10);
$("#date").value = sessionStorage.getItem("adm_date") || today;
$("#date").addEventListener("input", () => sessionStorage.setItem("adm_date", $("#date").value));

// --- Simple editor commands
$("#editor-toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const cmd = btn.dataset.cmd;
  if (cmd === "h2" || cmd === "h3" || cmd === "p") wrapBlock(cmd);
  if (cmd === "b") document.execCommand("bold");
  if (cmd === "i") document.execCommand("italic");
});

function wrapBlock(tag) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const el = document.createElement(tag);
  try { range.surroundContents(el); }
  catch {
    // Fallback: insert as block
    el.textContent = sel.toString();
    range.deleteContents();
    range.insertNode(el);
  }
}

// --- Plain text → HTML formatter (headings, paragraphs)
$("#paste-plain").addEventListener("click", async () => {
  const txt = await navigator.clipboard.readText().catch(()=> "");
  if (!txt) { toast("Clipboard empty or permission denied."); return; }
  $("#editor").innerHTML = plainTextToHTML(txt);
  toast("Plain text formatted.");
});

function plainTextToHTML(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].trimRight();
    if (!line.trim()) { out.push(""); continue; }
    if (/^#\s+/.test(line)) out.push(`<h2>${escapeHTML(line.replace(/^#\s+/, ""))}</h2>`);
    else if (/^##\s+/.test(line)) out.push(`<h3>${escapeHTML(line.replace(/^##\s+/, ""))}</h3>`);
    else if (/^---+$/.test(line)) out.push(`<hr/>`);
    else out.push(`<p>${escapeHTML(line)}</p>`);
  }
  // collapse multiple blanks into one
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

// --- Build HTML file from template
function buildPostHTML({ title, author, dateStr, category, contentHTML }) {
  const tpl = $("#post-template").textContent;
  return tpl
    .replace(/{{TITLE}}/g, title)
    .replace(/{{AUTHOR}}/g, author)
    .replace(/{{DATE}}/g, dateStr)
    .replace(/{{CATEGORY}}/g, category || "—")
    .replace("{{CONTENT}}", contentHTML);
}

// --- Find next post number by listing posts/ directory
async function getNextPostNumber(owner, repo, branch) {
  try {
    const items = await gh.getContents(owner, repo, "posts", branch);
    const nums = items
      .filter(x => x.type === "file" && /^post(\d+)\.html$/i.test(x.name))
      .map(x => parseInt(x.name.match(/^post(\d+)\.html$/i)[1], 10));
    const max = nums.length ? Math.max(...nums) : 0;
    return max + 1;
  } catch (e) {
    if (String(e).includes("404")) return 1; // no posts dir yet
    throw e;
  }
}

// --- Upload a single file (image or html)
async function uploadFile(owner, repo, branch, path, fileOrString, message) {
  let b64;
  if (fileOrString instanceof File) {
    const buf = await fileOrString.arrayBuffer();
    b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  } else {
    b64 = btoa(unescape(encodeURIComponent(fileOrString)));
  }
  const res = await gh.createOrUpdateFile(owner, repo, path, b64, message, branch);
  return res.content && res.content.sha;
}

// --- Update index.html by inserting a new card before the grid end
async function patchIndex(owner, repo, branch, cardHTML) {
  const file = await gh.getContents(owner, repo, "index.html", branch);
  const sha = file.sha;
  const content = atob(file.content.replace(/\n/g,""));
  // naive insert: look for closing grid container or </main>
  let updated = content;
  const marker = /<\/section>\s*<\/main>/i;
  if (marker.test(updated)) {
    updated = updated.replace(marker, `${cardHTML}\n</section>\n</main>`);
  } else {
    // fallback: just before </body>
    updated = updated.replace(/<\/body>/i, `${cardHTML}\n</body>`);
  }
  const b64 = btoa(unescape(encodeURIComponent(updated)));
  await gh.createOrUpdateFile(owner, repo, "index.html", b64, "Add new post card", branch, sha);
}

// --- Build a homepage card (adjust class names to your current grid markup)
function buildCardHTML({ href, title, category, thumbPath }) {
  // Keep it small & safe: HTML without scripts.
  return `
  <a class="card" href="${href}" data-category="${category || ""}">
    <figure class="card-figure">
      <img src="${thumbPath}" alt="${escapeHTML(title)}" loading="lazy" width="600" height="360">
    </figure>
    <div class="card-body">
      <h3 class="card-title">${escapeHTML(title)}</h3>
      <p class="card-meta">${escapeHTML(category || "")}</p>
    </div>
  </a>`;
}

// --- Insert uploaded inline images into editor content as <figure>
function insertInlineImagesToEditor(postNum, files) {
  if (!files || !files.length) return;
  const editor = $("#editor");
  for (const f of files) {
    const nm = sanitizeFileName(f.name);
    const rel = `../media/post${postNum}/${nm}`;
    const fig = document.createElement("figure");
    fig.innerHTML = `
      <img src="${rel}" alt="${escapeHTML(stripExt(nm))}" loading="lazy" width="1280" height="853">
      <figcaption></figcaption>`;
    editor.appendChild(fig);
  }
}

function stripExt(s){ return s.replace(/\.[^.]+$/, ""); }
function sanitizeFileName(s){ return s.trim().replace(/\s+/g,"-").toLowerCase(); }

// --- Buttons
$("#preview-btn").addEventListener("click", () => {
  const html = collectAndBuildHTML(false);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
});

$("#publish-btn").addEventListener("click", async () => {
  try {
    lockUI(true);
    toast("Publishing…");

    const owner = $("#owner").value.trim();
    const repo = $("#repo").value.trim();
    const branch = $("#branch").value.trim() || "main";
    if (!sessionStorage.getItem("gh_token")) throw new Error("Please enter your GitHub token.");

    const title = $("#title").value.trim() || "untitled";
    const author = $("#author").value.trim() || "—";
    const dateStr = $("#date").value || new Date().toISOString().slice(0,10);
    const category = $("#category").value.trim();

    const nextNum = await getNextPostNumber(owner, repo, branch);
    const postPath = `posts/post${nextNum}.html`;
    const mediaDir = `media/post${nextNum}/`;

    // 1) Upload thumbnail
    const thumb = $("#thumb").files[0];
    let thumbPath = "";
    if (thumb) {
      const tn = sanitizeFileName(thumb.name);
      thumbPath = `${mediaDir}${tn}`;
      await uploadFile(owner, repo, branch, thumbPath, thumb, `Add thumbnail for post${nextNum}`);
    }

    // 2) Upload inline images
    const imgs = Array.from($("#images").files || []);
    for (const f of imgs) {
      const nm = sanitizeFileName(f.name);
      await uploadFile(owner, repo, branch, `${mediaDir}${nm}`, f, `Add image ${nm} for post${nextNum}`);
    }

    // 3) Insert inline images into editor content after upload (so paths are correct)
    insertInlineImagesToEditor(nextNum, imgs);

    // 4) Build post HTML (from editor content)
    const postHTML = collectAndBuildHTML(true);

    // 5) Upload the post file
    await uploadFile(owner, repo, branch, postPath, postHTML, `Create post${nextNum}.html`);

    // 6) Patch index.html with a new card
    if (thumbPath) {
      const card = buildCardHTML({
        href: postPath,
        title,
        category,
        thumbPath
      });
      await patchIndex(owner, repo, branch, card);
    }

    toast(`✅ Published posts/post${nextNum}.html`, "ok");
  } catch (e) {
    console.error(e);
    toast(`❌ ${e.message}`, "danger");
  } finally {
    lockUI(false);
  }
});

function collectAndBuildHTML(useEditorContent = true) {
  const title = $("#title").value.trim() || "untitled";
  const author = $("#author").value.trim() || "—";
  const dateStr = $("#date").value || new Date().toISOString().slice(0,10);
  const category = $("#category").value.trim();

  const contentHTML = useEditorContent ? $("#editor").innerHTML : plainTextToHTML($("#editor").innerText);
  return buildPostHTML({ title, author, dateStr, category, contentHTML });
}

function toast(msg, cls = "") {
  statusEl.textContent = msg;
  statusEl.className = (cls ? cls + " " : "") + "muted";
}

function lockUI(lock) {
  $$("#admin input, #publish-btn, #preview-btn, #paste-plain, #editor [contenteditable]").forEach(el => {
    if (el) el.disabled = lock;
  });
}
