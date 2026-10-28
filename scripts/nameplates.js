import { MODULE_ID, isResponsibleGM, cleanLine } from "./util.js";
import * as store from "./store.js";
import { isNPC } from "./npcs.js";

/*
 * Nameplates of NPCs the whole party knows. When a face is in every player's Familiar Faces (the GM added it for
 * everyone, or a player shared it), every token of that NPC shows its name when anyone hovers it: the tokens already
 * placed in every scene, and the actor's prototype token, so tokens placed later do too.
 *
 * Which tokens: the face's own actor (faces added from a token or the Actors directory remember it), NPC actors with
 * the face's name ("Neverwinter Guard" covers every Neverwinter Guard), and NPC tokens carrying the face's name.
 *
 * Only the responsible GM writes (players can't edit NPC tokens); when a GM logs in it catches up on faces shared
 * while no GM was online. The module never hides a name again, and a token that already shows its name to everyone
 * (Hovered by Anyone or Always for Everyone) is left as it is.
 */

const modes = () => CONST.TOKEN_DISPLAY_MODES;
const key = name => cleanLine(name, 80).toLowerCase();

/** Whether everyone already sees the name on hover at this display mode. */
function showsToAll(mode) {
  return mode === modes().HOVER || mode === modes().ALWAYS;
}

function enabled() {
  return !!game.settings.get(MODULE_ID, "knownNameplates");
}

/** "Actor.<id>" (a world actor) → its id; compendium or token uuids → null. */
function worldActorId(uuid) {
  if (typeof uuid !== "string") return null;
  const parts = uuid.split(".");
  return parts.length === 2 && parts[0] === "Actor" ? parts[1] : null;
}

/** The NPC actors and the names the whole party knows. */
function knownTargets() {
  const names = new Set();
  const actorIds = new Set();
  for (const face of store.everyFace()) {
    if (face.knownBy) continue;
    const name = key(face.name);
    if (name) names.add(name);
    const id = worldActorId(face.actor);
    if (id && isNPC(game.actors.get(id))) actorIds.add(id);
  }
  for (const actor of game.actors) {
    if (names.has(key(actor.name)) && isNPC(actor)) actorIds.add(actor.id);
  }
  return { names, actorIds };
}

function tokenMatches(tokenDoc, { names, actorIds }) {
  if (tokenDoc.actorId && actorIds.has(tokenDoc.actorId)) return true;
  return names.has(key(tokenDoc.name)) && isNPC(tokenDoc.actor);
}

/** Responsible GM: every token of a party-known NPC shows its name on hover. */
export async function syncNameplates() {
  if (!isResponsibleGM() || !store.ready() || !enabled()) return;
  const targets = knownTargets();
  if (!targets.names.size && !targets.actorIds.size) return;
  const HOVER = modes().HOVER;

  const actorUpdates = [];
  for (const id of targets.actorIds) {
    const actor = game.actors.get(id);
    if (actor && !showsToAll(actor.prototypeToken?.displayName)) actorUpdates.push({ _id: id, "prototypeToken.displayName": HOVER });
  }
  if (actorUpdates.length) await Actor.implementation.updateDocuments(actorUpdates);

  let tokens = 0;
  for (const scene of game.scenes) {
    const updates = scene.tokens
      .filter(t => tokenMatches(t, targets) && !showsToAll(t.displayName))
      .map(t => ({ _id: t.id, displayName: HOVER }));
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates);
    tokens += updates.length;
  }
  if (actorUpdates.length || tokens) {
    console.log(`${MODULE_ID} | names on hover: ${actorUpdates.length} prototype token(s), ${tokens} placed token(s)`);
  }
}

const queueSync = foundry.utils.debounce(() => {
  syncNameplates().catch(err => console.error(`${MODULE_ID} | nameplates`, err));
}, 600);

export function requestNameplateSync() {
  queueSync();
}

/** At init. */
export function registerNameplateHooks() {
  // A face was added for everyone, shared with the party, renamed or linked: catch up.
  Hooks.on("updateJournalEntry", (doc, changes) => {
    if (doc.getFlag(MODULE_ID, "store") !== "shared") return;
    if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.faces`)) queueSync();
  });
  // A token placed later (also one of another actor that carries a known name) gets it straight away.
  Hooks.on("preCreateToken", (tokenDoc) => {
    try {
      if (!game.user.isGM || !store.ready() || !enabled() || showsToAll(tokenDoc.displayName)) return;
      if (tokenMatches(tokenDoc, knownTargets())) tokenDoc.updateSource({ displayName: modes().HOVER });
    } catch (err) {
      console.error(`${MODULE_ID} | preCreateToken`, err);
    }
  });
}
