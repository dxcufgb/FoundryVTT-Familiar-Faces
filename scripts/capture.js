import {
  MODULE_ID, QUEST_LOG_ID, t, escapeHTML, cleanLine, cleanName, imagesIn, imagesInPage, currentSceneName, placeSuggestions,
  canAddFaces, nameHue, initials, randomId
} from "./util.js";
import * as store from "./store.js";
import { FaceSheet } from "./apps/face-sheet.js";
import { tokenize } from "./search.js";
import { showImage } from "./images.js";

const { DialogV2 } = foundry.applications.api;
const MAX_NAME = 80;
/** Where a right-clicked image counts as a journal image. */
const JOURNAL_IMAGE_SCOPE = ".journal-entry-page, .journal-entry-content, .journal-page-content, .application.journal-entry, .application.journal-sheet, .journal-sheet, .image-popout";
const EDITING = "input, textarea, select, [contenteditable=''], [contenteditable=true], prose-mirror, .editor-content, #board";

/* -------------------------------------------- */
/*  "Add to Familiar Faces" dialog              */
/* -------------------------------------------- */

/**
 * Asks for the details of a new face and creates it.
 * @param {object} [prefill]
 * @param {string} [prefill.name]
 * @param {string} [prefill.img]          The portrait to preselect.
 * @param {string[]} [prefill.images]     More images to offer (e.g. the images of the journal page).
 * @param {string} [prefill.metAt]        Defaults to the current scene.
 * @param {string} [prefill.info]
 * @param {{uuid: string, label: string}|null} [prefill.source]
 * @returns {Promise<string|null>} the new face's id
 */
export async function addFaceDialog({ name = "", img = "", images = [], metAt, info = "", source = null } = {}) {
  if (!store.ready()) {
    ui.notifications.warn(t("NotReady"));
    return null;
  }
  if (!canAddFaces()) {
    ui.notifications.warn(t("CannotAdd"));
    return null;
  }
  name = cleanName(name);
  const choices = [...new Set([img, ...images].filter(Boolean))].slice(0, 12);
  const listId = `dxff-add-places-${randomId()}`;
  const places = placeSuggestions(store.allFaces().map(f => f.metAt));
  const place = metAt ?? currentSceneName();

  const imageGrid = choices.length ? `
    <fieldset class="dxff-pick-images">
      <legend>${escapeHTML(t("Portrait"))}</legend>
      <label class="dxff-pick-image dxff-pick-none" data-tooltip="${escapeHTML(t("NoPortrait"))}">
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
        <label for="${listId}-name">${escapeHTML(t("Field.Name"))}</label>
        <input id="${listId}-name" type="text" name="name" value="${escapeHTML(name)}" maxlength="${MAX_NAME}" required>
      </div>
      <p class="dxff-dup-warning" hidden>
        <i class="fa-solid fa-triangle-exclamation" inert></i> <span></span>
        <button type="button" data-open-existing><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("Open"))}</button>
      </p>
      <div class="form-group">
        <label for="${listId}-met">${escapeHTML(t("Field.MetAt"))}</label>
        <input id="${listId}-met" type="text" name="metAt" value="${escapeHTML(place)}" list="${listId}" maxlength="120"
               placeholder="${escapeHTML(t("Placeholder.MetAt"))}">
        <datalist id="${listId}">${places.map(p => `<option value="${escapeHTML(p)}"></option>`).join("")}</datalist>
      </div>
      <div class="form-group stacked">
        <label for="${listId}-info">${escapeHTML(t("Field.Info"))}</label>
        <textarea id="${listId}-info" name="info" rows="3" placeholder="${escapeHTML(t("Placeholder.Info"))}">${escapeHTML(info)}</textarea>
        <p class="hint">${escapeHTML(t("InfoHint"))}</p>
      </div>
      ${imageGrid}
      ${source ? `<label class="dxff-checkbox"><input type="checkbox" name="linkSource" checked> ${escapeHTML(t("LinkSource"))}</label>` : ""}
    </div>`;

  const result = await DialogV2.wait({
    window: { title: t("AddFace"), icon: "fa-solid fa-user-plus" },
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
        const existing = store.findByName(input.value);
        warn.hidden = !existing;
        if (!existing) return;
        warn.querySelector("span").textContent = t("AlreadyExists", { name: existing.name });
        warn.dataset.faceId = existing.id;
      };
      input.addEventListener("input", check);
      check();
      warn.querySelector("[data-open-existing]").addEventListener("click", () => {
        FaceSheet.open(warn.dataset.faceId);
        dialog.close();
      });
      input.focus();
      input.select();
    }
  });
  if (!result || result === "cancel" || typeof result !== "object") return null;
  const finalName = cleanName(result.name);
  if (!finalName) {
    ui.notifications.warn(t("NameRequired"));
    return null;
  }
  try {
    const id = await store.createFace({
      name: finalName,
      img: result.img ?? "",
      metAt: result.metAt,
      info: result.info,
      source: source && result.linkSource ? source : null
    });
    ui.notifications.info(t("Added", { name: escapeHTML(finalName) }));
    return id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/* -------------------------------------------- */
/*  "Add image to NPC" dialog                   */
/* -------------------------------------------- */

/** The face whose full name appears in a piece of text (a page name, a caption); the longest name wins. */
function guessFace(faces, hint) {
  const text = String(hint ?? "").toLowerCase();
  if (!text) return null;
  return faces.filter(f => f.name.length > 1 && text.includes(f.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

/**
 * GM: search the familiar faces and bind an image to one of them as its portrait.
 * @param {string} src
 * @param {object} [options]
 * @param {string} [options.hint]     Text near the image (page name, caption), used to preselect a face.
 * @param {string} [options.name]     Name to suggest when a new face is made from the image.
 * @param {{uuid: string, label: string}|null} [options.source]
 */
export async function bindImageDialog(src, { hint = "", name = "", source = null } = {}) {
  if (!game.user.isGM) return;
  if (!store.ready()) return ui.notifications.warn(t("NotReady"));
  const faces = store.allFaces().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (!faces.length) {
    ui.notifications.info(t("NoFacesYet"));
    return addFaceDialog({ name, img: src, source });
  }
  const guess = guessFace(faces, hint);
  const list = faces.map(f => `
    <li>
      <label class="dxff-bind-option" data-search="${escapeHTML(`${f.name} ${f.metAt}`.toLowerCase())}">
        <input type="radio" name="faceId" value="${f.id}" ${f.id === guess?.id ? "checked" : ""}>
        <span class="dxff-avatar" style="--hue: ${nameHue(f.name)}">${f.img ? `<img src="${escapeHTML(f.img)}" alt="">` : `<span>${escapeHTML(initials(f.name))}</span>`}</span>
        <span class="dxff-bind-name">${escapeHTML(f.name)}${f.metAt ? `<small><i class="fa-solid fa-location-dot" inert></i> ${escapeHTML(f.metAt)}</small>` : ""}</span>
        ${f.img ? `<i class="fa-solid fa-image dxff-has-portrait" data-tooltip="${escapeHTML(t("HasPortrait"))}"></i>` : ""}
      </label>
    </li>`).join("");

  const content = `
    <div class="dxff dxff-bind">
      <div class="dxff-bind-preview"><img src="${escapeHTML(src)}" alt=""></div>
      <div class="dxff-bind-main">
        <div class="dxff-search">
          <i class="fa-solid fa-magnifying-glass" inert></i>
          <input type="search" name="q" placeholder="${escapeHTML(t("SearchFaces"))}" autocomplete="off" aria-label="${escapeHTML(t("SearchFaces"))}">
        </div>
        <ol class="dxff-bind-list">${list}</ol>
        <p class="dxff-bind-none" hidden>${escapeHTML(t("NoMatches"))}</p>
        <p class="hint">${escapeHTML(t("BindHint"))}</p>
      </div>
    </div>`;

  const result = await DialogV2.wait({
    window: { title: t("BindImage"), icon: "fa-solid fa-image-portrait" },
    position: { width: 560 },
    classes: ["dxff-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      { action: "new", label: t("NewFaceWithImage"), icon: "fa-solid fa-user-plus" },
      {
        action: "bind", label: t("BindButton"), icon: "fa-solid fa-link", default: true,
        callback: (event, button) => button.form.querySelector("input[name=faceId]:checked")?.value ?? ""
      }
    ],
    render: (event, dialog) => {
      const el = dialog.element;
      const input = el.querySelector("input[name=q]");
      const none = el.querySelector(".dxff-bind-none");
      const options = [...el.querySelectorAll(".dxff-bind-option")];
      const filter = () => {
        const terms = tokenize(input.value);
        let shown = 0;
        for (const opt of options) {
          const ok = terms.every(term => opt.dataset.search.includes(term));
          opt.closest("li").hidden = !ok;
          if (ok) shown++;
        }
        none.hidden = shown > 0;
        const checked = el.querySelector("input[name=faceId]:checked");
        if (!checked || checked.closest("li").hidden) {
          const first = options.find(o => !o.closest("li").hidden)?.querySelector("input");
          if (first && terms.length) first.checked = true;
        }
      };
      input.addEventListener("input", filter);
      input.addEventListener("keydown", ev => {
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          (el.querySelector("input[name=faceId]:checked") ?? options.find(o => !o.closest("li").hidden)?.querySelector("input"))?.focus();
        }
      });
      for (const opt of options) {
        opt.addEventListener("dblclick", () => el.querySelector("button[data-action=bind]")?.click());
      }
      el.querySelector("input[name=faceId]:checked")?.closest("li")?.scrollIntoView({ block: "nearest" });
      input.focus();
    }
  });

  if (result === null || result === undefined || result === "cancel") return;
  if (result === "new") return addFaceDialog({ name, img: src, source });
  const face = store.getFace(result);
  if (!face) return ui.notifications.warn(t("PickFace"));
  await store.setImage(face.id, src);
  ui.notifications.info(t("PortraitSet", { name: escapeHTML(face.name) }));
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

export function registerContextMenus() {
  Hooks.on("getJournalEntryContextOptions", (app, options) => {
    const entry = li => game.journal.get(li.closest("[data-entry-id]")?.dataset.entryId);
    options.push({
      name: "DXFF.Ctx.AddEntry",
      icon: MENU_ICON,
      condition: li => {
        const e = entry(li);
        return store.ready() && canAddFaces() && !!e && !store.isStore(e) && e.testUserPermission(game.user, "OBSERVER");
      },
      callback: li => {
        const e = entry(li);
        if (e) addFaceDialog({ name: e.name, images: journalImages(e), source: { uuid: e.uuid, label: e.name } });
      }
    });
  });

  Hooks.on("getJournalEntryPageContextOptions", (app, options) => {
    const page = li => app.document?.pages.get(li.dataset.pageId);
    options.push({
      name: "DXFF.Ctx.AddPage",
      icon: MENU_ICON,
      condition: li => store.ready() && canAddFaces() && !store.isStore(app.document) && !!page(li)?.testUserPermission(game.user, "OBSERVER"),
      callback: li => {
        const p = page(li);
        if (p) addFaceDialog({ name: p.name, images: imagesInPage(p), source: { uuid: p.uuid, label: `${p.parent.name}: ${p.name}` } });
      }
    }, {
      name: "DXFF.Ctx.BindImage",
      icon: '<i class="fa-solid fa-image-portrait"></i>',
      condition: li => game.user.isGM && store.ready() && page(li)?.type === "image" && !!page(li)?.src,
      callback: li => {
        const p = page(li);
        if (p?.src) bindImageDialog(p.src, { hint: `${p.name} ${p.image?.caption ?? ""}`, name: p.name, source: { uuid: p.uuid, label: `${p.parent.name}: ${p.name}` } });
      }
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
  if (existing) items.push({ icon: "fa-solid fa-address-card", label: t("Ctx.OpenFace", { name: existing.name }), run: () => FaceSheet.open(existing.id) });
  items.push({
    icon: "fa-solid fa-user-plus",
    label: t(existing ? "Ctx.AddNameAgain" : "Ctx.AddName", { name: found.name }),
    run: () => addFaceDialog({ name: found.name, images: found.images, source: link(found.source) })
  });
  return items;
}

function selectionMenuAllowed() {
  return game.ready && store.ready() && canAddFaces() && game.settings.get(MODULE_ID, "selectionMenu");
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
    { icon: "fa-solid fa-user-plus", label: t("Ctx.NewFaceWithImage"), run: () => addFaceDialog({ name, img: src, source: link(source) }) },
    { icon: "fa-solid fa-expand", label: t("Ctx.ViewImage"), run: () => showImage(src, cleanLine(name || source?.label, 80)) }
  ]);
}

/** Registered at ready, so other modules' init-time listeners (the Quest log's) get the event first. */
export function registerPointerMenus() {
  window.addEventListener("contextmenu", onImageContextMenu, true);
  window.addEventListener("contextmenu", onSelectionContextMenu, true);
  watchQuestLogMenu();
}
