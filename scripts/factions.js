import { t, escapeHTML, cleanLine, uniqueSuggestions, randomId } from "./util.js";
import * as store from "./store.js";
import { FactionSheet } from "./apps/faction-sheet.js";
import { placeholderGridHTML, isPlaceholder } from "./placeholders.js";

/*
 * Factions, the counterpart of places.js: a player adds a faction they have heard of → it goes into their own list
 * (only they, and the GM, see it) until they share it with the party.
 */

/** Player: adds a faction to their own list (or opens it when it's already there). */
export async function addFactionForMe(faction) {
  if (!faction?.name) return null;
  try {
    const existing = store.findFactionByName(faction.name, { any: true });
    if (existing && store.canSeeEntry(existing)) {
      FactionSheet.open(existing.id);
      return existing.id;
    }
    let id = existing?.id;
    if (existing) await store.addKnowerTo("factions", existing.id);
    else id = await store.createFaction({ ...faction, knownBy: [game.user.id] });
    ui.notifications.info(t("FactionAddedForMe", { name: escapeHTML(faction.name) }));
    return id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/** Player: adds a faction they know of to their own list, then opens it so they can write notes. */
export async function addKnownFactionDialog() {
  if (!store.ready()) return ui.notifications.warn(t("NotReady"));
  const id = `dxff-faction-${randomId()}`;
  const categories = uniqueSuggestions(store.allFactions().map(f => f.category));
  const content = `
    <div class="dxff dxff-add-face">
      <p class="hint">${escapeHTML(t("AddKnownFactionIntro"))}</p>
      <div class="form-group">
        <label for="${id}-name">${escapeHTML(t("Field.FactionName"))}</label>
        <input id="${id}-name" type="text" name="name" maxlength="120" required
               placeholder="${escapeHTML(t("Placeholder.KnownFactionName"))}">
      </div>
      <p class="dxff-dup-warning" hidden>
        <i class="fa-solid fa-circle-info" inert></i> <span></span>
        <button type="button" data-open-existing><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("Open"))}</button>
      </p>
      <div class="form-group">
        <label for="${id}-category">${escapeHTML(t("Field.Category"))}</label>
        <input id="${id}-category" type="text" name="category" list="${id}-categories" maxlength="120"
               placeholder="${escapeHTML(t("Placeholder.Category"))}">
        <datalist id="${id}-categories">${categories.map(c => `<option value="${escapeHTML(c)}"></option>`).join("")}</datalist>
      </div>
      <div class="form-group stacked">
        <label for="${id}-info">${escapeHTML(t("Field.KnownFactionInfo"))}</label>
        <textarea id="${id}-info" name="info" rows="3" placeholder="${escapeHTML(t("Placeholder.KnownFactionInfo"))}"></textarea>
        <p class="hint">${escapeHTML(t("AddKnownFactionHintPrivate"))}</p>
      </div>
      ${placeholderGridHTML("", { kind: "factions" })}
    </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: t("AddKnownFaction"), icon: "fa-solid fa-shield-halved" },
    position: { width: 500 },
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
      // Only factions this player already has: what other players know of is not theirs to see.
      const check = () => {
        const existing = store.findFactionByName(input.value);
        warn.hidden = !existing;
        if (!existing) return;
        warn.querySelector("span").textContent = t("FactionAlreadyYours", { name: existing.name });
        warn.dataset.factionId = existing.id;
      };
      input.addEventListener("input", check);
      warn.querySelector("[data-open-existing]").addEventListener("click", () => {
        FactionSheet.open(warn.dataset.factionId);
        dialog.close();
      });
      input.focus();
    }
  });
  if (!result || typeof result !== "object") return null;
  const name = cleanLine(result.name, 120);
  if (!name) {
    ui.notifications.warn(t("NameRequired"));
    return null;
  }
  const img = isPlaceholder(result.placeholder) ? result.placeholder : "";
  const factionId = await addFactionForMe({
    name, category: cleanLine(result.category, 120), info: String(result.info ?? "").trim(), img
  });
  if (factionId) FactionSheet.open(factionId);
  return factionId;
}
