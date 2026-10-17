import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../../server/multiplayerProtocol";

describe("Snake WebSocket message validation", () => {
  it("accepts only well-shaped room and gameplay messages", () => {
    expect(parseClientMessage('{"type":"rooms"}')).toEqual({ ok: true, message: { type: "rooms" } });
    expect(parseClientMessage('{"type":"create","name":"  Nova  ","visibility":"private"}')).toEqual({
      ok: true,
      message: { type: "create", name: "Nova", visibility: "private" },
    });
    expect(parseClientMessage('{"type":"join","roomCode":"AB12CD","name":"Nova","reconnectToken":"safe-token"}')).toEqual({
      ok: true,
      message: { type: "join", roomCode: "AB12CD", name: "Nova", reconnectToken: "safe-token" },
    });
    expect(parseClientMessage('{"type":"ready","ready":true}')).toEqual({ ok: true, message: { type: "ready", ready: true } });
    expect(parseClientMessage('{"type":"direction","direction":"left"}')).toEqual({ ok: true, message: { type: "direction", direction: "left" } });
    expect(parseClientMessage('{"type":"boost","active":true}')).toEqual({ ok: true, message: { type: "boost", active: true } });
  });

  it("rejects malformed, oversized, unknown, and invalid player input", () => {
    expect(parseClientMessage("not-json")).toMatchObject({ ok: false, code: "invalid_json" });
    expect(parseClientMessage("x".repeat(4097))).toMatchObject({ ok: false, code: "message_too_large" });
    expect(parseClientMessage("[]")).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"teleport","x":999}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"direction","direction":"north"}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"ready","ready":"yes"}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"boost","active":"yes"}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"join","roomCode":"ABC","name":"Nova"}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage('{"type":"create","name":" ","visibility":"private"}')).toMatchObject({ ok: false, code: "invalid_message" });
    expect(parseClientMessage(`{"type":"create","name":"${"a".repeat(21)}","visibility":"public"}`)).toMatchObject({ ok: false, code: "invalid_message" });
  });
});
