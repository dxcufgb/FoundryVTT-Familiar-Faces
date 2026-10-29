import { TEMPLATE_PATH, t, uniqueSuggestions } from "../util.js";
import * as store from "../store.js";
import { EntrySheet, factionLinkView } from "./entry-sheet.js";
import { pickEntriesDialog } from "../pickers.js";

/** One faction's window: picture, what it is, its members and places (each with a role), and the notes. */
export class FactionSheet extends EntrySheet {
  static kind = "factions";
  static DRAFT_FIELDS = ["name", "category", "info"];

  static DEFAULT_OPTIONS = {
    window: { icon: "fa-solid fa-shield-halved" },
    actions: {
      linkMembers: FactionSheet.#onLinkMembers,
      linkFactionPlaces: FactionSheet.#onLinkPlaces
    }
  };

  static PARTS = {
    body: { template: `${TEMPLATE_PATH}/faction-sheet.hbs`, scrollable: [""] }
  };

  get factionId() {
    return this.entryId;
  }

  get faction() {
    return this.entry;
  }

  async _prepareEntryContext(context, faction) {
    const factions = store.allFactions();
    context.categoryOptions = uniqueSuggestions(factions.map(f => f.category));
    for (const kind of ["faces", "places"]) {
      const entries = store.allEntries(kind);
      const items = store.membersOfFaction(faction, kind, entries)
        .map(({ entry, link }) => factionLinkView({ faction, kind, entry, link, show: "entry" }));
      const canLink = entries.some(e => store.canLinkFaction(faction, e) && !store.factionLinkOf(faction, kind, e.id));
      const faces = kind === "faces";
      context[faces ? "membersSection" : "placesSection"] = {
        title: t(faces ? "FactionMembers" : "FactionPlaces"),
        icon: faces ? "fa-solid fa-masks-theater" : "fa-solid fa-map-location-dot",
        linkAction: canLink ? (faces ? "linkMembers" : "linkFactionPlaces") : "",
        linkHint: t(faces ? "LinkMembersHint" : "LinkFactionPlacesHint"),
        linkLabel: t(faces ? "LinkFace" : "LinkPlace"),
        emptyText: t(faces ? "NoFactionMembers" : "NoFactionPlaces"),
        items
      };
    }
  }

  /** Links NPCs (kind "faces") or places chosen from a list to this faction. */
  async #link(kind) {
    const faction = this.entry;
    if (!faction) return;
    const faces = kind === "faces";
    const entries = store.allEntries(kind)
      .filter(e => !store.factionLinkOf(faction, kind, e.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (!entries.length) return ui.notifications.info(t(faces ? "NoFacesToLink" : "NoPlacesToLink"));
    const ids = await pickEntriesDialog(entries, faces
      ? { title: t("LinkMembersTo", { name: faction.name }), hint: t("LinkMembersPickHint"), search: t("SearchFaces"), icon: "fa-solid fa-user-plus" }
      : { title: t("LinkFactionPlacesTo", { name: faction.name }), hint: t("LinkFactionPlacesPickHint"), search: t("SearchPlaces"), icon: "fa-solid fa-map-location-dot" });
    try {
      for (const id of ids) await store.linkToFaction(faction.id, kind, id);
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  static #onLinkMembers() {
    return this.#link("faces");
  }

  static #onLinkPlaces() {
    return this.#link("places");
  }
}

EntrySheet.register(FactionSheet);
