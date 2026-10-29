# Dxcufgb's Familiar Faces & Places

FoundryVTT v13 module (id `dxcufgbs-familiar-faces`, the install folder must have the same name; the id stayed when the
module was renamed from "Familiar Faces" in 1.1, because the stored flags are keyed by it). A right-sidebar tab with three
lists, **NPCs**, **Places** and **Factions** (switch at the top, client setting `activeList`). Faces are the NPCs the party has met: the GM adds them from journals (right-click a selected name, a journal or a page) and
binds portraits (right-click a journal image → search dialog of existing faces), and adds NPCs for the whole party from
the Actors directory menu or the token HUD; players add NPCs to their own list by right-clicking a token, and keep notes
per NPC with the place they met them, each note private, shared with the party or with chosen players. Search and
group-by-place (one place per face: `metAt`, else the earliest note's place).
Places work the same way (GM adds from journals, the Scenes directory or *Add place*; players *Add a place you visited*
to their own list; notes; sharing; pictures/looks), grouped by `region` ("Located in"). NPCs and places link: by name
(a face's `metAt` or a visible note's `place` equals the place's name) and by hand (`place.faces.<faceId>`).
**Factions** (guilds, houses, cults) work the same way (GM adds from journals or *Add faction*; players *Add a faction you
know of*; notes; sharing; pictures/looks), grouped by `category` ("Type"). A faction links by hand only to any number of
NPCs and places, each link with an optional `role` (`factions.<id>.faces.<faceId>` / `.places.<placeId>` = {by, at, role}).
With Dxcufgb's Quest log active, a new note's text gets `@Quest/@Reward/@PartyNote` links (`quest-links.js`).
System-agnostic. No build step and no npm dependencies.

## Layout
- `scripts/main.js` – entry: settings, the sidebar tab registration (`Sidebar.TABS.familiarfaces` inserted before
  `settings`, `CONFIG.ui.familiarfaces`), refresh hooks, notifications, hiding the store journals from the Journal
  directory, `createUser` → private store, the module API.
- `scripts/store.js` – the data layer. Faces, places and factions share it: most functions take a kind
  (`"faces"`/`"places"`/`"factions"`, `kindOf`):
  `createEntry`, `getEntry`, `allEntries`, `updateEntry`, `shareEntryWithParty`, `forgetEntry`, `deleteEntry`,
  `addEntryNote`, `notesOf`, `visibleNotesBy`…; the old face functions (`createFace`, `notesFor`, …) are thin wrappers
  and part of the API. Places: `flags.<module>.places.<placeId>` = {name, img, region, info, source, scene, faces,
  knownBy, …}, notes in `placeNotes.<placeId>.<noteId>` (shared and private stores, no `place` field). `faces` =
  `{<faceId>: {by, at}}` hand-made links (`linkFace`/`unlinkFace`, `canLink`: both visible; `canUnlink`: its maker, the
  place's editor, a GM). `facesOfPlace` / `placesOfFace` combine hand links and name matches, only with what the user
  can see. Deleting a face also removes its links from places. Factions: `flags.<module>.factions.<id>` = {name, img,
  category, info, source, faces, places, knownBy, …}, notes in `factionNotes`; normalized `links` (NPCs) and
  `placeLinks`. `linkToFaction` / `unlinkFromFaction` / `setFactionRole` (kind + id; `canLinkFaction`: both visible;
  `canUnlinkFaction`: its maker, the faction's editor, a GM, also for the role); `membersOfFaction(faction, kind)` /
  `factionsOf(entry)` only with what the user can see. Deleting a face or place removes it from factions. Events carry `{type, kind, id}`. Faces: A `store: "shared"` journal (default OWNER) holds
  `flags.dxcufgbs-familiar-faces.faces.<faceId>` and shared notes `notes.<faceId>.<noteId>` (`sharedWith: []` = the
  party, a list of user ids = only those players). Each user has a `store: "private"` journal (`owner: <userId>`,
  default NONE, that user OWNER) with their private notes in the same `notes` shape. A face with `knownBy: {<userId>:
  true}` is only in those players' lists (and the GM's); no `knownBy` = the whole party. `allFaces`/`getFace`/
  `findByName` only return faces the current user can see (`canSeeFace`); `everyFace` / `{any: true}` are for
  bookkeeping only. A player removes such a face from their list with `forgetFace` (the last one removes the face). `shareWithParty` drops `knownBy` (`canShareFace`: the GM, or a player in `knownBy`); shared notes come along, private notes stay in their authors' stores; the `known` event carries `sharedBy` for the notification. `ensureStores` runs on the
  responsible GM only. Visibility of a note = which store it is in + `sharedWith`; `updateNote` moves a note between
  stores (write the new copy first, then delete the old one, same id).
- `scripts/apps/faces-tab.js` – `FacesTab` (HandlebarsApplicationMixin(AbstractSidebarTab)): parts `tabs` (NPCs /
  Places / Factions switch), `header` (search, never re-rendered by data changes), `filters` (group/sort selects, per list:
  `groupBy`/`sortBy`, `placeGroupBy`/`placeSortBy`), `list`, `footer`. One search per list (`FacesTab.searches`).
  Cards carry `data-entry-id` + `data-kind`. Context menu on cards.
- `scripts/apps/entry-sheet.js` – `EntrySheet`, the base of both sheets: picture (GM tools, drop target), edit form
  (`DRAFT_FIELDS`), note composer and notes. Sheet state (`draft`, `composer`, `editNote`) is bound with `data-bind`,
  so re-renders caused by other people's writes keep what the user is typing; focus is restored in `_onRender`.
  `face-sheet.js` (`FaceSheet`: where met, linked places) and `place-sheet.js` (`PlaceSheet`: region, scene, people
  met here, places located in it) add their own context; `faction-sheet.js` (`FactionSheet`: type, members, places).
  The base adds a *Factions* section to NPC and place sheets and the faction-link actions (`linkFactions`,
  `editFactionRole`, `unlinkFactionLink`, `openLinked`); faction link pills use the `link-list.hbs` partial. Templates
  share the `portrait.hbs`, `notes.hbs` and `link-list.hbs` partials.
- `scripts/places.js` – the counterpart of npcs.js: Scenes directory item (GM, `addPlaceForAll`), *Add a place you
  visited* (`addVisitedPlaceDialog`, `knownBy: [me]`). Places are not blocked during combat.
- `scripts/factions.js` – *Add a faction you know of* (`addKnownFactionDialog`, `knownBy: [me]`). Factions are not
  blocked during combat.
- `scripts/quest-links.js` – Dxcufgb's Quest log: `addEntryNote` runs a new note's text through `autoLinkQuestLog`
  (world setting `questLogLinks`): the first whole-word mention of each quest title / reward name / party note title
  from the Quest log's API (`quests()`, `rewards()`, `partyNotes()`: only what the user may see) becomes
  `@Quest[id]{text}` etc.; longest names first, existing `@…[…]{…}` and `[[…]]` untouched. Edits don't re-link.
- `scripts/pickers.js` – searchable lists of faces/places (the image-binding dialog, the link dialogs).
- Tab footer (`tab-footer.hbs`, players only): *Add someone you met* → `addMetFaceDialog` (npcs.js) → `addNpcForMe` with
  no image or actor, so the face gets `knownBy: [me]` (or the player is added as a knower of an existing face).
- `scripts/placeholders.js` – 24 placeholder looks for faces (`assets/placeholders/<id>.svg`), 24 for places
  (`assets/placeholders/places/<id>.svg`, labels `DXFF.PlaceLooks.*`) and 24 for factions
  (`assets/placeholders/factions/<id>.svg`, labels `DXFF.FactionLooks.*`), game-icons.net CC BY 3.0; a face or place
  stores the path as `img`. `canPickPlaceholder`: GM always, the face's editor while it has no real portrait. Picker in
  the "someone you met" dialog and the sheet's portrait tools (`pickPlaceholder`). Labels in `DXFF.Roles.*`.
- Combat: `combatBlocks()` (util) = a player while any combat has started. `createFace`, `addKnower` and
  `shareWithParty` throw `InCombat` for them, `canAddFaces`/`canShareFace` are false, and the token / selection menus
  show an "In combat" item instead of Add. `mayAddFaces` is the permission without the combat check. The tab header
  re-renders on combat start/end (`onCombatChange` in main.js).
- `scripts/nameplates.js` – responsible GM: every token (all scenes + the prototype token) of an NPC whose face has no
  `knownBy` gets `displayName: HOVER` unless it already shows to everyone (HOVER/ALWAYS); matched by `face.actor`, NPC
  actor name or NPC token name. Debounced sync on shared-store face changes and at ready; `preCreateToken` for new
  tokens. Never lowers a display mode. Setting `knownNameplates`.
- `scripts/npcs.js` – NPC tokens and actors: the players' right-click menu on NPC tokens (capture-phase `contextmenu`
  on `window`, registered at **ready**, only on `#board`, ignores right-drags), the GM's token HUD button
  (`renderTokenHUD`) and the Actors directory item (`getActorContextOptions`). NPC = actor without a player owner.
  Players get the token's image instead of the actor portrait when the token name differs from the actor's (disguise).
- `scripts/capture.js` – the *Add NPC* / *Add place* dialog (`addEntryDialog(kind)`), the *Add image to NPC/place*
  search dialog, the Journal directory / page
  context menu hooks, and our own small right-click menu for a selected name and for journal images (capture-phase
  `contextmenu` listeners on `document`, registered at **ready**). When Dxcufgb's Quest log is active its selection
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
- **Permissions**: portraits and place / faction pictures are GM-only (`setImage`/`setEntryImage` callers check
  `game.user.isGM`); editing/deleting a face or place: `canEditEntry` (GM or its creator); editing a note: its author only; deleting: author, or a GM for shared notes.
- **Escaping**: user text is stored plain and rendered through `enrich()` (escapes first) or `highlight()`; any other
  interpolation into HTML (dialogs, notifications, our context menu) must use `escapeHTML`.
- **One client acts**: `ensureStores` / `ensurePrivateStore` run only where `isResponsibleGM()`.
- **Right-click menus**: never swallow a right-click that isn't on a short selection or a journal image; Shift always
  bypasses; text inputs and editors are excluded.
