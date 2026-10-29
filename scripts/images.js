import { MODULE_ID, t, randomId, escapeHTML } from "./util.js";

/*
 * Portraits. Only GMs (and users with Foundry's "Upload new files" permission) upload; files go to the world's
 * familiar-faces folder unless the imageFolder setting says otherwise. Images already in the world (journal images,
 * actor portraits) are only referenced by path, never copied.
 */

const MAX_SIDE = 1024;

export function imageFolder() {
  const custom = game.settings.get(MODULE_ID, "imageFolder")?.trim();
  return (custom || `worlds/${game.world.id}/familiar-faces`).replace(/^\/+|\/+$/g, "");
}

export function canUpload() {
  return game.user.can("FILES_UPLOAD");
}

export function canBrowse() {
  return game.user.can("FILES_BROWSE");
}

let folderReady = null;
async function ensureFolder() {
  const target = imageFolder();
  if (folderReady === target) return target;
  const FP = foundry.applications.apps.FilePicker.implementation;
  let parent = "";
  for (const part of target.split("/")) {
    parent = parent ? `${parent}/${part}` : part;
    try {
      await FP.browse("data", parent);
    } catch {
      try {
        await FP.createDirectory("data", parent);
      } catch (err) {
        if (!String(err?.message ?? err).includes("EEXIST")) console.warn(`${MODULE_ID} | createDirectory`, err);
      }
    }
  }
  folderReady = target;
  return target;
}

function safeName(name, ext) {
  const base = String(name ?? "portrait").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "portrait";
  return `${Date.now().toString(36)}-${randomId().slice(0, 4)}-${base}.${ext}`;
}

/** Shrinks big photos to at most MAX_SIDE px as WebP; GIF and SVG are kept as they are. */
async function prepare(file) {
  if (!file?.type?.startsWith("image/")) throw new Error(t("NotAnImage"));
  const ext = file.type.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  if (["image/gif", "image/svg+xml"].includes(file.type)) return new File([file], safeName(file.name, ext), { type: file.type });
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 500 * 1024) return new File([file], safeName(file.name, ext), { type: file.type });
    const canvasEl = document.createElement("canvas");
    canvasEl.width = Math.round(bitmap.width * scale);
    canvasEl.height = Math.round(bitmap.height * scale);
    canvasEl.getContext("2d").drawImage(bitmap, 0, 0, canvasEl.width, canvasEl.height);
    const blob = await new Promise(resolve => canvasEl.toBlob(resolve, "image/webp", 0.86));
    if (!blob) throw new Error("toBlob failed");
    return new File([blob], safeName(file.name, "webp"), { type: "image/webp" });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not shrink image, uploading as is`, err);
    return new File([file], safeName(file.name, ext), { type: file.type });
  }
}

/** Uploads one image file and returns its path. Throws with a readable message. */
export async function uploadImage(file) {
  if (!canUpload()) throw new Error(t("NoUploadPermission"));
  const prepared = await prepare(file);
  const folder = await ensureFolder();
  const FP = foundry.applications.apps.FilePicker.implementation;
  const response = await FP.upload("data", folder, prepared, {}, { notify: false });
  if (!response?.path) throw new Error(t("UploadFailed"));
  return response.path;
}

/** Uploads the first image of a list, reporting a failure; resolves to the path or null. */
export async function uploadFirst(files) {
  const file = [...(files ?? [])].find(f => f?.type?.startsWith("image/"));
  if (!file) return null;
  try {
    return await uploadImage(file);
  } catch (err) {
    ui.notifications.error(t("UploadError", { name: escapeHTML(file.name), error: escapeHTML(err.message) }));
    return null;
  }
}

/** Opens a native file dialog for one image. Resolves to the chosen File objects. */
export function pickFiles() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve([...(input.files ?? [])]), { once: true });
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}

/** Opens Foundry's file browser. Resolves to a path or null. */
export function browseImage(current) {
  return new Promise(resolve => {
    const FP = foundry.applications.apps.FilePicker.implementation;
    let done = false;
    const picker = new FP({
      type: "image",
      current: current || imageFolder(),
      callback: path => {
        done = true;
        resolve(path);
      }
    });
    picker.addEventListener?.("close", () => setTimeout(() => { if (!done) resolve(null); }, 50), { once: true });
    picker.render(true);
  });
}

/** Image files from a paste or drop event. */
export function filesFromEvent(event) {
  const list = event.clipboardData?.files ?? event.dataTransfer?.files ?? [];
  return [...list].filter(f => f.type?.startsWith("image/"));
}

/** An image URL dragged in from another page or from Foundry, if any. */
export function urlFromDrop(event) {
  const uri = event.dataTransfer?.getData("text/uri-list") || "";
  const first = uri.split(/\r?\n/).find(l => l && !l.startsWith("#"));
  if (first && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(first)) return first;
  return null;
}

/** A picture of a scene: its background image (not a video), else its thumbnail. */
export function sceneImage(scene) {
  const bg = scene?.background?.src;
  if (bg && !/\.(webm|mp4|m4v|ogv)(\?|$)/i.test(bg)) return bg;
  return scene?.thumb ?? "";
}

/** The image of a dropped Foundry document (actor portrait, item, tile, scene, image journal page), if any. */
export async function imageFromDropData(data) {
  if (!data) return null;
  if (data.type === "Tile" && data.texture?.src) return data.texture.src;
  if (!data.uuid) return data.src ?? data.img ?? null;
  const doc = await fromUuid(data.uuid).catch(() => null);
  if (!doc) return null;
  if (doc.documentName === "JournalEntryPage") return doc.type === "image" ? doc.src : null;
  if (doc.documentName === "Tile" || doc.documentName === "Token") return doc.texture?.src ?? null;
  if (doc.documentName === "Scene") return sceneImage(doc) || null;
  return doc.img ?? null;
}

export function showImage(src, title) {
  const ImagePopout = foundry.applications.apps.ImagePopout;
  new ImagePopout({ src, window: { title: title || t("Portrait") } }).render({ force: true });
}

/** GM: shows an image to every connected player (Foundry's own "Show Players"). */
export async function shareImage(src, title) {
  try {
    const ImagePopout = foundry.applications.apps.ImagePopout;
    const popout = new ImagePopout({ src, window: { title: title || t("Portrait") } });
    await popout.shareImage();
    ui.notifications.info(t("PortraitShown", { name: escapeHTML(title) }));
  } catch (err) {
    console.error(`${MODULE_ID} | share image`, err);
    ui.notifications.error(t("ShareFailed"));
  }
}
