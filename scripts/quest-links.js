import { MODULE_ID, QUEST_LOG_ID, escapeRegExp } from "./util.js";

/*
 * With Dxcufgb's Quest log active, a new note about an NPC, place or faction gets links to the Quest log entries it
 * mentions: the first time the note names a quest, a quest reward or a party note, the name becomes
 * @Quest[id]{name}, @Reward[id]{name} or @PartyNote[id]{name} (the Quest log renders those as links).
 * Only entries the author can see are linked (the Quest log's API leaves out what a player may not see), whole words
 * only, longer names first, and text that already is a link is left alone. The label is the note's own text, so a
 * link never shows anything the author didn't write.
 */

/** Text that must not be touched: existing enricher links (@UUID[…]{…}, @Quest[…]…) and inline rolls ([[…]]). */
const PROTECTED = /@\w+\[[^\]]*\](?:\{[^}]*\})?|\[\[[^\]]*\]\]/g;
const MIN_LENGTH = 3;

export function questLogActive() {
  return !!game.modules.get(QUEST_LOG_ID)?.active && !!game.modules.get(QUEST_LOG_ID)?.api;
}

/** Whether new notes are linked to the Quest log (world setting, on by default). */
function enabled() {
  try {
    return questLogActive() && game.settings.get(MODULE_ID, "questLogLinks");
  } catch {
    return false;
  }
}

/** The Quest log entries the current user can see, as link targets: [{name, tag, id}]. Quests win over rewards and notes. */
export function questLogTargets() {
  const api = game.modules.get(QUEST_LOG_ID)?.api;
  if (!api) return [];
  const out = [];
  const add = (list, tag, field) => {
    let entries = [];
    try {
      entries = typeof list === "function" ? list() ?? [] : [];
    } catch (err) {
      console.error(`${MODULE_ID} | quest log ${tag}`, err);
    }
    for (const entry of entries) {
      const name = String(entry?.[field] ?? "").replace(/\s+/g, " ").trim();
      if (!entry?.id || !/^[A-Za-z0-9]{1,32}$/.test(entry.id)) continue;
      if (name.length < MIN_LENGTH || /[[\]{}@]/.test(name)) continue;
      out.push({ name, tag, id: entry.id });
    }
  };
  add(api.quests, "Quest", "title");
  add(api.rewards, "Reward", "name");
  add(api.partyNotes, "PartyNote", "title");
  // Longest names first, so "The Black Road Bandits" wins over "The Black Road"; the sort is stable for equal lengths.
  return out.sort((a, b) => b.name.length - a.name.length);
}

/** The regular expression of a name as a whole word or phrase, any case, any spacing. */
function namePattern(name) {
  const body = name.split(" ").map(escapeRegExp).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "iu");
}

/**
 * Links the first mention of each target in the text. Exported for testing; `targets` defaults to the Quest log.
 * @param {string} text
 * @param {{name: string, tag: string, id: string}[]} [targets]
 * @returns {string}
 */
export function linkMentions(text, targets = questLogTargets()) {
  text = String(text ?? "");
  if (!text || !targets.length) return text;
  // Ranges that can't be linked: existing links, and every mention linked so far.
  const taken = [];
  for (const m of text.matchAll(PROTECTED)) taken.push([m.index, m.index + m[0].length]);
  const free = (start, end) => taken.every(([s, e]) => end <= s || start >= e);
  const found = [];
  const linked = new Set();
  for (const target of targets) {
    const key = `${target.tag}:${target.id}`;
    if (linked.has(key)) continue;
    const re = new RegExp(namePattern(target.name).source, "giu");
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!free(start, end)) continue;
      taken.push([start, end]);
      found.push({ start, end, link: `@${target.tag}[${target.id}]{${m[0].replace(/\s+/g, " ")}}` });
      linked.add(key);
      break;
    }
  }
  if (!found.length) return text;
  found.sort((a, b) => b.start - a.start);
  for (const { start, end, link } of found) text = text.slice(0, start) + link + text.slice(end);
  return text;
}

/** A new note's text with its Quest log mentions linked; unchanged when the Quest log isn't active or linking is off. */
export function autoLinkQuestLog(text) {
  if (!enabled()) return text;
  try {
    return linkMentions(text);
  } catch (err) {
    console.error(`${MODULE_ID} | quest log links`, err);
    return text;
  }
}
