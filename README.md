# Dxcufgb's Familiar Faces

[![Foundry v13](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-familiar-faces?label=Foundry%20v13&logo=foundryvirtualtabletop&color=ff6400)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-familiar-faces/module.zip?label=downloads&color=blue)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dxcufgb)\
[![CI](https://img.shields.io/github/actions/workflow/status/dxcufgb/FoundryVTT-familiar-faces/ci.yml?branch=main&label=CI)](https://github.com/dxcufgb/FoundryVTT-familiar-faces/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dxcufgb/FoundryVTT-familiar-faces)](LICENSE)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Everyone the party has met, in its own tab in the right sidebar. The GM adds NPCs straight from the journals by selecting a name and right-clicking it, or from the Actors directory or an NPC's token, and gives them a portrait by right-clicking an image. Players add the NPCs they meet to their own list by right-clicking a token. Each player keeps their own notes about every NPC, writes down where they met them, and decides who gets to read each note: only themselves, the whole party, or a few chosen players.

**Foundry VTT:** v13 · **System:** any

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-familiar-faces/releases/latest/download/module.json
```

Enable it in your world. The first time a GM opens the world with the module enabled, it sets up its storage (a few journal entries that are hidden from the Journal directory). Players see the tab right away, but can only write private notes once that has happened.

## For the GM

### Adding someone the party has met

- **Select a name in any journal and right-click it** → *Add “Name” to Familiar Faces*. A small window opens with the name filled in, **First met at** set to the current scene, an optional **What the party knows** text that every player sees, and — if the journal page has pictures — a choice of portrait. The face links back to the journal page it came from. If someone with that name is already in the list, the window says so and offers to open them instead.
- **Right-click a journal or a journal page** in the sidebar → *Add to Familiar Faces* (the name of the journal or page is used).
- **Right-click an NPC in the Actors directory** → *Add to Familiar Faces*. The NPC goes straight into every player's Familiar Faces with its name, its portrait (or token image) and the current scene as where they were first met. No window opens.
- **Right-click an NPC's token** and click the theatre-masks button on the token HUD to do the same for the token: the token's name, the NPC's image and the token's scene. If some players had already added that NPC themselves, the button puts them in everyone's list instead.
- Or use **Add NPC** at the top of the tab.

Hold **Shift** while right-clicking to get the normal menu instead. The menus can be turned off per user in the module settings.

### Portraits

- **Right-click an image in a journal** → *Add image to NPC…*. A search window lists every NPC; type a few letters, pick one (or double-click it) and the image becomes their portrait. If the page name or the image caption contains someone's name, that NPC is picked for you. *New NPC with this image* adds a new NPC with that portrait instead.
- Image journal pages also have *Add image to NPC…* in their right-click menu in the journal's page list.
- In an NPC's window, drop an image file, an image link, an actor, a tile or an image journal page onto the portrait, or use the buttons on it to pick a file, upload one, show the portrait to the players, or remove it.

Only the GM can set portraits.

### Managing NPCs

Right-click an NPC in the tab to open it, change or remove its portrait, show the portrait to the players, or remove the NPC. You see every NPC, also the ones players added for themselves; those have a small lock next to the name that tells who has them, and **Share with the party** (in the right-click menu, on the card and in the NPC's window) puts them in everyone's list. **Edit** in the NPC's window changes the name, where they were first met and what the party knows. Removing an NPC also removes everyone's notes about it.

## For players

- Open the **Familiar Faces** tab (the theatre-masks icon) to see everyone your party has met.
- **Search** finds names, places, the GM's description and the notes you can see. Put several words in "quotes" to search for them together.
- **Right-click an NPC's token** on the map → *Add Name to my Familiar Faces*. They go into your own list only, with the token's name and image and the scene as where you met them; the other players don't see them unless they add them too, or the GM shares them with everyone. If they're already in your list, the menu opens them instead. **Remove from my faces** in their window takes them out of your list again (your private notes about them are kept). Hold **Shift** to skip the menu.
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

**How private is private?** Familiar Faces only ever shows a note to the people it's meant for, and the GM can read every note. But Foundry sends all of a world's data to every connected player, including journals they have no permission to open, so a player who digs into the browser console could still find notes that weren't meant for them. Treat "Only me" and "Some players" like passing a note at the table, not like a locked diary. The same goes for NPCs a player added only to their own list.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Notifications | World | Tell players when someone new is added, gets a portrait, or a note is shared with them. |
| Players can add NPCs | World | Lets players add people themselves (portraits stay GM-only). Off by default. |
| Portrait upload folder | World | Where uploaded portraits go. Empty: `worlds/<world>/familiar-faces`. |
| Right-click selected names | User | The *Add to Familiar Faces* menu on selected names. |
| Right-click journal images (GM) | User | The *Add image to NPC* menu on journal images. |
| Show the names of NPCs the party knows | World | When an NPC is in every player's Familiar Faces, all its tokens show their name to everyone on hover (see below). On by default. |
| Right-click NPC tokens | User | Players: the *Add to my Familiar Faces* menu on NPC tokens. GM: the Familiar Faces button on NPC token HUDs. |

## No new NPCs in the middle of a fight

Nobody has time to make new acquaintances during combat. While a combat encounter is running (it has started), players can't add NPCs – not from tokens, selected names, journals or the **Add NPC** button – and can't share NPCs with the party. Right-clicking an NPC token or a selected name says so instead, and the Add NPC button is greyed out. Opening NPCs and writing notes still work, and everything is back as soon as the combat ends. The GM can still add and share NPCs during combat.

## Names on hover for NPCs the party knows

As soon as an NPC is in every player's Familiar Faces – the GM added them for everyone, or a player shared them with the party – all tokens of that NPC show their name to everyone on hover (Display Name: *Hovered by Anyone*): the tokens already placed in every scene, and the actor's prototype token, so tokens placed later do the same. So once the party has met a "Neverwinter Guard", every Neverwinter Guard token shows its name.

- It covers the NPC's own actor (NPCs added from a token or the Actors directory remember it), NPC actors with the NPC's name, and NPC tokens carrying that name.
- A GM has to be logged in for tokens to change; NPCs shared while no GM is online are caught up when a GM logs in.
- Tokens that already show their name to everyone (*Always for Everyone*) are left alone, and the module never hides a name again – removing an NPC doesn't change its tokens back.
- Turn it off with **Show the names of NPCs the party knows** in the module settings.

## Works with Dxcufgb's Quest log

The Quest log has its own menu for selected text. With both modules enabled, the Familiar Faces items are added to the bottom of the Quest log's menu, so one right-click on a selected name offers both.

## For macro and module authors

```js
const ff = game.modules.get("dxcufgbs-familiar-faces").api;
ff.open();                                   // switch to the tab
ff.faces();                                  // [{id, name, img, metAt, info, source, ...}]
ff.findByName("Mira Ashgrove");
ff.addFace({ name: "Mira Ashgrove", img: "path/to/mira.webp" });   // opens the Add window
await ff.createFace({ name: "Mira Ashgrove", metAt: "Saltmarsh" }); // no window; returns the id
ff.bindImage("path/to/mira.webp");           // opens the Add image to NPC search
ff.addToken(token);                          // GM: for all players; player: to their own Familiar Faces
ff.addActor(actor);                          // GM: add an NPC actor for all players
ff.shareWithParty(id);                       // GM, or a player who has the NPC: put it in everyone's list
ff.forgetFace(id);                           // player: remove an NPC from their own list
await ff.syncNameplates();                   // GM: update the tokens of party-known NPCs now
ff.openFace(id);
```

## Credits

The placeholder pictures use symbols from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), recoloured and placed on backgrounds (see `assets/placeholders/LICENSE.txt`).

## Support

Found a bug or have an idea? [Open an issue](https://github.com/dxcufgb/FoundryVTT-familiar-faces/issues). If you like the module, you can [support me on Ko-fi](https://ko-fi.com/dxcufgb).

## License

[MIT](LICENSE)
