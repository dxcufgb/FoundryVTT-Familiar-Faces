import { MODULE_ID, TEMPLATE_PATH, t, nameHue, initials, canAddFaces, canAddPlaces, mayAddFaces, combatBlocks, userInfo } from "../util.js";
import * as store from "../store.js";
import { tokenize, matchFace, matchPlace, highlight } from "../search.js";
import { EntrySheet } from "./entry-sheet.js";
import { FaceSheet } from "./face-sheet.js";
import { PlaceSheet } from "./place-sheet.js";
import { addFaceDialog, addPlaceDialog } from "../capture.js";
import { addMetFaceDialog } from "../npcs.js";
import { addVisitedPlaceDialog } from "../places.js";
import { browseImage, shareImage } from "../images.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export const MODES = ["faces", "places"];
export const GROUP_MODES = ["none", "place"];
export const PLACE_GROUP_MODES = ["none", "region"];
export const SORT_MODES = ["name", "recent"];
const UNKNOWN = "\u0000unknown";

/** The settings and texts of each list. */
const MODE = {
  faces: {
    groupSetting: "groupBy", sortSetting: "sortBy", groups: GROUP_MODES, icon: "fa-solid fa-masks-theater",
    sheet: () => FaceSheet
  },
  places: {
    groupSetting: "placeGroupBy", sortSetting: "placeSortBy", groups: PLACE_GROUP_MODES, icon: "fa-solid fa-map-location-dot",
    sheet: () => PlaceSheet
  }
};

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
  static searches = { faces: "", places: "" };
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
    const notesByFace = ready ? store.visibleNotesByFace() : new Map();

    const found = [];
    if (mode === "faces") {
      // The places an NPC is linked to by hand are searchable too.
      const linkedNames = new Map();
      for (const place of places) {
        for (const link of place.links) {
          if (!linkedNames.has(link.faceId)) linkedNames.set(link.faceId, []);
          linkedNames.get(link.faceId).push(place.name);
        }
      }
      for (const face of faces) {
        const notes = notesByFace.get(face.id) ?? [];
        const match = matchFace(face, notes, terms, linkedNames.get(face.id) ?? []);
        if (match) found.push({ entry: face, notes, snippet: match.snippet });
      }
    } else {
      const notesByPlace = ready ? store.visibleNotesByPlace() : new Map();
      for (const place of places) {
        const notes = notesByPlace.get(place.id) ?? [];
        const people = store.facesOfPlace(place, faces, notesByFace);
        const match = matchPlace(place, notes, terms, people.map(p => p.face.name));
        if (match) found.push({ entry: place, notes, people, snippet: match.snippet });
      }
    }

    const total = mode === "faces" ? faces.length : places.length;
    const canAdd = mode === "faces" ? canAddFaces() : canAddPlaces();
    const groupBy = this.groupBy;
    Object.assign(context, {
      ready,
      mode,
      isPlaces: mode === "places",
      tabs: MODES.map(id => ({
        id, active: id === mode, icon: MODE[id].icon, label: t(`Tabs.${id}`),
        count: id === "faces" ? faces.length : places.length
      })),
      isGM: game.user.isGM,
      canAdd,
      addBlocked: mode === "faces" && mayAddFaces() && combatBlocks(),
      addLabel: t(mode === "faces" ? "AddFace" : "AddPlace"),
      addHint: t(mode === "faces" ? "AddFaceHint" : "AddPlaceHint"),
      addIcon: mode === "faces" ? "fa-solid fa-user-plus" : "fa-solid fa-map-pin",
      searchPlaceholder: t(mode === "faces" ? "SearchPlaceholder" : "SearchPlacesPlaceholder"),
      searchLabel: t(mode === "faces" ? "Search" : "SearchPlaces"),
      canAddMet: !game.user.isGM && ready,
      metBlocked: mode === "faces" && combatBlocks(),
      metLabel: t(mode === "faces" ? "AddMet" : "AddVisited"),
      metHint: t(mode === "faces" ? "AddMetHint" : "AddVisitedHint"),
      metIcon: mode === "faces" ? "fa-solid fa-user-plus" : "fa-solid fa-map-pin",
      search: FacesTab.searches[mode],
      searching: terms.length > 0,
      groupBy,
      sortBy: this.sortBy,
      groupOptions: Object.fromEntries(MODE[mode].groups.map(g => [g, t(`GroupBy.${g}`)])),
      sortOptions: Object.fromEntries(SORT_MODES.map(s => [s, t(`SortBy.${s}`)])),
      shown: found.length,
      total,
      totalIcon: MODE[mode].icon,
      countHint: t(mode === "faces" ? "CountHint" : "PlaceCountHint"),
      groups: this.#group(found, terms, groupBy),
      emptyIcon: MODE[mode].icon,
      emptyMessage: !total
        ? t(mode === "faces" ? (canAddFaces() ? "EmptyGM" : "EmptyPlayer") : (canAddPlaces() ? "EmptyPlacesGM" : "EmptyPlacesPlayer"))
        : t(mode === "faces" ? "NoMatches" : "NoPlaceMatches")
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
    return t(entry.kind === "places" ? "KnownByPlace" : "KnownBy", { names: names.join(", ") || "—" });
  }

  /** The place a list entry is grouped under: where a face was met, or the region of a place. */
  static groupOf({ entry, notes }) {
    return entry.kind === "places" ? entry.region : FacesTab.placeOf(entry, notes);
  }

  #card({ entry, notes, people, snippet }, terms) {
    const isPlace = entry.kind === "places";
    const chip = FacesTab.groupOf({ entry, notes });
    const mine = notes.filter(n => n.createdBy === game.user.id).length;
    return {
      kind: entry.kind,
      square: isPlace,
      knownBy: FacesTab.knownByLabel(entry),
      canShare: store.canShareEntry(entry),
      shareHint: t(isPlace ? "SharePlaceWithPartyHint" : "ShareWithPartyHint"),
      id: entry.id,
      name: entry.name,
      nameHTML: highlight(entry.name, terms),
      img: entry.img,
      initials: initials(entry.name),
      hue: nameHue(entry.name),
      chips: chip ? [{
        name: chip, html: highlight(chip, terms), icon: isPlace ? "fa-solid fa-map" : "fa-solid fa-location-dot",
        tooltip: t(isPlace ? "FilterRegion" : "FilterPlace")
      }] : [],
      peopleCount: people?.length ?? 0,
      peopleHint: people?.length ? t("PeopleCountHint", { count: people.length }) : "",
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
        groups.set(key, { key, label: place || t(this.mode === "places" ? "UnknownRegion" : "UnknownPlace"), unknown: !place, faces: [] });
      }
      groups.get(key).faces.push(this.#card(item, terms));
    }
    return [...groups.values()]
      .sort((a, b) => (a.unknown - b.unknown) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
      .map(g => ({ ...g, count: g.faces.length, collapsed: FacesTab.collapsed.has(g.key), groupIcon: this.mode === "places" ? "fa-solid fa-map" : "fa-solid fa-location-dot" }));
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
    const kindOf = li => li.dataset.kind === "places" ? "places" : "faces";
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
        condition: li => game.user.isGM && kindOf(li) === "places" && !!entry(li),
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
        condition: li => game.user.isGM && kindOf(li) === "places" && !!entry(li)?.img,
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
        condition: li => game.user.isGM && kindOf(li) === "places" && !!entry(li)?.img,
        callback: li => store.setEntryImage("places", li.dataset.entryId, "")
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
        name: "DXFF.DeleteFace", icon: '<i class="fa-solid fa-trash"></i>',
        condition: li => store.canDeleteEntry(entry(li)),
        callback: li => sheet(li).confirmDelete(li.dataset.entryId)
      }
    ];
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Switches between the faces and the places, in the tab and its pop-out. */
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
    if (FacesTab.mode === "places") addPlaceDialog({});
    else addFaceDialog({});
  }

  static #onAddMet() {
    if (FacesTab.mode === "places") addVisitedPlaceDialog();
    else addMetFaceDialog();
  }

  static #onOpenEntry(event, target) {
    const el = target.closest("[data-entry-id]");
    if (el) EntrySheet.openEntry(el.dataset.kind === "places" ? "places" : "faces", el.dataset.entryId);
  }

  static #onToggleGroup(event, target) {
    const key = target.closest("[data-group]").dataset.group;
    if (FacesTab.collapsed.has(key)) FacesTab.collapsed.delete(key);
    else FacesTab.collapsed.add(key);
    FacesTab.renderAllLists();
  }

  /** A place (or region) on a card: show only what is there. */
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
    if (el.dataset.kind === "places") PlaceSheet.shareWithParty(el.dataset.entryId);
    else FaceSheet.shareWithParty(el.dataset.entryId);
  }

  static #onClearSearch() {
    FacesTab.searches[FacesTab.mode] = "";
    FacesTab.renderAllLists();
  }
}
