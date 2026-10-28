import { MODULE_ID, t, escapeHTML, cleanLine, currentSceneName } from "./util.js";
import * as store from "./store.js";
import { FaceSheet } from "./apps/face-sheet.js";
import { showMenu } from "./capture.js";

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
