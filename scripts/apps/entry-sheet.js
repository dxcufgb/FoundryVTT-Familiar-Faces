import {
  MODULE_ID, VISIBILITY, VISIBILITY_ICONS, t, enrich, formatDate, userInfo, nameHue, initials, escapeHTML,
  placeSuggestions, currentSceneName, shareablePlayers, getDropData, linkForDrop, insertAtCursor
} from "../util.js";
import * as store from "../store.js";
import {
  uploadFirst, pickFiles, browseImage, canBrowse, canUpload, filesFromEvent, urlFromDrop, imageFromDropData, showImage, shareImage
} from "../images.js";
import { canPickPlaceholder, pickPlaceholderDialog, isPlaceholder } from "../placeholders.js";
import { pickEntriesDialog, avatarClass } from "../pickers.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const NOTE_FILTERS = ["all", "mine", "others"];

/**
 * What differs between a face, a place and a faction in the texts of the sheet and its dialogs (DXFF.* keys).
 */
const TEXTS = {
  faces: {
    gone: "FaceGone", forget: "ForgetFace", forgetConfirm: "ForgetFaceConfirm", forgetConfirmLast: "ForgetFaceConfirmLast",
    remove: "DeleteFace", removeConfirm: "DeleteFaceConfirm", share: "ShareWithParty", shareConfirm: "ShareConfirm",
    shareConfirmEntry: "ShareConfirmFace", shared: "SharedWithParty", forgetIcon: "fa-solid fa-user-minus",
    pic: { drop: "PortraitDropHint", browse: "BrowsePortrait", upload: "UploadPortrait", show: "ShowPortrait", remove: "RemovePortrait", title: "Portrait", pick: "PickLook", pickHint: "PickLookHint" },
    noNotes: "NoNotes", notePlaceholder: "Placeholder.Note", shareHint: "ShareWithPartyHint", shareConfirmPrivate: "ShareConfirmPrivate"
  },
  places: {
    gone: "PlaceGone", forget: "ForgetPlace", forgetConfirm: "ForgetPlaceConfirm", forgetConfirmLast: "ForgetPlaceConfirmLast",
    remove: "DeleteFace", removeConfirm: "DeletePlaceConfirm", share: "ShareWithParty", shareConfirm: "SharePlaceConfirm",
    shareConfirmEntry: "SharePlaceConfirmEntry", shared: "SharedPlaceWithParty", forgetIcon: "fa-solid fa-map-pin",
    pic: { drop: "PictureDropHint", browse: "BrowsePicture", upload: "UploadPicture", show: "ShowPicture", remove: "RemovePicture", title: "Picture", pick: "PickLook", pickHint: "PickPlaceLookHint" },
    noNotes: "NoPlaceNotes", notePlaceholder: "Placeholder.PlaceNote", shareHint: "SharePlaceWithPartyHint", shareConfirmPrivate: "ShareConfirmPrivate"
  },
  factions: {
    gone: "FactionGone", forget: "ForgetFaction", forgetConfirm: "ForgetFactionConfirm", forgetConfirmLast: "ForgetFactionConfirmLast",
    remove: "DeleteFace", removeConfirm: "DeleteFactionConfirm", share: "ShareWithParty", shareConfirm: "ShareFactionConfirm",
    shareConfirmEntry: "ShareFactionConfirmEntry", shared: "SharedFactionWithParty", forgetIcon: "fa-solid fa-eye-slash",
    pic: { drop: "FactionPictureDropHint", browse: "BrowsePicture", upload: "UploadPicture", show: "ShowPicture", remove: "RemovePicture", title: "Picture", pick: "PickLook", pickHint: "PickFactionLookHint" },
    noNotes: "NoFactionNotes", notePlaceholder: "Placeholder.FactionNote", shareHint: "ShareFactionWithPartyHint", shareConfirmPrivate: "ShareConfirmPrivate"
  }
};

const SINGULAR = { faces: "face", places: "place", factions: "faction" };
const LOOK_ICONS = { faces: "fa-solid fa-masks-theater", places: "fa-solid fa-map", factions: "fa-solid fa-shield-halved" };

/** A faction's link as a pill: the NPC or place in a faction's window, or the faction in an NPC's or place's window. */
export function factionLinkView({ faction, kind, entry, link, show }) {
  const shown = show === "faction" ? faction : entry;
  return {
    factionId: faction.id,
    linkKind: kind,
    linkId: entry.id,
    openKind: shown.kind,
    openId: shown.id,
    name: shown.name,
    img: shown.img,
    hue: nameHue(shown.name),
    initials: initials(shown.name),
    avatarClass: avatarClass(shown.kind),
    role: link.role,
    canUnlink: store.canUnlinkFaction(faction, link)
  };
}

/**
 * The window of one face, place or faction: its picture, what it is, and the notes the user may see. FaceSheet,
 * PlaceSheet and FactionSheet add what is their own (where an NPC was met, the people of a place, the members of a
 * faction).
 */
export class EntrySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  /** "faces", "places" or "factions". */
  static kind = "faces";
  /** The fields of the edit form. */
  static DRAFT_FIELDS = ["name", "info"];
  /** The sheet class of each kind, so either sheet can open the other. */
  static classes = {};

  static register(cls) {
    EntrySheet.classes[cls.kind] = cls;
  }

  static DEFAULT_OPTIONS = {
    classes: ["dxff", "dxff-sheet"],
    window: { icon: "fa-solid fa-masks-theater", resizable: true },
    position: { width: 560, height: 720 },
    actions: {
      editFace: EntrySheet.#onEditEntry,
      cancelEdit: EntrySheet.#onCancelEdit,
      deleteFace: EntrySheet.#onDeleteEntry,
      forgetFace: EntrySheet.#onForgetEntry,
      shareFace: EntrySheet.#onShareEntry,
      pickPlaceholder: EntrySheet.#onPickPlaceholder,
      viewPortrait: EntrySheet.#onViewPortrait,
      browsePortrait: EntrySheet.#onBrowsePortrait,
      uploadPortrait: EntrySheet.#onUploadPortrait,
      removePortrait: EntrySheet.#onRemovePortrait,
      showPortrait: EntrySheet.#onShowPortrait,
      openSource: EntrySheet.#onOpenSource,
      useScene: EntrySheet.#onUseScene,
      setVisibility: EntrySheet.#onSetVisibility,
      postNote: EntrySheet.#onPostNote,
      editNote: EntrySheet.#onEditNote,
      saveNote: EntrySheet.#onSaveNote,
      cancelNote: EntrySheet.#onCancelNote,
      deleteNote: EntrySheet.#onDeleteNote,
      setNoteFilter: EntrySheet.#onSetNoteFilter,
      openFace: EntrySheet.#onOpenOther,
      openPlace: EntrySheet.#onOpenOther,
      openFaction: EntrySheet.#onOpenOther,
      openLinked: EntrySheet.#onOpenLinked,
      linkFactions: EntrySheet.#onLinkFactions,
      unlinkFactionLink: EntrySheet.#onUnlinkFactionLink,
      editFactionRole: EntrySheet.#onEditFactionRole
    }
  };

  /* -------------------------------------------- */
  /*  Opening                                     */
  /* -------------------------------------------- */

  static get texts() {
    return TEXTS[this.kind];
  }

  static appId(id) {
    return `dxff-${SINGULAR[this.kind] ?? "face"}-${id}`;
  }

  /** Opens (or brings forward) the window of a face or place. */
  static open(id) {
    if (!store.getEntry(this.kind, id)) return ui.notifications.warn(t(this.texts.gone));
    const existing = foundry.applications.instances.get(this.appId(id));
    if (existing) {
      existing.render({ force: true });
      existing.bringToFront();
      return existing;
    }
    const app = new this({ id: this.appId(id), entryId: id });
    app.render({ force: true });
    return app;
  }

  /** Opens a face or a place by kind. */
  static openEntry(kind, id) {
    return EntrySheet.classes[kind]?.open(id);
  }

  /** Re-renders every open face and place window (or only one kind); closes the windows of ones that were removed. */
  static refreshAll({ kind = null } = {}) {
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof EntrySheet) || !app.rendered || (kind && app.kind !== kind)) continue;
      if (!app.entry) {
        setTimeout(() => {
          if (app.rendered && !app.entry) app.close();
        }, 1000);
        continue;
      }
      app.render();
    }
  }

  /** Player: takes a face or place that only some players know out of their own list. */
  static async confirmForget(id) {
    const entry = store.getEntry(this.kind, id);
    if (!store.canForgetEntry(entry)) return false;
    const last = entry.knownBy.every(userId => userId === game.user.id);
    const texts = this.texts;
    const ok = await DialogV2.confirm({
      window: { title: t(texts.forget), icon: texts.forgetIcon },
      content: `<p>${t(last ? texts.forgetConfirmLast : texts.forgetConfirm, { name: escapeHTML(entry.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return false;
    await store.forgetEntry(this.kind, id);
    return true;
  }

  /**
   * Puts a face or place that only some players know into every player's list. Players confirm first, with what
   * will be shared and what stays private.
   */
  static async shareWithParty(id) {
    const entry = store.getEntry(this.kind, id);
    if (!store.canShareEntry(entry)) return;
    const texts = this.texts;
    if (!game.user.isGM) {
      const notes = store.notesOf(this.kind, id);
      const shared = notes.filter(n => n.visibility === "everyone").length;
      const some = notes.filter(n => n.visibility === "some").length;
      const own = notes.filter(n => n.visibility === "private").length;
      const name = escapeHTML(entry.name);
      const lines = [
        `<p>${t(texts.shareConfirm, { name })}</p>`,
        `<ul class="dxff-share-summary">`,
        `<li><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t(texts.shareConfirmEntry))}</li>`,
        shared ? `<li><i class="fa-solid fa-users" inert></i> ${escapeHTML(t(shared === 1 ? "ShareConfirmNote" : "ShareConfirmNotes", { count: shared }))}</li>` : "",
        some ? `<li><i class="fa-solid fa-user-check" inert></i> ${escapeHTML(t("ShareConfirmSome", { count: some }))}</li>` : "",
        `<li><i class="fa-solid fa-lock" inert></i> ${escapeHTML(t(texts.shareConfirmPrivate))}${own ? ` (${own})` : ""}</li>`,
        `</ul>`
      ];
      const ok = await DialogV2.confirm({
        window: { title: t(texts.share), icon: "fa-solid fa-users" },
        classes: ["dxff-dialog"],
        content: `<div class="dxff">${lines.join("")}</div>`,
        rejectClose: false
      });
      if (!ok) return;
    }
    try {
      await store.shareEntryWithParty(this.kind, id);
      ui.notifications.info(t(texts.shared, { name: escapeHTML(entry.name) }));
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async confirmDelete(id) {
    const entry = store.getEntry(this.kind, id);
    if (!entry || !store.canDeleteEntry(entry)) return false;
    const ok = await DialogV2.confirm({
      window: { title: t(this.texts.remove), icon: "fa-solid fa-trash" },
      content: `<p>${t(this.texts.removeConfirm, { name: escapeHTML(entry.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return false;
    await store.deleteEntry(this.kind, id);
    return true;
  }

  /* -------------------------------------------- */

  constructor(options = {}) {
    super(options);
    this.entryId = options.entryId;
    this.editing = false;
    this.draft = null;
    const lastVis = game.settings.get(MODULE_ID, "lastVisibility");
    this.composer = { text: "", place: "", visibility: ["private", "everyone"].includes(lastVis) ? lastVis : "private", sharedWith: [] };
    this.editNote = null;
    this.noteFilter = "all";
    this._focus = null;
    this._focusNext = null;
  }

  get kind() {
    return this.constructor.kind;
  }

  get entry() {
    return store.getEntry(this.kind, this.entryId);
  }

  get title() {
    return this.entry?.name ?? t("Title");
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const entry = this.entry;
    const texts = this.constructor.texts;
    Object.assign(context, { missing: !entry, isGM: game.user.isGM, goneText: t(texts.gone) });
    if (!entry) return context;

    const notes = store.notesOf(this.kind, entry.id);
    const players = shareablePlayers();
    const playerNames = new Map(game.users.map(u => [u.id, u.name]));

    const counts = { all: notes.length, mine: 0, others: 0 };
    for (const n of notes) counts[n.createdBy === game.user.id ? "mine" : "others"]++;
    const filtered = notes.filter(n => this.noteFilter === "all"
      || (this.noteFilter === "mine") === (n.createdBy === game.user.id));

    const noteViews = [];
    for (const note of filtered.slice().reverse()) {
      const author = userInfo(note.createdBy, note.authorName);
      const editing = this.editNote?.id === note.id && this.editNote.where === note.where;
      const sharedNames = note.sharedWith.map(id => playerNames.get(id)).filter(Boolean);
      noteViews.push({
        ...note,
        html: await enrich(note.text),
        author,
        mine: note.createdBy === game.user.id,
        date: formatDate(note.createdAt),
        edited: note.editedAt ? formatDate(note.editedAt) : "",
        visIcon: VISIBILITY_ICONS[note.visibility],
        visLabel: note.visibility === "private" ? t("Vis.privateShort")
          : note.visibility === "everyone" ? t("Vis.everyoneShort")
            : t("Vis.someShort", { names: sharedNames.join(", ") || "—" }),
        canEdit: store.canEditNote(note),
        canDelete: store.canDeleteNote(note),
        editing,
        edit: editing ? this.#visibilityView(this.editNote, players, "edit") : null
      });
    }

    if (this.editing && !this.draft) {
      this.draft = Object.fromEntries(this.constructor.DRAFT_FIELDS.map(key => [key, entry[key] ?? ""]));
    }

    const canEdit = store.canEditEntry(entry);
    Object.assign(context, {
      appId: this.id,
      kind: this.kind,
      isPlace: this.kind === "places",
      isFaction: this.kind === "factions",
      squarePic: this.kind !== "faces",
      lookIcon: LOOK_ICONS[this.kind],
      entry,
      face: entry,
      hue: nameHue(entry.name),
      initials: initials(entry.name),
      infoHTML: await enrich(entry.info),
      sourceHTML: entry.source ? await enrich(`@UUID[${entry.source.uuid}]{${entry.source.label.replace(/[{}[\]]/g, "") || t("Source")}}`) : "",
      added: formatDate(entry.createdAt),
      addedBy: entry.createdBy ? userInfo(entry.createdBy).name : "",
      canEdit,
      canDelete: store.canDeleteEntry(entry),
      canForget: store.canForgetEntry(entry),
      canShare: store.canShareEntry(entry),
      knownBy: entry.knownBy ? entry.knownBy.map(id => id === game.user.id ? t("You") : userInfo(id).name).join(", ") || "—" : "",
      hasActions: canEdit || store.canForgetEntry(entry) || store.canShareEntry(entry),
      canPickPlaceholder: canPickPlaceholder(entry, canEdit),
      placeholderLook: isPlaceholder(entry.img),
      canUpload: game.user.isGM && canUpload(),
      canBrowse: game.user.isGM && canBrowse(),
      pic: Object.fromEntries(Object.entries(texts.pic).map(([key, value]) => [key, t(value)])),
      texts: { forget: t(texts.forget), forgetIcon: texts.forgetIcon, remove: t(texts.remove), share: t(texts.share), shareHint: t(texts.shareHint) },
      editing: this.editing,
      draft: this.draft,
      currentScene: currentSceneName(),
      privateReady: store.privateReady(),
      hasNotePlace: this.kind === "faces",
      notePlaceholder: t(texts.notePlaceholder),
      composer: this.#visibilityView(this.composer, players, "composer"),
      composerBlocked: this.composer.visibility === "private" && !store.privateReady(),
      hasPlayers: players.length > 0,
      notes: noteViews,
      noteFilters: NOTE_FILTERS.map(id => ({ id, label: t(`NoteFilter.${id}`), count: counts[id], active: id === this.noteFilter })),
      noNotes: !notes.length,
      noNotesText: t(texts.noNotes),
      gmSeesShared: !game.user.isGM
    });
    if (this.kind !== "factions") this.#prepareFactions(context, entry);
    await this._prepareEntryContext(context, entry, notes);
    return context;
  }

  /** The factions of an NPC or place, and whether more can be linked. */
  #prepareFactions(context, entry) {
    const factions = store.allFactions();
    const items = store.factionsOf(entry, factions)
      .map(({ faction, link }) => factionLinkView({ faction, kind: this.kind, entry, link, show: "faction" }));
    const canLink = factions.some(f => !store.factionLinkOf(f, this.kind, entry.id));
    context.factionsSection = {
      title: t("FactionsOf"),
      icon: "fa-solid fa-shield-halved",
      linkAction: canLink ? "linkFactions" : "",
      linkHint: t(this.kind === "places" ? "LinkFactionsPlaceHint" : "LinkFactionsHint"),
      linkLabel: t("LinkFactions"),
      emptyText: t("NoFactionsOf"),
      items
    };
    context.showFactions = items.length > 0 || canLink;
  }

  /** What the face or place sheet adds to the context. */
  async _prepareEntryContext(context, entry, notes) {
    context.placeOptions = placeSuggestions(notes.map(n => n.place));
  }

  /** Visibility buttons and the player checkboxes for the composer or the note being edited. */
  #visibilityView(state, players, scope) {
    return {
      ...state,
      scope,
      options: VISIBILITY.map(id => ({
        id, icon: VISIBILITY_ICONS[id], label: t(`Vis.${id}`), hint: t(`Vis.${id}Hint`),
        active: state.visibility === id, disabled: id === "some" && !players.length
      })),
      showPlayers: state.visibility === "some",
      players: players.map(p => ({ ...p, checked: state.sharedWith.includes(p.id) }))
    };
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _preRender(context, options) {
    await super._preRender(context, options);
    const active = document.activeElement;
    this._focus = null;
    if (active && this.element?.contains(active) && active.dataset?.bind) {
      this._focus = { bind: active.dataset.bind, start: active.selectionStart, end: active.selectionEnd };
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    const titleEl = root.querySelector(".window-title");
    if (titleEl) titleEl.textContent = this.title;

    for (const field of root.querySelectorAll("[data-bind]")) {
      field.addEventListener("input", () => this.#bind(field));
    }
    for (const box of root.querySelectorAll("input[data-share]")) {
      box.addEventListener("change", () => {
        const state = box.dataset.share === "edit" ? this.editNote : this.composer;
        if (!state) return;
        const set = new Set(state.sharedWith);
        if (box.checked) set.add(box.value);
        else set.delete(box.value);
        state.sharedWith = [...set];
      });
    }
    for (const field of root.querySelectorAll("[data-keys]")) {
      field.addEventListener("keydown", event => this.#onKeyDown(event, field.dataset.keys));
    }
    root.querySelector("form.dxff-face-edit")?.addEventListener("submit", event => {
      event.preventDefault();
      this.#saveEntry();
    });

    for (const zone of root.querySelectorAll("[data-drop]")) {
      zone.addEventListener("dragover", event => {
        event.preventDefault();
        zone.classList.add("dxff-drop-hover");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("dxff-drop-hover"));
      zone.addEventListener("drop", event => {
        zone.classList.remove("dxff-drop-hover");
        this.#onDrop(event, zone);
      });
    }
    root.querySelector("[data-drop=portrait]")?.addEventListener("paste", event => {
      const files = filesFromEvent(event);
      if (files.length) this.#uploadPortrait(files);
    });

    if (this._focus) {
      const field = root.querySelector(`[data-bind="${this._focus.bind}"]`);
      if (field) {
        field.focus();
        try { field.setSelectionRange(this._focus.start, this._focus.end); } catch { /* not a text field */ }
      }
      this._focus = null;
    } else if (this._focusNext) {
      root.querySelector(this._focusNext)?.focus();
    }
    this._focusNext = null;
  }

  #bind(field) {
    const [scope, key] = field.dataset.bind.split(".");
    const state = this[scope];
    if (state && key) state[key] = field.value;
  }

  #onKeyDown(event, keys) {
    const submit = event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (keys === "composer" && submit) {
      event.preventDefault();
      EntrySheet.#onPostNote.call(this);
    } else if (keys === "edit") {
      if (submit) {
        event.preventDefault();
        EntrySheet.#onSaveNote.call(this);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        EntrySheet.#onCancelNote.call(this);
      }
    } else if (keys === "place" && event.key === "Enter") {
      // Enter in a place field moves on to the text rather than submitting anything.
      event.preventDefault();
      event.target.closest("[data-note-form]")?.querySelector("textarea")?.focus();
    }
  }

  async #onDrop(event, zone) {
    event.preventDefault();
    const kind = zone.dataset.drop;
    if (kind === "portrait") {
      if (!game.user.isGM) return;
      const files = filesFromEvent(event);
      if (files.length) return this.#uploadPortrait(files);
      const url = urlFromDrop(event);
      const data = url ? null : getDropData(event);
      const src = url ?? await imageFromDropData(data);
      if (src) await this._setPicture(src, data);
      else ui.notifications.warn(t("NoImageInDrop"));
      return;
    }
    // Notes: a dropped document becomes a link at the cursor.
    const field = zone.matches("textarea") ? zone : zone.querySelector("textarea");
    const link = await linkForDrop(getDropData(event));
    if (field && link) insertAtCursor(field, link);
  }

  /** GM: a picture was dropped (data: what was dropped, when it was a Foundry document). */
  async _setPicture(src) {
    await store.setEntryImage(this.kind, this.entryId, src);
  }

  async #uploadPortrait(files) {
    if (!canUpload()) return ui.notifications.warn(t("NoUploadPermission"));
    const path = await uploadFirst(files);
    if (path) await store.setEntryImage(this.kind, this.entryId, path);
  }

  async #saveEntry() {
    if (!this.draft) return;
    const name = String(this.draft.name ?? "").trim();
    if (!name) return ui.notifications.warn(t("NameRequired"));
    try {
      await store.updateEntry(this.kind, this.entryId, { ...this.draft, name });
      this.editing = false;
      this.draft = null;
      this.render();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onEditEntry() {
    if (!store.canEditEntry(this.entry)) return;
    this.editing = true;
    this.draft = null;
    this._focusNext = "[data-bind='draft.name']";
    this.render();
  }

  static #onCancelEdit() {
    this.editing = false;
    this.draft = null;
    this.render();
  }

  static async #onDeleteEntry() {
    if (await this.constructor.confirmDelete(this.entryId)) this.close();
  }

  static async #onForgetEntry() {
    if (await this.constructor.confirmForget(this.entryId)) this.close();
  }

  /** Pick (or change, or clear) a placeholder look for a face or place without a picture of its own. */
  static async #onPickPlaceholder() {
    const entry = this.entry;
    if (!canPickPlaceholder(entry, store.canEditEntry(entry))) return;
    const src = await pickPlaceholderDialog(entry.img, entry.name, this.kind);
    if (src === null || src === entry.img) return;
    // Clearing only removes a placeholder; a real picture is removed with its own button (GM).
    if (!src && !isPlaceholder(entry.img)) return;
    try {
      await store.setEntryImage(this.kind, this.entryId, src);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static #onShareEntry() {
    this.constructor.shareWithParty(this.entryId);
  }

  static #onViewPortrait() {
    const entry = this.entry;
    if (entry?.img) showImage(entry.img, entry.name);
  }

  static async #onBrowsePortrait() {
    if (!game.user.isGM) return;
    const path = await browseImage(this.entry?.img);
    if (path) await store.setEntryImage(this.kind, this.entryId, path);
  }

  static async #onUploadPortrait() {
    if (!game.user.isGM) return;
    const files = await pickFiles();
    if (files.length) await this.#uploadPortrait(files);
  }

  static async #onRemovePortrait() {
    if (!game.user.isGM) return;
    await store.setEntryImage(this.kind, this.entryId, "");
  }

  static #onShowPortrait() {
    const entry = this.entry;
    if (game.user.isGM && entry?.img) shareImage(entry.img, entry.name);
  }

  static async #onOpenSource() {
    const uuid = this.entry?.source?.uuid;
    if (!uuid) return;
    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc) return ui.notifications.warn(t("SourceGone"));
    if (doc.documentName === "JournalEntryPage") doc.parent?.sheet?.render({ force: true, pageId: doc.id });
    else doc.sheet?.render({ force: true });
  }

  static #onUseScene(event, target) {
    const scene = currentSceneName();
    if (!scene) return;
    const scope = target.dataset.scope;
    const state = scope === "draft" ? this.draft : scope === "edit" ? this.editNote : this.composer;
    if (!state) return;
    state[target.dataset.field || (scope === "draft" ? "metAt" : "place")] = scene;
    this.render();
  }

  static async #onSetVisibility(event, target) {
    const vis = target.dataset.vis;
    if (!VISIBILITY.includes(vis)) return;
    const state = target.dataset.scope === "edit" ? this.editNote : this.composer;
    if (!state) return;
    state.visibility = vis;
    // "Some players" isn't remembered: the next note would start shared with nobody ticked.
    if (target.dataset.scope !== "edit" && vis !== "some") await game.settings.set(MODULE_ID, "lastVisibility", vis);
    this.render();
  }

  static async #onPostNote() {
    const c = this.composer;
    if (!c.text.trim() && !(this.kind === "faces" && c.place.trim())) {
      ui.notifications.warn(t(this.kind === "faces" ? "NoteEmpty" : "PlaceNoteEmpty"));
      return;
    }
    if (c.visibility === "some" && !c.sharedWith.length) return ui.notifications.warn(t("PickPlayers"));
    if (c.visibility === "private" && !store.privateReady()) return ui.notifications.warn(t("PrivateNotReady"));
    try {
      await store.addEntryNote(this.kind, this.entryId, { text: c.text, place: c.place, visibility: c.visibility, sharedWith: c.sharedWith });
      // Keep the place and who it's shared with: the next note is usually from the same meeting.
      c.text = "";
      this._focusNext = "[data-bind='composer.text']";
      this.render();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  #noteOf(target) {
    const el = target.closest("[data-note-id]");
    return store.notesOf(this.kind, this.entryId).find(n => n.id === el.dataset.noteId && n.where === el.dataset.where);
  }

  static #onEditNote(event, target) {
    const note = this.#noteOf(target);
    if (!store.canEditNote(note)) return;
    this.editNote = {
      id: note.id, where: note.where, text: note.text, place: note.place,
      visibility: note.visibility, sharedWith: [...note.sharedWith]
    };
    this._focusNext = "[data-bind='editNote.text']";
    this.render();
  }

  static async #onSaveNote() {
    const e = this.editNote;
    if (!e) return;
    if (!e.text.trim() && !(this.kind === "faces" && e.place.trim())) {
      return ui.notifications.warn(t(this.kind === "faces" ? "NoteEmpty" : "PlaceNoteEmpty"));
    }
    if (e.visibility === "some" && !e.sharedWith.length) return ui.notifications.warn(t("PickPlayers"));
    try {
      await store.updateEntryNote(this.kind, this.entryId, e.id, e.where, {
        text: e.text, place: e.place, visibility: e.visibility, sharedWith: e.sharedWith
      });
      this.editNote = null;
      this.render();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static #onCancelNote() {
    this.editNote = null;
    this.render();
  }

  static async #onDeleteNote(event, target) {
    const note = this.#noteOf(target);
    if (!store.canDeleteNote(note)) return;
    const ok = await DialogV2.confirm({
      window: { title: t("DeleteNote"), icon: "fa-solid fa-trash" },
      content: `<p>${escapeHTML(t("DeleteNoteConfirm"))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    if (this.editNote?.id === note.id) this.editNote = null;
    await store.deleteEntryNote(this.kind, this.entryId, note.id, note.where);
  }

  static #onSetNoteFilter(event, target) {
    const id = target.dataset.filter;
    if (!NOTE_FILTERS.includes(id)) return;
    this.noteFilter = id;
    this.render();
  }

  /** Opens a linked NPC (data-face-id), place (data-place-id) or faction (data-faction-id). */
  static #onOpenOther(event, target) {
    const el = target.closest("[data-face-id], [data-place-id], [data-faction-id]");
    if (!el) return;
    if (el.dataset.faceId) EntrySheet.openEntry("faces", el.dataset.faceId);
    else if (el.dataset.placeId) EntrySheet.openEntry("places", el.dataset.placeId);
    else EntrySheet.openEntry("factions", el.dataset.factionId);
  }

  /** Opens what a link pill shows (data-open-kind, data-open-id). */
  static #onOpenLinked(event, target) {
    const { openKind, openId } = target.dataset;
    if (store.KINDS.includes(openKind) && openId) EntrySheet.openEntry(openKind, openId);
  }

  /** NPC or place: links it to factions chosen from a list. */
  static async #onLinkFactions() {
    const entry = this.entry;
    if (!entry || this.kind === "factions") return;
    const factions = store.allFactions()
      .filter(f => !store.factionLinkOf(f, this.kind, entry.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!factions.length) return ui.notifications.info(t("NoFactionsToLink"));
    const ids = await pickEntriesDialog(factions, {
      title: t("LinkFactionsTo", { name: entry.name }), hint: t("LinkFactionsPickHint"), search: t("SearchFactions"),
      icon: "fa-solid fa-shield-halved"
    });
    try {
      for (const id of ids) await store.linkToFaction(id, this.kind, entry.id);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  /** The faction link of a pill (data-faction-id, data-link-kind, data-link-id). */
  static #linkOf(target) {
    const el = target.closest("[data-faction-id][data-link-kind]");
    if (!el) return null;
    const { factionId, linkKind, linkId } = el.dataset;
    const faction = store.getFaction(factionId);
    const link = store.factionLinkOf(faction, linkKind, linkId);
    return faction && link ? { faction, kind: linkKind, id: linkId, link } : null;
  }

  static async #onUnlinkFactionLink(event, target) {
    event.stopPropagation();
    const found = EntrySheet.#linkOf(target);
    if (found) await store.unlinkFromFaction(found.faction.id, found.kind, found.id);
  }

  /** Changes the role of an NPC or place in a faction ("Leader", "Headquarters"). */
  static async #onEditFactionRole(event, target) {
    event.stopPropagation();
    const found = EntrySheet.#linkOf(target);
    if (!found || !store.canUnlinkFaction(found.faction, found.link)) return;
    const entry = store.getEntry(found.kind, found.id);
    if (!entry) return;
    const role = await roleDialog(found.faction, entry, found.link.role);
    if (role === null) return;
    try {
      await store.setFactionRole(found.faction.id, found.kind, found.id, role);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }
}

/** Asks for the role of an NPC or place in a faction. Resolves to the role ("" to clear it), or null when cancelled. */
async function roleDialog(faction, entry, current = "") {
  const places = entry.kind === "places";
  const result = await DialogV2.wait({
    window: { title: t("EditRoleTitle", { name: entry.name, faction: faction.name }), icon: "fa-solid fa-id-badge" },
    position: { width: 420 },
    classes: ["dxff-dialog"],
    content: `
      <div class="dxff">
        <div class="form-group stacked">
          <label>${escapeHTML(t(places ? "Field.PlaceRole" : "Field.Role"))}</label>
          <input type="text" name="role" value="${escapeHTML(current)}" maxlength="${store.ROLE_MAX}" autocomplete="off"
                 placeholder="${escapeHTML(t(places ? "Placeholder.PlaceRole" : "Placeholder.Role"))}">
        </div>
      </div>`,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      {
        action: "save", label: t("Save"), icon: "fa-solid fa-check", default: true,
        callback: (event, button) => ({ role: button.form.elements.role.value })
      }
    ],
    render: (event, dialog) => {
      const input = dialog.element.querySelector("input[name=role]");
      input?.focus();
      input?.select();
    }
  });
  return result && typeof result === "object" ? String(result.role ?? "") : null;
}
