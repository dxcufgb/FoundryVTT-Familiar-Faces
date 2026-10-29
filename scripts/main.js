import {
  MODULE_ID, QUEST_LOG_ID, TEMPLATE_PATH, VISIBILITY, t, escapeHTML, isResponsibleGM, combatBlocks, mayAddFaces
} from "./util.js";
import * as store from "./store.js";
import { FacesTab, MODES, GROUP_MODES, PLACE_GROUP_MODES, FACTION_GROUP_MODES, SORT_MODES } from "./apps/faces-tab.js";
import { EntrySheet } from "./apps/entry-sheet.js";
import { FaceSheet } from "./apps/face-sheet.js";
import { PlaceSheet } from "./apps/place-sheet.js";
import { FactionSheet } from "./apps/faction-sheet.js";
import {
  registerContextMenus, registerPointerMenus, addFaceDialog, addPlaceDialog, addFactionDialog, bindImageDialog
} from "./capture.js";
import { registerNpcHooks, registerTokenMenu, addNpcForMe, addNpcForAll, npcFromToken, npcFromActor } from "./npcs.js";
import { registerPlaceHooks, addPlaceForAll, placeFromScene } from "./places.js";
import { registerNameplateHooks, requestNameplateSync, syncNameplates } from "./nameplates.js";
import { linkMentions, questLogTargets } from "./quest-links.js";
import { canPickPlaceholder, isPlaceholder } from "./placeholders.js";

/* -------------------------------------------- */
/*  Settings and the sidebar tab                */
/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(MODULE_ID, "notify", {
    name: "DXFF.Settings.Notify.Name",
    hint: "DXFF.Settings.Notify.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "playersCanAdd", {
    name: "DXFF.Settings.PlayersCanAdd.Name",
    hint: "DXFF.Settings.PlayersCanAdd.Hint",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: refreshAll
  });
  game.settings.register(MODULE_ID, "imageFolder", {
    name: "DXFF.Settings.ImageFolder.Name",
    hint: "DXFF.Settings.ImageFolder.Hint",
    scope: "world", config: true, type: String, default: ""
  });
  game.settings.register(MODULE_ID, "selectionMenu", {
    name: "DXFF.Settings.SelectionMenu.Name",
    hint: "DXFF.Settings.SelectionMenu.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "imageMenu", {
    name: "DXFF.Settings.ImageMenu.Name",
    hint: "DXFF.Settings.ImageMenu.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "tokenMenu", {
    name: "DXFF.Settings.TokenMenu.Name",
    hint: "DXFF.Settings.TokenMenu.Hint",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "knownNameplates", {
    name: "DXFF.Settings.KnownNameplates.Name",
    hint: "DXFF.Settings.KnownNameplates.Hint",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: value => { if (value) requestNameplateSync(); }
  });
  game.settings.register(MODULE_ID, "questLogLinks", {
    name: "DXFF.Settings.QuestLogLinks.Name",
    hint: "DXFF.Settings.QuestLogLinks.Hint",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "groupBy", {
    scope: "client", config: false, type: String, default: "none",
    choices: Object.fromEntries(GROUP_MODES.map(g => [g, g]))
  });
  game.settings.register(MODULE_ID, "sortBy", {
    scope: "client", config: false, type: String, default: "name",
    choices: Object.fromEntries(SORT_MODES.map(s => [s, s]))
  });
  game.settings.register(MODULE_ID, "placeGroupBy", {
    scope: "client", config: false, type: String, default: "none",
    choices: Object.fromEntries(PLACE_GROUP_MODES.map(g => [g, g]))
  });
  game.settings.register(MODULE_ID, "placeSortBy", {
    scope: "client", config: false, type: String, default: "name",
    choices: Object.fromEntries(SORT_MODES.map(s => [s, s]))
  });
  game.settings.register(MODULE_ID, "factionGroupBy", {
    scope: "client", config: false, type: String, default: "none",
    choices: Object.fromEntries(FACTION_GROUP_MODES.map(g => [g, g]))
  });
  game.settings.register(MODULE_ID, "factionSortBy", {
    scope: "client", config: false, type: String, default: "name",
    choices: Object.fromEntries(SORT_MODES.map(s => [s, s]))
  });
  game.settings.register(MODULE_ID, "activeList", {
    scope: "client", config: false, type: String, default: "faces",
    choices: Object.fromEntries(MODES.map(m => [m, m]))
  });
  game.settings.register(MODULE_ID, "lastVisibility", {
    scope: "client", config: false, type: String, default: "private",
    choices: Object.fromEntries(VISIBILITY.map(v => [v, v]))
  });
}

/** Adds the Familiar Faces & Places tab to the right sidebar, just before Game Settings. */
function registerSidebarTab() {
  const Sidebar = foundry.applications.sidebar.Sidebar;
  const tab = { tooltip: "DXFF.Title", icon: "fa-solid fa-masks-theater" };
  const tabs = {};
  for (const [id, config] of Object.entries(Sidebar.TABS)) {
    if (id === "settings") tabs.familiarfaces = tab;
    tabs[id] = config;
  }
  tabs.familiarfaces ??= tab;
  Sidebar.TABS = tabs;
  CONFIG.ui.familiarfaces = FacesTab;
}

function refreshAll() {
  ui.familiarfaces?.refresh();
  ui.familiarfaces?.popout?.refresh();
  EntrySheet.refreshAll();
}

/* -------------------------------------------- */
/*  Notifications                               */
/* -------------------------------------------- */

/** The notification texts of each kind (DXFF.* keys). */
const NOTIFY = {
  faces: { created: "NotifyCreated", sharedBy: "NotifySharedBy", image: "NotifyPortrait" },
  places: { created: "NotifyPlaceCreated", sharedBy: "NotifyPlaceSharedBy", image: "NotifyPicture" },
  factions: { created: "NotifyFactionCreated", sharedBy: "NotifyFactionSharedBy", image: "NotifyPicture" }
};

function notifyChange(event, userId) {
  if (!event?.type || userId === game.user.id || !game.settings.get(MODULE_ID, "notify")) return;
  const kind = store.kindOf(event.kind);
  // Only entries this user has in their lists; a player's own NPCs don't concern the GM or the other players.
  const entry = store.getEntry(kind, event.id ?? event.faceId);
  if (!entry) return;
  const texts = NOTIFY[kind];
  const by = escapeHTML(game.users.get(userId)?.name ?? "");
  const name = escapeHTML(entry.name);
  if (event.type === "created") {
    if (!entry.knownBy) ui.notifications.info(t(texts.created, { name }));
  } else if (event.type === "known") {
    // Something some players knew was shared with the whole party: new for everyone who didn't have it. When a player
    // shared it, the GM hears about it too, and everyone is told who it was.
    if (entry.knownBy) return;
    const before = Array.isArray(event.before) ? event.before : [];
    const sharer = game.users.get(event.sharedBy);
    const byPlayer = !!sharer && !sharer.isGM;
    const sharedText = () => t(texts.sharedBy, { name, by: escapeHTML(sharer.name) });
    if (game.user.isGM) {
      if (byPlayer) ui.notifications.info(sharedText());
    } else if (!before.includes(game.user.id)) {
      ui.notifications.info(byPlayer ? sharedText() : t(texts.created, { name }));
    }
  } else if (event.type === "image") ui.notifications.info(t(texts.image, { name }));
  else if (event.type === "note") {
    // Only tell the players the note was meant for.
    const mine = !event.sharedWith?.length || event.sharedWith.includes(game.user.id);
    if (mine && !game.user.isGM) ui.notifications.info(t("NotifyNote", { name, by }));
  }
}

/* -------------------------------------------- */
/*  API permission checks                       */
/* -------------------------------------------- */

/*
 * The API checks what the module's own windows check, so a player's macro can't do more than the player could in the
 * tab. A refusal warns and returns null (creating, adding a note) or false (everything else); it never throws. GMs
 * may do everything. The store functions themselves stay unchecked for the module's own callers.
 */

const GONE_TEXT = { faces: "FaceGone", places: "PlaceGone", factions: "FactionGone" };
/** Fields only a GM may set through update…: the edit form of a player has name, info and metAt/region/category. */
const GM_FIELDS = ["source", "actor", "scene"];

function refuse(key, data) {
  ui.notifications.warn(t(key, data));
}

/** The entry when the user has it in their lists; otherwise warns that it's gone (as the windows do). */
function visibleEntry(kind, id) {
  const entry = store.getEntry(kind, id);
  if (!entry) refuse(GONE_TEXT[kind]);
  return entry;
}

const nameOf = entry => ({ name: escapeHTML(entry.name) });

/** A player may set a placeholder look (or clear one) on an entry they may edit while it has no real picture. */
function mayPickLook(entry, src) {
  if (game.user.isGM) return true;
  if (!canPickPlaceholder(entry, store.canEditEntry(entry))) return false;
  return isPlaceholder(src) || (!src && isPlaceholder(entry.img));
}

function gmOnly(fn) {
  return (...args) => {
    if (!game.user.isGM) {
      refuse("Api.GMOnly");
      return null;
    }
    return fn(...args);
  };
}

/** Players add to their own list (knownBy: just them), or for the party when the GM allows it. */
function apiCreate(kind) {
  return async (data = {}) => {
    if (!game.user.isGM) {
      const knownBy = Array.isArray(data?.knownBy) ? [...new Set(data.knownBy.filter(Boolean))] : [];
      const ownList = knownBy.length > 0 && knownBy.every(userId => userId === game.user.id);
      if (kind === "faces" && combatBlocks()) {
        refuse("InCombat");
        return null;
      }
      if (knownBy.length && !ownList) {
        refuse("Api.OnlyOwnList");
        return null;
      }
      if (!ownList && !mayAddFaces()) {
        refuse("CannotAdd");
        return null;
      }
    }
    return store.createEntry(kind, data);
  };
}

/** The GM or the entry's creator; a player only the fields of their edit form, and a picture only as a look. */
function apiUpdate(kind) {
  return async (id, changes = {}) => {
    const entry = visibleEntry(kind, id);
    if (!entry) return false;
    if (!store.canEditEntry(entry)) {
      refuse("Api.CannotEdit", nameOf(entry));
      return false;
    }
    if (!changes || typeof changes !== "object") changes = {};
    if (!game.user.isGM && GM_FIELDS.some(key => key in changes)) {
      refuse("Api.GMOnly");
      return false;
    }
    if ("img" in changes && !mayPickLook(entry, changes.img)) {
      refuse("Api.ImageGMOnly");
      return false;
    }
    await store.updateEntry(kind, id, changes);
    return true;
  };
}

function apiSetImage(kind) {
  return async (id, src) => {
    const entry = visibleEntry(kind, id);
    if (!entry) return false;
    if (!mayPickLook(entry, src)) {
      refuse("Api.ImageGMOnly");
      return false;
    }
    await store.setEntryImage(kind, id, src);
    return true;
  };
}

function apiDelete(kind) {
  return async id => {
    const entry = visibleEntry(kind, id);
    if (!entry) return false;
    if (!store.canDeleteEntry(entry)) {
      refuse("Api.CannotDelete", nameOf(entry));
      return false;
    }
    await store.deleteEntry(kind, id);
    return true;
  };
}

function apiShare(kind) {
  return async id => {
    const entry = store.getEntry(kind, id, { any: game.user.isGM });
    if (!entry) {
      refuse(GONE_TEXT[kind]);
      return false;
    }
    if (!entry.knownBy) return false;
    if (kind === "faces" && combatBlocks()) {
      refuse("InCombat");
      return false;
    }
    if (!store.canShareEntry(entry)) {
      refuse("Api.CannotShare", nameOf(entry));
      return false;
    }
    return store.shareEntryWithParty(kind, id);
  };
}

function apiForget(kind) {
  return async id => {
    const entry = visibleEntry(kind, id);
    if (!entry) return false;
    if (!store.canForgetEntry(entry)) {
      refuse("Api.CannotForget", nameOf(entry));
      return false;
    }
    return store.forgetEntry(kind, id);
  };
}

/** Notes only about entries the user has in their lists, as in the windows. */
function apiAddNote(kind) {
  return async (id, data) => {
    if (!visibleEntry(kind, id)) return null;
    return store.addEntryNote(kind, id, data);
  };
}

async function apiLinkFace(placeId, faceId) {
  const place = visibleEntry("places", placeId);
  const face = place ? visibleEntry("faces", faceId) : null;
  if (!place || !face) return false;
  if (!store.canLink(place, face)) {
    refuse("Api.CannotLink");
    return false;
  }
  return store.linkFace(placeId, faceId);
}

async function apiUnlinkFace(placeId, faceId) {
  const place = visibleEntry("places", placeId);
  const link = place?.links.find(l => l.faceId === faceId);
  if (!link) return false;
  if (!store.canUnlink(place, link)) {
    refuse("Api.CannotUnlink", nameOf(place));
    return false;
  }
  return store.unlinkFace(placeId, faceId);
}

async function apiLinkToFaction(factionId, kind, id, role) {
  kind = store.kindOf(kind);
  if (kind === "factions") return false;
  const faction = visibleEntry("factions", factionId);
  const entry = faction ? visibleEntry(kind, id) : null;
  if (!faction || !entry) return false;
  if (!store.canLinkFaction(faction, entry)) {
    refuse("Api.CannotLink");
    return false;
  }
  return store.linkToFaction(factionId, kind, id, role);
}

/** Changing a role or removing a faction link: its maker, the faction's editor or a GM. */
function apiFactionLinkChange(change) {
  return async (factionId, kind, id, ...rest) => {
    const faction = visibleEntry("factions", factionId);
    const link = store.factionLinkOf(faction, kind, id);
    if (!faction || !link) return false;
    if (!store.canUnlinkFaction(faction, link)) {
      refuse("Api.CannotUnlink", nameOf(faction));
      return false;
    }
    return change(factionId, kind, id, ...rest);
  };
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  registerSidebarTab();
  registerContextMenus();
  registerNpcHooks();
  registerPlaceHooks();
  registerNameplateHooks();
  foundry.applications.handlebars.loadTemplates([
    `${TEMPLATE_PATH}/visibility.hbs`, `${TEMPLATE_PATH}/notes.hbs`, `${TEMPLATE_PATH}/portrait.hbs`,
    `${TEMPLATE_PATH}/link-list.hbs`
  ]);
});

Hooks.once("ready", async () => {
  try {
    registerPointerMenus();
    registerTokenMenu();
    await store.ensureStores();
    refreshAll();
    requestNameplateSync();
    // Every data call checks the user's permissions first (see "API permission checks" above).
    game.modules.get(MODULE_ID).api = {
      open: () => ui.familiarfaces?.activate(),
      openFace: id => FaceSheet.open(id),
      addFace: prefill => addFaceDialog(prefill),
      bindImage: gmOnly((src, options) => bindImageDialog(src, options)),
      faces: () => store.allFaces(),
      getFace: store.getFace,
      findByName: store.findByName,
      canSeeEntry: store.canSeeEntry,
      canSeeFace: store.canSeeEntry,
      createFace: apiCreate("faces"),
      updateFace: apiUpdate("faces"),
      addToken: token => {
        const doc = token?.document ?? token;
        return game.user.isGM ? addNpcForAll(npcFromToken(doc)) : addNpcForMe(npcFromToken(doc));
      },
      addActor: gmOnly(actor => addNpcForAll(npcFromActor(actor))),
      shareWithParty: apiShare("faces"),
      forgetFace: apiForget("faces"),
      setImage: apiSetImage("faces"),
      deleteFace: apiDelete("faces"),
      notes: store.notesFor,
      addNote: apiAddNote("faces"),
      syncNameplates,
      // Places
      openPlaces: async () => {
        await game.settings.set(MODULE_ID, "activeList", "places");
        ui.familiarfaces?.activate();
        ui.familiarfaces?.render({ parts: ["tabs", "header", "filters", "list", "footer"] });
      },
      openPlace: id => PlaceSheet.open(id),
      addPlace: prefill => addPlaceDialog(prefill),
      bindPlaceImage: gmOnly((src, options) => bindImageDialog(src, { ...options, kind: "places" })),
      places: () => store.allPlaces(),
      getPlace: store.getPlace,
      findPlaceByName: store.findPlaceByName,
      createPlace: apiCreate("places"),
      updatePlace: apiUpdate("places"),
      addScene: gmOnly(scene => addPlaceForAll(placeFromScene(scene))),
      sharePlaceWithParty: apiShare("places"),
      forgetPlace: apiForget("places"),
      setPlaceImage: apiSetImage("places"),
      deletePlace: apiDelete("places"),
      placeNotes: store.placeNotesFor,
      addPlaceNote: apiAddNote("places"),
      linkFace: apiLinkFace,
      unlinkFace: apiUnlinkFace,
      facesOfPlace: id => store.facesOfPlace(store.getPlace(id)).map(found => found.face),
      placesOfFace: id => store.placesOfFace(store.getFace(id)).map(found => found.place),
      // Factions
      openFactions: async () => {
        await game.settings.set(MODULE_ID, "activeList", "factions");
        ui.familiarfaces?.activate();
        ui.familiarfaces?.render({ parts: ["tabs", "header", "filters", "list", "footer"] });
      },
      openFaction: id => FactionSheet.open(id),
      addFaction: prefill => addFactionDialog(prefill),
      bindFactionImage: gmOnly((src, options) => bindImageDialog(src, { ...options, kind: "factions" })),
      factions: () => store.allFactions(),
      getFaction: store.getFaction,
      findFactionByName: store.findFactionByName,
      createFaction: apiCreate("factions"),
      updateFaction: apiUpdate("factions"),
      shareFactionWithParty: apiShare("factions"),
      forgetFaction: apiForget("factions"),
      setFactionImage: apiSetImage("factions"),
      deleteFaction: apiDelete("factions"),
      factionNotes: store.factionNotesFor,
      addFactionNote: apiAddNote("factions"),
      linkToFaction: apiLinkToFaction,
      unlinkFromFaction: apiFactionLinkChange(store.unlinkFromFaction),
      setFactionRole: apiFactionLinkChange(store.setFactionRole),
      membersOfFaction: id => store.membersOfFaction(store.getFaction(id), "faces").map(({ entry, link }) => ({ face: entry, role: link.role })),
      placesOfFaction: id => store.membersOfFaction(store.getFaction(id), "places").map(({ entry, link }) => ({ place: entry, role: link.role })),
      factionsOf: (kind, id) => store.factionsOf(store.getEntry(kind, id)).map(({ faction, link }) => ({ faction, role: link.role })),
      // Dxcufgb's Quest log: the links a new note would get
      linkQuestLog: text => linkMentions(text, questLogTargets())
    };
  } catch (err) {
    console.error(`${MODULE_ID} | ready`, err);
  }
});

for (const hook of ["createJournalEntry", "deleteJournalEntry"]) {
  Hooks.on(hook, doc => {
    if (store.isStore(doc)) refreshAll();
  });
}

Hooks.on("updateJournalEntry", (doc, changes, options, userId) => {
  try {
    if (!store.isStore(doc)) return;
    refreshAll();
    notifyChange(options?.[MODULE_ID], userId);
  } catch (err) {
    console.error(`${MODULE_ID} | updateJournalEntry`, err);
  }
});

// Every user gets a private store for their private notes.
Hooks.on("createUser", user => {
  store.ensurePrivateStore(user).catch(err => console.error(`${MODULE_ID} | private store`, err));
});

// The responsible GM changed (the first GM logged out): make sure the stores exist.
Hooks.on("userConnected", () => {
  if (isResponsibleGM()) store.ensureStores().catch(err => console.error(`${MODULE_ID} | stores`, err));
});

// Keep the storage journals out of the Journal directory; they're managed from the Familiar Faces & Places tab.
Hooks.on("renderJournalDirectory", (app, html) => {
  try {
    const root = html instanceof HTMLElement ? html : html?.[0];
    for (const id of store.storeIds()) root?.querySelector(`[data-entry-id="${id}"]`)?.remove();
  } catch (err) {
    console.error(`${MODULE_ID} | renderJournalDirectory`, err);
  }
});

// Quest log changes: the notes' @Quest / @Reward / @PartyNote links show the current names.
Hooks.on("updateJournalEntry", doc => {
  try {
    if (!game.modules.get(QUEST_LOG_ID)?.active) return;
    if (doc.getFlag(QUEST_LOG_ID, "store")) EntrySheet.refreshAll();
  } catch (err) {
    console.error(`${MODULE_ID} | quest log refresh`, err);
  }
});

// Combat starting or ending turns adding and sharing off and on for players (header: the Add face button).
function onCombatChange() {
  if (game.user.isGM) return;
  for (const app of [ui.familiarfaces, ui.familiarfaces?.popout]) {
    if (app?.rendered) app.render({ parts: ["tabs", "header", "filters", "list", "footer"] });
  }
  EntrySheet.refreshAll();
}
Hooks.on("combatStart", onCombatChange);
Hooks.on("deleteCombat", onCombatChange);
Hooks.on("updateCombat", (combat, changes) => {
  if ("round" in changes || "active" in changes) onCombatChange();
});

// User names and colours show on notes.
Hooks.on("updateUser", (user, changes) => {
  if ("name" in changes || "color" in changes) EntrySheet.refreshAll();
});

// A place shows the name of its scene.
for (const hook of ["updateScene", "deleteScene"]) {
  Hooks.on(hook, () => {
    try {
      EntrySheet.refreshAll({ kind: "places" });
    } catch (err) {
      console.error(`${MODULE_ID} | ${hook}`, err);
    }
  });
}
