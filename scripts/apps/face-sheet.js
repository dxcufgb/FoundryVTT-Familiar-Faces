import {
  MODULE_ID, TEMPLATE_PATH, VISIBILITY, VISIBILITY_ICONS, t, enrich, formatDate, userInfo, nameHue, initials, escapeHTML,
  placeSuggestions, currentSceneName, shareablePlayers, getDropData, linkForDrop, insertAtCursor
} from "../util.js";
import * as store from "../store.js";
import {
  uploadFirst, pickFiles, browseImage, canBrowse, canUpload, filesFromEvent, urlFromDrop, imageFromDropData, showImage, shareImage
} from "../images.js";

import { canPickPlaceholder, pickPlaceholderDialog, isPlaceholder } from "../placeholders.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const NOTE_FILTERS = ["all", "mine", "others"];

/** One face's window: portrait, who they are and where they were met, and the notes the user may see. */
export class FaceSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["dxff", "dxff-sheet"],
    window: { icon: "fa-solid fa-masks-theater", resizable: true },
    position: { width: 560, height: 720 },
    actions: {
      editFace: FaceSheet.#onEditFace,
      cancelEdit: FaceSheet.#onCancelEdit,
      deleteFace: FaceSheet.#onDeleteFace,
      forgetFace: FaceSheet.#onForgetFace,
      shareFace: FaceSheet.#onShareFace,
      pickPlaceholder: FaceSheet.#onPickPlaceholder,
      viewPortrait: FaceSheet.#onViewPortrait,
      browsePortrait: FaceSheet.#onBrowsePortrait,
      uploadPortrait: FaceSheet.#onUploadPortrait,
      removePortrait: FaceSheet.#onRemovePortrait,
      showPortrait: FaceSheet.#onShowPortrait,
      openSource: FaceSheet.#onOpenSource,
      useScene: FaceSheet.#onUseScene,
      setVisibility: FaceSheet.#onSetVisibility,
      postNote: FaceSheet.#onPostNote,
      editNote: FaceSheet.#onEditNote,
      saveNote: FaceSheet.#onSaveNote,
      cancelNote: FaceSheet.#onCancelNote,
      deleteNote: FaceSheet.#onDeleteNote,
      setNoteFilter: FaceSheet.#onSetNoteFilter
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/face-sheet.hbs`, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Opening                                     */
  /* -------------------------------------------- */

  static appId(faceId) {
    return `dxff-face-${faceId}`;
  }

  /** Opens (or brings forward) the window of a face. */
  static open(faceId) {
    if (!store.getFace(faceId)) return ui.notifications.warn(t("FaceGone"));
    const existing = foundry.applications.instances.get(FaceSheet.appId(faceId));
    if (existing) {
      existing.render({ force: true });
      existing.bringToFront();
      return existing;
    }
    const app = new FaceSheet({ id: FaceSheet.appId(faceId), faceId });
    app.render({ force: true });
    return app;
  }

  /** Re-renders every open face window; closes windows of faces that were removed. */
  static refreshAll() {
    for (const app of foundry.applications.instances.values()) {
      if (!(app instanceof FaceSheet) || !app.rendered) continue;
      if (!store.getFace(app.faceId)) {
        setTimeout(() => {
          if (app.rendered && !store.getFace(app.faceId)) app.close();
        }, 1000);
        continue;
      }
      app.render();
    }
  }

  /** Player: takes a face that only some players know out of their own Familiar Faces. */
  static async confirmForget(faceId) {
    const face = store.getFace(faceId);
    if (!store.canForgetFace(face)) return false;
    const last = face.knownBy.every(id => id === game.user.id);
    const ok = await DialogV2.confirm({
      window: { title: t("ForgetFace"), icon: "fa-solid fa-user-minus" },
      content: `<p>${t(last ? "ForgetFaceConfirmLast" : "ForgetFaceConfirm", { name: escapeHTML(face.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return false;
    await store.forgetFace(faceId);
    return true;
  }

  /**
   * Puts a face that only some players know into every player's Familiar Faces. Players confirm first, with what will
   * be shared and what stays private.
   */
  static async shareWithParty(faceId) {
    const face = store.getFace(faceId);
    if (!store.canShareFace(face)) return;
    if (!game.user.isGM) {
      const notes = store.notesFor(faceId);
      const shared = notes.filter(n => n.visibility === "everyone").length;
      const some = notes.filter(n => n.visibility === "some").length;
      const own = notes.filter(n => n.visibility === "private").length;
      const name = escapeHTML(face.name);
      const lines = [
        `<p>${t("ShareConfirm", { name })}</p>`,
        `<ul class="dxff-share-summary">`,
        `<li><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("ShareConfirmFace"))}</li>`,
        shared ? `<li><i class="fa-solid fa-users" inert></i> ${escapeHTML(t(shared === 1 ? "ShareConfirmNote" : "ShareConfirmNotes", { count: shared }))}</li>` : "",
        some ? `<li><i class="fa-solid fa-user-check" inert></i> ${escapeHTML(t("ShareConfirmSome", { count: some }))}</li>` : "",
        `<li><i class="fa-solid fa-lock" inert></i> ${escapeHTML(t("ShareConfirmPrivate"))}${own ? ` (${own})` : ""}</li>`,
        `</ul>`
      ];
      const ok = await DialogV2.confirm({
        window: { title: t("ShareWithParty"), icon: "fa-solid fa-users" },
        classes: ["dxff-dialog"],
        content: `<div class="dxff">${lines.join("")}</div>`,
        rejectClose: false
      });
      if (!ok) return;
    }
    try {
      await store.shareWithParty(faceId);
      ui.notifications.info(t("SharedWithParty", { name: escapeHTML(face.name) }));
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async confirmDelete(faceId) {
    const face = store.getFace(faceId);
    if (!face || !store.canDeleteFace(face)) return false;
    const ok = await DialogV2.confirm({
      window: { title: t("DeleteFace"), icon: "fa-solid fa-trash" },
      content: `<p>${t("DeleteFaceConfirm", { name: escapeHTML(face.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return false;
    await store.deleteFace(faceId);
    return true;
  }

  /* -------------------------------------------- */

  constructor(options = {}) {
    super(options);
    this.faceId = options.faceId;
    this.editing = false;
    this.draft = null;
    const lastVis = game.settings.get(MODULE_ID, "lastVisibility");
    this.composer = { text: "", place: "", visibility: ["private", "everyone"].includes(lastVis) ? lastVis : "private", sharedWith: [] };
    this.editNote = null;
    this.noteFilter = "all";
    this._focus = null;
    this._focusNext = null;
  }

  get face() {
    return store.getFace(this.faceId);
  }

  get title() {
    return this.face?.name ?? t("Title");
  }

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const face = this.face;
    Object.assign(context, { missing: !face, isGM: game.user.isGM });
    if (!face) return context;

    const notes = store.notesFor(face.id);
    const players = shareablePlayers();
    const playerNames = new Map(game.users.map(u => [u.id, u.name]));
    const allPlaces = [face.metAt, ...store.allFaces().map(f => f.metAt), ...notes.map(n => n.place)];

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

    if (this.editing && !this.draft) this.draft = { name: face.name, metAt: face.metAt, info: face.info };

    Object.assign(context, {
      appId: this.id,
      face,
      hue: nameHue(face.name),
      initials: initials(face.name),
      infoHTML: await enrich(face.info),
      sourceHTML: face.source ? await enrich(`@UUID[${face.source.uuid}]{${face.source.label.replace(/[{}[\]]/g, "") || t("Source")}}`) : "",
      added: formatDate(face.createdAt),
      addedBy: face.createdBy ? userInfo(face.createdBy).name : "",
      canEdit: store.canEditFace(face),
      canDelete: store.canDeleteFace(face),
      canForget: store.canForgetFace(face),
      canShare: store.canShareFace(face),
      knownBy: face.knownBy ? face.knownBy.map(id => id === game.user.id ? t("You") : userInfo(id).name).join(", ") || "—" : "",
      hasActions: store.canEditFace(face) || store.canForgetFace(face) || store.canShareFace(face),
      canPickPlaceholder: canPickPlaceholder(face, store.canEditFace(face)),
      placeholderLook: isPlaceholder(face.img),
      canUpload: game.user.isGM && canUpload(),
      canBrowse: game.user.isGM && canBrowse(),
      editing: this.editing,
      draft: this.draft,
      placeOptions: placeSuggestions(allPlaces),
      currentScene: currentSceneName(),
      privateReady: store.privateReady(),
      composer: this.#visibilityView(this.composer, players, "composer"),
      composerBlocked: this.composer.visibility === "private" && !store.privateReady(),
      hasPlayers: players.length > 0,
      notes: noteViews,
      noteFilters: NOTE_FILTERS.map(id => ({ id, label: t(`NoteFilter.${id}`), count: counts[id], active: id === this.noteFilter })),
      noNotes: !notes.length,
      gmSeesShared: !game.user.isGM
    });
    return context;
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
      this.#saveFace();
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
      FaceSheet.#onPostNote.call(this);
    } else if (keys === "edit") {
      if (submit) {
        event.preventDefault();
        FaceSheet.#onSaveNote.call(this);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        FaceSheet.#onCancelNote.call(this);
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
      if (src) await store.setImage(this.faceId, src);
      else ui.notifications.warn(t("NoImageInDrop"));
      return;
    }
    // Notes: a dropped document becomes a link at the cursor.
    const field = zone.matches("textarea") ? zone : zone.querySelector("textarea");
    const link = await linkForDrop(getDropData(event));
    if (field && link) insertAtCursor(field, link);
  }

  async #uploadPortrait(files) {
    if (!canUpload()) return ui.notifications.warn(t("NoUploadPermission"));
    const path = await uploadFirst(files);
    if (path) await store.setImage(this.faceId, path);
  }

  async #saveFace() {
    if (!this.draft) return;
    const name = this.draft.name.trim();
    if (!name) return ui.notifications.warn(t("NameRequired"));
    try {
      await store.updateFace(this.faceId, { name, metAt: this.draft.metAt, info: this.draft.info });
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

  static #onEditFace() {
    if (!store.canEditFace(this.face)) return;
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

  static async #onDeleteFace() {
    if (await FaceSheet.confirmDelete(this.faceId)) this.close();
  }

  static async #onForgetFace() {
    if (await FaceSheet.confirmForget(this.faceId)) this.close();
  }

  /** Pick (or change, or clear) a placeholder look for a face without a portrait of its own. */
  static async #onPickPlaceholder() {
    const face = this.face;
    if (!canPickPlaceholder(face, store.canEditFace(face))) return;
    const src = await pickPlaceholderDialog(face.img, face.name);
    if (src === null || src === face.img) return;
    // Clearing only removes a placeholder; a real portrait is removed with its own button (GM).
    if (!src && !isPlaceholder(face.img)) return;
    try {
      await store.setImage(this.faceId, src);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static #onShareFace() {
    FaceSheet.shareWithParty(this.faceId);
  }

  static #onViewPortrait() {
    const face = this.face;
    if (face?.img) showImage(face.img, face.name);
  }

  static async #onBrowsePortrait() {
    if (!game.user.isGM) return;
    const path = await browseImage(this.face?.img);
    if (path) await store.setImage(this.faceId, path);
  }

  static async #onUploadPortrait() {
    if (!game.user.isGM) return;
    const files = await pickFiles();
    if (files.length) await this.#uploadPortrait(files);
  }

  static async #onRemovePortrait() {
    if (!game.user.isGM) return;
    await store.setImage(this.faceId, "");
  }

  static #onShowPortrait() {
    const face = this.face;
    if (game.user.isGM && face?.img) shareImage(face.img, face.name);
  }

  static async #onOpenSource() {
    const uuid = this.face?.source?.uuid;
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
    state[scope === "draft" ? "metAt" : "place"] = scene;
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
    if (!c.text.trim() && !c.place.trim()) {
      ui.notifications.warn(t("NoteEmpty"));
      return;
    }
    if (c.visibility === "some" && !c.sharedWith.length) return ui.notifications.warn(t("PickPlayers"));
    if (c.visibility === "private" && !store.privateReady()) return ui.notifications.warn(t("PrivateNotReady"));
    try {
      await store.addNote(this.faceId, { text: c.text, place: c.place, visibility: c.visibility, sharedWith: c.sharedWith });
      // Keep the place and who it's shared with: the next note is usually from the same meeting.
      c.text = "";
      this._focusNext = "[data-bind='composer.text']";
      this.render();
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static #onEditNote(event, target) {
    const el = target.closest("[data-note-id]");
    const note = store.notesFor(this.faceId).find(n => n.id === el.dataset.noteId && n.where === el.dataset.where);
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
    if (!e.text.trim() && !e.place.trim()) return ui.notifications.warn(t("NoteEmpty"));
    if (e.visibility === "some" && !e.sharedWith.length) return ui.notifications.warn(t("PickPlayers"));
    try {
      await store.updateNote(this.faceId, e.id, e.where, {
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
    const el = target.closest("[data-note-id]");
    const note = store.notesFor(this.faceId).find(n => n.id === el.dataset.noteId && n.where === el.dataset.where);
    if (!store.canDeleteNote(note)) return;
    const ok = await DialogV2.confirm({
      window: { title: t("DeleteNote"), icon: "fa-solid fa-trash" },
      content: `<p>${escapeHTML(t("DeleteNoteConfirm"))}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    if (this.editNote?.id === note.id) this.editNote = null;
    await store.deleteNote(this.faceId, note.id, note.where);
  }

  static #onSetNoteFilter(event, target) {
    const id = target.dataset.filter;
    if (!NOTE_FILTERS.includes(id)) return;
    this.noteFilter = id;
    this.render();
  }
}
