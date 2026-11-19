// Generated from lib/notes.mjs and templates/workbench.js by scripts/render_site.py.
(() => {
"use strict";
// These checks catch specific public/private boundary failures. They do not
// establish editorial quality or replace review of the actual product changes.
const FORMATS = {
  'tangyixiao-zh-v1': {
    sections: ['更新内容', '安装与升级', '兼容性与已知限制'],
    installation: ['运行要求', '安装方式'],
    evidence: '校验与验证记录', labels: ['校验信息', '验证范围', '源码']
  },
  'tangyixiao-en-v1': {
    sections: ['Changes', 'Installation and upgrade', 'Compatibility and known limitations'],
    installation: ['Requirements', 'Installation'],
    evidence: 'Checksums and validation', labels: ['Checksum', 'Validation', 'Source']
  }
}

function formatChecks(prose, format) {
  const style = Object.hasOwn(FORMATS, format) ? FORMATS[format] : undefined
  if (!style) throw new Error(`Unknown release-note format: ${format}`)
  const blocks = [...prose.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)]
  const main = prose.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '').trim()
  const headings = [...main.matchAll(/^(#{1,6})[ \t]+(.+?)\s*$/gm)]
  const actual = headings.map(match => [match[1].length, match[2].trim()])
  const expected = [[2,style.sections[0]],[2,style.sections[1]],[3,style.installation[0]],[3,style.installation[1]],[2,style.sections[2]]]
  const intro = main.slice(0, headings[0]?.index ?? main.length).trim()
  const sections = [...main.matchAll(/^##[ \t]+(.+?)\s*$/gm)]
  const body = name => {
    const index = sections.findIndex(match => match[1].trim() === name)
    if (index < 0) return ''
    return main.slice(sections[index].index + sections[index][0].length, sections[index+1]?.index ?? main.length).trim()
  }
  const list = text => {
    const lines = text.split('\n').filter(line => line.trim())
    return lines.some(line => /^-\s+\S/.test(line)) && lines.every(line => /^-\s+\S|^[ \t]{2,}\S/.test(line))
  }
  const evidence = blocks[0]?.[1] ?? ''
  const evidenceLast = blocks.length === 1 && !prose.slice(blocks[0].index + blocks[0][0].length).trim()
  const summary = evidence.match(/<summary>[ \t]*([^<]+?)[ \t]*<\/summary>/i)?.[1]?.trim()
  const labels = [...evidence.matchAll(/^\*\*(.+?)\*\*[ \t]*$/gm)]
  const evidenceFilled = labels.length === style.labels.length && labels.every((match,index) => match[1] === style.labels[index] && evidence.slice(match.index + match[0].length, labels[index+1]?.index ?? evidence.length).trim())
  return [
    {id:'format.summary',ok:Boolean(intro) && !/^[#<*-]/.test(intro) && !/\n[ \t]*\n/.test(intro),message:'Start with one prose summary paragraph before the fixed sections.'},
    {id:'format.headings',ok:JSON.stringify(actual) === JSON.stringify(expected),message:`Use the fixed heading sequence: ${expected.map(([level,label]) => `${'#'.repeat(level)} ${label}`).join(' → ')}`},
    {id:'format.lists',ok:list(body(style.sections[0])) && list(body(style.sections[2])),message:'Changes and compatibility/known limitations use nonempty bullet lists.'},
    {id:'format.evidence',ok:evidenceLast && summary === style.evidence && evidenceFilled,message:`Finish with one ${style.evidence} disclosure with nonempty ${style.labels.join(' → ')} entries.`}
  ]
}

function reviewReleaseNotes({ notes, title, format }) {
  if (typeof notes !== 'string' || !notes.trim()) throw new Error('Release notes must be nonempty text')
  if (typeof title !== 'string' || !title.trim()) throw new Error('Provide the public release title')
  const text = notes.replace(/\r\n/g, '\n')
  const prose = text.replace(/```[^\n]*\n[\s\S]*?```/g, '')
  const lead = prose.split('\n').find(line => line.trim())?.trim() ?? ''
  const heading = lead.replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim()
  const checks = [
    { id:'notes-no-duplicate-title', ok:!/^#{1,6}\s+/.test(lead) || heading !== title.trim(), message:'The Release page already shows its title; start the body with useful changes.' },
    { id:'notes-no-private-instructions', ok:!/(?:按(?:照)?用户(?:要求|指示)|根据用户(?:要求|指示)|用户要求我们|经用户授权.{0,12}(?:发布|合并|执行)|published[^\n]{0,100}with user authorization|as (?:requested|instructed) by (?:the )?user|approved (?:design )?(?:option|concept) [a-z][0-9]?)/i.test(prose), message:'Describe project behavior instead of private instructions or approval history.' },
    { id:'notes-no-private-machine-state', ok:!/(?:this release does not downgrade (?:the )?(?:local|existing local) preview|未(?:替换|降级)(?:你|用户)(?:的)?(?:本机|本地)预览|本机预览(?:保持|未被替换))/i.test(prose), message:'Private machine state belongs in the task record, not the public release.' }
  ]
  if (format !== undefined) checks.push(...formatChecks(prose, format))
  const main = prose.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '')
  const advisories = []
  if (/(?:端口冲突|port conflict|(?:本机|本地)[^\n]{0,40}(?:重跑|重试)|reran[^\n]{0,40}(?:local|port))/i.test(main)) advisories.push({ id:'local-debug-history', message:'Move local debugging history to a linked development record unless it explains a user-facing known issue.' })
  if (/(?:\b\d+ (?:local |offline |serial )*(?:tests|checks)|\d+\s*(?:项|个)(?:自动)?测试|合并后.{0,24}测试)/i.test(main)) advisories.push({ id:'validation-in-main-copy', message:'Keep test evidence concise and linked or folded; lead with changes and installation impact.' })
  if (/(?:source, installation, host loading|源码、(?:本地)?检查、CI|source and (?:local )?validation are separate)/i.test(main)) advisories.push({ id:'delivery-report-in-main-copy', message:'Keep evidence boundaries in verification records. Retain concrete user-facing limitations in the release.' })
  return { ok:checks.every(check => check.ok), checks, advisories, format:format ?? 'unrestricted', editorialReview:'required', scope:'specific-publishing-hygiene-checks' }
}

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
// Native video controls can start playback after the dialog has already closed.
video.addEventListener("play", () => {
  if (!player.open) video.pause();
});
get("close").addEventListener("click", () => player.close());
player.addEventListener("close", () => video.pause());
player.addEventListener("click", (event) => {
  if (event.target !== player) return;
  const box = player.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) player.close();
});
})();
