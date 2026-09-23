import { Suspense } from "react";
import { DefaultSubComponentRenderer, DefaultWorkspacePanelModel } from "@projectstorm/react-workspaces-defaults";
import { WorkspaceTrayMode, type TrayModelPanelRendererEvent } from "@projectstorm/react-workspaces-model-tray";
import type { TabRendererEvent } from "@projectstorm/react-workspaces-model-tabs";
import type { RenderTitleBarEvent } from "@projectstorm/react-workspaces-core";
import type { FloatingWindowSubRendererEvent } from "@projectstorm/react-workspaces-model-floating-window";
import { X } from "lucide-react";
import { getIcon } from "../../lib/icons";
import { WorkspaceModelFactory, type SerializedModel, type WorkspaceModelFactoryEvent, type WorkspaceEngine } from "@projectstorm/react-workspaces-core";
import type { IconName } from "@fortawesome/free-solid-svg-icons";
import type { AppId } from "../../types";
import { appRegistry } from "../registry";
import { AppErrorBoundary } from "../../shell/Window/AppErrorBoundary";

/**
 * Bridges react-workspaces to the OS app registry: a workspace panel whose
 * content is a *real OrbitOS app* (Notes, Terminal, Calculator …).
 */

/** Font Awesome glyphs (registered in Workspaces.tsx) shown in tabs and trays. */
export const PANEL_ICONS: Partial<Record<AppId, IconName>> = {
  notes: "note-sticky",
  terminal: "terminal",
  calculator: "calculator",
  clock: "clock",
  "task-manager": "chart-line",
  browser: "globe",
  paint: "paintbrush",
  "about-me": "user",
  "theme-studio": "palette",
  settings: "gear",
  "file-explorer": "folder",
  "text-editor": "file-lines",
  welcome: "star",
  launcher: "grip",
};

export const APP_PANEL_TYPE = "orbit-app";

export class AppPanelModel extends DefaultWorkspacePanelModel {
  appId: AppId;

  constructor(appId: AppId = "notes") {
    super(appRegistry[appId]?.name ?? appId, PANEL_ICONS[appId] ?? "cube");
    this.type = APP_PANEL_TYPE;
    this.appId = appId;
    this.minimumSize.update({ width: 220, height: 140 });
  }

  toArray() {
    return { ...super.toArray(), appId: this.appId };
  }

  fromArray(payload: SerializedModel & { appId?: string }, engine: WorkspaceEngine) {
    super.fromArray(payload, engine);
    const id = payload.appId as AppId | undefined;
    if (id && id in appRegistry) this.appId = id;
  }
}

function AppPanelContent({ model }: { model: AppPanelModel }) {
  const app = appRegistry[model.appId];
  if (!app) return <div className="wsapp-missing">Unknown app “{model.appId}”</div>;
  const Component = app.component;
  return (
    <div className="wsapp-panel">
      <AppErrorBoundary appName={app.name}>
        <Suspense fallback={<div className="wsapp-missing">Loading…</div>}>
          <Component windowId={`panel-${model.id}`} />
        </Suspense>
      </AppErrorBoundary>
    </div>
  );
}

export class AppPanelFactory extends WorkspaceModelFactory<AppPanelModel> {
  constructor() {
    super(APP_PANEL_TYPE);
  }

  generateContent(event: WorkspaceModelFactoryEvent<AppPanelModel>) {
    return <AppPanelContent model={event.model} />;
  }

  protected _generateModel(): AppPanelModel {
    return new AppPanelModel("notes");
  }
}

function PanelTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="wsapp-title">
      <span className="wsapp-title__text">{title}</span>
      <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Draws the workspace chrome (panel titles, tabs, tray icons) with the OS
 * design tokens instead of the library's built-in dark-blue widgets, so it
 * follows the active theme and accent and keeps its text readable.
 */
export class AppPanelRenderer extends DefaultSubComponentRenderer {
  matchModel(model: DefaultWorkspacePanelModel): boolean {
    return model.type === APP_PANEL_TYPE;
  }

  renderTitleBar(event: RenderTitleBarEvent<DefaultWorkspacePanelModel>) {
    return (
      <PanelTitle
        title={event.model.displayName}
        onClose={() => {
          event.model.delete();
          event.engine.normalize();
        }}
      />
    );
  }

  renderWindowTitle(event: FloatingWindowSubRendererEvent<DefaultWorkspacePanelModel>) {
    return (
      <PanelTitle
        title={event.model.displayName}
        onClose={() => {
          event.model.parent.delete();
          event.engine.normalize();
        }}
      />
    );
  }

  renderTab(event: TabRendererEvent<DefaultWorkspacePanelModel>) {
    return (
      <div className="wsapp-tab" data-selected={event.selected || undefined}>
        {event.model.displayName}
      </div>
    );
  }

  renderIcon(event: TrayModelPanelRendererEvent<DefaultWorkspacePanelModel>) {
    const Icon = getIcon(appRegistry[(event.model as AppPanelModel).appId]?.icon);
    const small = event.parent.mode === WorkspaceTrayMode.NORMAL;
    return (
      <div className="wsapp-tray" data-small={small || undefined} data-selected={event.selected || undefined}>
        <Icon size={small ? 15 : 20} aria-hidden="true" />
      </div>
    );
  }
}
