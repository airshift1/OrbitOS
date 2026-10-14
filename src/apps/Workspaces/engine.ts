import {
  DebugLayer,
  ExpandNodeModel,
  overConstrainRecomputeBehavior,
  WorkspaceEngine,
  WorkspaceNodeFactory,
} from "@projectstorm/react-workspaces-core";
import { DefaultTrayFactory, DefaultWindowModel, DefaultWindowModelFactory, DefaultWorkspacePanelFactory } from "@projectstorm/react-workspaces-defaults";
import { draggingItemBehavior, getDirectiveForWorkspaceNode } from "@projectstorm/react-workspaces-behavior-panel-dropzone";
import { draggingItemDividerBehavior } from "@projectstorm/react-workspaces-behavior-divider-dropzone";
import { WorkspaceTabFactory, WorkspaceTabModel } from "@projectstorm/react-workspaces-model-tabs";
import { resizingBehavior } from "@projectstorm/react-workspaces-behavior-resize";
import { RootWorkspaceModel } from "@projectstorm/react-workspaces-model-floating-window";
import { ConvertToTabZone, getDirectiveForTabModel } from "@projectstorm/react-workspaces-dropzone-plugin-tabs";
import { ConvertToTrayZone, getDirectiveForTrayModel } from "@projectstorm/react-workspaces-dropzone-plugin-tray";
import type { AppId } from "../../types";
import { AppPanelFactory, AppPanelModel, AppPanelRenderer } from "./AppPanel";

/**
 * Engine wiring — the same recipe as react-workspaces' own demo stories
 * (panel / tab / tray / floating-window models, drag-to-dock behaviours,
 * divider resizing), with our app-hosting panel type registered on top.
 */
export function createEngine(): WorkspaceEngine {
  const engine = new WorkspaceEngine();

  const renderer = new AppPanelRenderer();
  const windowFactory = new DefaultWindowModelFactory();
  const tabFactory = new WorkspaceTabFactory();
  const trayFactory = new DefaultTrayFactory({
    windowFactory,
    installIconPositionListener: true,
    installEngineLockListener: true,
  });
  const nodeFactory = new WorkspaceNodeFactory();

  engine.registerFactory(new DefaultWorkspacePanelFactory());
  engine.registerFactory(new AppPanelFactory());

  tabFactory.addRenderer(renderer);
  trayFactory.addRenderer(renderer);
  nodeFactory.addRenderer(renderer);
  // The library types this renderer slot for the base model; our panel is a subclass.
  windowFactory.addRenderer(renderer as never);

  engine.registerFactory(tabFactory);
  engine.registerFactory(trayFactory);
  engine.registerFactory(nodeFactory);
  engine.registerFactory(windowFactory);

  overConstrainRecomputeBehavior({ engine });

  draggingItemBehavior({
    engine,
    getDropZoneForModel: (model) =>
      getDirectiveForTrayModel(model) ||
      getDirectiveForWorkspaceNode({
        node: model,
        transformZones: [ConvertToTabZone(tabFactory), ConvertToTrayZone(trayFactory)],
        generateParentNode: () => new ExpandNodeModel(),
        allowSplit: !(model.parent instanceof ExpandNodeModel) || model.parent.parent === null,
      }) ||
      getDirectiveForTabModel(model, [], () => new ExpandNodeModel()),
    debug: false,
  });
  draggingItemDividerBehavior({ engine });
  resizingBehavior(engine);

  engine.layerManager.addLayer(new DebugLayer({ dividers: false, resizeDividers: false, panels: false }));
  return engine;
}

const column = (...apps: AppId[]) => {
  const node = new ExpandNodeModel().setExpand(false, true).setVertical(true);
  apps.forEach((a) => node.addModel(new AppPanelModel(a)));
  return node;
};

/** Default layout: Notes | tabbed [Terminal, Calculator, Clock] | column [System Monitor, Launcher]. */
export function createDefaultLayout(engine: WorkspaceEngine): RootWorkspaceModel {
  const root = new RootWorkspaceModel(engine, false);
  root.setHorizontal(true);
  root
    .addModel(new AppPanelModel("notes"))
    .addModel(
      new WorkspaceTabModel()
        .addModel(new AppPanelModel("terminal"))
        .addModel(new AppPanelModel("calculator"))
        .addModel(new AppPanelModel("clock")),
    )
    .addModel(column("task-manager", "launcher"));
  return root;
}

/** Add a floating (draggable, resizable) window hosting an app. */
export function addFloatingApp(root: RootWorkspaceModel, appId: AppId, offset: number) {
  const w = new DefaultWindowModel(new AppPanelModel(appId));
  w.position.update({ top: 70 + offset, left: 90 + offset });
  w.setWidth(420);
  w.setHeight(320);
  root.addFloatingWindow(w);
}

/** Restore a saved layout, falling back to the default when it can't be read. */
export function restoreLayout(engine: WorkspaceEngine, serialized: string | null): RootWorkspaceModel {
  if (serialized) {
    try {
      const root = new RootWorkspaceModel(engine, false);
      root.fromArray(JSON.parse(serialized), engine);
      if (root.flatten().some((m) => m instanceof AppPanelModel)) return root;
    } catch (err) {
      console.warn("[Workspaces] could not restore saved layout", err);
    }
  }
  return createDefaultLayout(engine);
}
