import { t, escapeHTML, cleanLine, currentSceneName, placeSuggestions, randomId } from "./util.js";
import * as store from "./store.js";
import { PlaceSheet } from "./apps/place-sheet.js";
import { placeholderGridHTML, isPlaceholder } from "./placeholders.js";
import { sceneImage } from "./images.js";

/*
 * Places, the counterpart of npcs.js:
 *   - a player adds a place they visited → it goes into their own Familiar Places (only they, and the GM, see it);
 *   - the GM adds a scene from the Scenes directory → a place for the whole party, with the scene's name and picture.
 */

const MENU_ICON = '<i class="fa-solid fa-map-location-dot"></i>';

export function placeFromScene(scene) {
  return {
    name: cleanLine(scene?.navName || scene?.name, 120),
    img: sceneImage(scene),
    scene: scene?.uuid ?? ""
  };
}

/** The place with this name, including places only other players know. */
function existingPlace(place) {
  return store.findPlaceByName(place.name, { any: true });
}

/** Player: adds a place to their own Familiar Places (or opens it when it's already there). */
export async function addPlaceForMe(place) {
  if (!place?.name) return null;
  try {
    const existing = existingPlace(place);
    if (existing && store.canSeeEntry(existing)) {
      PlaceSheet.open(existing.id);
      return existing.id;
    }
    let id = existing?.id;
    if (existing) await store.addKnowerTo("places", existing.id);
    else id = await store.createPlace({ ...place, knownBy: [game.user.id] });
    ui.notifications.info(t("PlaceAddedForMe", { name: escapeHTML(place.name) }));
    return id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/** GM: adds a place to every player's Familiar Places. */
export async function addPlaceForAll(place) {
  if (!game.user.isGM || !place?.name) return null;
  try {
    const existing = existingPlace(place);
    if (!existing) {
      const id = await store.createPlace(place);
      ui.notifications.info(t("PlaceAdded", { name: escapeHTML(place.name) }));
      return id;
    }
    if (!existing.knownBy) {
      ui.notifications.info(t("PlaceAlreadyExists", { name: escapeHTML(existing.name) }));
      PlaceSheet.open(existing.id);
      return existing.id;
    }
    // Some players already have it: now everyone does. Fill in what the place is missing.
    await store.sharePlaceWithParty(existing.id);
    const missing = {};
    if (!existing.img && place.img) missing.img = place.img;
    if (!existing.scene && place.scene) missing.scene = place.scene;
    if (Object.keys(missing).length) await store.updatePlace(existing.id, missing);
    ui.notifications.info(t("SharedPlaceWithParty", { name: escapeHTML(existing.name) }));
    return existing.id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/**
 * Player: adds a place they visited to their own Familiar Places, then opens it so they can write notes. Only they
 * (and the GM) see it until they share it with the party. The name starts as the current scene.
 */
export async function addVisitedPlaceDialog() {
  if (!store.ready()) return ui.notifications.warn(t("NotReady"));
  const id = `dxff-visit-${randomId()}`;
  const regions = placeSuggestions([...store.allPlaces().map(p => p.region), ...store.allPlaces().map(p => p.name)]);
  const scene = canvas?.scene ?? game.scenes?.viewed;
  const sceneName = currentSceneName();
  const content = `
    <div class="dxff dxff-add-face">
      <p class="hint">${escapeHTML(t("AddVisitedIntro"))}</p>
      <div class="form-group">
        <label for="${id}-name">${escapeHTML(t("Field.PlaceName"))}</label>
        <input id="${id}-name" type="text" name="name" value="${escapeHTML(sceneName)}" maxlength="120" required
               placeholder="${escapeHTML(t("Placeholder.VisitedName"))}">
      </div>
      <p class="dxff-dup-warning" hidden>
        <i class="fa-solid fa-circle-info" inert></i> <span></span>
        <button type="button" data-open-existing><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("Open"))}</button>
      </p>
      <div class="form-group">
        <label for="${id}-region">${escapeHTML(t("Field.Region"))}</label>
        <input id="${id}-region" type="text" name="region" list="${id}-regions" maxlength="120"
               placeholder="${escapeHTML(t("Placeholder.Region"))}">
        <datalist id="${id}-regions">${regions.map(p => `<option value="${escapeHTML(p)}"></option>`).join("")}</datalist>
      </div>
      <div class="form-group stacked">
        <label for="${id}-info">${escapeHTML(t("Field.VisitedInfo"))}</label>
        <textarea id="${id}-info" name="info" rows="3" placeholder="${escapeHTML(t("Placeholder.VisitedInfo"))}"></textarea>
        <p class="hint">${escapeHTML(t("AddVisitedHintPrivate"))}</p>
      </div>
      ${scene && sceneName ? `<label class="dxff-checkbox"><input type="checkbox" name="linkScene"> ${escapeHTML(t("LinkScene", { scene: sceneName }))}</label>` : ""}
      ${placeholderGridHTML("", { kind: "places" })}
    </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: t("AddVisited"), icon: "fa-solid fa-map-pin" },
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
      const sceneBox = el.querySelector("input[name=linkScene]");
      // Only places this player already has: whether other players went somewhere is not theirs to see.
      const check = () => {
        const existing = store.findPlaceByName(input.value);
        warn.hidden = !existing;
        if (sceneBox) sceneBox.checked = cleanLine(input.value, 120).toLowerCase() === sceneName.toLowerCase();
        if (!existing) return;
        warn.querySelector("span").textContent = t("PlaceAlreadyYours", { name: existing.name });
        warn.dataset.placeId = existing.id;
      };
      input.addEventListener("input", check);
      check();
      warn.querySelector("[data-open-existing]").addEventListener("click", () => {
        PlaceSheet.open(warn.dataset.placeId);
        dialog.close();
      });
      input.focus();
      input.select();
    }
  });
  if (!result || typeof result !== "object") return null;
  const name = cleanLine(result.name, 120);
  if (!name) {
    ui.notifications.warn(t("NameRequired"));
    return null;
  }
  const img = isPlaceholder(result.placeholder) ? result.placeholder : "";
  const placeId = await addPlaceForMe({
    name, region: cleanLine(result.region, 120), info: String(result.info ?? "").trim(), img,
    scene: result.linkScene && scene ? scene.uuid : ""
  });
  if (placeId) PlaceSheet.open(placeId);
  return placeId;
}

/** At init: the Scenes directory menu (GM). */
export function registerPlaceHooks() {
  Hooks.on("getSceneContextOptions", (app, options) => {
    const scene = li => game.scenes.get(li.closest("[data-entry-id]")?.dataset.entryId);
    options.push({
      name: "DXFF.Ctx.AddScene",
      icon: MENU_ICON,
      condition: li => game.user.isGM && store.ready() && !!scene(li),
      callback: li => {
        const s = scene(li);
        if (s) addPlaceForAll(placeFromScene(s));
      }
    });
  });
}
