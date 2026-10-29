import {
  MODULE_ID, TEMPLATE_PATH, t, nameHue, initials, canAddFaces, canAddPlaces, canAddFactions, mayAddFaces, combatBlocks, userInfo
} from "../util.js";
import * as store from "../store.js";
import { tokenize, matchFace, matchPlace, matchFaction, highlight } from "../search.js";
import { EntrySheet } from "./entry-sheet.js";
import { FaceSheet } from "./face-sheet.js";
import { PlaceSheet } from "./place-sheet.js";
import { FactionSheet } from "./faction-sheet.js";
import { addEntryDialog } from "../capture.js";
import { addMetFaceDialog } from "../npcs.js";
import { addVisitedPlaceDialog } from "../places.js";
import { addKnownFactionDialog } from "../factions.js";
import { avatarClass } from "../pickers.js";
import { browseImage, shareImage } from "../images.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export const MODES = ["faces", "places", "factions"];
export const GROUP_MODES = ["none", "place"];
export const PLACE_GROUP_MODES = ["none", "region"];
export const FACTION_GROUP_MODES = ["none", "category"];
export const SORT_MODES = ["name", "recent"];
const UNKNOWN = "\u0000unknown";

/** The settings and texts (DXFF.* keys) of each list. */
const MODE = {
  faces: {
    groupSetting: "groupBy", sortSetting: "sortBy", groups: GROUP_MODES, icon: "fa-solid fa-masks-theater",
    sheet: () => FaceSheet, canAdd: canAddFaces, addMet: () => addMetFaceDialog(),
    add: "AddFace", addHint: "AddFaceHint", addIcon: "fa-solid fa-user-plus", searchPlaceholder: "SearchPlaceholder",
    search: "Search", met: "AddMet", metHint: "AddMetHint", metIcon: "fa-solid fa-user-plus", countHint: "CountHint",
    emptyGM: "EmptyGM", emptyPlayer: "EmptyPlayer", noMatches: "NoMatches", unknownGroup: "UnknownPlace",
    groupIcon: "fa-solid fa-location-dot", chipTooltip: "FilterPlace", shareHint: "ShareWithPartyHint"
  },
  places: {
    groupSetting: "placeGroupBy", sortSetting: "placeSortBy", groups: PLACE_GROUP_MODES, icon: "fa-solid fa-map-location-dot",
    sheet: () => PlaceSheet, canAdd: canAddPlaces, addMet: () => addVisitedPlaceDialog(),
    add: "AddPlace", addHint: "AddPlaceHint", addIcon: "fa-solid fa-map-pin", searchPlaceholder: "SearchPlacesPlaceholder",
    search: "SearchPlaces", met: "AddVisited", metHint: "AddVisitedHint", metIcon: "fa-solid fa-map-pin", countHint: "PlaceCountHint",
    emptyGM: "EmptyPlacesGM", emptyPlayer: "EmptyPlacesPlayer", noMatches: "NoPlaceMatches", unknownGroup: "UnknownRegion",
    groupIcon: "fa-solid fa-map", chipTooltip: "FilterRegion", shareHint: "SharePlaceWithPartyHint"
  },
  factions: {
    groupSetting: "factionGroupBy", sortSetting: "factionSortBy", groups: FACTION_GROUP_MODES, icon: "fa-solid fa-shield-halved",
    sheet: () => FactionSheet, canAdd: canAddFactions, addMet: () => addKnownFactionDialog(),
    add: "AddFaction", addHint: "AddFactionHint", addIcon: "fa-solid fa-shield-halved", searchPlaceholder: "SearchFactionsPlaceholder",
    search: "SearchFactions", met: "AddKnownFaction", metHint: "AddKnownFactionHint", metIcon: "fa-solid fa-shield-halved",
    countHint: "FactionCountHint", emptyGM: "EmptyFactionsGM", emptyPlayer: "EmptyFactionsPlayer", noMatches: "NoFactionMatches",
    unknownGroup: "UnknownCategory", groupIcon: "fa-solid fa-tag", chipTooltip: "FilterCategory", shareHint: "ShareFactionWithPartyHint"
  }
};

/** The kind of a list element (data-kind). */
const kindOfEl = li => MODES.includes(li.dataset.kind) ? li.dataset.kind : "faces";

/** The Familiar Faces & Places tab in the right sidebar (and its pop-out): a list of NPCs and a list of places. */
export class FacesTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = "familiarfaces";

  static DEFAULT_OPTIONS = {
    classes: ["dxff", "dxff-tab", "flexcol"],
    window: { title: "DXFF.Title", icon: "fa-solid fa-masks-theater" },
    actions: {
      switchTab: FacesTab.#onSwitchTab,
      addFace: FacesTab.#onAddEntry,
      openFace: FacesTab.#onOpenEntry,
      toggleGroup: FacesTab.#onToggleGroup,
      clearSearch: FacesTab.#onClearSearch,
      filterPlace: FacesTab.#onFilterPlace,
      shareFace: FacesTab.#onShareEntry,
      addMet: FacesTab.#onAddMet
    }
  };

  static PARTS = {
    tabs: { template: `${TEMPLATE_PATH}/tab-nav.hbs` },
    header: { template: `${TEMPLATE_PATH}/tab-header.hbs` },
    filters: { template: `${TEMPLATE_PATH}/tab-filters.hbs` },
    list: { template: `${TEMPLATE_PATH}/tab-list.hbs`, scrollable: [""] },
    footer: { template: `${TEMPLATE_PATH}/tab-footer.hbs` }
  };

  /** Free-text search of each list, shared by the sidebar tab and its pop-out. */
  static searches = { faces: "", places: "", factions: "" };
  static collapsed = new Set();

  /** Search of the faces list (as in earlier versions). */
  static get search() {
    return FacesTab.searches.faces;
  }

  static set search(value) {
    FacesTab.searches.faces = value;
  }

  /** Which list is shown: "faces" or "places". */
  static get mode() {
    const mode = game.settings.get(MODULE_ID, "activeList");
    return MODES.includes(mode) ? mode : "faces";
  }

  get mode() {
    return FacesTab.mode;
  }

  get groupBy() {
    const config = MODE[this.mode];
    const value = game.settings.get(MODULE_ID, config.groupSetting);
    return config.groups.includes(value) ? value : "none";
  }

  get sortBy() {
    return game.settings.get(MODULE_ID, MODE[this.mode].sortSetting);
  }

  /** Re-renders the parts that depend on data (the search box keeps focus and text). */
  refresh() {
    if (!this.rendered) return;
    this.render({ parts: ["tabs", "filters", "list", "footer"] });
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const ready = store.ready();
    const mode = this.mode;
    const terms = tokenize(FacesTab.searches[mode]);
    const faces = ready ? store.allFaces() : [];
    const places = ready ? store.allPlaces() : [];
    const factions = ready ? store.allFactions() : [];
    const notesByFace = ready ? store.visibleNotesByFace() : new Map();
    const config = MODE[mode];

    const found = [];
    if (mode === "faces") {
      // The places and factions an NPC is linked to by hand are searchable too.
      const linkedNames = new Map();
      const addName = (faceId, name) => {
        if (!linkedNames.has(faceId)) linkedNames.set(faceId, []);
        linkedNames.get(faceId).push(name);
      };
      for (const place of places) for (const link of place.links) addName(link.faceId, place.name);
      for (const faction of factions) for (const link of faction.links) addName(link.faceId, faction.name);
      for (const face of faces) {
        const notes = notesByFace.get(face.id) ?? [];
        const match = matchFace(face, notes, terms, linkedNames.get(face.id) ?? []);
        if (match) found.push({ entry: face, notes, snippet: match.snippet });
      }
    } else if (mode === "places") {
      const notesByPlace = ready ? store.visibleNotesByPlace() : new Map();
      for (const place of places) {
        const notes = notesByPlace.get(place.id) ?? [];
        const people = store.facesOfPlace(place, faces, notesByFace);
        const factionNames = store.factionsOf(place, factions).map(f => f.faction.name);
        const match = matchPlace(place, notes, terms, [...people.map(p => p.face.name), ...factionNames]);
        if (match) found.push({ entry: place, notes, people, snippet: match.snippet });
      }
    } else {
      const notesByFaction = ready ? store.visibleNotesByFaction() : new Map();
      for (const faction of factions) {
        const notes = notesByFaction.get(faction.id) ?? [];
        const members = store.membersOfFaction(faction, "faces", faces);
        const homes = store.membersOfFaction(faction, "places", places);
        const names = [...members, ...homes].flatMap(({ entry, link }) => [entry.name, link.role]);
        const match = matchFaction(faction, notes, terms, names);
        if (match) found.push({ entry: faction, notes, people: members, homes, snippet: match.snippet });
      }
    }

    const counts = { faces: faces.length, places: places.length, factions: factions.length };
    const total = counts[mode];
    const canAdd = config.canAdd();
    const groupBy = this.groupBy;
    Object.assign(context, {
      ready,
      mode,
      isPlaces: mode === "places",
      tabs: MODES.map(id => ({
        id, active: id === mode, icon: MODE[id].icon, label: t(`Tabs.${id}`), count: counts[id]
      })),
      isGM: game.user.isGM,
      canAdd,
      addBlocked: mode === "faces" && mayAddFaces() && combatBlocks(),
      addLabel: t(config.add),
      addHint: t(config.addHint),
      addIcon: config.addIcon,
      searchPlaceholder: t(config.searchPlaceholder),
      searchLabel: t(config.search),
      canAddMet: !game.user.isGM && ready,
      metBlocked: mode === "faces" && combatBlocks(),
      metLabel: t(config.met),
      metHint: t(config.metHint),
      metIcon: config.metIcon,
      search: FacesTab.searches[mode],
      searching: terms.length > 0,
      groupBy,
      sortBy: this.sortBy,
      groupOptions: Object.fromEntries(MODE[mode].groups.map(g => [g, t(`GroupBy.${g}`)])),
      sortOptions: Object.fromEntries(SORT_MODES.map(s => [s, t(`SortBy.${s}`)])),
      shown: found.length,
      total,
      totalIcon: MODE[mode].icon,
      countHint: t(config.countHint),
      groups: this.#group(found, terms, groupBy),
      emptyIcon: MODE[mode].icon,
      emptyMessage: !total ? t(canAdd ? config.emptyGM : config.emptyPlayer) : t(config.noMatches)
    });
    return context;
  }

  /**
   * Where a face was met: its "First met at", or else the place of the earliest note that has one. One place per
   * face, so a face is listed once when grouped by place; the places in notes stay searchable.
   */
  static placeOf(face, notes) {
    return face.metAt || notes.find(n => n.place)?.place || "";
  }

  /** Tooltip for a face or place only some players have: who they are. */
  static knownByLabel(entry) {
    if (!entry.knownBy) return "";
    const names = entry.knownBy.map(id => id === game.user.id ? t("You") : userInfo(id).name);
    const key = { faces: "KnownBy", places: "KnownByPlace", factions: "KnownByFaction" }[entry.kind] ?? "KnownBy";
    return t(key, { names: names.join(", ") || "—" });
  }

  /** What a list entry is grouped under: where a face was met, the region of a place, or the kind of a faction. */
  static groupOf({ entry, notes }) {
    if (entry.kind === "places") return entry.region;
    if (entry.kind === "factions") return entry.category;
    return FacesTab.placeOf(entry, notes);
  }

  #card({ entry, notes, people, homes, snippet }, terms) {
    const config = MODE[entry.kind] ?? MODE.faces;
    const chip = FacesTab.groupOf({ entry, notes });
    const mine = notes.filter(n => n.createdBy === game.user.id).length;
    const factions = entry.kind === "factions";
    return {
      kind: entry.kind,
      avatarClass: avatarClass(entry.kind),
      knownBy: FacesTab.knownByLabel(entry),
      canShare: store.canShareEntry(entry),
      shareHint: t(config.shareHint),
      id: entry.id,
      name: entry.name,
      nameHTML: highlight(entry.name, terms),
      img: entry.img,
      initials: initials(entry.name),
      hue: nameHue(entry.name),
      chips: chip ? [{ name: chip, html: highlight(chip, terms), icon: config.groupIcon, tooltip: t(config.chipTooltip) }] : [],
      peopleCount: people?.length ?? 0,
      peopleHint: people?.length ? t(factions ? "MemberCountHint" : "PeopleCountHint", { count: people.length }) : "",
      placeCount: homes?.length ?? 0,
      placeHint: homes?.length ? t("FactionPlaceCountHint", { count: homes.length }) : "",
      noteCount: notes.length,
      mineCount: mine,
      othersCount: notes.length - mine,
      snippet
    };
  }

  static lastActivity(item) {
    return Math.max(item.entry.updatedAt || 0, item.entry.createdAt || 0, ...item.notes.map(n => n.editedAt || n.createdAt || 0));
  }

  #group(items, terms, groupBy) {
    const byName = (a, b) => a.entry.name.localeCompare(b.entry.name, undefined, { numeric: true, sensitivity: "base" });
    items.sort(this.sortBy === "recent"
      ? (a, b) => (FacesTab.lastActivity(b) - FacesTab.lastActivity(a)) || byName(a, b)
      : byName);
    if (groupBy === "none") {
      return items.length ? [{ key: "all", label: null, faces: items.map(e => this.#card(e, terms)) }] : [];
    }
    const groups = new Map();
    for (const item of items) {
      const place = FacesTab.groupOf(item);
      const key = `${this.mode}:${place ? place.toLowerCase() : UNKNOWN}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label: place || t(MODE[this.mode].unknownGroup), unknown: !place, faces: [] });
      }
      groups.get(key).faces.push(this.#card(item, terms));
    }
    return [...groups.values()]
      .sort((a, b) => (a.unknown - b.unknown) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
      .map(g => ({ ...g, count: g.faces.length, collapsed: FacesTab.collapsed.has(g.key), groupIcon: MODE[this.mode].groupIcon }));
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);
    const input = this.element.querySelector("input[name=search]");
    if (input && options.parts?.includes("header")) {
      input.addEventListener("input", foundry.utils.debounce(event => {
        FacesTab.searches[FacesTab.mode] = event.target.value;
        FacesTab.renderAllLists(this);
      }, 150));
      input.addEventListener("keydown", event => {
        if (event.key === "Escape" && input.value) {
          event.preventDefault();
          event.stopPropagation();
          input.value = "";
          FacesTab.searches[FacesTab.mode] = "";
          FacesTab.renderAllLists(this);
        }
      });
    }
    if (options.parts?.includes("filters")) {
      for (const name of ["groupBy", "sortBy"]) {
        this.element.querySelector(`select[name=${name}]`)?.addEventListener("change", async event => {
          const config = MODE[FacesTab.mode];
          await game.settings.set(MODULE_ID, name === "groupBy" ? config.groupSetting : config.sortSetting, event.target.value);
          FacesTab.renderAllLists();
        });
      }
    }
    if (!this._dxffMenu) {
      this._dxffMenu = true;
      new foundry.applications.ux.ContextMenu.implementation(this.element, ".dxff-face[data-entry-id]", FacesTab.#entryMenu(), {
        jQuery: false, fixed: true
      });
    }
  }

  /** The tab and its pop-out keep the same search; re-render both lists. */
  static renderAllLists(source = null) {
    const mode = FacesTab.mode;
    for (const app of [ui.familiarfaces, ui.familiarfaces?.popout]) {
      if (!app?.rendered) continue;
      const input = app.element.querySelector("input[name=search]");
      if (app !== source && input && input.value !== FacesTab.searches[mode]) input.value = FacesTab.searches[mode];
      app.render({ parts: ["filters", "list"] });
    }
  }

  static #entryMenu() {
    const kindOf = kindOfEl;
    const entry = li => store.getEntry(kindOf(li), li.dataset.entryId);
    const sheet = li => MODE[kindOf(li)].sheet();
    return [
      {
        name: "DXFF.Open", icon: '<i class="fa-solid fa-address-card"></i>',
        callback: li => sheet(li).open(li.dataset.entryId)
      },
      {
        name: "DXFF.ChangePortrait", icon: '<i class="fa-solid fa-image-portrait"></i>',
        condition: li => game.user.isGM && kindOf(li) === "faces" && !!entry(li),
        callback: async li => {
          const path = await browseImage(entry(li)?.img);
          if (path) await store.setEntryImage(kindOf(li), li.dataset.entryId, path);
        }
      },
      {
        name: "DXFF.ChangePicture", icon: '<i class="fa-solid fa-image"></i>',
        condition: li => game.user.isGM && kindOf(li) !== "faces" && !!entry(li),
        callback: async li => {
          const path = await browseImage(entry(li)?.img);
          if (path) await store.setEntryImage(kindOf(li), li.dataset.entryId, path);
        }
      },
      {
        name: "DXFF.ShowPortrait", icon: '<i class="fa-solid fa-eye"></i>',
        condition: li => game.user.isGM && kindOf(li) === "faces" && !!entry(li)?.img,
        callback: li => {
          const e = entry(li);
          if (e?.img) shareImage(e.img, e.name);
        }
      },
      {
        name: "DXFF.ShowPicture", icon: '<i class="fa-solid fa-eye"></i>',
        condition: li => game.user.isGM && kindOf(li) !== "faces" && !!entry(li)?.img,
        callback: li => {
          const e = entry(li);
          if (e?.img) shareImage(e.img, e.name);
        }
      },
      {
        name: "DXFF.RemovePortrait", icon: '<i class="fa-solid fa-image"></i>',
        condition: li => game.user.isGM && kindOf(li) === "faces" && !!entry(li)?.img,
        callback: li => store.setEntryImage("faces", li.dataset.entryId, "")
      },
      {
        name: "DXFF.RemovePicture", icon: '<i class="fa-solid fa-image"></i>',
        condition: li => game.user.isGM && kindOf(li) !== "faces" && !!entry(li)?.img,
        callback: li => store.setEntryImage(kindOf(li), li.dataset.entryId, "")
      },
      {
        name: "DXFF.ShareWithParty", icon: '<i class="fa-solid fa-users"></i>',
        condition: li => store.canShareEntry(entry(li)),
        callback: li => sheet(li).shareWithParty(li.dataset.entryId)
      },
      {
        name: "DXFF.ForgetFace", icon: '<i class="fa-solid fa-user-minus"></i>',
        condition: li => kindOf(li) === "faces" && store.canForgetEntry(entry(li)),
        callback: li => FaceSheet.confirmForget(li.dataset.entryId)
      },
      {
        name: "DXFF.ForgetPlace", icon: '<i class="fa-solid fa-map-pin"></i>',
        condition: li => kindOf(li) === "places" && store.canForgetEntry(entry(li)),
        callback: li => PlaceSheet.confirmForget(li.dataset.entryId)
      },
      {
        name: "DXFF.ForgetFaction", icon: '<i class="fa-solid fa-eye-slash"></i>',
        condition: li => kindOf(li) === "factions" && store.canForgetEntry(entry(li)),
        callback: li => FactionSheet.confirmForget(li.dataset.entryId)
      },
      {
        name: "DXFF.DeleteFace", icon: '<i class="fa-solid fa-trash"></i>',
        condition: li => store.canDeleteEntry(entry(li)),
        callback: li => sheet(li).confirmDelete(li.dataset.entryId)
      }
    ];
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Switches between the faces, the places and the factions, in the tab and its pop-out. */
  static async #onSwitchTab(event, target) {
    const mode = target.dataset.tab;
    if (!MODES.includes(mode) || mode === FacesTab.mode) return;
    await game.settings.set(MODULE_ID, "activeList", mode);
    for (const app of [ui.familiarfaces, ui.familiarfaces?.popout]) {
      if (app?.rendered) app.render({ parts: ["tabs", "header", "filters", "list", "footer"] });
    }
  }

  static #onAddEntry() {
    if (!store.ready()) return ui.notifications.warn(t("NotReady"));
    addEntryDialog(FacesTab.mode, {});
  }

  static #onAddMet() {
    MODE[FacesTab.mode].addMet();
  }

  static #onOpenEntry(event, target) {
    const el = target.closest("[data-entry-id]");
    if (el) EntrySheet.openEntry(kindOfEl(el), el.dataset.entryId);
  }

  static #onToggleGroup(event, target) {
    const key = target.closest("[data-group]").dataset.group;
    if (FacesTab.collapsed.has(key)) FacesTab.collapsed.delete(key);
    else FacesTab.collapsed.add(key);
    FacesTab.renderAllLists();
  }

  /** A place (or region, or kind of faction) on a card: show only what is there. */
  static #onFilterPlace(event, target) {
    event.stopPropagation();
    const place = target.dataset.place;
    const mode = FacesTab.mode;
    FacesTab.searches[mode] = FacesTab.searches[mode].trim().toLowerCase() === `"${place}"`.toLowerCase() ? "" : `"${place}"`;
    FacesTab.renderAllLists();
  }

  static #onShareEntry(event, target) {
    event.stopPropagation();
    const el = target.closest("[data-entry-id]");
    if (!el) return;
    MODE[kindOfEl(el)].sheet().shareWithParty(el.dataset.entryId);
  }

  static #onClearSearch() {
    FacesTab.searches[FacesTab.mode] = "";
    FacesTab.renderAllLists();
  }
}
