import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  Bot,
  Boxes,
  BriefcaseBusiness,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  Gamepad2,
  Globe,
  Grid2X2,
  Heart,
  Home,
  Image,
  MonitorDown,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
  Wrench,
} from "lucide-react";
import type { AppId, AppProps } from "../../types";
import { launchApp } from "../../lib/launch";
import { AppIcon } from "../../shell/AppIcon";
import { Button, EmptyState } from "../../ui";
import { REQUIRED_APP_IDS, useSystemStore } from "../../stores/useSystemStore";
import { useWindowStore } from "../../stores/useWindowStore";
import { notify } from "../../stores/useNotificationStore";
import {
  getStoreListing,
  getStoreAction,
  isStoreListingInstalled,
  openStoreExternalLink,
  searchStoreCatalog,
  sortStoreCatalog,
  STORE_CATEGORIES,
  type StoreCategory,
  type StoreListing,
} from "./catalog";
import "./OrbitStore.css";

type StorePage = "Home" | "Discover" | "Games" | "Applications" | "AI Tools" | "Categories" | "Installed" | "Updates";
type StoreSort = "recommended" | "name" | "category";

const NAV_ITEMS: { label: StorePage; icon: typeof Home }[] = [
  { label: "Home", icon: Home },
  { label: "Discover", icon: Compass },
  { label: "Games", icon: Gamepad2 },
  { label: "Applications", icon: Boxes },
  { label: "AI Tools", icon: Bot },
  { label: "Categories", icon: Grid2X2 },
];

const CATEGORY_ICONS: Record<StoreCategory, typeof Home> = {
  Games: Gamepad2,
  Productivity: BriefcaseBusiness,
  Creativity: WandSparkles,
  Utilities: Wrench,
  Education: Sparkles,
  AI: Bot,
};

const CATEGORY_ART: Record<StoreCategory, string> = {
  Games: "games",
  Productivity: "work",
  Creativity: "creative",
  Utilities: "utility",
  Education: "learn",
  AI: "ai",
};

const FEATURED_ID: AppId = "snake";
const FEATURED_GAMES = ["hexgl", "orbit-blast", "dino-run", "2048", "godot"];
const RECOMMENDED = ["excalidraw", "notes", "paint", "workspaces"];
const NEW_AND_NOTEWORTHY = ["scratch", "godot", "snake"];
const POPULAR_APPS = ["blender", "gimp", "file-explorer", "text-editor"];

function listing(id: string): StoreListing | undefined {
  return getStoreListing(id);
}

function AppCard({ item, installed, onOpen, onAction, onUninstall }: {
  item: StoreListing;
  installed: boolean;
  onOpen: (id: string) => void;
  onAction: (item: StoreListing) => void;
  onUninstall: (item: StoreListing) => void;
}) {
  const { category } = item;
  const action = getStoreAction(item, installed);
  const actionLabel = action === "open" ? "Open"
    : action === "visit-website" ? "Visit Website"
      : action === "download" ? "Download"
        : "Add to library";
  return (
    <article className="orbit-store__card">
      <button type="button" className="orbit-store__card-main" onClick={() => onOpen(item.id)} aria-label={`View details for ${item.name}`}>
        <span className={`orbit-store__card-art orbit-store__card-art--${CATEGORY_ART[category]}`}>
          <AppIcon icon={item.icon} appId={item.app?.id} size={48} />
          <span className="orbit-store__art-orbit" aria-hidden="true" />
        </span>
        <span className="orbit-store__card-copy">
          <span className="orbit-store__card-category">{item.kind === "web" ? "Web app" : item.kind === "desktop" ? "Desktop app" : category}</span>
          <strong>{item.name}</strong>
          <span className="orbit-store__card-description">{item.description}</span>
        </span>
      </button>
      <div className="orbit-store__card-footer">
        <span className="orbit-store__included">
          {installed ? <PackageCheck size={13} /> : item.kind === "web" ? <Globe size={13} /> : item.kind === "desktop" ? <MonitorDown size={13} /> : null}
          {installed ? "Installed" : item.kind === "web" ? "Web app" : item.kind === "desktop" ? "Desktop download" : "Bundled"}
        </span>
        <span className="orbit-store__card-actions">
          <Button size="sm" onClick={() => onAction(item)}>{actionLabel}</Button>
          {installed && item.app && !REQUIRED_APP_IDS.includes(item.app.id) && <Button variant="quiet" size="sm" onClick={() => onUninstall(item)}>Remove</Button>}
        </span>
      </div>
    </article>
  );
}

function Shelf({ title, note, items, onOpen, onSeeAll, isInstalled, onAction, onUninstall }: {
  title: string;
  note?: string;
  items: StoreListing[];
  onOpen: (id: string) => void;
  onSeeAll?: () => void;
  isInstalled: (item: StoreListing) => boolean;
  onAction: (item: StoreListing) => void;
  onUninstall: (item: StoreListing) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateScrollControls = () => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 2);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  };
  const scrollShelf = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    track.scrollBy({ left: direction * 280, behavior });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollControls();
    const observer = new ResizeObserver(updateScrollControls);
    observer.observe(track);
    return () => observer.disconnect();
  }, [items.length]);

  if (!items.length) return null;
  return (
    <section className="orbit-store__shelf">
      <div className="orbit-store__section-heading">
        <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
        <div className="orbit-store__section-actions">
          {onSeeAll && <button type="button" className="orbit-store__text-action" onClick={onSeeAll}>See all <ChevronRight size={15} /></button>}
          <Button iconOnly size="sm" aria-label={`Scroll ${title} left`} disabled={!canScrollLeft} onClick={() => scrollShelf(-1)}><ArrowLeft size={15} /></Button>
          <Button iconOnly size="sm" aria-label={`Scroll ${title} right`} disabled={!canScrollRight} onClick={() => scrollShelf(1)}><ArrowRight size={15} /></Button>
        </div>
      </div>
      <div className="orbit-store__shelf-track" ref={trackRef} onScroll={updateScrollControls}>
        {items.map((item) => <AppCard key={item.id} item={item} installed={isInstalled(item)} onOpen={onOpen} onAction={onAction} onUninstall={onUninstall} />)}
      </div>
    </section>
  );
}

function CatalogGrid({ items, onOpen, onSearchReset, emptyTitle, emptyMessage, isInstalled, onAction, onUninstall }: {
  items: StoreListing[];
  onOpen: (id: string) => void;
  onSearchReset?: () => void;
  isInstalled: (item: StoreListing) => boolean;
  onAction: (item: StoreListing) => void;
  onUninstall: (item: StoreListing) => void;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (!items.length) {
    return (
      <EmptyState title={emptyTitle ?? "No apps found"} action={onSearchReset && <Button size="sm" onClick={onSearchReset}>Clear search</Button>}>
        {emptyMessage ?? "Try another search or category, or clear the filters to see more official listings."}
      </EmptyState>
    );
  }
  return <div className="orbit-store__grid">{items.map((item) => <AppCard key={item.id} item={item} installed={isInstalled(item)} onOpen={onOpen} onAction={onAction} onUninstall={onUninstall} />)}</div>;
}

export function OrbitStore(_props: AppProps) {
  const [page, setPage] = useState<StorePage>("Home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoreCategory | "All">("All");
  const [sort, setSort] = useState<StoreSort>("recommended");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const uninstalledApps = useSystemStore((state) => state.uninstalledApps);
  const setAppInstalled = useSystemStore((state) => state.setAppInstalled);

  const allResults = useMemo(() => {
    let results = searchStoreCatalog(query);
    if (page === "Games") results = results.filter(({ category: appCategory }) => appCategory === "Games");
    if (page === "Applications") results = results.filter(({ category: appCategory }) => appCategory !== "Games" && appCategory !== "AI" && appCategory !== "Education");
    if (page === "AI Tools") results = results.filter(({ category: appCategory }) => appCategory === "AI");
    if (category !== "All") results = results.filter((item) => item.category === category);
    return sortStoreCatalog(results, sort);
  }, [category, page, query, sort]);

  const openDetails = (id: string) => {
    setSelectedApp(id);
  };
  const installApp = (id: AppId) => {
    setAppInstalled(id, true);
    notify({ title: "Added to your library", body: `${listing(id)?.name ?? "App"} is now available in the OrbitOS launcher. It was already bundled with this build; nothing was downloaded.`, kind: "success", appId: "orbit-store" });
  };
  const uninstallApp = (item: StoreListing) => {
    const app = item.app;
    if (!app) return;
    if (useWindowStore.getState().windows.some((win) => win.appId === app.id)) {
      notify({ title: "App is still open", body: `Close ${app.name} before removing it from your library.`, kind: "warning", appId: "orbit-store" });
      return;
    }
    if (!window.confirm(`Remove ${app.name} from your OrbitOS library? Its code remains bundled with this build; this only removes it from your launcher and shortcuts.`)) return;
    setAppInstalled(app.id, false);
    notify({ title: "Removed from your library", body: `${app.name} is no longer available from OrbitOS launchers.`, kind: "success", appId: "orbit-store" });
  };
  const isInstalled = (item: StoreListing) => isStoreListingInstalled(item, uninstalledApps);
  const performPrimaryAction = (item: StoreListing) => {
    const action = getStoreAction(item, isInstalled(item));
    if (action === "open" && item.app) {
      launchApp(item.app.id);
      return;
    }
    if (action === "add-to-library" && item.app) {
      installApp(item.app.id);
      return;
    }
    if (!openStoreExternalLink(item)) {
      notify({ title: "Official link unavailable", body: "Orbit Store could not open this publisher link. Check your browser's popup settings.", kind: "error", appId: "orbit-store" });
      return;
    }
    notify({
      title: action === "download" ? "Official download page opened" : "Official website opened",
      body: action === "download"
        ? `${item.name} opens its publisher's download page in a new browser tab. OrbitOS does not download or install native software.`
        : `${item.name} opens in a new browser tab. OrbitOS does not proxy the site or send it data in the background.`,
      kind: "info",
      appId: "orbit-store",
    });
  };
  const appCardProps = { isInstalled, onAction: performPrimaryAction, onUninstall: uninstallApp };
  const navigate = (nextPage: StorePage) => {
    setPage(nextPage);
    setSelectedApp(null);
    if (nextPage !== "Discover") {
      setQuery("");
      setCategory("All");
    }
  };

  const detail = selectedApp ? listing(selectedApp) : undefined;
  const visibleItems = page === "Installed"
    ? allResults.filter((item) => item.kind === "bundled" && isInstalled(item))
    : allResults;

  const viewTitle = page === "Games" ? "Games" : page === "Applications" ? "Applications" : page === "AI Tools" ? "AI tools" : "Discover";
  const availableCategories = page === "Games"
    ? ["Games"] as const
    : page === "Applications"
      ? ["Productivity", "Creativity", "Utilities"] as const
      : STORE_CATEGORIES;

  return (
    <div className="orbit-store-frame">
    <main className="orbit-store">
      <aside className="orbit-store__sidebar" aria-label="Store navigation">
        <div className="orbit-store__brand">
          <span className="orbit-store__brand-mark"><Grid2X2 size={19} /></span>
          <span><strong>Orbit Store</strong><small>Find your next favorite</small></span>
        </div>
        <nav className="orbit-store__nav" aria-label="Main">
          <span className="orbit-store__nav-label">EXPLORE</span>
          {NAV_ITEMS.map(({ label, icon: Icon }) => (
            <button type="button" key={label} aria-label={label} title={label} className={`orbit-store__nav-item ${page === label && !selectedApp ? "is-selected" : ""}`} aria-current={page === label && !selectedApp ? "page" : undefined} onClick={() => navigate(label)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
          <span className="orbit-store__nav-label orbit-store__nav-label--spaced">LIBRARY</span>
          <button type="button" aria-label="Installed" title="Installed" className={`orbit-store__nav-item ${page === "Installed" && !selectedApp ? "is-selected" : ""}`} aria-current={page === "Installed" && !selectedApp ? "page" : undefined} onClick={() => navigate("Installed")}><PackageCheck size={17} /><span>Installed</span></button>
          <button type="button" aria-label="Updates" title="Updates" className={`orbit-store__nav-item ${page === "Updates" && !selectedApp ? "is-selected" : ""}`} aria-current={page === "Updates" && !selectedApp ? "page" : undefined} onClick={() => navigate("Updates")}><RefreshCw size={17} /><span>Updates</span></button>
        </nav>
        <div className="orbit-store__sidebar-note"><span className="orbit-store__local-dot" />Curated official links<small>Downloads always open publisher pages</small></div>
      </aside>

      <div className="orbit-store__main">
        <header className="orbit-store__toolbar">
          {selectedApp ? (
            <Button variant="quiet" onClick={() => setSelectedApp(null)}><ArrowLeft size={15} /> Back to {page === "Home" ? "Home" : page}</Button>
          ) : (
            <div className="orbit-store__breadcrumbs"><span>Orbit Store</span><ChevronRight size={14} /><strong>{page}</strong></div>
          )}
          <label className="orbit-store__search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery) {
                setPage("Discover");
                setCategory("All");
                setSelectedApp(null);
              }
            }} placeholder="Search apps and games" aria-label="Search store apps" />
            {query && <button type="button" aria-label="Clear search query" onClick={() => setQuery("")}>×</button>}
          </label>
          <span className="orbit-store__preview-pill"><span />STATIC CATALOG</span>
        </header>

        <div className="orbit-store__content">
          {detail ? (
            <section className="orbit-store__detail">
              <div className={`orbit-store__detail-hero orbit-store__card-art--${CATEGORY_ART[detail.category]}`}>
                <div className="orbit-store__detail-hero-copy">
                  <span className="orbit-store__eyebrow">{detail.category} · {detail.kind === "bundled" ? "Included with OrbitOS" : detail.kind === "web" ? "Web app" : "Desktop software"}</span>
                  <h1>{detail.name}</h1>
                  <p>{detail.description}</p>
                  <span className="orbit-store__detail-actions">
                    <Button variant="primary" onClick={() => performPrimaryAction(detail)}>
                      {getStoreAction(detail, isInstalled(detail)) === "open" ? "Open"
                        : getStoreAction(detail, isInstalled(detail)) === "visit-website" ? "Visit Website"
                          : getStoreAction(detail, isInstalled(detail)) === "download" ? "Download"
                            : "Add to library"}
                      {detail.kind === "web" ? <ExternalLink size={15} /> : detail.kind === "desktop" ? <Download size={15} /> : <ArrowRight size={15} />}
                    </Button>
                    {isInstalled(detail) && detail.app && !REQUIRED_APP_IDS.includes(detail.app.id) && <Button variant="quiet" onClick={() => uninstallApp(detail)}>Remove</Button>}
                  </span>
                </div>
                <div className="orbit-store__detail-icon"><AppIcon icon={detail.icon} appId={detail.app?.id} size={92} /></div>
              </div>
              <div className="orbit-store__detail-meta">
                <div><span>Publisher</span><strong>{detail.publisher}</strong></div>
                <div><span>License</span><strong>{detail.license}</strong></div>
                <div><span>Type</span><strong>{detail.kind === "web" ? "Web app" : detail.kind === "desktop" ? "Native desktop app" : "Bundled OrbitOS app"}</strong></div>
                <div><span>Install status</span><strong>{detail.kind === "bundled" ? isInstalled(detail) ? "Installed in OrbitOS" : "Not in your library" : detail.kind === "web" ? "Opens on publisher website" : "Not installed by OrbitOS"}</strong></div>
              </div>
              <div className="orbit-store__detail-columns">
                <section className="orbit-store__detail-panel">
                  <h2>About this app</h2><p>{detail.description}</p>
                  <h3>What it offers</h3>
                  <ul>{detail.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  <p className="orbit-store__disclaimer">
                    {detail.kind === "bundled"
                      ? "Adding or removing a bundled app only changes its OrbitOS library visibility; its code stays in this build."
                      : detail.kind === "web"
                        ? "This web app opens directly on its publisher's site in a new tab. OrbitOS does not embed, install, or send data to it in the background."
                        : "Download opens the publisher's official download page in a new tab. Choose a compatible build there; OrbitOS does not download or run installers."}
                  </p>
                </section>
                <section className="orbit-store__detail-panel">
                  <div className="orbit-store__section-heading"><div><h2>Official links</h2><p>Publisher-controlled destinations</p></div><Image size={17} /></div>
                  <div className={`orbit-store__preview-art orbit-store__card-art--${CATEGORY_ART[detail.category]}`}><AppIcon icon={detail.icon} appId={detail.app?.id} size={72} /><span>{detail.name}</span></div>
                  {detail.websiteUrl && <a className="orbit-store__official-link" href={detail.websiteUrl} target="_blank" rel="noopener noreferrer"><Globe size={14} /> Project website <ExternalLink size={13} /></a>}
                  {detail.downloadUrl && <a className="orbit-store__official-link" href={detail.downloadUrl} target="_blank" rel="noopener noreferrer"><Download size={14} /> Official download page <ExternalLink size={13} /></a>}
                  {detail.sourceUrl && <a className="orbit-store__official-link" href={detail.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Source repository</a>}
                  {detail.licenseUrl && <a className="orbit-store__official-link" href={detail.licenseUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> License details</a>}
                </section>
              </div>
            </section>
          ) : page === "Home" && !query ? (
            <div className="orbit-store__home">
              <section className="orbit-store__hero">
                <div className="orbit-store__hero-copy">
                  <span className="orbit-store__eyebrow"><Sparkles size={13} /> FEATURED IN ORBITOS</span>
                  <h1>Make room<br />for a little play.</h1>
                  <p>Discover OrbitOS apps and hand-picked projects from their official publishers.</p>
                  <Button variant="primary" onClick={() => openDetails(FEATURED_ID)}>View details <ArrowRight size={15} /></Button>
                </div>
                {listing(FEATURED_ID) && <button type="button" className="orbit-store__hero-art" onClick={() => openDetails(FEATURED_ID)} aria-label="View Snake details">
                  <span className="orbit-store__hero-spark orbit-store__hero-spark--one">✦</span>
                  <span className="orbit-store__hero-spark orbit-store__hero-spark--two">✧</span>
                  <AppIcon icon={listing(FEATURED_ID)?.icon ?? "Gamepad2"} appId={FEATURED_ID} size={96} />
                  <span className="orbit-store__hero-art-caption">SNAKE · ORBIT ARCADE</span>
                </button>}
              </section>
              <div className="orbit-store__curation-note"><Heart size={14} /> External listings link to publisher-controlled websites; OrbitOS never installs downloads.</div>
              <Shelf {...appCardProps} title="Featured Games" note="Games bundled with OrbitOS and a browser-playable racer" items={FEATURED_GAMES.map(listing).filter((item): item is StoreListing => Boolean(item))} onOpen={openDetails} onSeeAll={() => navigate("Games")} />
              <Shelf {...appCardProps} title="Recommended for You" note="Creative tools from OrbitOS and the web" items={RECOMMENDED.map(listing).filter((item): item is StoreListing => Boolean(item))} onOpen={openDetails} onSeeAll={() => navigate("Applications")} />
              <Shelf {...appCardProps} title="Popular Applications" note="Official desktop download pages" items={POPULAR_APPS.map(listing).filter((item): item is StoreListing => Boolean(item))} onOpen={openDetails} onSeeAll={() => navigate("Applications")} />
              <Shelf {...appCardProps} title="New & Noteworthy" note="Explore web apps and game-making tools" items={NEW_AND_NOTEWORTHY.map(listing).filter((item): item is StoreListing => Boolean(item))} onOpen={openDetails} />
              <section className="orbit-store__category-block">
                <div className="orbit-store__section-heading"><div><h2>Browse categories</h2><p>Find the right tool for your next idea.</p></div><button type="button" className="orbit-store__text-action" onClick={() => navigate("Categories")}>All categories <ChevronRight size={15} /></button></div>
                <CategoryTiles onChoose={(nextCategory) => { setCategory(nextCategory); setPage("Categories"); }} />
              </section>
            </div>
          ) : page === "Categories" && !query ? (
            <section className="orbit-store__listing-page">
              <div className="orbit-store__page-heading"><span className="orbit-store__eyebrow">EXPLORE BY INTEREST</span><h1>Categories</h1><p>Browse OrbitOS apps and curated publisher listings by category.</p></div>
              <CategoryTiles onChoose={(nextCategory) => { setCategory(nextCategory); setPage("Discover"); }} />
              <div className="orbit-store__section-heading orbit-store__category-results-heading"><div><h2>{category === "All" ? "All apps" : category}</h2><p>Bundled apps and verified official links</p></div></div>
              <CatalogGrid {...appCardProps} items={category === "All" ? searchStoreCatalog("") : searchStoreCatalog("", category)} onOpen={openDetails} />
            </section>
          ) : page === "Updates" && !query ? (
            <section className="orbit-store__empty-page">
              <span className="orbit-store__empty-icon"><RefreshCw size={24} /></span><span className="orbit-store__eyebrow">UPDATES</span><h1>Keep everything current.</h1>
              <p>Orbit Store does not run an update service. Bundled OrbitOS apps update with OrbitOS; native apps are updated by their publishers.</p>
              <Button onClick={() => navigate("Discover")}>Browse apps <ArrowRight size={15} /></Button>
            </section>
          ) : page === "Installed" && !query ? (
            <section className="orbit-store__listing-page">
              <div className="orbit-store__page-heading"><span className="orbit-store__eyebrow">YOUR LIBRARY</span><h1>Installed apps</h1><p>Bundled OrbitOS apps available in your library. External web apps and native downloads are not marked installed here.</p></div>
              <CatalogGrid {...appCardProps} items={visibleItems} onOpen={openDetails} emptyTitle="Your library is empty" emptyMessage="Browse the bundled catalog and add apps back to your library." />
            </section>
          ) : page === "Home" && query ? (
            <CatalogGrid {...appCardProps} items={visibleItems} onOpen={openDetails} onSearchReset={() => setQuery("")} />
          ) : (
            <section className="orbit-store__listing-page">
            <div className="orbit-store__page-heading"><span className="orbit-store__eyebrow">{page === "AI Tools" ? "LOCAL AI" : "CURATED CATALOG"}</span><h1>{query ? "Search results" : viewTitle}</h1><p>{page === "AI Tools" ? "Local assistant tools plus third-party AI listings when available." : category !== "All" ? `Showing ${category} listings from OrbitOS and official publishers.` : "Browse OrbitOS apps and curated web and desktop software."}</p></div>
              {page !== "AI Tools" && <div className="orbit-store__filters">
                <div className="orbit-store__category-filters" role="group" aria-label="Filter by category">
                  <button type="button" aria-pressed={category === "All"} onClick={() => setCategory("All")}>All</button>
                  {availableCategories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
                </div>
                <label className="orbit-store__sort"><ArrowDownAZ size={15} /><span className="orbit-store__sr-only">Sort apps</span><select value={sort} onChange={(event) => setSort(event.target.value as StoreSort)}><option value="recommended">Curated order</option><option value="name">Name A–Z</option><option value="category">Category</option></select></label>
              </div>}
              <CatalogGrid {...appCardProps} items={visibleItems} onOpen={openDetails} onSearchReset={() => { setQuery(""); setCategory("All"); }} emptyTitle={page === "AI Tools" ? "No AI listings yet" : undefined} emptyMessage={page === "AI Tools" ? "No AI apps are currently listed in this local catalog." : undefined} />
            </section>
          )}
          <footer className="orbit-store__footer">Static catalog · third-party actions open official publisher pages · no silent downloads or installs</footer>
        </div>
      </div>
    </main>
    </div>
  );
}

function CategoryTiles({ onChoose }: { onChoose: (category: StoreCategory) => void }) {
  return (
    <div className="orbit-store__category-grid">
      {STORE_CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        const count = searchStoreCatalog("", category).length;
        return <button type="button" className={`orbit-store__category-tile orbit-store__category-tile--${CATEGORY_ART[category]}`} key={category} onClick={() => onChoose(category)}>
          <Icon size={20} /><strong>{category}</strong><span>{count ? `${count} ${count === 1 ? "listing" : "listings"}` : "No listings yet"}</span><ChevronRight size={16} />
        </button>;
      })}
    </div>
  );
}
