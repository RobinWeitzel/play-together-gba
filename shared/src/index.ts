// Shared types between client and server. Single source of truth for the
// WebSocket protocol (SPEC §9) and the HTTP /api shape.

export type GbaButton =
  | "A"
  | "B"
  | "L"
  | "R"
  | "Start"
  | "Select"
  | "Up"
  | "Down"
  | "Left"
  | "Right";

export const GBA_BUTTONS: GbaButton[] = [
  "A",
  "B",
  "L",
  "R",
  "Start",
  "Select",
  "Up",
  "Down",
  "Left",
  "Right",
];

export type Role = "controller" | "follower";

export interface RosterEntry {
  id: string;
  name: string;
  role: Role;
}

export interface SnapshotMeta {
  frame: number;
  // base64-encoded snapshot bytes (gzip-compressed if compressed=true)
  data: string;
  compressed: boolean;
  // bytes-length of the underlying state file before compression/base64
  rawSize: number;
}

// ---- Client → Server ----
//
// JoinMsg now references a persistent SAVE — not an ad-hoc session id.
// The save carries the romId/romHash, so the client does not declare them
// on join; the server tells the client in `welcome` and the client
// hash-checks its local ROM bytes before booting.
export interface JoinMsg {
  type: "join";
  saveId: string;
  name: string;
}

export interface ClientInputMsg {
  type: "input";
  frame: number;
  button: GbaButton;
  pressed: boolean;
}

export interface ClientSnapshotMsg {
  type: "snapshot";
  frame: number;
  data: string;
  compressed: boolean;
  rawSize: number;
}

export interface HeartbeatMsg {
  type: "heartbeat";
}

export interface LeaveMsg {
  type: "leave";
}

export type ClientMsg =
  | JoinMsg
  | ClientInputMsg
  | ClientSnapshotMsg
  | HeartbeatMsg
  | LeaveMsg;

// ---- Server → Client ----
export interface WelcomeMsg {
  type: "welcome";
  selfId: string;
  role: Role;
  controllerId: string | null;
  roster: RosterEntry[];
  latestSnapshot: SnapshotMeta | null;
  // Save context (what game, who has played).
  saveId: string;
  saveName: string;
  romId: string;
  romHash: string;
  contributors: Record<string, number>; // playerName → totalControllerMs
}

export interface RosterMsg {
  type: "roster";
  roster: RosterEntry[];
  controllerId: string | null;
}

export interface ServerInputMsg {
  type: "input";
  frame: number;
  button: GbaButton;
  pressed: boolean;
}

export interface ServerSnapshotMsg {
  type: "snapshot";
  frame: number;
  data: string;
  compressed: boolean;
  rawSize: number;
}

export interface BecomeControllerMsg {
  type: "becomeController";
  frame: number;
  data: string;
  compressed: boolean;
  rawSize: number;
}

export interface ControllerChangedMsg {
  type: "controllerChanged";
  controllerId: string | null;
}

export interface HeartbeatAckMsg {
  type: "heartbeatAck";
}

// Live contributors update — push when a controller hands over or a snapshot
// flushes accumulated time, so the home-page roster + in-game header can
// reflect the latest minutes-per-player without polling.
export interface ContributorsMsg {
  type: "contributors";
  contributors: Record<string, number>;
}

export interface ErrorMsg {
  type: "error";
  code: string;
  message: string;
}

export type ServerMsg =
  | WelcomeMsg
  | RosterMsg
  | ServerInputMsg
  | ServerSnapshotMsg
  | BecomeControllerMsg
  | ControllerChangedMsg
  | HeartbeatAckMsg
  | ContributorsMsg
  | ErrorMsg;

// ---- HTTP /api/saves ----
//
// A "save" is the persistent thing: it owns a ROM, a save state on disk, and
// a contributor ledger. The "session" is the in-memory wrapper that exists
// only while at least one player is connected to that save.
export interface SaveSummary {
  id: string;
  name: string;
  romId: string;
  romHash: string;
  romName: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  contributors: Record<string, number>; // playerName → totalControllerMs
  // Live-session info; null when no one is currently in the save.
  live: {
    participantCount: number;
    controllerName: string | null;
  } | null;
}

export interface CreateSaveRequest {
  name: string;
  romId: string;
}

export interface CreateSaveResponse {
  save: SaveSummary;
}

// ---- Tunables (SPEC §17) ----
export const DEFAULTS = {
  SNAPSHOT_INTERVAL_MS: 1500,
  FOLLOWER_DELAY_MS: 120,
  HEARTBEAT_INTERVAL_MS: 3000,
  HEARTBEAT_TIMEOUT_MS: 10000,
  RECONCILE_MODE: "hash" as "hash" | "always",
} as const;
