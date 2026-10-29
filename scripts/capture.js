import {
  MODULE_ID, QUEST_LOG_ID, t, escapeHTML, cleanLine, cleanName, imagesIn, imagesInPage, currentSceneName, placeSuggestions,
  canAddFaces, canAddPlaces, mayAddFaces, combatBlocks, randomId
} from "./util.js";
import * as store from "./store.js";
import { EntrySheet } from "./apps/entry-sheet.js";
import { FaceSheet } from "./apps/face-sheet.js";
import { PlaceSheet } from "./apps/place-sheet.js";
import { showImage } from "./images.js";
import { entryOptionsHTML, searchBoxHTML, wireEntrySearch } from "./pickers.js";

const { DialogV2 } = foundry.applications.api;
const MAX_NAME = 80;
/** Where a right-clicked image counts as a journal image. */
const JOURNAL_IMAGE_SCOPE = ".journal-entry-page, .journal-entry-content, .journal-page-content, .application.journal-entry, .application.journal-sheet, .journal-sheet, .image-popout";
const EDITING = "input, textarea, select, [contenteditable=''], [contenteditable=true], prose-mirror, .editor-content, #board";

/* -------------------------------------------- */
/*  "Add NPC" / "Add place" dialog              */
/* -------------------------------------------- */

/** What differs between adding a face and a place (DXFF.* keys). */
const ADD = {
  faces: {
    title: "AddFace", icon: "fa-solid fa-user-plus", name: "Field.Name", nameMax: MAX_NAME, where: "metAt", whereLabel: "Field.MetAt",
    wherePlaceholder: "Placeholder.MetAt", info: "Field.Info", infoPlaceholder: "Placeholder.Info", exists: "AlreadyExists",
    added: "Added", linkSource: "LinkSource", picture: "Portrait", noPicture: "NoPortrait"
  },
  places: {
    title: "AddPlace", icon: "fa-solid fa-map-pin", name: "Field.PlaceName", nameMax: 120, where: "region", whereLabel: "Field.Region",
    wherePlaceholder: "Placeholder.Region", info: "Field.PlaceInfo", infoPlaceholder: "Placeholder.PlaceInfo", exists: "PlaceAlreadyExists",
    added: "PlaceAdded", linkSource: "LinkSourcePlace", picture: "Picture", noPicture: "NoPicture"
  }
};

function canAdd(kind) {
  return kind === "places" ? canAddPlaces() : canAddFaces();
}

/**
 * Asks for the details of a new face or place and creates it.
 * @param {"faces"|"places"} kind
 * @param {object} [prefill]
 * @param {string} [prefill.name]
 * @param {string} [prefill.img]          The picture to preselect.
 * @param {string[]} [prefill.images]     More images to offer (e.g. the images of the journal page).
 * @param {string} [prefill.metAt]        Faces: defaults to the current scene.
 * @param {string} [prefill.region]       Places: the region it is in.
 * @param {string} [prefill.info]
 * @param {{uuid: string, label: string}|null} [prefill.source]
 * @param {string} [prefill.scene]        Places: the uuid of its scene.
 * @returns {Promise<string|null>} the new entry's id
 */
export async function addEntryDialog(kind, { name = "", img = "", images = [], metAt, region = "", info = "", source = null, scene = "" } = {}) {
  kind = kind === "places" ? "places" : "faces";
  const texts = ADD[kind];
  if (!store.ready()) {
    ui.notifications.warn(t("NotReady"));
    return null;
  }
  if (!canAdd(kind)) {
    ui.notifications.warn(t(kind === "faces" && combatBlocks() ? "InCombat" : "CannotAdd"));
    return null;
  }
  name = cleanName(name, texts.nameMax);
  // A new place from the Add button: most likely where the party is now.
  let sceneOffer = "";
  if (kind === "places" && !name && !scene) {
    const current = canvas?.scene ?? game.scenes?.viewed;
    name = cleanName(currentSceneName(), texts.nameMax);
    if (current && name) sceneOffer = current.uuid;
  }
  const choices = [...new Set([img, ...images].filter(Boolean))].slice(0, 12);
  const listId = `dxff-add-${kind}-${randomId()}`;
  const places = kind === "faces"
    ? placeSuggestions([...store.allFaces().map(f => f.metAt), ...store.allPlaces().map(p => p.name)])
    : placeSuggestions([...store.allPlaces().map(p => p.region), ...store.allPlaces().map(p => p.name)]);
  const where = kind === "faces" ? (metAt ?? currentSceneName()) : region;

  const imageGrid = choices.length ? `
    <fieldset class="dxff-pick-images">
      <legend>${escapeHTML(t(texts.picture))}</legend>
      <label class="dxff-pick-image dxff-pick-none" data-tooltip="${escapeHTML(t(texts.noPicture))}">
        <input type="radio" name="img" value=""><span><i class="fa-solid fa-ban" inert></i></span>
      </label>
      ${choices.map((src, i) => `
      <label class="dxff-pick-image">
        <input type="radio" name="img" value="${escapeHTML(src)}" ${i === 0 ? "checked" : ""}><img src="${escapeHTML(src)}" alt="">
      </label>`).join("")}
    </fieldset>` : "";

  const content = `
    <div class="dxff dxff-add-face">
      ${source ? `<p class="dxff-source-line"><i class="fa-solid fa-link" inert></i> ${escapeHTML(t("From"))}: <b>${escapeHTML(source.label)}</b></p>` : ""}
      <div class="form-group">
        <label for="${listId}-name">${escapeHTML(t(texts.name))}</label>
        <input id="${listId}-name" type="text" name="name" value="${escapeHTML(name)}" maxlength="${texts.nameMax}" required>
      </div>
      <p class="dxff-dup-warning" hidden>
        <i class="fa-solid fa-triangle-exclamation" inert></i> <span></span>
        <button type="button" data-open-existing><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("Open"))}</button>
      </p>
      <div class="form-group">
        <label for="${listId}-where">${escapeHTML(t(texts.whereLabel))}</label>
        <input id="${listId}-where" type="text" name="where" value="${escapeHTML(where)}" list="${listId}" maxlength="120"
               placeholder="${escapeHTML(t(texts.wherePlaceholder))}">
        <datalist id="${listId}">${places.map(p => `<option value="${escapeHTML(p)}"></option>`).join("")}</datalist>
      </div>
      <div class="form-group stacked">
        <label for="${listId}-info">${escapeHTML(t(texts.info))}</label>
        <textarea id="${listId}-info" name="info" rows="3" placeholder="${escapeHTML(t(texts.infoPlaceholder))}">${escapeHTML(info)}</textarea>
        <p class="hint">${escapeHTML(t("InfoHint"))}</p>
      </div>
      ${imageGrid}
      ${source ? `<label class="dxff-checkbox"><input type="checkbox" name="linkSource" checked> ${escapeHTML(t(texts.linkSource))}</label>` : ""}
      ${sceneOffer ? `<label class="dxff-checkbox"><input type="checkbox" name="linkScene" checked> ${escapeHTML(t("LinkScene", { scene: name }))}</label>` : ""}
    </div>`;

  const result = await DialogV2.wait({
    window: { title: t(texts.title), icon: texts.icon },
    position: { width: 480 },
    classes: ["dxff-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      {
        action: "add", label: t("Add"), icon: "fa-solid fa-check", default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      }
    ],
    render: (event, dialog) => {
      const el = dialog.element;
      const input = el.querySelector("input[name=name]");
      const warn = el.querySelector(".dxff-dup-warning");
      const check = () => {
        const existing = store.findEntryByName(kind, input.value);
        warn.hidden = !existing;
        if (!existing) return;
        warn.querySelector("span").textContent = t(texts.exists, { name: existing.name });
        warn.dataset.entryId = existing.id;
      };
      input.addEventListener("input", check);
      check();
      warn.querySelector("[data-open-existing]").addEventListener("click", () => {
        EntrySheet.openEntry(kind, warn.dataset.entryId);
        dialog.close();
      });
      input.focus();
      input.select();
    }
  });
  if (!result || result === "cancel" || typeof result !== "object") return null;
  const finalName = cleanName(result.name, texts.nameMax);
  if (!finalName) {
    ui.notifications.warn(t("NameRequired"));
    return null;
  }
  try {
    const data = {
      name: finalName,
      img: result.img ?? "",
      info: result.info,
      source: source && result.linkSource ? source : null
    };
    if (kind === "faces") data.metAt = result.where;
    else {
      data.region = result.where;
      data.scene = scene || (sceneOffer && result.linkScene ? sceneOffer : "");
    }
    const id = await store.createEntry(kind, data);
    ui.notifications.info(t(texts.added, { name: escapeHTML(finalName) }));
    return id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/** The Add NPC dialog (see addEntryDialog). */
export function addFaceDialog(prefill = {}) {
  return addEntryDialog("faces", prefill);
}

/** The Add place dialog (see addEntryDialog). */
export function addPlaceDialog(prefill = {}) {
  return addEntryDialog("places", prefill);
}

/* -------------------------------------------- */
/*  "Add image to NPC / place" dialog           */
/* -------------------------------------------- */

const BIND = {
  faces: {
    title: "BindImage", button: "BindButton", hint: "BindHint", newEntry: "NewFaceWithImage", none: "NoFacesYet",
    search: "SearchFaces", pick: "PickFace", done: "PortraitSet", icon: "fa-solid fa-image-portrait", newIcon: "fa-solid fa-user-plus"
  },
  places: {
    title: "BindPlaceImage", button: "BindPlaceButton", hint: "BindPlaceHint", newEntry: "NewPlaceWithImage", none: "NoPlacesYet",
    search: "SearchPlaces", pick: "PickPlace", done: "PictureSet", icon: "fa-solid fa-image", newIcon: "fa-solid fa-map-pin"
  }
};

/** The face or place whose full name appears in a piece of text (a page name, a caption); the longest name wins. */
function guessEntry(entries, hint) {
  const text = String(hint ?? "").toLowerCase();
  if (!text) return null;
  return entries.filter(e => e.name.length > 1 && text.includes(e.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

/**
 * GM: search the faces (or places) and bind an image to one of them as its portrait (picture).
 * @param {string} src
 * @param {object} [options]
 * @param {string} [options.hint]     Text near the image (page name, caption), used to preselect one.
 * @param {string} [options.name]     Name to suggest when a new face or place is made from the image.
 * @param {{uuid: string, label: string}|null} [options.source]
 * @param {"faces"|"places"} [options.kind]
 */
export async function bindImageDialog(src, { hint = "", name = "", source = null, kind = "faces" } = {}) {
  kind = kind === "places" ? "places" : "faces";
  const texts = BIND[kind];
  if (!game.user.isGM) return;
  if (!store.ready()) return ui.notifications.warn(t("NotReady"));
  const entries = store.allEntries(kind).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (!entries.length) {
    ui.notifications.info(t(texts.none));
    return addEntryDialog(kind, { name, img: src, source });
  }
  const guess = guessEntry(entries, hint);
  const content = `
    <div class="dxff dxff-bind">
      <div class="dxff-bind-preview"><img src="${escapeHTML(src)}" alt=""></div>
      <div class="dxff-bind-main">
        ${searchBoxHTML(t(texts.search))}
        <ol class="dxff-bind-list">${entryOptionsHTML(entries, { checked: guess?.id ?? "", portraitMark: true })}</ol>
        <p class="dxff-bind-none" hidden>${escapeHTML(t("NoMatchesAny"))}</p>
        <p class="hint">${escapeHTML(t(texts.hint))}</p>
      </div>
    </div>`;

  const result = await DialogV2.wait({
    window: { title: t(texts.title), icon: texts.icon },
    position: { width: 560 },
    classes: ["dxff-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      { action: "new", label: t(texts.newEntry), icon: texts.newIcon },
      {
        action: "bind", label: t(texts.button), icon: "fa-solid fa-link", default: true,
        callback: (event, button) => button.form.querySelector("input[name=entryId]:checked")?.value ?? ""
      }
    ],
    render: (event, dialog) => wireEntrySearch(dialog.element, { action: "bind" })
  });

  if (result === null || result === undefined || result === "cancel") return;
  if (result === "new") return addEntryDialog(kind, { name, img: src, source });
  const entry = store.getEntry(kind, result);
  if (!entry) return ui.notifications.warn(t(texts.pick));
  await store.setEntryImage(kind, entry.id, src);
  ui.notifications.info(t(texts.done, { name: escapeHTML(entry.name) }));
}

/* -------------------------------------------- */
/*  Sources                                     */
/* -------------------------------------------- */

/** Works out which journal (page) or other document window an element is in. */
function sourceForElement(el) {
  const appEl = el?.closest?.(".application, .app");
  const app = appEl ? foundry.applications.instances.get(appEl.id) ?? ui.windows?.[appEl.dataset.appid] : null;
  const doc = app?.document ?? app?.object;
  const pageEl = el?.closest?.("[data-page-id]");
  if (doc instanceof JournalEntry) {
    if (store.isStore(doc)) return null;
    const page = pageEl ? doc.pages.get(pageEl.dataset.pageId) : null;
    if (page) return { uuid: page.uuid, label: `${doc.name}: ${page.name}`, page };
    return { uuid: doc.uuid, label: doc.name, page: null };
  }
  if (doc instanceof JournalEntryPage) return { uuid: doc.uuid, label: `${doc.parent?.name ?? ""}: ${doc.name}`, page: doc };
  if (doc?.uuid) return { uuid: doc.uuid, label: doc.name ?? doc.documentName, page: null };
  return null;
}

function link(source) {
  return source ? { uuid: source.uuid, label: source.label } : null;
}

function journalImages(entry) {
  const pages = entry.pages.contents.filter(p => p.testUserPermission(game.user, "OBSERVER")).sort((a, b) => a.sort - b.sort);
  return [...new Set(pages.flatMap(imagesInPage))];
}

/* -------------------------------------------- */
/*  Foundry context menus (Journal directory)   */
/* -------------------------------------------- */

const MENU_ICON = '<i class="fa-solid fa-masks-theater"></i>';
const PLACE_ICON = '<i class="fa-solid fa-map-location-dot"></i>';

export function registerContextMenus() {
  Hooks.on("getJournalEntryContextOptions", (app, options) => {
    const entry = li => game.journal.get(li.closest("[data-entry-id]")?.dataset.entryId);
    const usable = (li, kind) => {
      const e = entry(li);
      return store.ready() && canAdd(kind) && !!e && !store.isStore(e) && e.testUserPermission(game.user, "OBSERVER");
    };
    const add = (li, kind) => {
      const e = entry(li);
      if (e) addEntryDialog(kind, { name: e.name, images: journalImages(e), source: { uuid: e.uuid, label: e.name } });
    };
    options.push({
      name: "DXFF.Ctx.AddEntry", icon: MENU_ICON,
      condition: li => usable(li, "faces"), callback: li => add(li, "faces")
    }, {
      name: "DXFF.Ctx.AddEntryPlace", icon: PLACE_ICON,
      condition: li => usable(li, "places"), callback: li => add(li, "places")
    });
  });

  Hooks.on("getJournalEntryPageContextOptions", (app, options) => {
    const page = li => app.document?.pages.get(li.dataset.pageId);
    const usable = (li, kind) => store.ready() && canAdd(kind) && !store.isStore(app.document) && !!page(li)?.testUserPermission(game.user, "OBSERVER");
    const add = (li, kind) => {
      const p = page(li);
      if (p) addEntryDialog(kind, { name: p.name, images: imagesInPage(p), source: { uuid: p.uuid, label: `${p.parent.name}: ${p.name}` } });
    };
    const imagePage = li => game.user.isGM && store.ready() && page(li)?.type === "image" && !!page(li)?.src;
    const bind = (li, kind) => {
      const p = page(li);
      if (p?.src) bindImageDialog(p.src, { kind, hint: `${p.name} ${p.image?.caption ?? ""}`, name: p.name, source: { uuid: p.uuid, label: `${p.parent.name}: ${p.name}` } });
    };
    options.push({
      name: "DXFF.Ctx.AddPage", icon: MENU_ICON,
      condition: li => usable(li, "faces"), callback: li => add(li, "faces")
    }, {
      name: "DXFF.Ctx.AddPagePlace", icon: PLACE_ICON,
      condition: li => usable(li, "places"), callback: li => add(li, "places")
    }, {
      name: "DXFF.Ctx.BindImage", icon: '<i class="fa-solid fa-image-portrait"></i>',
      condition: imagePage, callback: li => bind(li, "faces")
    }, {
      name: "DXFF.Ctx.BindPlaceImage", icon: '<i class="fa-solid fa-image"></i>',
      condition: imagePage, callback: li => bind(li, "places")
    });
  });
}

/* -------------------------------------------- */
/*  Our own small right-click menu              */
/* -------------------------------------------- */

let menuEl = null;

function closeMenu() {
  menuEl?.remove();
  menuEl = null;
  document.removeEventListener("pointerdown", onOutside, true);
  document.removeEventListener("keydown", onKey, true);
  window.removeEventListener("blur", closeMenu);
  window.removeEventListener("wheel", closeMenu, true);
}

function onOutside(event) {
  if (!menuEl?.contains(event.target)) closeMenu();
}

function onKey(event) {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeMenu();
  }
}

function itemHTML(item, i) {
  return `<li role="menuitem" tabindex="-1" data-dxff-item="${i}"><i class="${item.icon}" inert></i><span>${escapeHTML(item.label)}</span></li>`;
}

export function showMenu(x, y, items) {
  closeMenu();
  menuEl = document.createElement("nav");
  menuEl.id = "dxff-context-menu";
  menuEl.className = "dxff dxff-ctx";
  menuEl.setAttribute("role", "menu");
  menuEl.innerHTML = `<header><i class="fa-solid fa-masks-theater" inert></i> ${escapeHTML(t("Title"))}</header><ol>${items.map(itemHTML).join("")}</ol>`;
  document.body.append(menuEl);
  const { width, height } = menuEl.getBoundingClientRect();
  menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
  menuEl.addEventListener("click", event => {
    const i = event.target.closest("[data-dxff-item]")?.dataset.dxffItem;
    if (i === undefined) return;
    closeMenu();
    items[Number(i)]?.run();
  });
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("wheel", closeMenu, true);
  }, 0);
}

/* -------------------------------------------- */
/*  Right-click on a selected name              */
/* -------------------------------------------- */

/** The current text selection as a face name, with the journal page it is in and that page's images. */
function selectionAsName(event = null) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const raw = selection.toString();
  if (!raw.trim() || raw.length > MAX_NAME * 2 || /\n\s*\n/.test(raw)) return null;
  const name = cleanName(raw);
  if (!name || name.length > MAX_NAME) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (el?.closest?.(EDITING) || el?.closest?.(".dxff")) return null;
  if (event) {
    if (event.target.closest?.(EDITING)) return null;
    const pad = 6;
    const inside = [...range.getClientRects()].some(r =>
      event.clientX >= r.left - pad && event.clientX <= r.right + pad && event.clientY >= r.top - pad && event.clientY <= r.bottom + pad);
    if (!inside) return null;
  }
  const source = sourceForElement(el);
  const images = source?.page ? imagesInPage(source.page) : imagesIn(el?.closest?.(".journal-entry-page, article, .window-content"));
  return { name, images, source };
}

function selectionItems(found) {
  const items = [];
  const existing = store.findByName(found.name);
  const place = store.findPlaceByName(found.name);
  if (existing) items.push({ icon: "fa-solid fa-address-card", label: t("Ctx.OpenFace", { name: existing.name }), run: () => FaceSheet.open(existing.id) });
  if (place) items.push({ icon: "fa-solid fa-map-location-dot", label: t("Ctx.OpenPlace", { name: place.name }), run: () => PlaceSheet.open(place.id) });
  if (combatBlocks()) {
    items.push({ icon: "fa-solid fa-swords", label: t("Ctx.InCombat"), run: () => ui.notifications.info(t("InCombat")) });
  } else {
    items.push({
      icon: "fa-solid fa-user-plus",
      label: t(existing ? "Ctx.AddNameAgain" : "Ctx.AddName", { name: found.name }),
      run: () => addEntryDialog("faces", { name: found.name, images: found.images, source: link(found.source) })
    });
  }
  // Places don't wait for the fight to end.
  if (canAddPlaces()) {
    items.push({
      icon: "fa-solid fa-map-pin",
      label: t(place ? "Ctx.AddPlaceNameAgain" : "Ctx.AddPlaceName", { name: found.name }),
      run: () => addEntryDialog("places", { name: found.name, images: found.images, source: link(found.source) })
    });
  }
  return items;
}

function selectionMenuAllowed() {
  return game.ready && store.ready() && mayAddFaces() && game.settings.get(MODULE_ID, "selectionMenu");
}

function onSelectionContextMenu(event) {
  if (event.shiftKey || !selectionMenuAllowed()) return;
  const found = selectionAsName(event);
  if (!found) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  showMenu(event.clientX, event.clientY, selectionItems(found));
}

/*
 * Dxcufgb's Quest log has its own menu for selected text. Its listener is registered at init and ours at ready, so
 * when it shows its menu ours never runs; our items are added to the bottom of its menu instead, so both work.
 */
function injectIntoQuestLogMenu(menu) {
  if (!selectionMenuAllowed()) return;
  const found = selectionAsName();
  const ol = menu.querySelector("ol");
  if (!found || !ol || ol.querySelector("[data-dxff-item]")) return;
  const items = selectionItems(found);
  ol.insertAdjacentHTML("beforeend", `<li class="dxql-ctx-sep" role="separator"></li>${items.map(itemHTML).join("")}`);
  for (const li of ol.querySelectorAll("[data-dxff-item]")) {
    li.addEventListener("click", event => {
      event.stopPropagation();
      menu.remove();
      items[Number(li.dataset.dxffItem)]?.run();
    });
  }
  const rect = menu.getBoundingClientRect();
  if (rect.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
}

function watchQuestLogMenu() {
  if (!game.modules.get(QUEST_LOG_ID)?.active) return;
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.id === "dxql-context-menu") {
          try {
            injectIntoQuestLogMenu(node);
          } catch (err) {
            console.error(`${MODULE_ID} | quest log menu`, err);
          }
        }
      }
    }
  }).observe(document.body, { childList: true });
}

/* -------------------------------------------- */
/*  Right-click on a journal image (GM)         */
/* -------------------------------------------- */

function onImageContextMenu(event) {
  if (event.shiftKey || !game.ready || !game.user.isGM || !store.ready()) return;
  if (!game.settings.get(MODULE_ID, "imageMenu")) return;
  const img = event.target instanceof HTMLImageElement ? event.target : null;
  if (!img?.closest(JOURNAL_IMAGE_SCOPE) || img.closest(EDITING) || img.closest(".dxff")) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount && selection.getRangeAt(0).intersectsNode(img)) return;
  const src = img.getAttribute("src");
  if (!src || src.startsWith("data:")) return;

  const source = sourceForElement(img);
  const caption = img.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
  const hint = [source?.page?.name, img.alt, img.title, caption, source?.label].filter(Boolean).join(" ");
  const name = cleanName(source?.page?.name || img.alt || "");
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  showMenu(event.clientX, event.clientY, [
    { icon: "fa-solid fa-image-portrait", label: t("Ctx.BindImage"), run: () => bindImageDialog(src, { hint, name, source: link(source) }) },
    { icon: "fa-solid fa-user-plus", label: t("Ctx.NewFaceWithImage"), run: () => addEntryDialog("faces", { name, img: src, source: link(source) }) },
    { icon: "fa-solid fa-image", label: t("Ctx.BindPlaceImage"), run: () => bindImageDialog(src, { kind: "places", hint, name, source: link(source) }) },
    { icon: "fa-solid fa-map-pin", label: t("Ctx.NewPlaceWithImage"), run: () => addEntryDialog("places", { name, img: src, source: link(source) }) },
    { icon: "fa-solid fa-expand", label: t("Ctx.ViewImage"), run: () => showImage(src, cleanLine(name || source?.label, 80)) }
  ]);
}

/**
 * Registered at ready on document, the same target as the Quest log's init-time listener, so its listener gets the
 * event first (a capture listener on window would run before every listener on document).
 */
export function registerPointerMenus() {
  document.addEventListener("contextmenu", onImageContextMenu, true);
  document.addEventListener("contextmenu", onSelectionContextMenu, true);
  watchQuestLogMenu();
}
