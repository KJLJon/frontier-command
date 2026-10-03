# A practical multiplayer extension

No online dependency exists in the current single-player game. The simulation accepts serializable commands and owns the match world independently of Phaser and DOM. The local client owns selection, camera, hotkeys, audio and menus. Those presentation fields should never be sent as authoritative world data.

The recommended first implementation is an authoritative Cloudflare Durable Object per match, accessed through Worker WebSocket routing. A match session handles 1v1/2v2/co-op/FFA players, invite codes, join/resume, command validation and tick execution. Clients send `{matchId,playerId,sequence,intendedTick,command}`. The server derives the player/team identity from the session, rejects unauthorized entity control, applies costs/prerequisites/rate limits, orders commands deterministically by tick/player sequence, and broadcasts acknowledged commands plus periodic snapshots.

Run the existing headless Simulation inside the object. Do not trust client spawn/debug/resource modifications. Disable client debug in competitive builds. Fog-filter snapshots so clients do not receive concealed enemy data. The current full-world single-player snapshot is unsuitable for competitive secrecy. Commander movement can use local prediction with reconciliation; RTS orders can show immediate target markers until accepted.

Use snapshots plus authoritative correction initially. Pure peer lockstep would require fixed-point movement/damage, canonical serialization/PRNG state, path tie-breaking, deterministic content checksums and extensive cross-browser hash tests. Current float simulation is not claimed to meet those constraints.

Map/campaign/content versions belong in the handshake. Teams are alliance IDs in Player and are already independent of player indices. The game is currently configured for 2–6 local/AI slots; a network setup should distinguish controller type, seat ownership and connection state rather than rewriting entity team semantics. The browser supports one local human; multiple humans are a future transport/UI feature.

D1 can store profile/progression summaries; R2 can hold replay snapshots/content packs; KV can provide short-lived invite lookup. Durable Object storage preserves match checkpoints. Replays should record initial map/settings/content hash and the ordered command stream. Do not use wall-clock UI callbacks for critical simulation behavior.

Tactical pause policy must be agreed per mode. Offline retains its current policy. Ranked multiplayer should disallow unilateral pausing; co-op can use a consensus pause with server-owned state. Save/snapshot migrations must preserve old data and refuse incompatible content with a readable message.
