import { MODULE_ID, QUEST_LOG_ID, TEMPLATE_PATH, VISIBILITY, t, escapeHTML, isResponsibleGM } from "./util.js";
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
    game.modules.get(MODULE_ID).api = {
      open: () => ui.familiarfaces?.activate(),
      openFace: id => FaceSheet.open(id),
      addFace: prefill => addFaceDialog(prefill),
      bindImage: (src, options) => bindImageDialog(src, options),
      faces: () => store.allFaces(),
      getFace: store.getFace,
      findByName: store.findByName,
      canSeeFace: store.canSeeFace,
      createFace: store.createFace,
      updateFace: store.updateFace,
      addToken: token => {
        const doc = token?.document ?? token;
        return game.user.isGM ? addNpcForAll(npcFromToken(doc)) : addNpcForMe(npcFromToken(doc));
      },
      addActor: actor => addNpcForAll(npcFromActor(actor)),
      shareWithParty: store.shareWithParty,
      forgetFace: store.forgetFace,
      setImage: store.setImage,
      deleteFace: store.deleteFace,
      notes: store.notesFor,
      addNote: store.addNote,
      syncNameplates,
      // Places
      openPlaces: async () => {
        await game.settings.set(MODULE_ID, "activeList", "places");
        ui.familiarfaces?.activate();
        ui.familiarfaces?.render({ parts: ["tabs", "header", "filters", "list", "footer"] });
      },
      openPlace: id => PlaceSheet.open(id),
      addPlace: prefill => addPlaceDialog(prefill),
      bindPlaceImage: (src, options) => bindImageDialog(src, { ...options, kind: "places" }),
      places: () => store.allPlaces(),
      getPlace: store.getPlace,
      findPlaceByName: store.findPlaceByName,
      createPlace: store.createPlace,
      updatePlace: store.updatePlace,
      addScene: scene => addPlaceForAll(placeFromScene(scene)),
      sharePlaceWithParty: store.sharePlaceWithParty,
      forgetPlace: store.forgetPlace,
      setPlaceImage: store.setPlaceImage,
      deletePlace: store.deletePlace,
      placeNotes: store.placeNotesFor,
      addPlaceNote: store.addPlaceNote,
      linkFace: store.linkFace,
      unlinkFace: store.unlinkFace,
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
      bindFactionImage: (src, options) => bindImageDialog(src, { ...options, kind: "factions" }),
      factions: () => store.allFactions(),
      getFaction: store.getFaction,
      findFactionByName: store.findFactionByName,
      createFaction: store.createFaction,
      updateFaction: store.updateFaction,
      shareFactionWithParty: store.shareFactionWithParty,
      forgetFaction: store.forgetFaction,
      setFactionImage: store.setFactionImage,
      deleteFaction: store.deleteFaction,
      factionNotes: store.factionNotesFor,
      addFactionNote: store.addFactionNote,
      linkToFaction: store.linkToFaction,
      unlinkFromFaction: store.unlinkFromFaction,
      setFactionRole: store.setFactionRole,
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
