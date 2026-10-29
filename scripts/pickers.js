import { t, escapeHTML, nameHue, initials } from "./util.js";
import { tokenize } from "./search.js";
import { hasRealPortrait } from "./placeholders.js";

/*
 * A searchable list of faces, places or factions to pick from: the "Add image to NPC/place/faction" dialog (one, radio buttons) and the
 * link dialogs of the sheets (several, checkboxes).
 */

const SUBLINE = {
  faces: { field: "metAt", icon: "fa-solid fa-location-dot" },
  places: { field: "region", icon: "fa-solid fa-map" },
  factions: { field: "category", icon: "fa-solid fa-tag" }
};

/** The line under a name: where a face was first met, the region of a place, or the kind of a faction. */
function subline(entry) {
  const { field, icon } = SUBLINE[entry.kind] ?? SUBLINE.faces;
  const text = entry[field];
  return text ? `<small><i class="${icon}" inert></i> ${escapeHTML(text)}</small>` : "";
}

/** Faces are round, places rounded squares, factions crests. */
export function avatarClass(kind) {
  return kind === "places" ? "dxff-square" : kind === "factions" ? "dxff-crest" : "";
}

/**
 * The options of the list.
 * @param {object[]} entries
 * @param {object} [options]
 * @param {"radio"|"checkbox"} [options.type]
 * @param {string} [options.checked]          Id of the option to check (radio).
 * @param {boolean} [options.portraitMark]    Mark the entries that already have a picture of their own.
 */
export function entryOptionsHTML(entries, { type = "radio", checked = "", portraitMark = false } = {}) {
  return entries.map(e => `
    <li>
      <label class="dxff-bind-option" data-search="${escapeHTML(`${e.name} ${e.metAt ?? ""} ${e.region ?? ""} ${e.category ?? ""}`.toLowerCase())}">
        <input type="${type}" name="entryId" value="${escapeHTML(e.id)}" ${e.id === checked ? "checked" : ""}>
        <span class="dxff-avatar ${avatarClass(e.kind)}" style="--hue: ${nameHue(e.name)}">${e.img ? `<img src="${escapeHTML(e.img)}" alt="">` : `<span>${escapeHTML(initials(e.name))}</span>`}</span>
        <span class="dxff-bind-name">${escapeHTML(e.name)}${subline(e)}</span>
        ${portraitMark && hasRealPortrait(e.img) ? `<i class="fa-solid fa-image dxff-has-portrait" data-tooltip="${escapeHTML(t(e.kind === "faces" ? "HasPortrait" : "HasPicture"))}"></i>` : ""}
      </label>
    </li>`).join("");
}

/** The search box above the list. */
export function searchBoxHTML(placeholder) {
  return `
    <div class="dxff-search">
      <i class="fa-solid fa-magnifying-glass" inert></i>
      <input type="search" name="q" placeholder="${escapeHTML(placeholder)}" autocomplete="off" aria-label="${escapeHTML(placeholder)}">
    </div>`;
}

/**
 * Filters the options as the user types; with radio buttons the first match is picked. Double-clicking an option
 * presses the dialog's button `action`.
 */
export function wireEntrySearch(el, { action = null, pickFirst = true } = {}) {
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
    if (none) none.hidden = shown > 0;
    if (!pickFirst) return;
    const checked = el.querySelector("input[name=entryId]:checked");
    if (!checked || checked.closest("li").hidden) {
      const first = options.find(o => !o.closest("li").hidden)?.querySelector("input");
      if (first && terms.length) first.checked = true;
    }
  };
  input.addEventListener("input", filter);
  input.addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      (el.querySelector("input[name=entryId]:checked") ?? options.find(o => !o.closest("li").hidden)?.querySelector("input"))?.focus();
    }
  });
  if (action) {
    for (const opt of options) {
      opt.addEventListener("dblclick", () => el.querySelector(`button[data-action=${action}]`)?.click());
    }
  }
  el.querySelector("input[name=entryId]:checked")?.closest("li")?.scrollIntoView({ block: "nearest" });
  input.focus();
}

/**
 * Lets the user pick several faces or places (to link them). Resolves to the chosen ids ([] when cancelled).
 * @param {object[]} entries
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.hint
 * @param {string} options.search   Placeholder of the search box.
 */
export async function pickEntriesDialog(entries, { title, hint, search, icon = "fa-solid fa-link" }) {
  const content = `
    <div class="dxff dxff-bind dxff-pick-entries">
      <div class="dxff-bind-main">
        ${searchBoxHTML(search)}
        <ol class="dxff-bind-list">${entryOptionsHTML(entries, { type: "checkbox" })}</ol>
        <p class="dxff-bind-none" hidden>${escapeHTML(t("NoMatchesAny"))}</p>
        <p class="hint">${escapeHTML(hint)}</p>
      </div>
    </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title, icon },
    position: { width: 420 },
    classes: ["dxff-dialog"],
    content,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      {
        action: "link", label: t("LinkButton"), icon: "fa-solid fa-link", default: true,
        callback: (event, button) => [...button.form.querySelectorAll("input[name=entryId]:checked")].map(i => i.value)
      }
    ],
    render: (event, dialog) => wireEntrySearch(dialog.element, { pickFirst: false })
  });
  return Array.isArray(result) ? result : [];
}
