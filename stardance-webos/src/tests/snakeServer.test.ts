import { describe, expect, it } from "vitest";
import { DISCONNECT_GRACE_MS, SnakeRoomManager, WORLD_COLUMNS, WORLD_ROWS } from "../../server/snakeRooms";

describe("authoritative Snake room service", () => {
  it("creates discoverable public rooms and keeps private rooms out of discovery", () => {
    const manager = new SnakeRoomManager(() => 1_000, () => 0.5);
    const publicRoom = manager.createRoom("host-public", "  Starlight  ", "public");
    const privateRoom = manager.createRoom("host-private", "Comet", "private");
    const privateGuest = manager.joinRoom("private-guest", privateRoom!.roomCode, "Nova");

    expect(publicRoom?.roomCode).toMatch(/^[A-F0-9]{6}$/);
    expect(publicRoom?.snapshot.players[0]).not.toHaveProperty("reconnectToken");
    expect(privateGuest?.snapshot.players).toHaveLength(2);
    expect(manager.listPublicRooms()).toEqual([
      { code: publicRoom!.roomCode, players: 1, capacity: 8, status: "waiting" },
    ]);
    expect(privateRoom?.snapshot.visibility).toBe("private");
  });

  it("joins by code, starts only when the host has two players, and synchronizes authoritative movement", () => {
    let now = 1_000;
    const manager = new SnakeRoomManager(() => now, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    const guest = manager.joinRoom("guest", host.roomCode, "Guest")!;

    expect(manager.startRoom("guest")).toBe(false);
    expect(manager.startRoom("host")).toBe(false);
    expect(manager.setReady("guest", true)).toBe(true);
    expect(manager.startRoom("host")).toBe(true);
    const before = manager.snapshot(host.roomCode)!;
    expect(before.columns).toBe(WORLD_COLUMNS);
    expect(before.rows).toBe(WORLD_ROWS);
    expect(before.players).toHaveLength(2);

    now += 240;
    expect(manager.tick()).toContain(host.roomCode);
    const after = manager.snapshot(host.roomCode)!;
    expect(after.players[0].segments[0]).not.toEqual(before.players[0].segments[0]);
    expect(after.players[1].segments[0]).not.toEqual(before.players[1].segments[0]);
    expect(guest.snapshot.players).toHaveLength(2);
  });

  it("keeps both starting players alive while their default paths spread apart", () => {
    let now = 1_000;
    const manager = new SnakeRoomManager(() => now, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.joinRoom("guest", host.roomCode, "Guest");
    manager.setReady("guest", true);
    manager.startRoom("host");

    for (let step = 0; step < 10; step += 1) {
      now += 240;
      manager.tick();
    }

    const state = manager.snapshot(host.roomCode)!;
    expect(state.status).toBe("playing");
    expect(state.players.every((player) => player.alive)).toBe(true);
  });

  it("enforces the eight-player room capacity", () => {
    const manager = new SnakeRoomManager(() => 1_000, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    for (let player = 1; player < 8; player += 1) {
      expect(manager.joinRoom(`guest-${player}`, host.roomCode, `Guest ${player}`)).not.toBeNull();
    }
    expect(manager.snapshot(host.roomCode)?.players).toHaveLength(8);
    expect(manager.joinRoom("extra", host.roomCode, "Extra")).toBeNull();
  });

  it("rejects invalid and reverse directions before the next server tick", () => {
    const manager = new SnakeRoomManager(() => 1_000, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.joinRoom("guest", host.roomCode, "Guest");
    manager.setReady("guest", true);
    manager.startRoom("host");

    expect(manager.setDirection("host", "right")).toBe(false);
    expect(manager.setDirection("host", "up")).toBe(true);
    expect(manager.setDirection("host", "down")).toBe(false);
    expect(manager.setDirection("host", "north")).toBe(false);
    expect(manager.setDirection("guest", "left")).toBe(false);
  });

  it("keeps boost server-authoritative and applies one growth unit per two boosted pickups", () => {
    let now = 1_000;
    let call = 0;
    let column = 59;
    const random = () => {
      const value = call % 2 === 0 ? (column + 0.5) / WORLD_COLUMNS : 40.5 / WORLD_ROWS;
      call += 1;
      if (call % 2 === 0) column -= 1;
      return value;
    };
    const manager = new SnakeRoomManager(() => now, random);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.joinRoom("guest", host.roomCode, "Guest");
    manager.setReady("guest", true);
    manager.startRoom("host");
    expect(manager.setBoost("host", true)).toBe(true);
    expect(manager.snapshot(host.roomCode)?.players[0].boosting).toBe(true);

    now += 240;
    manager.tick();
    expect(manager.snapshot(host.roomCode)?.players[0]).toMatchObject({ score: 1, segments: expect.arrayContaining([{ x: 59, y: 40 }]) });
    expect(manager.snapshot(host.roomCode)?.players[0].segments).toHaveLength(3);
    now += 240;
    manager.tick();
    const hostState = manager.snapshot(host.roomCode)?.players[0];
    expect(hostState?.score).toBe(2);
    expect(hostState?.segments).toHaveLength(4);
    expect(manager.setBoost("host", false)).toBe(true);
    expect(manager.snapshot(host.roomCode)?.players[0].boosting).toBe(false);
  });

  it("keeps player identity through a reconnect and marks disconnects in room state", () => {
    const manager = new SnakeRoomManager(() => 1_000, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    const guest = manager.joinRoom("guest", host.roomCode, "Guest")!;

    expect(manager.disconnect("guest")).toBe(host.roomCode);
    expect(manager.snapshot(host.roomCode)?.players[1].online).toBe(false);
    const reconnected = manager.joinRoom("guest-new", host.roomCode, "Guest", guest.reconnectToken)!;
    expect(reconnected.playerId).toBe(guest.playerId);
    expect(manager.snapshot(host.roomCode)?.players[1].online).toBe(true);
  });

  it("moves a reconnect token to the new socket without letting the old socket disconnect it", () => {
    const manager = new SnakeRoomManager(() => 1_000, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    const guest = manager.joinRoom("guest-old", host.roomCode, "Guest")!;

    const replacement = manager.joinRoom("guest-new", host.roomCode, "Guest", guest.reconnectToken)!;
    expect(replacement.playerId).toBe(guest.playerId);
    expect(manager.disconnect("guest-old")).toBeNull();
    expect(manager.snapshot(host.roomCode)?.players[1].online).toBe(true);
  });

  it("detects wall collisions server-side and ends the round", () => {
    let now = 1_000;
    const manager = new SnakeRoomManager(() => now, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.joinRoom("guest", host.roomCode, "Guest");
    manager.setReady("guest", true);
    manager.startRoom("host");
    manager.setDirection("host", "up");
    manager.setDirection("guest", "up");

    for (let step = 0; step < 80; step += 1) {
      now += 240;
      manager.tick();
      if (step === 0) manager.setDirection("host", "left");
      if (step === 39) manager.setDirection("guest", "right");
    }

    const final = manager.snapshot(host.roomCode)!;
    expect(final.status).toBe("gameover");
    expect(final.players[0].alive).toBe(false);
    expect(final.winnerId).toBe(final.players[1].id);
  });

  it("spawns a shared cupcake at the 25-item milestone and resumes after its celebration", () => {
    let now = 1_000;
    let randomCall = 0;
    let foodColumn = 59;
    const random = () => {
      const value = randomCall % 2 === 0 ? (foodColumn + 0.5) / WORLD_COLUMNS : 40.5 / WORLD_ROWS;
      randomCall += 1;
      if (randomCall % 2 === 0) foodColumn -= 1;
      return value;
    };
    const manager = new SnakeRoomManager(() => now, random);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.joinRoom("guest", host.roomCode, "Guest");
    manager.setReady("guest", true);
    manager.startRoom("host");
    manager.setDirection("guest", "up");

    for (let item = 0; item < 25; item += 1) {
      now += 240;
      manager.tick();
      if (item === 19) manager.setDirection("guest", "right");
    }
    expect(manager.snapshot(host.roomCode)?.players[0].score).toBe(25);
    expect(manager.snapshot(host.roomCode)?.specialFood).not.toBeNull();

    now += 240;
    manager.tick();
    now += 240;
    manager.tick();
    expect(manager.snapshot(host.roomCode)?.players[0].score).toBe(27);
    expect(manager.snapshot(host.roomCode)?.status).toBe("celebrating");

    now += 2_999;
    manager.tick();
    expect(manager.snapshot(host.roomCode)?.status).toBe("celebrating");
    now += 1;
    manager.tick();
    expect(manager.snapshot(host.roomCode)?.status).toBe("playing");
  });

  it("cleans up rooms after every player disconnects and the grace period expires", () => {
    let now = 1_000;
    const manager = new SnakeRoomManager(() => now, () => 0.5);
    const host = manager.createRoom("host", "Host", "private")!;
    manager.disconnect("host");
    now += DISCONNECT_GRACE_MS;

    expect(manager.tick()).toContain(host.roomCode);
    expect(manager.snapshot(host.roomCode)).toBeNull();
  });
});
