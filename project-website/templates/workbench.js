const get = (id) => document.getElementById(id);
const form = get("edit");
const words = JSON.parse(form.dataset.messages);
const title = get("release-title");
const notes = get("notes");
const rules = get("rules");
const count = get("count");
const pending = get("pending");
const advice = get("advisories");
const error = get("field-error");
const manual = get("manual-copy");
const taskText = get("task-text");
const copyStatus = get("copy-status");
let edited = false;
let checked = false;
let revision = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function clearCopy() {
  revision++;
  manual.hidden = true;
  copyStatus.hidden = true;
  taskText.value = "";
}

function clearReport() {
  checked = false;
  rules.replaceChildren();
  advice.hidden = true;
  error.hidden = true;
  title.removeAttribute("aria-invalid");
  notes.removeAttribute("aria-invalid");
}

function showPending(label, message) {
  count.className = "count idle";
  count.textContent = label;
  pending.hidden = false;
  pending.textContent = message;
}

function ruleCopy(check) {
  return words.categories[check.id] || [check.id, check.message, words.pass];
}

function ruleRow(check) {
  const [label, failure, pass] = ruleCopy(check);
  const item = element("li", undefined, check.ok ? "pass" : "fail");
  item.dataset.rule = check.id;
  item.dataset.ok = String(check.ok);
  const symbol = element("span", check.ok ? "✓" : "!", "indicator");
  symbol.setAttribute("aria-hidden", "true");
  const line = element("div", undefined, "rule-line");
  line.append(element("strong", label), element("small", check.ok ? words.pass : words.fail));
  const row = element("div");
  row.append(line, element("p", check.ok ? pass : failure, "rule-msg"));
  item.append(symbol, row);
  return item;
}

function checkDraft(focusInvalid = false) {
  clearReport();
  const invalid = !title.value.trim() ? title : !notes.value.trim() ? notes : null;
  if (invalid) {
    const message = invalid === title ? words.needTitle : words.needNotes;
    invalid.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.hidden = false;
    showPending(words.missing, message);
    if (focusInvalid) invalid.focus();
    return null;
  }
  const result = reviewReleaseNotes({title: title.value, notes: notes.value});
  checked = true;
  pending.hidden = true;
  const failures = result.checks.filter((item) => !item.ok).length;
  count.className = failures ? "count" : "count ok";
  const summary = failures === 1 ? words.findingOne : words.findingsMany;
  count.textContent = failures ? summary.replace("{n}", failures) : words.allGood.replace("{n}", result.checks.length);
  rules.replaceChildren(...result.checks.map(ruleRow));
  if (result.advisories.length) {
    advice.hidden = false;
    advice.querySelector("ul").replaceChildren(...result.advisories.map((item) => element("li", words.advisories[item.id] || item.message)));
  }
  return result;
}

function markEdited() {
  edited = true;
  clearCopy();
  clearReport();
  get("sample-note").textContent = words.writing;
  showPending(words.stale, words.staleMessage);
}

function codexTask(result) {
  const findings = result.checks.filter((check) => !check.ok).map((check) => "- " + ruleCopy(check)[1] + " [" + check.id + "]");
  const heading = (id) => form.querySelector('label[for="' + id + '"]').textContent;
  const blocks = [words.taskIntro, heading(title.id) + "\n" + title.value, heading(notes.id) + "\n" + notes.value,
    words.findings + "\n" + (findings.join("\n") || words.noIssues)];
  if (result.advisories.length) {
    const suggestions = result.advisories.map((item) => "- " + (words.advisories[item.id] || item.message) + " [" + item.id + "]");
    blocks.push(words.suggestions + "\n" + suggestions.join("\n"));
  }
  return blocks.join("\n\n");
}

function manualCopy(text) {
  manual.hidden = false;
  taskText.value = text;
  taskText.focus();
  taskText.select();
  try {
    if (document.execCommand("copy")) {
      manual.hidden = true;
      get("copy").focus();
      return true;
    }
  } catch (_) { /* Leave the selected text available for the native Copy command. */ }
  return false;
}

get("copy").addEventListener("click", async () => {
  clearCopy();
  const currentRevision = revision;
  const result = checkDraft(true);
  if (!result) return;
  const text = codexTask(result);
  let copied = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    if (currentRevision !== revision) return;
    copied = manualCopy(text);
  }
  if (currentRevision !== revision) return;
  copyStatus.hidden = false;
  copyStatus.textContent = copied ? words.copied : words.manualHint;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearCopy();
  checkDraft(true);
});
title.addEventListener("input", markEdited);
notes.addEventListener("input", markEdited);

// Hand an edited draft to the selected translation in this tab. Remove it on arrival.
const site = new URL(document.documentElement.dataset.siteRoot, location.href);
const storageKey = "workflow-language-draft:" + site.pathname;
document.querySelector(".language-picker").addEventListener("click", (event) => {
  const link = event.target.closest("a[hreflang]");
  if (!link || !edited || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const draft = {locale: link.hreflang, title: title.value, notes: notes.value, checked};
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch (_) {
    try {
      // A same-origin history entry can carry the draft when tab storage is blocked.
      history.pushState({workflowLanguageDraft: draft}, "", link.href);
      event.preventDefault();
      location.reload();
    } catch (_) {
      // An opaque local-file origin can deny both mechanisms. Keep its editor open.
      link.target = "_blank";
      link.rel = "noopener";
      copyStatus.hidden = false;
      copyStatus.textContent = words.storageUnavailable;
    }
  }
});

let incoming = history.state?.workflowLanguageDraft;
if (incoming) history.replaceState(null, "");
try {
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    sessionStorage.removeItem(storageKey);
    incoming ??= JSON.parse(stored);
  }
} catch (_) { /* An untouched example also works when tab storage is disabled. */ }
if (incoming?.locale === document.documentElement.lang && typeof incoming.title === "string" && typeof incoming.notes === "string") {
  title.value = incoming.title;
  notes.value = incoming.notes;
  markEdited();
  if (incoming.checked) checkDraft();
}
if (!edited) checkDraft();
get("draft-actions").hidden = false;
count.hidden = false;

const player = get("player");
const video = get("terminal-video");
const mediaError = get("media-error");
document.querySelectorAll("a[data-video]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !player.showModal) return;
    event.preventDefault();
    player.showModal();
    mediaError.hidden = true;
    if (!video.getAttribute("src")) video.setAttribute("src", link.getAttribute("href"));
    video.play().catch(() => { if (video.error) mediaError.hidden = false; });
  });
});
video.addEventListener("error", () => { mediaError.hidden = false; });
get("close").addEventListener("click", () => player.close());
player.addEventListener("close", () => video.pause());
player.addEventListener("click", (event) => {
  if (event.target !== player) return;
  const box = player.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) player.close();
});
