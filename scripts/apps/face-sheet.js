import { TEMPLATE_PATH, t, nameHue, initials, placeSuggestions } from "../util.js";
import * as store from "../store.js";
import { EntrySheet } from "./entry-sheet.js";
import { pickEntriesDialog } from "../pickers.js";

/** Why a face and a place belong together, as a tooltip. */
export function linkReasons({ linked, met, noted }, kind) {
  const out = [];
  if (linked) out.push(t("LinkWhy.linked"));
  if (met) out.push(t(kind === "places" ? "LinkWhy.metHere" : "LinkWhy.met"));
  if (noted) out.push(t("LinkWhy.noted"));
  return out.join(" · ");
}

/** One face's window: portrait, who they are, where they were met and the places they belong to, and the notes. */
export class FaceSheet extends EntrySheet {
  static kind = "faces";
  static DRAFT_FIELDS = ["name", "metAt", "info"];

  static DEFAULT_OPTIONS = {
    actions: {
      linkPlace: FaceSheet.#onLinkPlace,
      unlinkPlace: FaceSheet.#onUnlinkPlace
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/face-sheet.hbs`, scrollable: [""] }
  };

  get faceId() {
    return this.entryId;
  }

  get face() {
    return this.entry;
  }

  async _prepareEntryContext(context, face, notes) {
    const places = store.allPlaces();
    context.placeOptions = placeSuggestions([
      face.metAt, ...store.allFaces().map(f => f.metAt), ...notes.map(n => n.place), ...places.map(p => p.name)
    ]);
    context.linkedPlaces = store.placesOfFace(face, notes, places).map(found => ({
      id: found.place.id,
      name: found.place.name,
      img: found.place.img,
      hue: nameHue(found.place.name),
      initials: initials(found.place.name),
      why: linkReasons(found, "faces"),
      canUnlink: found.linked && store.canUnlink(found.place, found.link)
    }));
    context.canLinkPlace = places.some(p => !p.links.some(l => l.faceId === face.id));
    context.metAtPlaceId = face.metAt ? store.findPlaceByName(face.metAt)?.id ?? "" : "";
    context.showPlaces = context.linkedPlaces.length > 0 || context.canLinkPlace;
  }

  /** Links this NPC to places chosen from a list. */
  static async #onLinkPlace() {
    const face = this.entry;
    if (!face) return;
    const places = store.allPlaces()
      .filter(p => !p.links.some(l => l.faceId === face.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!places.length) return ui.notifications.info(t("NoPlacesToLink"));
    const ids = await pickEntriesDialog(places, {
      title: t("LinkPlacesTo", { name: face.name }), hint: t("LinkPlacesHint"), search: t("SearchPlaces"), icon: "fa-solid fa-map-location-dot"
    });
    try {
      for (const id of ids) await store.linkFace(id, face.id);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static async #onUnlinkPlace(event, target) {
    event.stopPropagation();
    const placeId = target.closest("[data-place-id]")?.dataset.placeId;
    if (placeId) await store.unlinkFace(placeId, this.entryId);
  }
}

EntrySheet.register(FaceSheet);
