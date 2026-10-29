import { MODULE_ID, t, escapeHTML, randomId } from "./util.js";

/*
 * Placeholder portraits for faces without a picture of their own: a symbol on a coloured background that gives a feel
 * for who they are (a crown for royalty, an anvil and hammer for a smith, a coin purse for a merchant…), and the same
 * for places (a castle, a tavern sign, a forest…) and factions (a fleur-de-lys for a noble house, a mask for thieves…).
 * They are ordinary image files in assets/placeholders (places: assets/placeholders/places, factions:
 * assets/placeholders/factions), so a face, place or faction simply stores the path as its `img`; a real picture set later replaces it. Symbols: game-icons.net, CC BY 3.0 (see
 * assets/placeholders/LICENSE.txt).
 */

export const PLACEHOLDERS = [
  "royalty", "noble", "smith", "merchant", "innkeeper", "cook", "guard", "soldier", "priest", "wizard", "scholar", "scribe",
  "rogue", "stranger", "cultist", "farmer", "sailor", "fisher", "hunter", "healer", "bard", "judge", "beast", "jester"
];

export const PLACE_PLACEHOLDERS = [
  "castle", "city", "village", "tavern", "shop", "temple", "shrine", "house", "farm", "library", "harbor", "coast",
  "island", "forest", "mountains", "cave", "dungeon", "ruins", "graveyard", "swamp", "desert", "camp", "road", "portal"
];

export const FACTION_PLACEHOLDERS = [
  "crown", "noble", "guild", "merchants", "thieves", "assassins", "spies", "secret", "cult", "church", "knights", "army",
  "mercenaries", "watch", "mages", "scholars", "pirates", "bandits", "rebels", "druids", "tribe", "council", "undead", "monsters"
];

const FOLDER = `modules/${MODULE_ID}/assets/placeholders`;

/** The looks of each kind: their ids, their sub-folder and the DXFF.* keys of their labels. */
const LOOKS = {
  faces: { ids: PLACEHOLDERS, folder: FOLDER, labels: "Roles", hint: "PickLookHint" },
  places: { ids: PLACE_PLACEHOLDERS, folder: `${FOLDER}/places`, labels: "PlaceLooks", hint: "PickPlaceLookHint" },
  factions: { ids: FACTION_PLACEHOLDERS, folder: `${FOLDER}/factions`, labels: "FactionLooks", hint: "PickFactionLookHint" }
};

const looksOf = kind => LOOKS[kind] ?? LOOKS.faces;

export function placeholderSrc(id, kind = "faces") {
  const looks = looksOf(kind);
  return looks.ids.includes(id) ? `${looks.folder}/${id}.svg` : "";
}

export function isPlaceholder(src) {
  return typeof src === "string" && src.startsWith(`${FOLDER}/`);
}

/** A face's or place's own picture (not a placeholder). */
export function hasRealPortrait(src) {
  return !!src && !isPlaceholder(src);
}

/**
 * Who may pick a placeholder for a face or place: the GM always; the player who added it as long as it has no real
 * picture (real pictures are the GM's to set).
 */
export function canPickPlaceholder(face, canEdit) {
  if (!face) return false;
  if (game.user.isGM) return true;
  return !!canEdit && !hasRealPortrait(face.img);
}

/**
 * The radio grid of placeholders for a form, with "none" (initials) first.
 * @param {string} current  The face's or place's current image (a placeholder is preselected).
 * @param {object} [options]
 * @param {"faces"|"places"|"factions"} [options.kind]
 */
export function placeholderGridHTML(current = "", { legend = true, kind = "faces" } = {}) {
  const uid = randomId();
  const cell = (value, inner, label, checked) => `
    <label class="dxff-pick-image dxff-pick-placeholder" data-tooltip="${escapeHTML(label)}">
      <input type="radio" name="placeholder" value="${escapeHTML(value)}" aria-label="${escapeHTML(label)}" ${checked ? "checked" : ""}>${inner}
    </label>`;
  const none = cell("", `<span><i class="fa-solid fa-ban" inert></i></span>`, t("NoPortrait"), !isPlaceholder(current));
  const looks = looksOf(kind);
  const items = looks.ids.map(id => {
    const src = placeholderSrc(id, kind);
    return cell(src, `<img src="${src}" alt="">`, t(`${looks.labels}.${id}`), current === src);
  }).join("");
  return `
    <fieldset class="dxff-pick-images dxff-placeholders" id="dxff-ph-${uid}">
      ${legend ? `<legend>${escapeHTML(t("PlaceholderLegend"))}</legend>` : ""}
      ${none}${items}
    </fieldset>`;
}

/** Opens the placeholder picker. Resolves to the chosen path, "" for none, or null when cancelled. */
export async function pickPlaceholderDialog(current = "", name = "", kind = "faces") {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: name ? t("PickLookFor", { name }) : t("PickLook"), icon: "fa-solid fa-masks-theater" },
    position: { width: 520 },
    classes: ["dxff-dialog"],
    content: `<div class="dxff"><p class="hint">${escapeHTML(t(looksOf(kind).hint))}</p>${placeholderGridHTML(current, { legend: false, kind })}</div>`,
    rejectClose: false,
    buttons: [
      { action: "cancel", label: t("Cancel"), icon: "fa-solid fa-xmark" },
      {
        action: "pick", label: t("Save"), icon: "fa-solid fa-check", default: true,
        callback: (event, button) => ({ src: button.form.querySelector("input[name=placeholder]:checked")?.value ?? "" })
      }
    ],
    render: (event, dialog) => {
      // Double-click picks right away.
      for (const label of dialog.element.querySelectorAll(".dxff-pick-placeholder")) {
        label.addEventListener("dblclick", () => dialog.element.querySelector("button[data-action=pick]")?.click());
      }
    }
  });
  if (!result || typeof result !== "object") return null;
  return isPlaceholder(result.src) ? result.src : "";
}
