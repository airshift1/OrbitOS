import { describe, expect, it } from "vitest";
import { getSnakeWebSocketUrl } from "../apps/Snake/multiplayerConnection";

describe("Snake multiplayer connection configuration", () => {
  it("uses secure WebSockets for HTTPS server origins", () => {
    expect(getSnakeWebSocketUrl("https://snake.example.net")).toBe("wss://snake.example.net/ws");
    expect(getSnakeWebSocketUrl("http://localhost:8080/")).toBe("ws://localhost:8080/ws");
    expect(getSnakeWebSocketUrl("wss://snake.example.net/ws")).toBe("wss://snake.example.net/ws");
  });

  it("rejects credentials, query strings, unsupported schemes, and custom paths", () => {
    expect(getSnakeWebSocketUrl("https://user:password@snake.example.net")).toBeNull();
    expect(getSnakeWebSocketUrl("https://snake.example.net/?token=secret")).toBeNull();
    expect(getSnakeWebSocketUrl("https://snake.example.net/custom")).toBeNull();
    expect(getSnakeWebSocketUrl("file:///tmp/server")).toBeNull();
    expect(getSnakeWebSocketUrl("not a URL")).toBeNull();
  });
});
