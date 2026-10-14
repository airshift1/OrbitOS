import { describe, expect, it } from "vitest";
import { useFileSystemStore } from "../stores/useFileSystemStore";

const s = () => useFileSystemStore.getState();
const desktopId = () => s().getChildren(s().rootId).find((n) => n.name === "Desktop")!.id;

describe("file system store rejects unsafe names", () => {
  it("creates ordinary files", () => {
    expect(s().createNode(desktopId(), "hello.txt", "file", "hi")).not.toBe("");
  });
  it.each(["", "  ", "..", "a/b", "a\\b", "x".repeat(200), "evil.app", "EVIL.APP"])("createNode refuses %j", (name) => {
    const before = Object.keys(s().nodes).length;
    expect(s().createNode(desktopId(), name, "file", "x")).toBe("");
    expect(Object.keys(s().nodes).length).toBe(before);
  });
  it("won't create inside a file or a missing parent", () => {
    const fileId = s().createNode(desktopId(), "leaf.txt", "file", "");
    expect(s().createNode(fileId, "child.txt", "file")).toBe("");
    expect(s().createNode("does-not-exist", "child.txt", "file")).toBe("");
  });
  it("renameNode refuses bad names and protected nodes", () => {
    const id = s().createNode(desktopId(), "keep.txt", "file", "");
    s().renameNode(id, "../../etc/passwd");
    s().renameNode(id, "turn-into.app");
    expect(s().getNode(id)!.name).toBe("keep.txt");
    s().renameNode(desktopId(), "Renamed"); // system folder
    expect(s().getNode(desktopId())!.name).toBe("Desktop");
    s().renameNode(id, "  renamed.txt ");
    expect(s().getNode(id)!.name).toBe("renamed.txt");
  });
});
