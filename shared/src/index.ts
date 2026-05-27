// Shared types between client and server. Single source of truth for the
// WebSocket protocol (SPEC §9).

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
export interface JoinMsg {
  type: "join";
  sessionId: string;
  name: string;
  romId: string;
  romHash: string;
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
  romId: string;
  romHash: string;
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
  | ErrorMsg;

// ---- Tunables (SPEC §17) ----
export const DEFAULTS = {
  SNAPSHOT_INTERVAL_MS: 1500,
  FOLLOWER_DELAY_MS: 120,
  HEARTBEAT_INTERVAL_MS: 3000,
  HEARTBEAT_TIMEOUT_MS: 10000,
  RECONCILE_MODE: "hash" as "hash" | "always",
} as const;
