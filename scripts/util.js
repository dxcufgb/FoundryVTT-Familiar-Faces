export const MODULE_ID = "dxcufgbs-familiar-faces";
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;
export const QUEST_LOG_ID = "dxcufgbs-quest-log";

/** Where a note can be kept: only for its author, for the whole party, or for some players. */
export const VISIBILITY = ["private", "everyone", "some"];
export const VISIBILITY_ICONS = {
  private: "fa-solid fa-lock",
  everyone: "fa-solid fa-users",
  some: "fa-solid fa-user-check"
};

/** Localize a DXFF.* key, formatting when data is given. */
export function t(key, data) {
  const full = `DXFF.${key}`;
  return data ? game.i18n.format(full, data) : game.i18n.localize(full);
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The one GM client that does world setup. */
export function isResponsibleGM() {
  return game.user.isGM && !!game.users.activeGM?.isSelf;
}

export function randomId() {
  return foundry.utils.randomID();
}

export function cleanLine(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Name cleanup for a selection: no surrounding quotes or punctuation, one line. */
export function cleanName(value) {
  return cleanLine(value, 80).replace(/^[\s"'“”‘’«»([{,.;:!?-]+|[\s"'“”‘’«»)\]},.;:!?-]+$/g, "").trim();
}

/** A stable hue for a name, so a face without a portrait keeps its colour everywhere. */
export function nameHue(name) {
  let hash = 0;
  for (const ch of String(name).toLowerCase()) hash = ((hash << 5) - hash + ch.codePointAt(0)) | 0;
  return Math.abs(hash) % 360;
}

/** "Mira Ashgrove" → "MA". */
export function initials(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(w => /\p{L}|\p{N}/u.test(w));
  if (!words.length) return "?";
  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? [...words[words.length - 1]][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** Turns stored text (with @UUID links) into plain searchable text. */
export function plainText(text) {
  return String(text ?? "")
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/@\w+\[([^\]]*)\]/g, "$1")
    .replace(/\[\[\/?\w*\s*([^\]]*)\]\]/g, "$1");
}

/** Renders stored plain text (with Foundry enrichers such as @UUID) as safe HTML. */
export async function enrich(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const html = escapeHTML(raw).replace(/\r?\n/g, "<br>");
  const TextEditor = foundry.applications.ux.TextEditor.implementation;
  try {
    return await TextEditor.enrichHTML(html, { secrets: game.user.isGM });
  } catch (err) {
    console.error(`${MODULE_ID} | enrich failed`, err);
    return html;
  }
}

/** Converts an HTML element into readable plain text, one line per block. */
export function elementToText(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  clone.querySelectorAll("button, menu, script, style, input, select, textarea, [hidden]").forEach(el => el.remove());
  clone.querySelectorAll("br").forEach(el => el.replaceWith("\n"));
  clone.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr, header, footer, section, blockquote, dt, dd")
    .forEach(el => el.append("\n"));
  return clone.textContent.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Collects image sources from an element or fragment (skipping icons and SVG dice). */
export function imagesIn(element) {
  if (!element) return [];
  const out = new Set();
  for (const img of element.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:") || /\.svg($|\?)/i.test(src) || src.includes("icons/svg/")) continue;
    out.add(src);
  }
  return [...out];
}

/** Image sources in a journal page (text pages: the <img> tags, image pages: the image). */
export function imagesInPage(page) {
  if (!page) return [];
  if (page.type === "image") return page.src ? [page.src] : [];
  if (page.type !== "text") return [];
  const div = document.createElement("div");
  div.innerHTML = page.text?.content ?? "";
  return imagesIn(div);
}

export function formatDate(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** Name and colour of a user; falls back to the name saved with the entry. */
export function userInfo(userId, fallbackName) {
  const user = userId ? game.users.get(userId) : null;
  return { name: user?.name ?? fallbackName ?? t("UnknownUser"), color: user?.color?.css ?? "#999999" };
}

/** Players a note can be shared with (everyone but the current user and GMs, who see shared notes anyway). */
export function shareablePlayers() {
  return game.users.filter(u => !u.isGM && u.id !== game.user.id && u.role >= CONST.USER_ROLES.PLAYER)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(u => ({ id: u.id, name: u.name, color: u.color?.css ?? "#999999", active: u.active }));
}

export function currentSceneName() {
  const scene = canvas?.scene ?? game.scenes?.viewed;
  return scene ? (scene.navName || scene.name) : "";
}

/** Place suggestions: places already used plus the scenes this user can see. */
export function placeSuggestions(places = []) {
  const set = new Map();
  const add = v => {
    const s = cleanLine(v, 120);
    if (s && !set.has(s.toLowerCase())) set.set(s.toLowerCase(), s);
  };
  places.forEach(add);
  for (const scene of game.scenes ?? []) {
    if (game.user.isGM || scene.testUserPermission(game.user, "LIMITED")) add(scene.navName || scene.name);
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

/** Reads dropped Foundry data from a drag event, or null. */
export function getDropData(event) {
  try {
    return foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
  } catch {
    return null;
  }
}

/** A short "@UUID[...]{Name}" link for a dropped document. */
export async function linkForDrop(data) {
  if (!data?.uuid) return "";
  const doc = await fromUuid(data.uuid).catch(() => null);
  const name = doc?.name ?? data.name ?? data.type ?? "Link";
  return `@UUID[${data.uuid}]{${String(name).replace(/[{}[\]]/g, "")}}`;
}

/** Inserts text at the cursor of a textarea/input and fires an input event. */
export function insertAtCursor(field, text) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const before = field.value.slice(0, start);
  const pad = before && !/\s$/.test(before) ? " " : "";
  field.value = before + pad + text + field.value.slice(end);
  const pos = start + pad.length + text.length;
  field.setSelectionRange?.(pos, pos);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.focus();
}

/** Who may add new faces: the GM, and players when the world setting allows it. */
export function canAddFaces() {
  return mayAddFaces() && !combatBlocks();
}

/** Who may add faces at all, combat aside. */
export function mayAddFaces() {
  return game.user.isGM || !!game.settings.get(MODULE_ID, "playersCanAdd");
}

/** A fight is going on: a combat encounter that has started (round 1 or later). */
export function inCombat() {
  return !!game.combats?.some(c => c.started);
}

/**
 * Nobody has time to memorize a face in the middle of a fight: while a combat is running, players can't add faces
 * (to their own list or the party's) or share them with the party. The GM still can.
 */
export function combatBlocks() {
  return !game.user.isGM && inCombat();
}
