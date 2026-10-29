import { escapeHTML, escapeRegExp, plainText } from "./util.js";

/** Splits a search into lower-case words; "quoted phrases" stay together. */
export function tokenize(query) {
  const out = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(String(query ?? "")))) {
    const term = (m[1] ?? m[2]).trim().toLowerCase();
    if (term) out.push(term);
  }
  return out;
}

/** Wraps every search term in <mark>, escaping the rest. */
export function highlight(text, terms) {
  const safe = escapeHTML(text);
  if (!terms?.length) return safe;
  const re = new RegExp(`(${terms.map(term => escapeRegExp(escapeHTML(term))).join("|")})`, "gi");
  return safe.replace(re, "<mark>$1</mark>");
}

function snippetOf(text, terms, radius = 46) {
  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return null;
  let start = Math.max(0, at - radius);
  // Start at a word boundary (or the beginning, when that's close).
  if (start < 12) start = 0;
  else {
    const space = text.indexOf(" ", start);
    if (space >= 0 && space < at) start = space + 1;
  }
  const end = Math.min(text.length, at + radius * 2);
  const part = `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
  return highlight(part, terms);
}

/**
 * Every word must appear somewhere in the face: its name, where they were met, the info, the places it is linked to,
 * or the places and text of the notes this user can see. Returns {snippet} (null snippet when the name already shows
 * the match) or null.
 */
export function matchFace(face, notes, terms, placeNames = []) {
  return matchFields([
    { text: face.name, primary: true },
    { text: face.metAt, primary: true },
    ...notes.map(n => ({ text: n.place, primary: true })),
    ...placeNames.map(name => ({ text: name, primary: true })),
    { text: plainText(face.info) },
    ...notes.map(n => ({ text: plainText(n.text) }))
  ], terms);
}

/**
 * The same for a place: its name, region, the NPCs met or linked there (that this user can see), the info and the
 * text of the notes this user can see.
 */
export function matchPlace(place, notes, terms, faceNames = []) {
  return matchFields([
    { text: place.name, primary: true },
    { text: place.region, primary: true },
    ...faceNames.map(name => ({ text: name, primary: true })),
    { text: plainText(place.info) },
    ...notes.map(n => ({ text: plainText(n.text) }))
  ], terms);
}

function matchFields(all, terms) {
  if (!terms.length) return { snippet: null };
  const fields = all.filter(f => f.text);
  const haystack = fields.map(f => f.text.toLowerCase()).join("\n");
  if (!terms.every(term => haystack.includes(term))) return null;
  const primary = fields.filter(f => f.primary).map(f => f.text.toLowerCase()).join("\n");
  if (terms.every(term => primary.includes(term))) return { snippet: null };
  for (const field of fields.filter(f => !f.primary)) {
    const snippet = snippetOf(field.text, terms);
    if (snippet) return { snippet };
  }
  return { snippet: null };
}
