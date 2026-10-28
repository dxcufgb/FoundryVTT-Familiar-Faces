# Dxcufgb's Familiar Faces

FoundryVTT v13 module (id `dxcufgbs-familiar-faces`, the install folder must have the same name). A right-sidebar tab
of the NPCs the party has met: the GM adds them from journals (right-click a selected name, a journal or a page) and
binds portraits (right-click a journal image → search dialog of existing faces), and adds NPCs for the whole party from
the Actors directory menu or the token HUD; players add NPCs to their own list by right-clicking a token, and keep notes
per NPC with the place they met them, each note private, shared with the party or with chosen players. Search and
group-by-place (one place per face: `metAt`, else the earliest note's place).
System-agnostic. No build step and no npm dependencies.

## Layout
- `scripts/main.js` – entry: settings, the sidebar tab registration (`Sidebar.TABS.familiarfaces` inserted before
  `settings`, `CONFIG.ui.familiarfaces`), refresh hooks, notifications, hiding the store journals from the Journal
  directory, `createUser` → private store, the module API.
- `scripts/store.js` – the data layer. A `store: "shared"` journal (default OWNER) holds
  `flags.dxcufgbs-familiar-faces.faces.<faceId>` and shared notes `notes.<faceId>.<noteId>` (`sharedWith: []` = the
  party, a list of user ids = only those players). Each user has a `store: "private"` journal (`owner: <userId>`,
  default NONE, that user OWNER) with their private notes in the same `notes` shape. A face with `knownBy: {<userId>:
  true}` is only in those players' lists (and the GM's); no `knownBy` = the whole party. `allFaces`/`getFace`/
  `findByName` only return faces the current user can see (`canSeeFace`); `everyFace` / `{any: true}` are for
  bookkeeping only. A player removes such a face from their list with `forgetFace` (the last one removes the face). `ensureStores` runs on the
  responsible GM only. Visibility of a note = which store it is in + `sharedWith`; `updateNote` moves a note between
  stores (write the new copy first, then delete the old one, same id).
- `scripts/apps/faces-tab.js` – `FacesTab` (HandlebarsApplicationMixin(AbstractSidebarTab)): parts `header` (search,
  never re-rendered by data changes), `filters` (group/sort selects), `list`. Context menu on cards.
- `scripts/apps/face-sheet.js` – `FaceSheet`: one NPC: portrait (GM tools, drop target), details (view/edit), note
  composer and notes. Sheet state (`draft`, `composer`, `editNote`) is bound with `data-bind`, so re-renders caused
  by other people's writes keep what the user is typing; focus is restored in `_onRender`.
- `scripts/npcs.js` – NPC tokens and actors: the players' right-click menu on NPC tokens (capture-phase `contextmenu`
  on `window`, registered at **ready**, only on `#board`, ignores right-drags), the GM's token HUD button
  (`renderTokenHUD`) and the Actors directory item (`getActorContextOptions`). NPC = actor without a player owner.
  Players get the token's image instead of the actor portrait when the token name differs from the actor's (disguise).
- `scripts/capture.js` – the *Add face* dialog, the *Add image to NPC* search dialog, the Journal directory / page
  context menu hooks, and our own small right-click menu for a selected name and for journal images (capture-phase
  `contextmenu` listeners on `window`, registered at **ready**). When Dxcufgb's Quest log is active its selection
  menu (registered at init) wins the event; a MutationObserver adds our items to `#dxql-context-menu` instead.
- `scripts/images.js` – portrait upload (direct only; GMs / FILES_UPLOAD), file picker, image from drop data,
  ImagePopout show / share.
- `scripts/search.js` – word-AND search over name, met-at, info, and the places and text of visible notes.
- `scripts/util.js` – constants, `t()`, `escapeHTML`, `enrich` (escape → `<br>` → enrichHTML), helpers.
- `templates/*.hbs` (`visibility.hbs` is a partial loaded at init), `styles/familiar-faces.css` (theme tokens on
  `.dxff`, light/dark), `lang/en.json` (`DXFF.*`).
- `.github/workflows/ci.yml` / `release.yml` – thin callers of `dxcufgb/foundry-module-ci`; identical in every
  module, do not edit them here. `claude.yml` – the Claude review.

## Conventions
- `MODULE_ID` must equal `id` in `module.json`; CI checks it.
- Every visible setting (`config: true`) needs a Name and Hint in `lang/en.json`; CI checks it.
- Strings go through `t()` (`DXFF.` prefix). Hook handlers catch and `console.error` their errors.
- Update `README.md` when behaviour, settings or the API change.

## Review focus
- **Concurrent edits**: never write the whole `faces` or `notes` map from a stale copy; write only the keys that
  changed (dot paths). Notes are keyed objects for that reason; only `sharedWith` is an array (written by its author).
- **Privacy**: a private note is only ever written to the author's own private store, never to the shared store.
  Moving a note from shared to private deletes the shared copy. Players' clients only show notes `canSee` allows;
  anything rendered must come from `store.notesFor` / `visibleNotesByFace`, never from raw flags. Note that Foundry
  v13 still sends every journal (with its flags) to every client, even at ownership NONE — verified in the dev
  world — so privacy is enforced in the UI only; don't document it as more than that.
- **Permissions**: portraits are GM-only (`setImage` callers check `game.user.isGM`); editing/deleting a face:
  `canEditFace` (GM or its creator); editing a note: its author only; deleting: author, or a GM for shared notes.
- **Escaping**: user text is stored plain and rendered through `enrich()` (escapes first) or `highlight()`; any other
  interpolation into HTML (dialogs, notifications, our context menu) must use `escapeHTML`.
- **One client acts**: `ensureStores` / `ensurePrivateStore` run only where `isResponsibleGM()`.
- **Right-click menus**: never swallow a right-click that isn't on a short selection or a journal image; Shift always
  bypasses; text inputs and editors are excluded.
