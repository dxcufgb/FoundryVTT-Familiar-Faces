import { TEMPLATE_PATH, t, nameHue, initials, placeSuggestions } from "../util.js";
import * as store from "../store.js";
import { EntrySheet } from "./entry-sheet.js";
import { linkReasons } from "./face-sheet.js";
import { pickEntriesDialog } from "../pickers.js";

/** A scene a place belongs to, when it still exists. */
export function sceneOf(place) {
  if (!place?.scene) return null;
  try {
    const doc = fromUuidSync(place.scene);
    return doc?.documentName === "Scene" ? doc : null;
  } catch {
    return null;
  }
}

/** One place's window: picture, what it is and where, the people met there, and the notes. */
export class PlaceSheet extends EntrySheet {
  static kind = "places";
  static DRAFT_FIELDS = ["name", "region", "info"];

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-map-location-dot" },
    actions: {
      linkFace: PlaceSheet.#onLinkFace,
      unlinkFace: PlaceSheet.#onUnlinkFace,
      viewScene: PlaceSheet.#onViewScene
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/place-sheet.hbs`, scrollable: [""] }
  };

  get placeId() {
    return this.entryId;
  }

  get place() {
    return this.entry;
  }

  async _prepareEntryContext(context, place) {
    const places = store.allPlaces();
    const faces = store.allFaces();
    context.regionOptions = placeSuggestions([...places.map(p => p.region), ...places.filter(p => p.id !== place.id).map(p => p.name)]);
    context.people = store.facesOfPlace(place, faces, store.visibleNotesByFace()).map(found => ({
      id: found.face.id,
      name: found.face.name,
      img: found.face.img,
      hue: nameHue(found.face.name),
      initials: initials(found.face.name),
      why: linkReasons(found, "places"),
      canUnlink: found.linked && store.canUnlink(place, found.link)
    }));
    context.canLinkFace = faces.some(f => !place.links.some(l => l.faceId === f.id));
    const region = place.region ? store.findPlaceByName(place.region) : null;
    context.regionPlaceId = region && region.id !== place.id ? region.id : "";
    const key = store.placeKey(place.name);
    context.placesHere = places
      .filter(p => p.id !== place.id && store.placeKey(p.region) === key)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map(p => ({ id: p.id, name: p.name }));
    const scene = sceneOf(place);
    context.sceneName = scene ? (scene.navName || scene.name) : "";
    context.canViewScene = !!scene && (game.user.isGM || scene.testUserPermission(game.user, "OBSERVER"));
  }

  /** GM: a scene dropped on the picture also becomes the place's scene, when it has none. */
  async _setPicture(src, data) {
    const changes = { img: src };
    if (data?.type === "Scene" && data.uuid && !this.entry?.scene) changes.scene = data.uuid;
    await store.updatePlace(this.entryId, changes);
  }

  /** Links NPCs chosen from a list to this place. */
  static async #onLinkFace() {
    const place = this.entry;
    if (!place) return;
    const faces = store.allFaces()
      .filter(f => !place.links.some(l => l.faceId === f.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!faces.length) return ui.notifications.info(t("NoFacesToLink"));
    const ids = await pickEntriesDialog(faces, {
      title: t("LinkFacesTo", { name: place.name }), hint: t("LinkFacesHint"), search: t("SearchFaces"), icon: "fa-solid fa-user-plus"
    });
    try {
      for (const id of ids) await store.linkFace(place.id, id);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async #onUnlinkFace(event, target) {
    event.stopPropagation();
    const faceId = target.closest("[data-face-id]")?.dataset.faceId;
    if (faceId) await store.unlinkFace(this.entryId, faceId);
  }

  static #onViewScene() {
    const scene = sceneOf(this.entry);
    if (!scene) return ui.notifications.warn(t("SceneGone"));
    scene.view();
  }
}

EntrySheet.register(PlaceSheet);
