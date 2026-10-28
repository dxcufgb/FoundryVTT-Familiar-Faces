import { MODULE_ID, TEMPLATE_PATH, t, nameHue, initials, canAddFaces, userInfo } from "../util.js";
import * as store from "../store.js";
import { tokenize, matchFace, highlight } from "../search.js";
import { FaceSheet } from "./face-sheet.js";
import { addFaceDialog } from "../capture.js";
import { browseImage, shareImage } from "../images.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { AbstractSidebarTab } = foundry.applications.sidebar;

export const GROUP_MODES = ["none", "place"];
export const SORT_MODES = ["name", "recent"];
const UNKNOWN = "\u0000unknown";

/** The Familiar Faces tab in the right sidebar (and its pop-out). */
export class FacesTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  static tabName = "familiarfaces";

  static DEFAULT_OPTIONS = {
    classes: ["dxff", "dxff-tab", "flexcol"],
    window: { title: "DXFF.Title", icon: "fa-solid fa-masks-theater" },
    actions: {
      addFace: FacesTab.#onAddFace,
      openFace: FacesTab.#onOpenFace,
      toggleGroup: FacesTab.#onToggleGroup,
      clearSearch: FacesTab.#onClearSearch,
      filterPlace: FacesTab.#onFilterPlace
    }
  };

  static PARTS = {
    header: { template: `${TEMPLATE_PATH}/tab-header.hbs` },
    filters: { template: `${TEMPLATE_PATH}/tab-filters.hbs` },
    list: { template: `${TEMPLATE_PATH}/tab-list.hbs`, scrollable: [""] }
  };

  /** Free-text search, shared by the sidebar tab and its pop-out. */
  static search = "";
  static collapsed = new Set();

  get groupBy() {
    return game.settings.get(MODULE_ID, "groupBy");
  }

  get sortBy() {
    return game.settings.get(MODULE_ID, "sortBy");
  }

  /** Re-renders the parts that depend on data (the search box keeps focus and text). */
  refresh() {
    if (!this.rendered) return;
    this.render({ parts: ["filters", "list"] });
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const ready = store.ready();
    const terms = tokenize(FacesTab.search);
    const faces = ready ? store.allFaces() : [];
    const notesByFace = ready ? store.visibleNotesByFace() : new Map();

    const found = [];
    for (const face of faces) {
      const notes = notesByFace.get(face.id) ?? [];
      const match = matchFace(face, notes, terms);
      if (match) found.push({ face, notes, snippet: match.snippet });
    }

    Object.assign(context, {
      ready,
      isGM: game.user.isGM,
      canAdd: canAddFaces(),
      search: FacesTab.search,
      searching: terms.length > 0,
      groupBy: this.groupBy,
      sortBy: this.sortBy,
      groupOptions: Object.fromEntries(GROUP_MODES.map(g => [g, t(`GroupBy.${g}`)])),
      sortOptions: Object.fromEntries(SORT_MODES.map(s => [s, t(`SortBy.${s}`)])),
      shown: found.length,
      total: faces.length,
      groups: this.#group(found, terms),
      emptyMessage: !faces.length ? t(canAddFaces() ? "EmptyGM" : "EmptyPlayer") : t("NoMatches")
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

  /** Tooltip for a face only some players have: who they are. */
  static knownByLabel(face) {
    if (!face.knownBy) return "";
    const names = face.knownBy.map(id => id === game.user.id ? t("You") : userInfo(id).name);
    return t("KnownBy", { names: names.join(", ") || "—" });
  }

  #card({ face, notes, snippet }, terms) {
    const place = FacesTab.placeOf(face, notes);
    const places = place ? [place] : [];
    const mine = notes.filter(n => n.createdBy === game.user.id).length;
    return {
      knownBy: FacesTab.knownByLabel(face),
      id: face.id,
      name: face.name,
      nameHTML: highlight(face.name, terms),
      img: face.img,
      initials: initials(face.name),
      hue: nameHue(face.name),
      places: places.map(p => ({ name: p, html: highlight(p, terms) })),
      noteCount: notes.length,
      mineCount: mine,
      othersCount: notes.length - mine,
      snippet
    };
  }

  static lastActivity(entry) {
    return Math.max(entry.face.updatedAt || 0, entry.face.createdAt || 0, ...entry.notes.map(n => n.editedAt || n.createdAt || 0));
  }

  #group(entries, terms) {
    const byName = (a, b) => a.face.name.localeCompare(b.face.name, undefined, { numeric: true, sensitivity: "base" });
    entries.sort(this.sortBy === "recent"
      ? (a, b) => (FacesTab.lastActivity(b) - FacesTab.lastActivity(a)) || byName(a, b)
      : byName);
    if (this.groupBy !== "place") {
      return entries.length ? [{ key: "all", label: null, faces: entries.map(e => this.#card(e, terms)) }] : [];
    }
    const groups = new Map();
    for (const entry of entries) {
      const place = FacesTab.placeOf(entry.face, entry.notes);
      const key = place ? place.toLowerCase() : UNKNOWN;
      if (!groups.has(key)) groups.set(key, { key, label: place || t("UnknownPlace"), unknown: !place, faces: [] });
      groups.get(key).faces.push(this.#card(entry, terms));
    }
    return [...groups.values()]
      .sort((a, b) => (a.unknown - b.unknown) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
      .map(g => ({ ...g, count: g.faces.length, collapsed: FacesTab.collapsed.has(g.key) }));
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);
    const input = this.element.querySelector("input[name=search]");
    if (input && options.parts?.includes("header")) {
      input.addEventListener("input", foundry.utils.debounce(event => {
        FacesTab.search = event.target.value;
        FacesTab.renderAllLists(this);
      }, 150));
      input.addEventListener("keydown", event => {
        if (event.key === "Escape" && input.value) {
          event.preventDefault();
          event.stopPropagation();
          input.value = "";
          FacesTab.search = "";
          FacesTab.renderAllLists(this);
        }
      });
    }
    if (options.parts?.includes("filters")) {
      for (const [name, setting] of [["groupBy", "groupBy"], ["sortBy", "sortBy"]]) {
        this.element.querySelector(`select[name=${name}]`)?.addEventListener("change", async event => {
          await game.settings.set(MODULE_ID, setting, event.target.value);
          FacesTab.renderAllLists();
        });
      }
    }
    if (!this._dxffMenu) {
      this._dxffMenu = true;
      new foundry.applications.ux.ContextMenu.implementation(this.element, ".dxff-face[data-face-id]", FacesTab.#faceMenu(), {
        jQuery: false, fixed: true
      });
    }
  }

  /** The tab and its pop-out keep the same search; re-render both lists. */
  static renderAllLists(source = null) {
    for (const app of [ui.familiarfaces, ui.familiarfaces?.popout]) {
      if (!app?.rendered) continue;
      const input = app.element.querySelector("input[name=search]");
      if (app !== source && input && input.value !== FacesTab.search) input.value = FacesTab.search;
      app.render({ parts: ["filters", "list"] });
    }
  }

  static #faceMenu() {
    const face = li => store.getFace(li.dataset.faceId);
    return [
      {
        name: "DXFF.Open", icon: '<i class="fa-solid fa-address-card"></i>',
        callback: li => FaceSheet.open(li.dataset.faceId)
      },
      {
        name: "DXFF.ChangePortrait", icon: '<i class="fa-solid fa-image-portrait"></i>',
        condition: li => game.user.isGM && !!face(li),
        callback: async li => {
          const f = face(li);
          const path = await browseImage(f?.img);
          if (path) await store.setImage(li.dataset.faceId, path);
        }
      },
      {
        name: "DXFF.ShowPortrait", icon: '<i class="fa-solid fa-eye"></i>',
        condition: li => game.user.isGM && !!face(li)?.img,
        callback: li => {
          const f = face(li);
          if (f?.img) shareImage(f.img, f.name);
        }
      },
      {
        name: "DXFF.RemovePortrait", icon: '<i class="fa-solid fa-image"></i>',
        condition: li => game.user.isGM && !!face(li)?.img,
        callback: li => store.setImage(li.dataset.faceId, "")
      },
      {
        name: "DXFF.ShareWithParty", icon: '<i class="fa-solid fa-users"></i>',
        condition: li => game.user.isGM && !!face(li)?.knownBy,
        callback: li => FaceSheet.shareWithParty(li.dataset.faceId)
      },
      {
        name: "DXFF.ForgetFace", icon: '<i class="fa-solid fa-user-minus"></i>',
        condition: li => store.canForgetFace(face(li)),
        callback: li => FaceSheet.confirmForget(li.dataset.faceId)
      },
      {
        name: "DXFF.DeleteFace", icon: '<i class="fa-solid fa-trash"></i>',
        condition: li => store.canDeleteFace(face(li)),
        callback: li => FaceSheet.confirmDelete(li.dataset.faceId)
      }
    ];
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onAddFace() {
    if (!store.ready()) return ui.notifications.warn(t("NotReady"));
    addFaceDialog({});
  }

  static #onOpenFace(event, target) {
    const id = target.closest("[data-face-id]")?.dataset.faceId;
    if (id) FaceSheet.open(id);
  }

  static #onToggleGroup(event, target) {
    const key = target.closest("[data-group]").dataset.group;
    if (FacesTab.collapsed.has(key)) FacesTab.collapsed.delete(key);
    else FacesTab.collapsed.add(key);
    FacesTab.renderAllLists();
  }

  static #onFilterPlace(event, target) {
    event.stopPropagation();
    const place = target.dataset.place;
    FacesTab.search = FacesTab.search.trim().toLowerCase() === `"${place}"`.toLowerCase() ? "" : `"${place}"`;
    FacesTab.renderAllLists();
  }

  static #onClearSearch() {
    FacesTab.search = "";
    FacesTab.renderAllLists();
  }
}
