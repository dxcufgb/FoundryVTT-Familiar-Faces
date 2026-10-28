import { MODULE_ID, VISIBILITY, t, isResponsibleGM, randomId, cleanLine, combatBlocks } from "./util.js";

/*
 * Everything lives in the flags of journal entries that the module creates and hides from the Journal directory:
 *   - one "shared" store (default ownership OWNER): the faces themselves and every note shared with other players.
 *       flags.<module>.faces.<faceId>          = {name, img, metAt, info, source, actor, knownBy, createdBy, createdAt, updatedAt}
 *       flags.<module>.notes.<faceId>.<noteId> = {text, place, sharedWith, createdBy, authorName, createdAt, editedAt}
 *     sharedWith [] = the whole party; a list of user ids = only those players (plus the author and GMs).
 *     knownBy missing = a face of the whole party; {<userId>: true} = only in those players' Familiar Faces (plus GMs).
 *     It is a keyed object so two players adding the same NPC at the same time don't overwrite each other.
 *   - one "private" store per user (default ownership NONE, that user OWNER): the user's private notes, same shape.
 * Every write is a dot-path update of one key, so several people writing notes at the same time never overwrite
 * each other.
 */

const FACES = `flags.${MODULE_ID}.faces`;
const NOTES = `flags.${MODULE_ID}.notes`;
const O = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

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
    flags: { [MODULE_ID]: { store: "private", owner: user.id, notes: {} } }
  };
}

/** Responsible GM: create the shared store and a private store for every user that has none. */
export async function ensureStores() {
  if (!isResponsibleGM()) return;
  if (!getShared()) {
    await JournalEntry.implementation.create({
      name: t("StoreShared"),
      ownership: { default: O().OWNER },
      flags: { [MODULE_ID]: { store: "shared", faces: {}, notes: {} } }
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
/*  Faces                                       */
/* -------------------------------------------- */

function rawFaces() {
  return getShared()?.getFlag(MODULE_ID, "faces") ?? {};
}

/** The players who know a face, or null when the whole party knows it. */
function normalizeKnownBy(raw) {
  if (!raw || typeof raw !== "object") return null;
  return Object.entries(raw).filter(([, known]) => known).map(([userId]) => userId);
}

export function normalizeFace(id, raw) {
  return {
    id,
    name: cleanLine(raw.name, 80) || t("Unnamed"),
    img: typeof raw.img === "string" ? raw.img : "",
    metAt: cleanLine(raw.metAt, 120),
    info: String(raw.info ?? ""),
    source: raw.source?.uuid ? { uuid: String(raw.source.uuid), label: cleanLine(raw.source.label, 120) } : null,
    actor: typeof raw.actor === "string" ? raw.actor : "",
    knownBy: normalizeKnownBy(raw.knownBy),
    createdBy: raw.createdBy ?? null,
    createdAt: raw.createdAt ?? 0,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? 0
  };
}

/** Whether a user has this face in their Familiar Faces: GMs see every face, players the party's and their own. */
export function canSeeFace(face, user = game.user) {
  return !!face && (user.isGM || !face.knownBy || face.knownBy.includes(user.id));
}

/** Every face, including the ones only some players know. Only for the module's own bookkeeping. */
export function everyFace() {
  return Object.entries(rawFaces())
    .filter(([, raw]) => raw && typeof raw === "object")
    .map(([id, raw]) => normalizeFace(id, raw));
}

/** The faces the current user has in their Familiar Faces. */
export function allFaces() {
  return everyFace().filter(f => canSeeFace(f));
}

/** A face the current user can see; `any` also returns faces only other players know. */
export function getFace(id, { any = false } = {}) {
  const raw = id ? rawFaces()[id] : null;
  if (!raw || typeof raw !== "object") return null;
  const face = normalizeFace(id, raw);
  return any || canSeeFace(face) ? face : null;
}

export function findByName(name, { any = false } = {}) {
  const key = cleanLine(name).toLowerCase();
  if (!key) return null;
  return (any ? everyFace() : allFaces()).find(f => f.name.toLowerCase() === key) ?? null;
}

export function canEditFace(face) {
  return !!face && (game.user.isGM || (!!face.createdBy && face.createdBy === game.user.id));
}

/** Removing a face for everyone; a player removes a face only some players know from their own list instead. */
export function canDeleteFace(face) {
  return canEditFace(face) && (game.user.isGM || !face.knownBy);
}

/** The GM, or a player who has this face in their own list, can put it in every player's Familiar Faces. */
export function canShareFace(face) {
  return !!face?.knownBy && !combatBlocks() && (game.user.isGM || face.knownBy.includes(game.user.id));
}

export function canForgetFace(face) {
  return !!face && !game.user.isGM && !!face.knownBy?.includes(game.user.id);
}

/**
 * Creates a face. knownBy: null for the whole party, or the ids of the players whose Familiar Faces it is in.
 */
export async function createFace({ name, img = "", metAt = "", info = "", source = null, actor = "", knownBy = null } = {}) {
  if (combatBlocks()) throw new Error(t("InCombat"));
  const clean = cleanLine(name, 80);
  if (!clean) throw new Error(t("NameRequired"));
  const id = randomId();
  const now = Date.now();
  const data = {
    name: clean,
    img: String(img ?? ""),
    metAt: cleanLine(metAt, 120),
    info: String(info ?? "").trim(),
    source: source?.uuid ? { uuid: String(source.uuid), label: cleanLine(source.label, 120) } : null,
    createdBy: game.user.id,
    createdAt: now,
    updatedAt: now
  };
  if (typeof actor === "string" && actor) data.actor = actor;
  const knowers = Array.isArray(knownBy) ? [...new Set(knownBy.filter(Boolean))] : null;
  if (knowers?.length) data.knownBy = Object.fromEntries(knowers.map(userId => [userId, true]));
  await write(getShared(), { [`${FACES}.${id}`]: data }, { type: "created", faceId: id, name: clean });
  return id;
}

/** Adds a face that only some players know to a player's Familiar Faces. */
export async function addKnower(id, userId = game.user.id) {
  if (combatBlocks()) throw new Error(t("InCombat"));
  const face = getFace(id, { any: true });
  if (!face) throw new Error(t("FaceGone"));
  if (!face.knownBy || face.knownBy.includes(userId)) return false;
  await write(getShared(), {
    [`${FACES}.${id}.knownBy.${userId}`]: true,
    [`${FACES}.${id}.updatedAt`]: Date.now()
  }, { type: "known", faceId: id, before: face.knownBy });
  return true;
}

/**
 * Puts a face that only some players know into everyone's Familiar Faces, as if the GM had added it for the party:
 * the face itself (name, portrait, where they were met, what's known) and every note shared with the party or with
 * chosen players come along. "Only me" notes live in each author's own store and stay private.
 * The GM can share any such face; a player only one that is in their own list.
 */
export async function shareWithParty(id) {
  if (combatBlocks()) throw new Error(t("InCombat"));
  const face = getFace(id, { any: game.user.isGM });
  if (!face) throw new Error(t("FaceGone"));
  if (!canShareFace(face)) return false;
  await write(getShared(), {
    [`${FACES}.${id}.-=knownBy`]: null,
    [`${FACES}.${id}.updatedAt`]: Date.now()
  }, { type: "known", faceId: id, before: face.knownBy, sharedBy: game.user.id });
  return true;
}

/**
 * A player removes a face that only some players know from their own Familiar Faces. When nobody else knows it, the
 * face itself is removed. Their private notes about it stay, so adding the NPC again brings them back.
 */
export async function forgetFace(id) {
  const face = getFace(id);
  if (!canForgetFace(face)) return false;
  if (face.knownBy.every(userId => userId === game.user.id)) {
    await write(getShared(), { [`${FACES}.-=${id}`]: null, [`${NOTES}.-=${id}`]: null }, { type: "deleted", faceId: id });
    return true;
  }
  await write(getShared(), { [`${FACES}.${id}.knownBy.-=${game.user.id}`]: null }, { type: "forgot", faceId: id });
  return true;
}

const FACE_FIELDS = ["name", "img", "metAt", "info", "source"];

/** Writes only the given fields of a face. */
export async function updateFace(id, changes = {}) {
  if (!getFace(id)) throw new Error(t("FaceGone"));
  const update = {};
  for (const key of FACE_FIELDS) {
    if (!(key in changes)) continue;
    let value = changes[key];
    if (key === "name") value = cleanLine(value, 80) || t("Unnamed");
    else if (key === "metAt") value = cleanLine(value, 120);
    else if (key === "info") value = String(value ?? "").trim();
    else if (key === "img") value = String(value ?? "");
    else if (key === "source") value = value?.uuid ? { uuid: String(value.uuid), label: cleanLine(value.label, 120) } : null;
    update[`${FACES}.${id}.${key}`] = value;
  }
  if (!Object.keys(update).length) return;
  update[`${FACES}.${id}.updatedAt`] = Date.now();
  const event = "img" in changes && changes.img ? { type: "image", faceId: id } : { type: "updated", faceId: id };
  await write(getShared(), update, event);
}

export async function setImage(id, src) {
  return updateFace(id, { img: src ?? "" });
}

/** Removes a face and its notes. A GM also clears everyone's private notes about it. */
export async function deleteFace(id) {
  const shared = getShared();
  if (!shared) return;
  await write(shared, { [`${FACES}.-=${id}`]: null, [`${NOTES}.-=${id}`]: null }, { type: "deleted", faceId: id });
  const stores = game.user.isGM
    ? game.journal.filter(j => j.getFlag(MODULE_ID, "store") === "private")
    : [getPrivate()].filter(Boolean);
  for (const doc of stores) {
    if (doc.getFlag(MODULE_ID, "notes")?.[id]) await doc.update({ [`${NOTES}.-=${id}`]: null });
  }
}

/* -------------------------------------------- */
/*  Notes                                       */
/* -------------------------------------------- */

function cleanUserIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(id => game.users.get(id) && id !== game.user.id))];
}

function normalizeNote(faceId, id, raw, where) {
  const sharedWith = where === "shared" && Array.isArray(raw.sharedWith) ? raw.sharedWith.filter(Boolean) : [];
  return {
    id,
    faceId,
    where,
    visibility: where === "private" ? "private" : sharedWith.length ? "some" : "everyone",
    sharedWith,
    text: String(raw.text ?? ""),
    place: cleanLine(raw.place, 120),
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

function collect(doc, where, into, onlyFace = null) {
  const all = doc?.getFlag(MODULE_ID, "notes") ?? {};
  const faces = onlyFace ? { [onlyFace]: all[onlyFace] } : all;
  for (const [faceId, notes] of Object.entries(faces)) {
    if (!notes || typeof notes !== "object") continue;
    for (const [id, raw] of Object.entries(notes)) {
      if (!raw || typeof raw !== "object") continue;
      const note = normalizeNote(faceId, id, raw, where);
      if (!canSee(note)) continue;
      if (!into.has(faceId)) into.set(faceId, []);
      into.get(faceId).push(note);
    }
  }
}

/** Every note the current user may see, by face id: shared notes meant for them plus their own private notes. */
export function visibleNotesByFace() {
  const map = new Map();
  collect(getShared(), "shared", map);
  collect(getPrivate(), "private", map);
  for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return map;
}

export function notesFor(faceId) {
  const map = new Map();
  collect(getShared(), "shared", map, faceId);
  collect(getPrivate(), "private", map, faceId);
  return (map.get(faceId) ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

function storeFor(where) {
  return where === "private" ? getPrivate() : getShared();
}

function rawNote(faceId, noteId, where) {
  return storeFor(where)?.getFlag(MODULE_ID, "notes")?.[faceId]?.[noteId] ?? null;
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
 */
export async function addNote(faceId, { text = "", place = "", visibility = "private", sharedWith = [] } = {}) {
  if (!getFace(faceId)) throw new Error(t("FaceGone"));
  const id = randomId();
  const data = {
    text: String(text ?? "").trim(),
    place: cleanLine(place, 120),
    createdBy: game.user.id,
    authorName: game.user.name,
    createdAt: Date.now(),
    editedAt: 0
  };
  if (!data.text && !data.place) return null;
  const users = cleanUserIds(sharedWith);
  if (!VISIBILITY.includes(visibility) || (visibility === "some" && !users.length)) visibility = "private";
  if (visibility === "private") {
    const doc = getPrivate();
    if (!doc) throw new Error(t("PrivateNotReady"));
    await doc.update({ [`${NOTES}.${faceId}.${id}`]: data });
  } else {
    data.sharedWith = visibility === "some" ? users : [];
    await write(getShared(), { [`${NOTES}.${faceId}.${id}`]: data }, { type: "note", faceId, sharedWith: data.sharedWith });
  }
  return id;
}

/** Changes a note's text, place or who sees it; moving between private and shared keeps the same id. */
export async function updateNote(faceId, noteId, where, { text, place, visibility, sharedWith } = {}) {
  const raw = rawNote(faceId, noteId, where);
  if (!raw) throw new Error(t("NoteGone"));
  if (raw.createdBy !== game.user.id) throw new Error(t("NotYourNote"));
  const users = cleanUserIds(sharedWith);
  let target = visibility ?? (where === "private" ? "private" : raw.sharedWith?.length ? "some" : "everyone");
  if (!VISIBILITY.includes(target) || (target === "some" && !users.length)) target = "private";
  const targetWhere = target === "private" ? "private" : "shared";
  const next = {
    ...raw,
    text: text === undefined ? String(raw.text ?? "") : String(text).trim(),
    place: place === undefined ? cleanLine(raw.place, 120) : cleanLine(place, 120),
    editedAt: Date.now()
  };
  if (targetWhere === "shared") next.sharedWith = target === "some" ? users : [];
  else delete next.sharedWith;

  const path = `${NOTES}.${faceId}.${noteId}`;
  if (targetWhere === where) {
    const update = { [`${path}.text`]: next.text, [`${path}.place`]: next.place, [`${path}.editedAt`]: next.editedAt };
    if (where === "shared") update[`${path}.sharedWith`] = next.sharedWith;
    const event = where === "shared" ? { type: "noteEdited", faceId } : null;
    return write(storeFor(where), update, event);
  }
  // Moving: write the new copy first so the note is never lost, then remove the old one.
  const doc = storeFor(targetWhere);
  if (!doc) throw new Error(targetWhere === "private" ? t("PrivateNotReady") : t("NotReady"));
  await write(doc, { [path]: next }, targetWhere === "shared" ? { type: "note", faceId, sharedWith: next.sharedWith } : null);
  await storeFor(where).update({ [`${NOTES}.${faceId}.-=${noteId}`]: null });
}

export async function deleteNote(faceId, noteId, where) {
  const doc = storeFor(where);
  if (!doc) return;
  await doc.update({ [`${NOTES}.${faceId}.-=${noteId}`]: null });
}
