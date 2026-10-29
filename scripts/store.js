import { MODULE_ID, VISIBILITY, t, isResponsibleGM, randomId, cleanLine, combatBlocks } from "./util.js";

/*
 * Everything lives in the flags of journal entries that the module creates and hides from the Journal directory:
 *   - one "shared" store (default ownership OWNER): the faces and places themselves and every note shared with other
 *     players.
 *       flags.<module>.faces.<faceId>               = {name, img, metAt, info, source, actor, knownBy, createdBy, createdAt, updatedAt}
 *       flags.<module>.notes.<faceId>.<noteId>      = {text, place, sharedWith, createdBy, authorName, createdAt, editedAt}
 *       flags.<module>.places.<placeId>             = {name, img, region, info, source, scene, faces, knownBy, createdBy, createdAt, updatedAt}
 *       flags.<module>.placeNotes.<placeId>.<noteId> = {text, sharedWith, createdBy, authorName, createdAt, editedAt}
 *     sharedWith [] = the whole party; a list of user ids = only those players (plus the author and GMs).
 *     knownBy missing = known by the whole party; {<userId>: true} = only in those players' lists (plus GMs).
 *     It is a keyed object so two players adding the same NPC at the same time don't overwrite each other.
 *     A place's faces = {<faceId>: {by, at}}: the NPCs linked to it by hand (keyed for the same reason).
 *   - one "private" store per user (default ownership NONE, that user OWNER): the user's private notes, same shape
 *     (notes and placeNotes).
 * Every write is a dot-path update of one key, so several people writing notes at the same time never overwrite
 * each other.
 *
 * Faces and places work the same way; most functions take a kind ("faces" or "places"), and the face functions of
 * the earlier versions (createFace, notesFor, ...) are kept as they were.
 */

export const KINDS = ["faces", "places"];
const NOTE_KEYS = { faces: "notes", places: "placeNotes" };
const GONE = { faces: "FaceGone", places: "PlaceGone" };
const O = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

function kindOf(kind) {
  return kind === "places" ? "places" : "faces";
}

const entriesPath = kind => `flags.${MODULE_ID}.${kindOf(kind)}`;
const notesPath = kind => `flags.${MODULE_ID}.${NOTE_KEYS[kindOf(kind)]}`;

/** Players can't add or share NPCs during a fight; places aren't affected. */
function blocked(kind) {
  return kindOf(kind) === "faces" && combatBlocks();
}

/* -------------------------------------------- */
/*  Stores                                      */
/* -------------------------------------------- */

export function getShared() {
  return game.journal?.find(j => j.getFlag(MODULE_ID, "store") === "shared") ?? null;
}

/** The private store of a user (players only receive their own; GMs see everyone's). */
export function getPrivate(userId = game.user.id) {
  return game.journal?.find(j => j.getFlag(MODULE_ID, "store") === "private" && j.getFlag(MODULE_ID, "owner") === userId) ?? null;
}

export function isStore(doc) {
  return !!doc?.getFlag?.(MODULE_ID, "store");
}

export function storeIds() {
  return (game.journal ?? []).filter(isStore).map(j => j.id);
}

export function ready() {
  return !!getShared();
}

export function privateReady() {
  return !!getPrivate();
}

function privateStoreData(user) {
  return {
    name: t("StorePrivate", { name: user.name }),
    ownership: { default: O().NONE, [user.id]: O().OWNER },
    flags: { [MODULE_ID]: { store: "private", owner: user.id, notes: {}, placeNotes: {} } }
  };
}

/** Responsible GM: create the shared store and a private store for every user that has none. */
export async function ensureStores() {
  if (!isResponsibleGM()) return;
  if (!getShared()) {
    await JournalEntry.implementation.create({
      name: t("StoreShared"),
      ownership: { default: O().OWNER },
      flags: { [MODULE_ID]: { store: "shared", faces: {}, notes: {}, places: {}, placeNotes: {} } }
    });
  }
  const missing = game.users.filter(u => !getPrivate(u.id));
  if (missing.length) await JournalEntry.implementation.createDocuments(missing.map(privateStoreData));
}

export async function ensurePrivateStore(user) {
  if (!isResponsibleGM() || !user || getPrivate(user.id)) return;
  await JournalEntry.implementation.create(privateStoreData(user));
}

async function write(doc, changes, event) {
  if (!doc) throw new Error(t("NotReady"));
  return doc.update(changes, event ? { [MODULE_ID]: event } : {});
}

/* -------------------------------------------- */
/*  Normalizing                                 */
/* -------------------------------------------- */

function rawEntries(kind) {
  return getShared()?.getFlag(MODULE_ID, kindOf(kind)) ?? {};
}

/** The players who know a face or place, or null when the whole party knows it. */
function normalizeKnownBy(raw) {
  if (!raw || typeof raw !== "object") return null;
  return Object.entries(raw).filter(([, known]) => known).map(([userId]) => userId);
}

function normalizeSource(raw) {
  return raw?.uuid ? { uuid: String(raw.uuid), label: cleanLine(raw.label, 120) } : null;
}

export function normalizeFace(id, raw) {
  return {
    id,
    kind: "faces",
    name: cleanLine(raw.name, 80) || t("Unnamed"),
    img: typeof raw.img === "string" ? raw.img : "",
    metAt: cleanLine(raw.metAt, 120),
    info: String(raw.info ?? ""),
    source: normalizeSource(raw.source),
    actor: typeof raw.actor === "string" ? raw.actor : "",
    knownBy: normalizeKnownBy(raw.knownBy),
    createdBy: raw.createdBy ?? null,
    createdAt: raw.createdAt ?? 0,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? 0
  };
}

/** The NPCs linked to a place by hand: [{faceId, by, at}]. */
function normalizeLinks(raw) {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([, link]) => link)
    .map(([faceId, link]) => ({ faceId, by: link?.by ?? null, at: link?.at ?? 0 }));
}

export function normalizePlace(id, raw) {
  return {
    id,
    kind: "places",
    name: cleanLine(raw.name, 120) || t("Unnamed"),
    img: typeof raw.img === "string" ? raw.img : "",
    region: cleanLine(raw.region, 120),
    info: String(raw.info ?? ""),
    source: normalizeSource(raw.source),
    scene: typeof raw.scene === "string" ? raw.scene : "",
    links: normalizeLinks(raw.faces),
    knownBy: normalizeKnownBy(raw.knownBy),
    createdBy: raw.createdBy ?? null,
    createdAt: raw.createdAt ?? 0,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? 0
  };
}

function normalize(kind, id, raw) {
  return kindOf(kind) === "places" ? normalizePlace(id, raw) : normalizeFace(id, raw);
}

const NAME_MAX = { faces: 80, places: 120 };

/* -------------------------------------------- */
/*  Faces and places                            */
/* -------------------------------------------- */

/** Whether a user has this face or place in their lists: GMs see everything, players the party's and their own. */
export function canSeeEntry(entry, user = game.user) {
  return !!entry && (user.isGM || !entry.knownBy || entry.knownBy.includes(user.id));
}

/** Every face or place, including the ones only some players know. Only for the module's own bookkeeping. */
export function everyEntry(kind) {
  return Object.entries(rawEntries(kind))
    .filter(([, raw]) => raw && typeof raw === "object")
    .map(([id, raw]) => normalize(kind, id, raw));
}

/** The faces or places the current user has in their lists. */
export function allEntries(kind) {
  return everyEntry(kind).filter(e => canSeeEntry(e));
}

/** A face or place the current user can see; `any` also returns the ones only other players know. */
export function getEntry(kind, id, { any = false } = {}) {
  const raw = id ? rawEntries(kind)[id] : null;
  if (!raw || typeof raw !== "object") return null;
  const entry = normalize(kind, id, raw);
  return any || canSeeEntry(entry) ? entry : null;
}

export function findEntryByName(kind, name, { any = false } = {}) {
  const key = cleanLine(name).toLowerCase();
  if (!key) return null;
  return (any ? everyEntry(kind) : allEntries(kind)).find(e => e.name.toLowerCase() === key) ?? null;
}

export function canEditEntry(entry) {
  return !!entry && (game.user.isGM || (!!entry.createdBy && entry.createdBy === game.user.id));
}

/** Removing for everyone; a player removes one only some players know from their own list instead. */
export function canDeleteEntry(entry) {
  return canEditEntry(entry) && (game.user.isGM || !entry.knownBy);
}

/** The GM, or a player who has it in their own list, can put a face or place in every player's lists. */
export function canShareEntry(entry) {
  return !!entry?.knownBy && !blocked(entry.kind) && (game.user.isGM || entry.knownBy.includes(game.user.id));
}

export function canForgetEntry(entry) {
  return !!entry && !game.user.isGM && !!entry.knownBy?.includes(game.user.id);
}

/** The fields of a new or changed entry, cleaned. */
function cleanFields(kind, changes) {
  const out = {};
  const fields = kindOf(kind) === "places" ? ["name", "img", "region", "info", "source", "scene"] : ["name", "img", "metAt", "info", "source", "actor"];
  for (const key of fields) {
    if (!(key in changes)) continue;
    const value = changes[key];
    if (key === "name") out.name = cleanLine(value, NAME_MAX[kindOf(kind)]) || t("Unnamed");
    else if (key === "metAt" || key === "region") out[key] = cleanLine(value, 120);
    else if (key === "info") out.info = String(value ?? "").trim();
    else if (key === "img") out.img = String(value ?? "");
    else if (key === "source") out.source = normalizeSource(value);
    else if (key === "actor" || key === "scene") out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

/**
 * Creates a face or place. knownBy: null for the whole party, or the ids of the players whose lists it is in.
 */
export async function createEntry(kind, { name, knownBy = null, ...rest } = {}) {
  kind = kindOf(kind);
  if (blocked(kind)) throw new Error(t("InCombat"));
  const clean = cleanLine(name, NAME_MAX[kind]);
  if (!clean) throw new Error(t("NameRequired"));
  const id = randomId();
  const now = Date.now();
  const fields = cleanFields(kind, rest);
  const data = {
    name: clean,
    img: fields.img ?? "",
    info: fields.info ?? "",
    source: fields.source ?? null,
    createdBy: game.user.id,
    createdAt: now,
    updatedAt: now
  };
  if (kind === "faces") data.metAt = fields.metAt ?? "";
  else data.region = fields.region ?? "";
  if (fields.actor) data.actor = fields.actor;
  if (fields.scene) data.scene = fields.scene;
  const knowers = Array.isArray(knownBy) ? [...new Set(knownBy.filter(Boolean))] : null;
  if (knowers?.length) data.knownBy = Object.fromEntries(knowers.map(userId => [userId, true]));
  await write(getShared(), { [`${entriesPath(kind)}.${id}`]: data }, { type: "created", kind, id, name: clean });
  return id;
}

/** Adds a face or place that only some players know to a player's list. */
export async function addKnowerTo(kind, id, userId = game.user.id) {
  kind = kindOf(kind);
  if (blocked(kind)) throw new Error(t("InCombat"));
  const entry = getEntry(kind, id, { any: true });
  if (!entry) throw new Error(t(GONE[kind]));
  if (!entry.knownBy || entry.knownBy.includes(userId)) return false;
  await write(getShared(), {
    [`${entriesPath(kind)}.${id}.knownBy.${userId}`]: true,
    [`${entriesPath(kind)}.${id}.updatedAt`]: Date.now()
  }, { type: "known", kind, id, before: entry.knownBy });
  return true;
}

/**
 * Puts a face or place that only some players know into everyone's lists, as if the GM had added it for the party:
 * the entry itself and every note shared with the party or with chosen players come along. "Only me" notes live in
 * each author's own store and stay private. The GM can share any such entry; a player only one in their own list.
 */
export async function shareEntryWithParty(kind, id) {
  kind = kindOf(kind);
  if (blocked(kind)) throw new Error(t("InCombat"));
  const entry = getEntry(kind, id, { any: game.user.isGM });
  if (!entry) throw new Error(t(GONE[kind]));
  if (!canShareEntry(entry)) return false;
  await write(getShared(), {
    [`${entriesPath(kind)}.${id}.-=knownBy`]: null,
    [`${entriesPath(kind)}.${id}.updatedAt`]: Date.now()
  }, { type: "known", kind, id, before: entry.knownBy, sharedBy: game.user.id });
  return true;
}

/** The changes that remove an entry and its shared notes (and, for a face, its links from places). */
function removalChanges(kind, id) {
  const changes = { [`${entriesPath(kind)}.-=${id}`]: null, [`${notesPath(kind)}.-=${id}`]: null };
  if (kind === "faces") {
    for (const place of everyEntry("places")) {
      if (place.links.some(l => l.faceId === id)) changes[`${entriesPath("places")}.${place.id}.faces.-=${id}`] = null;
    }
  }
  return changes;
}

/**
 * A player removes a face or place that only some players know from their own list. When nobody else knows it, it is
 * removed. Their private notes about it stay, so adding it again brings them back.
 */
export async function forgetEntry(kind, id) {
  kind = kindOf(kind);
  const entry = getEntry(kind, id);
  if (!canForgetEntry(entry)) return false;
  if (entry.knownBy.every(userId => userId === game.user.id)) {
    await write(getShared(), removalChanges(kind, id), { type: "deleted", kind, id });
    return true;
  }
  await write(getShared(), { [`${entriesPath(kind)}.${id}.knownBy.-=${game.user.id}`]: null }, { type: "forgot", kind, id });
  return true;
}

/** Writes only the given fields of a face or place. */
export async function updateEntry(kind, id, changes = {}) {
  kind = kindOf(kind);
  if (!getEntry(kind, id)) throw new Error(t(GONE[kind]));
  const fields = cleanFields(kind, changes);
  const update = {};
  for (const [key, value] of Object.entries(fields)) update[`${entriesPath(kind)}.${id}.${key}`] = value;
  if (!Object.keys(update).length) return;
  update[`${entriesPath(kind)}.${id}.updatedAt`] = Date.now();
  const event = "img" in changes && changes.img ? { type: "image", kind, id } : { type: "updated", kind, id };
  await write(getShared(), update, event);
}

export async function setEntryImage(kind, id, src) {
  return updateEntry(kind, id, { img: src ?? "" });
}

/** Removes a face or place and its notes. A GM also clears everyone's private notes about it. */
export async function deleteEntry(kind, id) {
  kind = kindOf(kind);
  const shared = getShared();
  if (!shared) return;
  await write(shared, removalChanges(kind, id), { type: "deleted", kind, id });
  const stores = game.user.isGM
    ? game.journal.filter(j => j.getFlag(MODULE_ID, "store") === "private")
    : [getPrivate()].filter(Boolean);
  for (const doc of stores) {
    if (doc.getFlag(MODULE_ID, NOTE_KEYS[kind])?.[id]) await doc.update({ [`${notesPath(kind)}.-=${id}`]: null });
  }
}

/* -------------------------------------------- */
/*  Faces (the functions of earlier versions)   */
/* -------------------------------------------- */

export const canSeeFace = canSeeEntry;
export const everyFace = () => everyEntry("faces");
export const allFaces = () => allEntries("faces");
export const getFace = (id, options) => getEntry("faces", id, options);
export const findByName = (name, options) => findEntryByName("faces", name, options);
export const canEditFace = canEditEntry;
export const canDeleteFace = canDeleteEntry;
export const canShareFace = canShareEntry;
export const canForgetFace = canForgetEntry;
export const createFace = data => createEntry("faces", data);
export const addKnower = (id, userId) => addKnowerTo("faces", id, userId);
export const shareWithParty = id => shareEntryWithParty("faces", id);
export const forgetFace = id => forgetEntry("faces", id);
export const updateFace = (id, changes) => updateEntry("faces", id, changes);
export const setImage = (id, src) => setEntryImage("faces", id, src);
export const deleteFace = id => deleteEntry("faces", id);

/* -------------------------------------------- */
/*  Places                                      */
/* -------------------------------------------- */

export const everyPlace = () => everyEntry("places");
export const allPlaces = () => allEntries("places");
export const getPlace = (id, options) => getEntry("places", id, options);
export const findPlaceByName = (name, options) => findEntryByName("places", name, options);
export const createPlace = data => createEntry("places", data);
export const sharePlaceWithParty = id => shareEntryWithParty("places", id);
export const forgetPlace = id => forgetEntry("places", id);
export const updatePlace = (id, changes) => updateEntry("places", id, changes);
export const setPlaceImage = (id, src) => setEntryImage("places", id, src);
export const deletePlace = id => deleteEntry("places", id);

/** Anyone who has both the place and the NPC in their lists can link them. */
export function canLink(place, face) {
  return !!place && !!face && canSeeEntry(place) && canSeeEntry(face);
}

/** A link is removed by the one who made it, the place's editor, or a GM. */
export function canUnlink(place, link) {
  return !!place && !!link && (game.user.isGM || link.by === game.user.id || canEditEntry(place));
}

/** Links an NPC to a place by hand. */
export async function linkFace(placeId, faceId) {
  const place = getPlace(placeId);
  const face = getFace(faceId);
  if (!place) throw new Error(t("PlaceGone"));
  if (!face) throw new Error(t("FaceGone"));
  if (!canLink(place, face) || place.links.some(l => l.faceId === faceId)) return false;
  const now = Date.now();
  await write(getShared(), {
    [`${entriesPath("places")}.${placeId}.faces.${faceId}`]: { by: game.user.id, at: now },
    [`${entriesPath("places")}.${placeId}.updatedAt`]: now
  }, { type: "linked", kind: "places", id: placeId, faceId });
  return true;
}

export async function unlinkFace(placeId, faceId) {
  const place = getPlace(placeId);
  const link = place?.links.find(l => l.faceId === faceId);
  if (!canUnlink(place, link)) return false;
  await write(getShared(), { [`${entriesPath("places")}.${placeId}.faces.-=${faceId}`]: null }, { type: "unlinked", kind: "places", id: placeId, faceId });
  return true;
}

/** How a place name is compared: case and spacing don't matter. */
export function placeKey(name) {
  return cleanLine(name, 120).toLowerCase();
}

/**
 * The NPCs of a place that the current user can see, and why: linked by hand, first met there, or a note of theirs
 * is set there. `faces` and `notesByFace` are what the user can see (allFaces / visibleNotesByFace).
 * @returns {{face: object, linked: boolean, met: boolean, noted: boolean, link: object|null}[]}
 */
export function facesOfPlace(place, faces = allFaces(), notesByFace = visibleNotesByFace()) {
  if (!place) return [];
  const key = placeKey(place.name);
  const out = [];
  for (const face of faces) {
    const link = place.links.find(l => l.faceId === face.id) ?? null;
    const met = !!key && placeKey(face.metAt) === key;
    const noted = !!key && (notesByFace.get(face.id) ?? []).some(n => placeKey(n.place) === key);
    if (link || met || noted) out.push({ face, linked: !!link, met, noted, link });
  }
  return out.sort((a, b) => a.face.name.localeCompare(b.face.name, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * The places of an NPC that the current user can see: linked by hand, where they were first met, or where a note
 * says they were.
 * @returns {{place: object, linked: boolean, met: boolean, noted: boolean, link: object|null}[]}
 */
export function placesOfFace(face, notes = notesFor(face?.id), places = allPlaces()) {
  if (!face) return [];
  const metKey = placeKey(face.metAt);
  const noteKeys = new Set(notes.map(n => placeKey(n.place)).filter(Boolean));
  const out = [];
  for (const place of places) {
    const key = placeKey(place.name);
    const link = place.links.find(l => l.faceId === face.id) ?? null;
    const met = !!key && metKey === key;
    const noted = !!key && noteKeys.has(key);
    if (link || met || noted) out.push({ place, linked: !!link, met, noted, link });
  }
  return out.sort((a, b) => a.place.name.localeCompare(b.place.name, undefined, { numeric: true, sensitivity: "base" }));
}

/* -------------------------------------------- */
/*  Notes                                       */
/* -------------------------------------------- */

function cleanUserIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(id => game.users.get(id) && id !== game.user.id))];
}

function normalizeNote(kind, entryId, id, raw, where) {
  const sharedWith = where === "shared" && Array.isArray(raw.sharedWith) ? raw.sharedWith.filter(Boolean) : [];
  return {
    id,
    kind,
    entryId,
    faceId: entryId,
    where,
    visibility: where === "private" ? "private" : sharedWith.length ? "some" : "everyone",
    sharedWith,
    text: String(raw.text ?? ""),
    place: kind === "faces" ? cleanLine(raw.place, 120) : "",
    createdBy: raw.createdBy ?? null,
    authorName: raw.authorName ?? null,
    createdAt: raw.createdAt ?? 0,
    editedAt: raw.editedAt ?? 0
  };
}

function canSee(note) {
  if (note.where === "private") return note.createdBy === game.user.id || !note.createdBy;
  const me = game.user.id;
  return game.user.isGM || note.createdBy === me || !note.sharedWith.length || note.sharedWith.includes(me);
}

function collect(kind, doc, where, into, only = null) {
  const all = doc?.getFlag(MODULE_ID, NOTE_KEYS[kind]) ?? {};
  const entries = only ? { [only]: all[only] } : all;
  for (const [entryId, notes] of Object.entries(entries)) {
    if (!notes || typeof notes !== "object") continue;
    for (const [id, raw] of Object.entries(notes)) {
      if (!raw || typeof raw !== "object") continue;
      const note = normalizeNote(kind, entryId, id, raw, where);
      if (!canSee(note)) continue;
      if (!into.has(entryId)) into.set(entryId, []);
      into.get(entryId).push(note);
    }
  }
}

/** Every note the current user may see, by face or place id: shared notes meant for them plus their own private ones. */
export function visibleNotesBy(kind) {
  kind = kindOf(kind);
  const map = new Map();
  collect(kind, getShared(), "shared", map);
  collect(kind, getPrivate(), "private", map);
  for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return map;
}

export function notesOf(kind, entryId) {
  kind = kindOf(kind);
  const map = new Map();
  collect(kind, getShared(), "shared", map, entryId);
  collect(kind, getPrivate(), "private", map, entryId);
  return (map.get(entryId) ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

function storeFor(where) {
  return where === "private" ? getPrivate() : getShared();
}

function rawNote(kind, entryId, noteId, where) {
  return storeFor(where)?.getFlag(MODULE_ID, NOTE_KEYS[kind])?.[entryId]?.[noteId] ?? null;
}

export function canEditNote(note) {
  return !!note && note.createdBy === game.user.id;
}

export function canDeleteNote(note) {
  return !!note && (note.createdBy === game.user.id || (game.user.isGM && note.where === "shared"));
}

/**
 * Adds a note. visibility: "private" (the author's own store), "everyone" or "some" (the shared store, with the
 * chosen players in sharedWith). "some" without anyone chosen is kept private rather than shared with everybody.
 * Notes about places have no place of their own.
 */
export async function addEntryNote(kind, entryId, { text = "", place = "", visibility = "private", sharedWith = [] } = {}) {
  kind = kindOf(kind);
  if (!getEntry(kind, entryId)) throw new Error(t(GONE[kind]));
  const id = randomId();
  const data = {
    text: String(text ?? "").trim(),
    createdBy: game.user.id,
    authorName: game.user.name,
    createdAt: Date.now(),
    editedAt: 0
  };
  if (kind === "faces") data.place = cleanLine(place, 120);
  if (!data.text && !data.place) return null;
  const users = cleanUserIds(sharedWith);
  if (!VISIBILITY.includes(visibility) || (visibility === "some" && !users.length)) visibility = "private";
  const path = `${notesPath(kind)}.${entryId}.${id}`;
  if (visibility === "private") {
    const doc = getPrivate();
    if (!doc) throw new Error(t("PrivateNotReady"));
    await doc.update({ [path]: data });
  } else {
    data.sharedWith = visibility === "some" ? users : [];
    await write(getShared(), { [path]: data }, { type: "note", kind, id: entryId, sharedWith: data.sharedWith });
  }
  return id;
}

/** Changes a note's text, place or who sees it; moving between private and shared keeps the same id. */
export async function updateEntryNote(kind, entryId, noteId, where, { text, place, visibility, sharedWith } = {}) {
  kind = kindOf(kind);
  const raw = rawNote(kind, entryId, noteId, where);
  if (!raw) throw new Error(t("NoteGone"));
  if (raw.createdBy !== game.user.id) throw new Error(t("NotYourNote"));
  const users = cleanUserIds(sharedWith);
  let target = visibility ?? (where === "private" ? "private" : raw.sharedWith?.length ? "some" : "everyone");
  if (!VISIBILITY.includes(target) || (target === "some" && !users.length)) target = "private";
  const targetWhere = target === "private" ? "private" : "shared";
  const next = {
    ...raw,
    text: text === undefined ? String(raw.text ?? "") : String(text).trim(),
    editedAt: Date.now()
  };
  if (kind === "faces") next.place = place === undefined ? cleanLine(raw.place, 120) : cleanLine(place, 120);
  if (targetWhere === "shared") next.sharedWith = target === "some" ? users : [];
  else delete next.sharedWith;

  const path = `${notesPath(kind)}.${entryId}.${noteId}`;
  if (targetWhere === where) {
    const update = { [`${path}.text`]: next.text, [`${path}.editedAt`]: next.editedAt };
    if (kind === "faces") update[`${path}.place`] = next.place;
    if (where === "shared") update[`${path}.sharedWith`] = next.sharedWith;
    const event = where === "shared" ? { type: "noteEdited", kind, id: entryId } : null;
    return write(storeFor(where), update, event);
  }
  // Moving: write the new copy first so the note is never lost, then remove the old one.
  const doc = storeFor(targetWhere);
  if (!doc) throw new Error(targetWhere === "private" ? t("PrivateNotReady") : t("NotReady"));
  await write(doc, { [path]: next }, targetWhere === "shared" ? { type: "note", kind, id: entryId, sharedWith: next.sharedWith } : null);
  await storeFor(where).update({ [`${notesPath(kind)}.${entryId}.-=${noteId}`]: null });
}

export async function deleteEntryNote(kind, entryId, noteId, where) {
  const doc = storeFor(where);
  if (!doc) return;
  await doc.update({ [`${notesPath(kind)}.${entryId}.-=${noteId}`]: null });
}

/* Face notes, as in earlier versions. */
export const visibleNotesByFace = () => visibleNotesBy("faces");
export const notesFor = faceId => notesOf("faces", faceId);
export const addNote = (faceId, data) => addEntryNote("faces", faceId, data);
export const updateNote = (faceId, noteId, where, data) => updateEntryNote("faces", faceId, noteId, where, data);
export const deleteNote = (faceId, noteId, where) => deleteEntryNote("faces", faceId, noteId, where);

/* Place notes. */
export const visibleNotesByPlace = () => visibleNotesBy("places");
export const placeNotesFor = placeId => notesOf("places", placeId);
export const addPlaceNote = (placeId, data) => addEntryNote("places", placeId, data);
