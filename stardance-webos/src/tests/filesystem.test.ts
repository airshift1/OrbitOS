import { describe, expect, it } from "vitest";
import { MAX_NODE_CONTENT, sanitizePersistedFilesystem, useFileSystemStore } from "../stores/useFileSystemStore";

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

  it("enforces protected-node and tree-integrity rules in the store", () => {
    const root = s().rootId;
    const desktop = desktopId();
    const documents = s().getChildren(root).find((n) => n.name === "Documents")!.id;
    const file = s().createNode(desktop, "integrity.txt", "file", "safe");
    const folder = s().createNode(desktop, "integrity-folder", "folder");
    expect(file).not.toBe("");
    expect(folder).not.toBe("");
    s().moveNode(folder, file);
    expect(s().getNode(folder)!.parentId).toBe(desktop);
    s().moveNode(folder, folder);
    expect(s().getNode(folder)!.parentId).toBe(desktop);
    s().moveNode(folder, documents);
    expect(s().getNode(folder)!.parentId).toBe(documents);
    s().deleteNode(desktop);
    expect(s().getNode(desktop)).toBeDefined();
    s().updateContent(file, "x".repeat(MAX_NODE_CONTENT + 1));
    expect(s().getNode(file)!.content).toBe("safe");
  });

  it("falls back when persisted ancestry is malformed", () => {
    const out = sanitizePersistedFilesystem({
      rootId: "root",
      nodes: {
        root: { id: "root", name: "/", type: "folder", parentId: null, createdAt: 1, updatedAt: 1 },
        a: { id: "a", name: "A", type: "folder", parentId: "b", createdAt: 1, updatedAt: 1 },
        b: { id: "b", name: "B", type: "folder", parentId: "a", createdAt: 1, updatedAt: 1 },
      },
    });
    expect(out.nodes[out.rootId].name).toBe("/");
    expect(Object.values(out.nodes).some((node) => node.name === "Desktop")).toBe(true);
  });
});
