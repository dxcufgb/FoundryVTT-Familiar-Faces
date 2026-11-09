# Changelog

## Unreleased

- Fix: players could not add NPCs (*Add someone you met*, the token menu, sharing with the party) while a combat that
  had started was left running on another scene. Only a fight on the scene the player is viewing (or one not linked to
  a scene) blocks adding now. The debug snapshot also counts started combats.

## 1.3.1

- Optional integration with Dxcufgb's Debug Recorder: when it is installed and the GM records, Familiar Faces & Places
  adds a snapshot of its state (counts of NPCs, places and factions and their notes by visibility, store state, open
  windows, combat blocking, the Quest log integration, caught error codes) and breadcrumbs at its main actions. No
  names, notes, image paths or URLs are ever included. Without the recorder nothing changes.
