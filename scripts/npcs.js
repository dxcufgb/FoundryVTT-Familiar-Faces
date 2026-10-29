import { MODULE_ID, t, escapeHTML, cleanLine, currentSceneName, combatBlocks, placeSuggestions, randomId } from "./util.js";
import * as store from "./store.js";
import { FaceSheet } from "./apps/face-sheet.js";
import { showMenu } from "./capture.js";
import { placeholderGridHTML, isPlaceholder } from "./placeholders.js";

/*
 * NPCs on the canvas and in the Actors directory:
 *   - a player right-clicks an NPC's token → it goes into their own Familiar Faces (only they, and the GM, see it);
 *   - the GM gets a button on the token HUD and an Actors directory menu item → a face for the whole party.
 * Either way the face gets the NPC's name, the scene as the place they were met, and the NPC's image.
 */

const MENU_ICON = '<i class="fa-solid fa-masks-theater"></i>';
const DEFAULT_IMAGES = new Set(["icons/svg/mystery-man.svg", CONST.DEFAULT_TOKEN]);

/** An NPC is an actor no player owns. */
export function isNPC(actor) {
  return !!actor && !actor.hasPlayerOwner;
}

function image(src) {
  return typeof src === "string" && src && !DEFAULT_IMAGES.has(src) ? src : "";
}

function sceneName(scene) {
  return scene ? (scene.navName || scene.name) : currentSceneName();
}

/**
 * What a token shows of its NPC: the token's name, an image and the scene it is in.
 * A player only gets the actor's portrait when the token carries the actor's own name: a token named differently may
 * be a disguise, and the portrait would give it away. Otherwise they get the token image.
 */
export function npcFromToken(tokenDoc, { forPlayer = !game.user.isGM } = {}) {
  const actor = tokenDoc?.actor;
  const name = cleanLine(tokenDoc?.name || actor?.name, 80);
  const tokenImg = image(tokenDoc?.texture?.src);
  const actorImg = image(actor?.img);
  const disguised = !!actor && cleanLine(actor.name, 80).toLowerCase() !== name.toLowerCase();
  return {
    name,
    img: forPlayer && disguised ? tokenImg : (actorImg || tokenImg),
    metAt: sceneName(tokenDoc?.parent),
    actor: tokenDoc?.actorId ? `Actor.${tokenDoc.actorId}` : ""
  };
}

export function npcFromActor(actor) {
  return {
    name: cleanLine(actor.name, 80),
    img: image(actor.img) || image(actor.prototypeToken?.texture?.src),
    metAt: currentSceneName(),
    actor: actor.uuid
  };
}

/** The face this NPC already has (same name), including faces only other players know. */
function existingFace(npc) {
  return store.findByName(npc.name, { any: true });
}

/** Player: adds an NPC to their own Familiar Faces (or opens it when it's already there). */
export async function addNpcForMe(npc) {
  if (!npc?.name) return null;
  if (combatBlocks() && !store.canSeeFace(existingFace(npc))) {
    ui.notifications.warn(t("InCombat"));
    return null;
  }
  try {
    const existing = existingFace(npc);
    if (existing && store.canSeeFace(existing)) {
      FaceSheet.open(existing.id);
      return existing.id;
    }
    let id = existing?.id;
    if (existing) await store.addKnower(existing.id);
    else id = await store.createFace({ ...npc, knownBy: [game.user.id] });
    ui.notifications.info(t("AddedForMe", { name: escapeHTML(npc.name) }));
    return id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/**
 * Player: adds someone they met who has no token or character sheet (a name overheard, a face in the crowd) to their
 * own Familiar Faces, then opens them so they can write notes. Same as a token they add: only they (and the GM) see
 * it until they share it with the party.
 */
export async function addMetFaceDialog() {
  if (!store.ready()) return ui.notifications.warn(t("NotReady"));
  if (combatBlocks()) return ui.notifications.warn(t("InCombat"));
  const id = `dxff-met-${randomId()}`;
  const places = placeSuggestions([...store.allFaces().map(f => f.metAt), ...store.allPlaces().map(p => p.name)]);
  const content = `
    <div class="dxff dxff-add-face">
      <p class="hint">${escapeHTML(t("AddMetIntro"))}</p>
      <div class="form-group">
        <label for="${id}-name">${escapeHTML(t("Field.Name"))}</label>
        <input id="${id}-name" type="text" name="name" maxlength="80" required placeholder="${escapeHTML(t("Placeholder.MetName"))}">
      </div>
      <p class="dxff-dup-warning" hidden>
        <i class="fa-solid fa-circle-info" inert></i> <span></span>
        <button type="button" data-open-existing><i class="fa-solid fa-address-card" inert></i> ${escapeHTML(t("Open"))}</button>
      </p>
      <div class="form-group">
        <label for="${id}-met">${escapeHTML(t("Field.MetAt"))}</label>
        <input id="${id}-met" type="text" name="metAt" value="${escapeHTML(currentSceneName())}" list="${id}-places" maxlength="120"
               placeholder="${escapeHTML(t("Placeholder.MetAt"))}">
        <datalist id="${id}-places">${places.map(p => `<option value="${escapeHTML(p)}"></option>`).join("")}</datalist>
      </div>
      <div class="form-group stacked">
        <label for="${id}-info">${escapeHTML(t("Field.MetInfo"))}</label>
        <textarea id="${id}-info" name="info" rows="3" placeholder="${escapeHTML(t("Placeholder.MetInfo"))}"></textarea>
        <p class="hint">${escapeHTML(t("AddMetHintPrivate"))}</p>
      </div>
      ${placeholderGridHTML("")}
    </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: t("AddMet"), icon: "fa-solid fa-user-plus" },
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
      // Only faces this player already has: whether other players met someone is not theirs to see.
      const check = () => {
        const existing = store.findByName(input.value);
        warn.hidden = !existing;
        if (!existing) return;
        warn.querySelector("span").textContent = t("AlreadyYours", { name: existing.name });
        warn.dataset.faceId = existing.id;
      };
      input.addEventListener("input", check);
      warn.querySelector("[data-open-existing]").addEventListener("click", () => {
        FaceSheet.open(warn.dataset.faceId);
        dialog.close();
      });
      input.focus();
    }
  });
  if (!result || typeof result !== "object") return null;
  const name = cleanLine(result.name, 80);
  if (!name) {
    ui.notifications.warn(t("NameRequired"));
    return null;
  }
  const img = isPlaceholder(result.placeholder) ? result.placeholder : "";
  const faceId = await addNpcForMe({ name, metAt: cleanLine(result.metAt, 120), info: String(result.info ?? "").trim(), img, actor: "" });
  if (faceId) FaceSheet.open(faceId);
  return faceId;
}

/** GM: adds an NPC to every player's Familiar Faces, with its name, place and image. */
export async function addNpcForAll(npc) {
  if (!game.user.isGM || !npc?.name) return null;
  try {
    const existing = existingFace(npc);
    if (!existing) {
      const id = await store.createFace(npc);
      ui.notifications.info(t("Added", { name: escapeHTML(npc.name) }));
      return id;
    }
    if (!existing.knownBy) {
      ui.notifications.info(t("AlreadyExists", { name: escapeHTML(existing.name) }));
      FaceSheet.open(existing.id);
      return existing.id;
    }
    // Some players already have them: now everyone does. Fill in what the face is missing.
    await store.shareWithParty(existing.id);
    const missing = {};
    if (!existing.img && npc.img) missing.img = npc.img;
    if (!existing.metAt && npc.metAt) missing.metAt = npc.metAt;
    if (!existing.actor && npc.actor) missing.actor = npc.actor;
    if (Object.keys(missing).length) await store.updateFace(existing.id, missing);
    ui.notifications.info(t("SharedWithParty", { name: escapeHTML(existing.name) }));
    return existing.id;
  } catch (err) {
    ui.notifications.error(err.message);
    return null;
  }
}

/* -------------------------------------------- */
/*  Players: right-click an NPC token           */
/* -------------------------------------------- */

let rightDownAt = null;

function onPointerDown(event) {
  if (event.button === 2) rightDownAt = { x: event.clientX, y: event.clientY };
}

/** The visible token under the pointer (the hovered one when several overlap). */
function tokenAt(event) {
  if (!canvas?.ready || event.target !== canvas.app?.view) return null;
  const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  const under = canvas.tokens.placeables.filter(token => token.visible && token.bounds?.contains(point.x, point.y));
  if (!under.length) return null;
  const hovered = canvas.tokens.hover;
  if (under.includes(hovered)) return hovered;
  return under.sort((a, b) => (a.document.elevation - b.document.elevation) || (a.document.sort - b.document.sort)).at(-1);
}

function tokenMenuItems(token) {
  const npc = npcFromToken(token.document);
  if (!npc.name) return [];
  const existing = existingFace(npc);
  if (existing && store.canSeeFace(existing)) {
    return [{ icon: "fa-solid fa-address-card", label: t("Ctx.OpenFace", { name: existing.name }), run: () => FaceSheet.open(existing.id) }];
  }
  if (combatBlocks()) return [{ icon: "fa-solid fa-swords", label: t("Ctx.InCombat"), run: () => ui.notifications.info(t("InCombat")) }];
  return [{ icon: "fa-solid fa-user-plus", label: t("Ctx.AddNpcForMe", { name: npc.name }), run: () => addNpcForMe(npc) }];
}

function onCanvasContextMenu(event) {
  try {
    if (event.shiftKey || !game.ready || game.user.isGM || !store.ready()) return;
    if (!game.settings.get(MODULE_ID, "tokenMenu")) return;
    // A right-drag pans the canvas; only a plain right-click opens the menu.
    const from = rightDownAt;
    rightDownAt = null;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 6) return;
    const token = tokenAt(event);
    if (!token?.document || !isNPC(token.actor)) return;
    const items = tokenMenuItems(token);
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    showMenu(event.clientX, event.clientY, items);
  } catch (err) {
    console.error(`${MODULE_ID} | token menu`, err);
  }
}

/* -------------------------------------------- */
/*  GM: token HUD button                        */
/* -------------------------------------------- */

function onRenderTokenHUD(hud, html) {
  try {
    if (!game.user.isGM || !store.ready() || !game.settings.get(MODULE_ID, "tokenMenu")) return;
    const token = hud.object;
    if (!token?.document || !isNPC(token.actor)) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const column = root?.querySelector(".col.left") ?? root?.querySelector(".col.right");
    if (!column || column.querySelector(".dxff-hud")) return;
    const npc = npcFromToken(token.document);
    if (!npc.name) return;
    const existing = existingFace(npc);
    const everyone = !!existing && !existing.knownBy;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `control-icon dxff-hud${everyone ? " active" : ""}`;
    button.dataset.tooltip = everyone ? t("Ctx.OpenFace", { name: existing.name }) : t("Ctx.AddNpcForAll", { name: npc.name });
    button.setAttribute("aria-label", button.dataset.tooltip);
    button.innerHTML = '<i class="fa-solid fa-masks-theater" inert></i>';
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (everyone) return FaceSheet.open(existing.id);
      await addNpcForAll(npc);
      hud.render();
    });
    column.append(button);
  } catch (err) {
    console.error(`${MODULE_ID} | token HUD`, err);
  }
}

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

/** At init: the Actors directory menu and the token HUD. */
export function registerNpcHooks() {
  Hooks.on("getActorContextOptions", (app, options) => {
    const actor = li => game.actors.get(li.closest("[data-entry-id]")?.dataset.entryId);
    options.push({
      name: "DXFF.Ctx.AddActor",
      icon: MENU_ICON,
      condition: li => game.user.isGM && store.ready() && isNPC(actor(li)),
      callback: li => {
        const a = actor(li);
        if (a) addNpcForAll(npcFromActor(a));
      }
    });
  });
  Hooks.on("renderTokenHUD", onRenderTokenHUD);
}

/** At ready, like the other right-click menus. */
export function registerTokenMenu() {
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("contextmenu", onCanvasContextMenu, true);
}
