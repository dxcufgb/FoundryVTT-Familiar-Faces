# Dxcufgb's Familiar Faces & Places

[![Foundry v13](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-familiar-faces?label=Foundry%20v13&logo=foundryvirtualtabletop&color=ff6400)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-familiar-faces/module.zip?label=downloads&color=blue)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dxcufgb)\
[![CI](https://img.shields.io/github/actions/workflow/status/dxcufgb/FoundryVTT-familiar-faces/ci.yml?branch=main&label=CI)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dxcufgb/FoundryVTT-familiar-faces)](LICENSE)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Everyone the party has met and every place they have been, in its own tab in the right sidebar with a list of **NPCs** and a list of **Places**. The GM adds NPCs straight from the journals by selecting a name and right-clicking it, or from the Actors directory or an NPC's token, and gives them a portrait by right-clicking an image. Players add the NPCs they meet to their own list by right-clicking a token. Each player keeps their own notes about every NPC, writes down where they met them, and decides who gets to read each note: only themselves, the whole party, or a few chosen players.

Places work the same way: the GM adds them from the journals or the Scenes directory, players add the places they visit to their own list, and everyone keeps notes about them. NPCs and places are linked: a place lists the people met there, and an NPC lists the places they belong to.

**Factions** – guilds, noble houses, cults, gangs – are the third list. A faction links to any number of NPCs (its members) and places (its headquarters, hideouts, territory), each with an optional role such as *Leader* or *Headquarters*, and everyone keeps notes about it like about NPCs and places.

With **Dxcufgb's Quest log** active, new notes link the quests, quest rewards and party notes they mention by name.

*Called Familiar Faces until version 1.1. The module id (`dxcufgbs-familiar-faces`) hasn't changed, so updating keeps everything you had.*

**Foundry VTT:** v13 · **System:** any

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases/latest/download/module.json
```

Enable it in your world. The first time a GM opens the world with the module enabled, it sets up its storage (a few journal entries that are hidden from the Journal directory). Until then the tab only says that it isn't set up yet.

## For the GM

### Adding someone the party has met

- **Select a name in any journal and right-click it** → *Add “Name” to Familiar Faces*. A small window opens with the name filled in, **First met at** set to the current scene, an optional **What the party knows** text that every player sees, and — if the journal page has pictures — a choice of portrait. The NPC links back to the journal page it came from. If someone with that name is already in the list, the window says so and offers to open them instead.
- **Right-click a journal or a journal page** in the sidebar → *Add to Familiar Faces* (the name of the journal or page is used).
- **Right-click an NPC in the Actors directory** → *Add to Familiar Faces*. The NPC goes straight into every player's Familiar Faces with its name, its portrait (or token image) and the current scene as where they were first met. No window opens.
- **Right-click an NPC's token** and click the theatre-masks button on the token HUD to do the same for the token: the token's name, the NPC's image and the token's scene. If some players had already added that NPC themselves, the button puts them in everyone's list instead.
- Or use **Add NPC** at the top of the tab.

Hold **Shift** while right-clicking to get the normal menu instead. The menus can be turned off per user in the module settings.

### Adding a place

- **Select a place name in any journal and right-click it** → *Add “Name” to Familiar Places*. The window has the name, **Located in** (a region, a city or a bigger place), an optional **What the party knows** text, and a choice of picture from the journal page. The place links back to the journal page.
- **Right-click a journal or a journal page** → *Add to Familiar Places*.
- **Right-click a scene in the Scenes directory** → *Add to Familiar Places*. The scene goes straight into every player's Familiar Places with its name and background (or thumbnail) as the picture, and is linked to the scene.
- Or use **Add place** at the top of the **Places** list. It starts with the current scene's name and offers to link the scene.

### Adding a faction

- **Select a faction's name in any journal and right-click it** → *Add “Name” as a faction*. The window has the name, **Type** (a guild, a noble house, a cult…), an optional **What the party knows** text and a choice of picture from the journal page.
- **Right-click a journal or a journal page** → *Add as a faction*.
- Or use **Add faction** at the top of the **Factions** list.

### Portraits and pictures

- **Right-click an image in a journal** → *Add image to NPC…*. A search window lists every NPC; type a few letters, pick one (or double-click it) and the image becomes their portrait. If the page name or the image caption contains someone's name, that NPC is picked for you. *New NPC with this image* adds a new NPC with that portrait instead.
- Image journal pages also have *Add image to NPC…* in their right-click menu in the journal's page list.
- In an NPC's window, drop an image file, an image link, an actor, a tile or an image journal page onto the portrait, or use the buttons on it to pick a file, upload one, show the portrait to the players, or remove it.

Places have pictures the same way: *Add image to place…* on journal images and image pages, and the same buttons and drop target on the place's picture. Dropping a scene on a place's picture also links the place to that scene. Factions too: *Add image to faction…* and *New faction with this image…*.

Only the GM can set portraits and pictures.

### Managing NPCs and places

Right-click an NPC in the tab to open it, change or remove its portrait, show the portrait to the players, or remove the NPC. You see every NPC, also the ones players added for themselves; those have a small lock next to the name that tells who has them, and **Share with the party** (in the right-click menu, on the card and in the NPC's window) puts them in everyone's list. **Edit** in the NPC's window changes the name, where they were first met and what the party knows. Removing an NPC also removes everyone's notes about it.

Places are managed the same way in the **Places** list: open, change or remove the picture, show it to the players, share a player's place with the party, edit (name, **Located in**, what the party knows) or remove it. And factions in the **Factions** list (edit: name, **Type**, what the party knows). Removing an NPC or a place also removes it from its factions.

## For players

- Open the **Familiar Faces & Places** tab (the theatre-masks icon). **NPCs** at the top shows everyone your party has met, **Places** every place you've been.
- **Search** finds names, places, the GM's description and the notes you can see. Put several words in "quotes" to search for them together.
- **Right-click an NPC's token** on the map → *Add Name to my Familiar Faces*. They go into your own list only, with the token's name and image and the scene as where you met them; the other players don't see them unless they add them too, or the GM shares them with everyone. If they're already in your list, the menu opens them instead. **Remove from my NPCs** in their window takes them out of your list again (your private notes about them are kept). Hold **Shift** to skip the menu.
- **Add someone you met** – the button at the bottom of the tab, for people without a token or character sheet: a name you overheard, the bartender nobody put on the map. Give a name, where you met them and (optionally) what you know about them, and pick a **look**: one of 24 placeholder pictures that give a feel for who they are (a crown for royalty, an anvil and hammer for a smith, a coin purse for a merchant, a hood for a mysterious stranger…). They go into your own list, just like an NPC you added from a token, and their window opens so you can write notes. Not available during combat. Change the look later with the theatre-masks button on their portrait (as long as they have no real portrait; the GM can always change it, and a portrait the GM sets replaces the placeholder).
- **Share with the party** – the people icon on the card of an NPC only you (or a few of you) have, also in their window and right-click menu. After a quick confirmation every player gets them: the name, portrait, where they were first met, what's known about them, and the notes written for the party or for chosen players. Your **Only me** notes stay private. The others get a notification saying you shared them.
- **Group by → Place met** lists people under the place they were first met (*First met at*, or the place of the earliest note when that is empty). Click a place on a card to show only the people met there.
- Click an NPC to open it and **add a note**: where they were when you met them (pick a place you've used before or a scene, or click the map button for the current scene), and what you want to remember. **Ctrl+Enter** adds the note.
- Choose who can read each note:
  - **Only me** – a private note in your own notebook; other players never see it in Familiar Faces.
  - **Party** – every player can read it.
  - **Some players** – only the players you tick can read it.

  You can change this later by editing the note. Notes show who wrote them, when, and who can read them. Drop a journal entry, an actor or an item into a note to link it.
- Filter an NPC's notes by **All**, **Mine** and **Others'**.

### Places

- **Add a place you visited** – the button at the bottom of the **Places** list. It starts with the name of the scene you're in (and offers to link that scene), and you can give where it is (**Located in**), what you know about it and a **look**: one of 24 placeholder pictures (a castle, a tavern sign, a forest, a cave, a harbour…). The place goes into your own list only, just like an NPC you added yourself, and its window opens for notes. **Share with the party** and **Remove from my places** work as for NPCs. Unlike NPCs, places can be added and shared during combat.
- **People met here** in a place's window lists the NPCs that belong to it: NPCs first met there, NPCs whose notes say they were there, and NPCs linked to it by hand (the link button; for the people who live or work there). Click one to open them. An NPC's window lists their **Places** the same way, with its own link button. A link you made can be removed again (the GM and the place's creator can remove any link).
- **Search** in the Places list finds names, regions, the description, your notes and the names of the people met there. **Group by → Region** lists places under where they are; click a region on a card to show only the places there. When the region is itself a place (*The Yawning Portal* located in *Waterdeep*), the place's window links to it, and *Waterdeep* lists its **Places here**.
- Notes about a place work like notes about an NPC (Only me, Party, Some players), without the "where" field.

### Factions

- The **Factions** list shows the guilds, houses, cults and gangs your party knows of. **Add a faction you know of** (the button at the bottom of the list) puts one into your own list, with its **Type**, what you know about it and a **look**: one of 24 placeholder crests (a crown, a fleur-de-lys for a noble house, a mask for a thieves' guild, a cultist, a pirate flag…). **Share with the party** and **Remove from my factions** work as for NPCs, also during combat.
- A faction's window lists its **Members** (NPCs) and its **Places**. Link them with the link button next to each heading; a faction can have any number of both. The pen on a link gives it a **role**: *Leader*, *Informant* or *Enemy* for an NPC, *Headquarters*, *Hideout* or *Territory* for a place. An NPC's and a place's window list their **Factions** the same way, with their own link button. The one who made a link, the faction's creator and the GM can change its role or remove it.
- **Search** in the Factions list finds names, types, the description, your notes, and the names and roles of its members and places. **Group by → Type of faction** lists factions by type. Searching NPCs and places also finds them by the names of their factions.
- Notes about a faction work like notes about a place (Only me, Party, Some players).

### Links to the Quest log

With **Dxcufgb's Quest log** active, a note you add about an NPC, a place or a faction is linked to the Quest log: the first time the note names a quest, a quest reward or a party note, the name becomes a link to it (you can click it to open the quest). Only whole names are linked, a longer name wins over a shorter one inside it (*The Black Road Bandits* before *The Black Road*), links already in the note are left alone, and only quests, rewards and notes you can see in the Quest log are linked. It happens when the note is added; editing a note later doesn't add links again. The GM can turn it off with **Link notes to the Quest log**.

**How private is private?** Familiar Faces & Places only ever shows a note to the people it's meant for, and the GM can read every note. But Foundry sends all of a world's data to every connected player, including journals they have no permission to open, so a player who digs into the browser console could still find notes that weren't meant for them. Treat "Only me" and "Some players" like passing a note at the table, not like a locked diary. The same goes for NPCs and places a player added only to their own list.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Notifications | World | Tell players when someone, some place or a faction is added, gets a picture, or a note is shared with them. |
| Players can add NPCs, places and factions | World | Lets players add people, places and factions for the party themselves (portraits and pictures stay GM-only). Off by default. Players can always add them to their own lists. |
| Link notes to the Quest log | World | With Dxcufgb's Quest log active, new notes link the quests, quest rewards and party notes they mention. On by default. |
| Picture upload folder | World | Where uploaded portraits and pictures of places and factions go. Empty: `worlds/<world>/familiar-faces`. |
| Right-click selected names | User | The *Add to Familiar Faces*, *Add to Familiar Places* and *Add as a faction* menu on selected names. |
| Right-click journal images (GM) | User | The *Add image to NPC*, *Add image to place* and *Add image to faction* menu on journal images. |
| Show the names of NPCs the party knows | World | When an NPC is in every player's Familiar Faces, all its tokens show their name to everyone on hover (see below). On by default. |
| Right-click NPC tokens | User | Players: the *Add to my Familiar Faces* menu on NPC tokens. GM: the Familiar Faces button on NPC token HUDs. |

## No new NPCs in the middle of a fight

Nobody has time to make new acquaintances during combat. While a combat encounter is running (it has started), players can't add NPCs – not from tokens, selected names, journals or the **Add NPC** button – and can't share NPCs with the party. Right-clicking an NPC token or a selected name says so instead, and the Add NPC button is greyed out. Opening NPCs and writing notes still work, and everything is back as soon as the combat ends. The GM can still add and share NPCs during combat. Places and factions aren't affected: you can always note where you are.

## Names on hover for NPCs the party knows

As soon as an NPC is in every player's Familiar Faces – the GM added them for everyone, or a player shared them with the party – all tokens of that NPC show their name to everyone on hover (Display Name: *Hovered by Anyone*): the tokens already placed in every scene, and the actor's prototype token, so tokens placed later do the same. So once the party has met a "Neverwinter Guard", every Neverwinter Guard token shows its name.

- It covers the NPC's own actor (NPCs added from a token or the Actors directory remember it), NPC actors with the NPC's name, and NPC tokens carrying that name.
- A GM has to be logged in for tokens to change; NPCs shared while no GM is online are caught up when a GM logs in.
- Tokens that already show their name to everyone (*Always for Everyone*) are left alone, and the module never hides a name again – removing an NPC doesn't change its tokens back.
- Turn it off with **Show the names of NPCs the party knows** in the module settings.

## Works with Dxcufgb's Quest log

The Quest log has its own menu for selected text. With both modules enabled, the Familiar Faces & Places items are added to the bottom of the Quest log's menu, so one right-click on a selected name offers both. New notes also link the quests, rewards and party notes they mention (see *Links to the Quest log*). Without the Quest log everything else works the same.

## For macro and module authors

```js
const ff = game.modules.get("dxcufgbs-familiar-faces").api;
ff.open();                                   // switch to the tab
ff.faces();                                  // [{id, name, img, metAt, info, source, actor, knownBy, ...}]
ff.getFace(id);                              // one NPC, or null (also null when the user doesn't have it)
ff.findByName("Mira Ashgrove");
ff.addFace({ name: "Mira Ashgrove", img: "path/to/mira.webp" });   // opens the Add window
await ff.createFace({ name: "Mira Ashgrove", metAt: "Saltmarsh" }); // no window; returns the id
await ff.updateFace(id, { metAt: "Phandalin", info: "Runs the Stonehill Inn." }); // only the fields given
ff.bindImage("path/to/mira.webp");           // GM: opens the Add image to NPC search
await ff.setImage(id, "path/to/mira.webp");  // set the portrait directly ("" removes it)
ff.addToken(token);                          // GM: for all players; player: to their own Familiar Faces
ff.addActor(actor);                          // GM: add an NPC actor for all players
ff.shareWithParty(id);                       // GM, or a player who has the NPC: put it in everyone's list
ff.forgetFace(id);                           // player: remove an NPC from their own list
await ff.deleteFace(id);                     // remove the NPC and its notes
ff.notes(id);                                // the notes about an NPC the user can see
await ff.addNote(id, { text: "Owes us a favour.", place: "Saltmarsh", visibility: "everyone" }); // returns the note id
await ff.syncNameplates();                   // GM: update the tokens of party-known NPCs now
ff.openFace(id);

// Places
ff.openPlaces();                             // switch to the tab's Places list
ff.places();                                 // [{id, name, img, region, info, source, scene, links, knownBy, ...}]
ff.getPlace(id);
ff.findPlaceByName("Saltmarsh");
ff.addPlace({ name: "Saltmarsh", region: "Sword Coast" });      // opens the Add place window
await ff.createPlace({ name: "Saltmarsh", region: "Sword Coast", scene: scene.uuid }); // no window; returns the id
await ff.updatePlace(id, { region: "The Sword Coast" });
ff.bindPlaceImage("path/to/saltmarsh.webp"); // GM: opens the Add image to place search
await ff.setPlaceImage(id, "path/to/saltmarsh.webp");
ff.addScene(scene);                          // GM: add a scene as a place for all players
await ff.linkFace(placeId, faceId);          // link an NPC to a place
await ff.unlinkFace(placeId, faceId);        // remove that link again
ff.facesOfPlace(placeId);                    // the NPCs met at, noted at or linked to a place
ff.placesOfFace(faceId);                     // the places of an NPC
ff.placeNotes(id); await ff.addPlaceNote(id, { text: "The harbour master is bribable.", visibility: "private" });
ff.sharePlaceWithParty(id); ff.forgetPlace(id); ff.openPlace(id);
await ff.deletePlace(id);

// Factions
ff.openFactions();                           // switch to the tab's Factions list
ff.factions();                               // [{id, name, img, category, info, source, links, placeLinks, knownBy, ...}]
ff.getFaction(id);
ff.findFactionByName("Zhentarim");
ff.addFaction({ name: "Zhentarim", category: "Mercenaries" });  // opens the Add faction window
await ff.createFaction({ name: "Zhentarim", category: "Mercenaries" }); // no window; returns the id
await ff.updateFaction(id, { category: "Thieves' guild" });
ff.bindFactionImage("path/to/zhentarim.webp"); // GM: opens the Add image to faction search
await ff.setFactionImage(id, "path/to/zhentarim.webp");
await ff.linkToFaction(factionId, "faces", faceId, "Leader");    // or "places", placeId, "Headquarters"
await ff.setFactionRole(factionId, "faces", faceId, "Informant");
await ff.unlinkFromFaction(factionId, "faces", faceId);
ff.membersOfFaction(factionId);              // [{face, role}]
ff.placesOfFaction(factionId);               // [{place, role}]
ff.factionsOf("faces", faceId);              // [{faction, role}] (or "places", placeId)
ff.factionNotes(factionId); await ff.addFactionNote(factionId, { text: "They hire in Phandalin.", visibility: "everyone" });
ff.shareFactionWithParty(id); ff.forgetFaction(id); ff.openFaction(id);
await ff.deleteFaction(id);

// Dxcufgb's Quest log
ff.linkQuestLog("We met her on The Silver Thread"); // the text with the quests, rewards and notes it names linked
```

Everything only returns and finds what the current user has in their lists: the GM gets everything, a player the party's NPCs, places and factions plus their own. `getFace`, `getPlace`, `getFaction` and the `find…ByName` calls take `{ any: true }` to also find the ones only other players have. `canSeeFace(entry, user)` tells whether a user has an NPC, place or faction in their lists.

- **Creating**: `createFace` takes `name`, `img`, `metAt`, `info`, `source` (`{uuid, label}`, the link back to a journal), `actor` (an actor uuid) and `knownBy` (a list of user ids: only those players get it; leave it out for the whole party). `createPlace` takes `region` and `scene` (a scene uuid) instead of `metAt` and `actor`, `createFaction` takes `category`. A player can't create or share NPCs while a combat has started (they throw); places and factions aren't affected.
- **The `add…` calls** open the Add window with the given values filled in and return a Promise of the new id, or `null` when it was cancelled or the user may not add.
- **Links**: `linkFace`, `unlinkFace`, `linkToFaction`, `setFactionRole` and `unlinkFromFaction` return `true`, or `false` when nothing changed (already linked, not allowed). Anyone who has both in their lists can link them; the link's maker, the creator of the place or faction and the GM can change or remove it. `kind` is `"faces"` or `"places"`.
- **Notes**: `addNote`, `addPlaceNote` and `addFactionNote` take `{text, visibility, sharedWith}`, and NPC notes also `place`. `visibility` is `"private"` (only the author), `"everyone"` (the party) or `"some"` with `sharedWith` a list of user ids (an empty list keeps the note private). They return the note's id, or `null` for an empty note. With the Quest log active (and **Link notes to the Quest log** on), the text gets its Quest log links like a note added in the window. A note object has `{id, text, place, visibility, sharedWith, createdBy, authorName, createdAt, editedAt}`.
- **`shareWithParty`, `forgetFace`** and the place and faction versions return a Promise of `true`, or `false` when the user may not do it.
- **Permissions**: in the module's own windows only the GM sets portraits and pictures, only the GM or the creator edits or removes an NPC, place or faction, and players add for the party only with **Players can add NPCs, places and factions**. The data calls (`create…`, `update…`, `setImage`, `delete…` and their place and faction versions) don't check that themselves, so check `game.user.isGM` before calling them for a player. `deleteFace` (and the others) also removes the entry from places and factions; run by a GM, it clears everyone's private notes about it too.

**From another module**

The API is set in the module's own `ready` hook, after it has checked its storage (an `await`), so it isn't there yet while other modules' `ready` hooks run. Get it when you need it (a button, a later hook) rather than once at `ready`, and check that it's there:

```js
const familiarFaces = () => game.modules.get("dxcufgbs-familiar-faces")?.active ? game.modules.get("dxcufgbs-familiar-faces").api ?? null : null;

// later, e.g. when the user clicks something:
const ff = familiarFaces();
if (ff) console.log(ff.faces().map(face => face.name));   // null: not installed, not enabled, or not ready yet
```

Add `{ "id": "dxcufgbs-familiar-faces", "type": "module" }` to `relationships.recommends` in your `module.json`. The module calls no hooks of its own, so there is no event that says the API is ready. Its data lives in the flags of journal entries it hides from the Journal directory; that layout is internal and may change, so read and write through the API.

## Credits

The placeholder pictures of NPCs, places and factions use symbols from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloured and placed on backgrounds (see `assets/placeholders/LICENSE.txt`).

## Support

Found a bug or have an idea? [Open an issue](https://github.com/dxcufgb/FoundryVTT-familiar-faces/issues). If you like the module, you can [support me on Ko-fi](https://ko-fi.com/dxcufgb).

## License

[MIT](LICENSE)
