"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cardsData from "./cards.json";
import {
  ATTRIBUTES,
  CARD_RARITIES,
  CHARACTER_BY_ID,
  CHARACTERS,
  GROUP_BY_CHARACTER,
  GROUPS,
  type CardLanguage,
  type CardRarityId,
  type CardRecord,
} from "./data";
import {
  LANGUAGE_TAGS,
  UI_COPY,
  attributeName,
  characterName,
  currentRating,
  displayedCount,
  groupName,
  memberCount,
  ratingFileCopy,
  ratingNotice,
  rarityName,
  resultCount as formatResultCount,
  starLabel,
  viewResults,
} from "./i18n";

const cards = cardsData as CardRecord[];
const STORAGE_KEY = "pjsk-card-ratings-v1";
const PAGE_SIZE = 48;

type Ratings = Record<string, number>;
type RatingSyncStatus = "loading" | "saving" | "synced" | "local-only" | "error";
type RatingNotice = { kind: "exported" | "imported"; count: number } | { kind: "invalid" } | null;
type SortMode = "catalog" | "rating" | "title";

const LANGUAGES: { id: CardLanguage; label: string; shortLabel: string }[] = [
  { id: "zh", label: "中文", shortLabel: "中" },
  { id: "ja", label: "日本語", shortLabel: "日" },
  { id: "en", label: "English", shortLabel: "EN" },
];

function assetUrl(card: CardRecord, thumbnail = false) {
  const [character, ...filenameParts] = card.id.split("/");
  const filename = filenameParts.join("/");
  const localFilename = thumbnail ? filename.replace(/\.png$/i, ".webp") : filename;
  const directory = thumbnail ? "pjsk_thumbs" : "pjsk_cards";
  return `/${directory}/${encodeURIComponent(character)}/${encodeURIComponent(localFilename)}`;
}

function cardTitle(card: CardRecord, language: CardLanguage) {
  return card.titles?.[language] || card.title;
}

function toggleInSet<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function cleanRatings(input: unknown): Ratings {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const clean: Ratings = {};
  for (const [cardId, rating] of Object.entries(input)) {
    if (Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5) {
      clean[cardId] = Number(rating);
    }
  }
  return clean;
}

function CharacterAvatar({
  character,
  className,
}: {
  character: (typeof CHARACTERS)[number];
  className: string;
}) {
  return (
    <span className={className} style={{ "--character-color": character.color } as React.CSSProperties}>
      {character.mark}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/character-icons/${character.id}.png`}
        alt=""
        loading="lazy"
        onError={(event) => event.currentTarget.remove()}
      />
    </span>
  );
}

function WikiIcon({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" />
  );
}

function RarityIcon({ rarityId, alt, className }: { rarityId: CardRarityId; alt: string; className?: string }) {
  const rarity = CARD_RARITIES.find((item) => item.id === rarityId)!;
  const starCount = rarityId === "birthday" ? 0 : Number(rarityId[0]);
  const trained = rarityId.endsWith("-trained");

  if (starCount) {
    return (
      <span
        className={`rarity-icon-strip ${trained ? "is-trained-stars" : "is-untrained-stars"} ${className ?? ""}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        {Array.from({ length: starCount }, (_, index) => (
          trained ? (
            <span className="rarity-star-sprite" key={index}>
              <WikiIcon src={rarity.icon} alt="" />
            </span>
          ) : (
            <WikiIcon key={index} src={rarity.icon} alt="" />
          )
        ))}
      </span>
    );
  }

  return <WikiIcon src={rarity.icon} alt={alt} className={`${className ?? ""} rarity-birthday-icon`.trim()} />;
}

function StarRating({
  value,
  onChange,
  language,
  compact = false,
  dark = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  language: CardLanguage;
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={`star-rating ${compact ? "is-compact" : ""} ${dark ? "is-dark" : ""}`} aria-label={currentRating(language, value)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "is-active" : ""}
          aria-label={starLabel(language, star)}
          title={starLabel(language, star)}
          onClick={(event) => {
            event.stopPropagation();
            onChange(value === star ? 0 : star);
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

type FilterPanelProps = {
  selectedGroups: Set<string>;
  setSelectedGroups: (value: Set<string>) => void;
  selectedCharacters: Set<string>;
  setSelectedCharacters: (value: Set<string>) => void;
  selectedAttributes: Set<string>;
  setSelectedAttributes: (value: Set<string>) => void;
  selectedCardRarities: Set<string>;
  setSelectedCardRarities: (value: Set<string>) => void;
  selectedRatings: Set<number>;
  setSelectedRatings: (value: Set<number>) => void;
  resultCount: number;
  ratingsCount: number;
  ratingSyncStatus: RatingSyncStatus;
  ratingNotice: RatingNotice;
  language: CardLanguage;
  exportRatings: () => void;
  importRatings: (file: File) => void;
  clearFilters: () => void;
  onDone?: () => void;
};

function FilterPanel({
  selectedGroups,
  setSelectedGroups,
  selectedCharacters,
  setSelectedCharacters,
  selectedAttributes,
  setSelectedAttributes,
  selectedCardRarities,
  setSelectedCardRarities,
  selectedRatings,
  setSelectedRatings,
  resultCount,
  ratingsCount,
  ratingSyncStatus,
  ratingNotice: activeRatingNotice,
  language,
  exportRatings,
  importRatings,
  clearFilters,
  onDone,
}: FilterPanelProps) {
  const copy = UI_COPY[language];
  return (
    <div className="filter-panel-inner">
      <div className="filter-panel-heading">
        <div>
          <span className="eyebrow">{copy.multiFilter}</span>
          <h2>{copy.filterCards}</h2>
        </div>
        <div className="filter-heading-actions">
          <button type="button" className="filter-reset-all" onClick={clearFilters}>{copy.resetAll}</button>
          {onDone ? (
            <button type="button" className="icon-button" onClick={onDone} aria-label={copy.closeFilters}>
              ×
            </button>
          ) : null}
        </div>
      </div>

      <section className="filter-section">
        <div className="filter-section-title">
          <h3>{copy.groups}</h3>
          <button type="button" onClick={() => setSelectedGroups(new Set())}>{copy.reset}</button>
        </div>
        <div className="group-filter-list">
          {GROUPS.map((group) => {
            const active = selectedGroups.has(group.id);
            return (
              <button
                key={group.id}
                type="button"
                className={`group-filter-row ${active ? "is-active" : ""}`}
                aria-pressed={active}
                style={{ "--group-color": group.color, "--group-soft": group.softColor } as React.CSSProperties}
                onClick={() => setSelectedGroups(toggleInSet(selectedGroups, group.id))}
              >
                <span className="filter-checkbox">{active ? "✓" : ""}</span>
                <WikiIcon src={group.icon} alt="" className="group-filter-icon" />
                <span className="group-filter-copy">
                  <strong>{groupName(group, language)}</strong>
                  <small>{memberCount(language, group.members.length)}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="filter-section character-filter-section">
        <div className="filter-section-title">
          <h3>{copy.characters}</h3>
          <button type="button" onClick={() => setSelectedCharacters(new Set())}>{copy.reset}</button>
        </div>
        <div className="character-groups">
          {GROUPS.map((group) => (
            <div className="character-group" key={group.id}>
              <div className="character-group-label" style={{ color: group.color }}>{groupName(group, language)}</div>
              <div className="character-pills">
                {group.members.map((character) => {
                  const active = selectedCharacters.has(character.id);
                  return (
                    <button
                      type="button"
                      key={character.id}
                      className={`character-pill ${active ? "is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setSelectedCharacters(toggleInSet(selectedCharacters, character.id))}
                      title={characterName(character, language)}
                    >
                      <span className="filter-checkbox">{active ? "✓" : ""}</span>
                      <CharacterAvatar character={character} className="character-mark" />
                      <span>{characterName(character, language)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="filter-section">
        <div className="filter-section-title">
          <h3>{copy.attributes} <small>ATTRIBUTES</small></h3>
          <button type="button" onClick={() => setSelectedAttributes(new Set())}>{copy.reset}</button>
        </div>
        <div className="attribute-filter-grid">
          {ATTRIBUTES.map((attribute) => {
            const active = selectedAttributes.has(attribute.id);
            return (
              <button
                type="button"
                key={attribute.id}
                className={active ? "is-active" : ""}
                aria-pressed={active}
                style={{ "--attribute-color": attribute.color } as React.CSSProperties}
                onClick={() => setSelectedAttributes(toggleInSet(selectedAttributes, attribute.id))}
              >
                <WikiIcon src={attribute.icon} alt="" />
                <span>{attributeName(attribute.id, language)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="filter-section">
        <div className="filter-section-title">
          <h3>{copy.gameRarity}</h3>
          <button type="button" onClick={() => setSelectedCardRarities(new Set())}>{copy.reset}</button>
        </div>
        <div className="card-rarity-filter-grid">
          {CARD_RARITIES.map((rarity) => {
            const active = selectedCardRarities.has(rarity.id);
            return (
              <button
                type="button"
                key={rarity.id}
                className={active ? "is-active" : ""}
                aria-pressed={active}
                title={rarityName(rarity.id, language)}
                aria-label={rarityName(rarity.id, language)}
                onClick={() => setSelectedCardRarities(toggleInSet(selectedCardRarities, rarity.id))}
              >
                <RarityIcon rarityId={rarity.id} alt="" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="filter-section">
        <div className="filter-section-title">
          <h3>{copy.myRating}</h3>
          <button type="button" onClick={() => setSelectedRatings(new Set())}>{copy.reset}</button>
        </div>
        <div className="rating-filter-grid">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              type="button"
              key={rating}
              className={selectedRatings.has(rating) ? "is-active" : ""}
              aria-pressed={selectedRatings.has(rating)}
              onClick={() => setSelectedRatings(toggleInSet(selectedRatings, rating))}
            >
              <span>★</span>{rating}
            </button>
          ))}
          <button
            type="button"
            className={selectedRatings.has(0) ? "is-active" : ""}
            aria-pressed={selectedRatings.has(0)}
            onClick={() => setSelectedRatings(toggleInSet(selectedRatings, 0))}
          >
            {copy.unrated}
          </button>
        </div>
      </section>

      <section className="filter-section rating-file-section">
        <div className="filter-section-title">
          <h3>{copy.ratingFile}</h3>
          <span className={`rating-file-status is-${ratingSyncStatus}`}>
            {ratingSyncStatus === "loading" ? copy.loading : null}
            {ratingSyncStatus === "saving" ? copy.saving : null}
            {ratingSyncStatus === "synced" ? copy.synced : null}
            {ratingSyncStatus === "local-only" ? copy.localOnly : null}
            {ratingSyncStatus === "error" ? copy.syncFailed : null}
          </span>
        </div>
        <p className="rating-file-copy">
          {ratingFileCopy(language, ratingsCount)}
        </p>
        <div className="rating-file-actions">
          <button type="button" className="rating-file-button" onClick={exportRatings}>{copy.exportJson}</button>
          <label className="rating-file-button">
            {copy.importJson}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) importRatings(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {activeRatingNotice ? (
          <p className="rating-file-message">
            {activeRatingNotice.kind === "invalid"
              ? copy.invalidRatings
              : ratingNotice(language, activeRatingNotice.kind, activeRatingNotice.count)}
          </p>
        ) : null}
      </section>

      <p className="filter-logic-note">{copy.filterLogic}</p>
      <div className="filter-panel-actions">
        {onDone ? (
          <button type="button" className="button button-primary" onClick={onDone}>{viewResults(language, resultCount)}</button>
        ) : (
          <span className="filter-result-chip">{formatResultCount(language, resultCount)}</span>
        )}
      </div>
    </div>
  );
}

export default function CardBrowser() {
  const [ratings, setRatings] = useState<Ratings>({});
  const [ratingsReady, setRatingsReady] = useState(false);
  const [ratingSyncStatus, setRatingSyncStatus] = useState<RatingSyncStatus>("loading");
  const [activeRatingNotice, setActiveRatingNotice] = useState<RatingNotice>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(new Set());
  const [selectedCardRarities, setSelectedCardRarities] = useState<Set<string>>(new Set());
  const [selectedRatings, setSelectedRatings] = useState<Set<number>>(new Set());
  const [language, setLanguage] = useState<CardLanguage>("zh");
  const [sortMode, setSortMode] = useState<SortMode>("catalog");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const copy = UI_COPY[language];

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_TAGS[language];
    document.title = copy.pageTitle;
  }, [copy.pageTitle, language]);

  useEffect(() => {
    let cancelled = false;

    const loadRatings = async () => {
      let localRatings: Ratings = {};
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) localRatings = cleanRatings(JSON.parse(saved));
      } catch {
        // A malformed local value should never make the gallery unusable.
      }

      try {
        const response = await fetch("/api/local-ratings", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!cancelled) {
          setRatings({ ...localRatings, ...cleanRatings(payload.ratings) });
          setRatingSyncStatus("synced");
        }
      } catch {
        if (!cancelled) {
          setRatings(localRatings);
          setRatingSyncStatus("local-only");
        }
      } finally {
        if (!cancelled) setRatingsReady(true);
      }
    };

    loadRatings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ratingsReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRatingSyncStatus("saving");
      try {
        const response = await fetch("/api/local-ratings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 1, ratings }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setRatingSyncStatus("synced");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRatingSyncStatus("local-only");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ratings, ratingsReady]);

  useEffect(() => {
    document.body.classList.toggle("has-overlay", filtersOpen || Boolean(selectedCardId));
    return () => document.body.classList.remove("has-overlay");
  }, [filtersOpen, selectedCardId]);

  const setRating = useCallback((cardId: string, rating: number) => {
    setRatings((current) => {
      const next = { ...current };
      if (rating === 0) delete next[cardId];
      else next[cardId] = rating;
      return next;
    });
  }, []);

  const exportRatings = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      ratings,
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pjsk-ratings.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setActiveRatingNotice({ kind: "exported", count: Object.keys(ratings).length });
  }, [ratings]);

  const importRatings = useCallback(async (file: File) => {
    try {
      const payload = JSON.parse(await file.text());
      const imported = cleanRatings(payload?.ratings ?? payload);
      setRatings((current) => ({ ...current, ...imported }));
      setActiveRatingNotice({ kind: "imported", count: Object.keys(imported).length });
    } catch {
      setActiveRatingNotice({ kind: "invalid" });
      setRatingSyncStatus("error");
    }
  }, []);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = cards.filter((card) => {
      const character = CHARACTER_BY_ID[card.character];
      const group = GROUP_BY_CHARACTER[card.character];
      const rating = ratings[card.id] ?? 0;
      if (selectedGroups.size && !selectedGroups.has(group.id)) return false;
      if (selectedCharacters.size && !selectedCharacters.has(card.character)) return false;
      if (selectedAttributes.size && !selectedAttributes.has(card.attribute)) return false;
      if (selectedCardRarities.size && !selectedCardRarities.has(card.rarity)) return false;
      if (selectedRatings.size && !selectedRatings.has(rating)) return false;
      if (
        normalizedQuery &&
        !`${Object.values(card.titles).join(" ")} ${card.filename} ${LANGUAGES.map(({ id }) => characterName(character, id)).join(" ")} ${LANGUAGES.map(({ id }) => groupName(group, id)).join(" ")}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      ) return false;
      return true;
    });

    if (sortMode === "rating") {
      filtered.sort((a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0) || a.id.localeCompare(b.id));
    } else if (sortMode === "title") {
      filtered.sort((a, b) => cardTitle(a, language).localeCompare(cardTitle(b, language), language === "ja" ? "ja" : language === "zh" ? "zh-CN" : "en"));
    }
    return filtered;
  }, [language, query, ratings, selectedAttributes, selectedCardRarities, selectedCharacters, selectedGroups, selectedRatings, sortMode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisibleCount(PAGE_SIZE));
    return () => window.cancelAnimationFrame(frame);
  }, [language, query, selectedAttributes, selectedCardRarities, selectedCharacters, selectedGroups, selectedRatings, sortMode]);

  const selectedIndex = selectedCardId ? filteredCards.findIndex((card) => card.id === selectedCardId) : -1;
  const selectedCard = selectedIndex >= 0 ? filteredCards[selectedIndex] : null;
  const selectedCardTitle = selectedCard ? cardTitle(selectedCard, language) : "";

  const moveSelected = useCallback((direction: number) => {
    setSelectedCardId((currentCardId) => {
      if (!currentCardId || !filteredCards.length) return currentCardId;
      const currentIndex = filteredCards.findIndex((card) => card.id === currentCardId);
      if (currentIndex < 0) return currentCardId;
      const nextIndex = (currentIndex + direction + filteredCards.length) % filteredCards.length;
      return filteredCards[nextIndex].id;
    });
  }, [filteredCards]);

  const handleViewerKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.repeat || !selectedCard) return;

    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      setRating(selectedCard.id, Number(event.key));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSelectedCardId(null);
      return;
    }

    if (event.key === "Enter" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      moveSelected(1);
      return;
    }

    if (event.key === "Backspace" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      moveSelected(-1);
    }
  };

  useEffect(() => {
    if (selectedCardId) viewerRef.current?.focus({ preventScroll: true });
  }, [selectedCardId]);

  const clearFilters = () => {
    setSelectedGroups(new Set());
    setSelectedCharacters(new Set());
    setSelectedAttributes(new Set());
    setSelectedCardRarities(new Set());
    setSelectedRatings(new Set());
    setQuery("");
  };

  const activeFilterCount = selectedGroups.size + selectedCharacters.size + selectedAttributes.size + selectedCardRarities.size + selectedRatings.size;
  const ratedValues = Object.values(ratings);
  const averageRating = ratedValues.length
    ? (ratedValues.reduce((sum, rating) => sum + rating, 0) / ratedValues.length).toFixed(1)
    : "—";

  return (
    <main onKeyDown={handleViewerKeyDown}>
      <header className="site-header">
        <div className="brand-block">
          <span className="brand-orbit"><i /><i /><i /></span>
          <div>
            <strong>SEKAI ARCHIVE</strong>
            <small>{copy.cardViewer}</small>
          </div>
        </div>
        <div className="header-status">
          <span><b>{cards.length}</b> {copy.cardsShort}</span>
          <span><b>{ratedValues.length}</b> {copy.ratedShort}</span>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-kicker">{copy.heroKicker}</span>
          <h1>PJSK<br /><em>{copy.heroTitle}</em></h1>
          <p>{copy.heroDescription}</p>
        </div>
        <div className="hero-stats" aria-label={copy.collectionStats}>
          <div><span>{copy.completeCollection}</span><strong>{cards.length}</strong><small>{copy.cardsShort}</small></div>
          <div><span>{copy.myRating}</span><strong>{ratedValues.length}</strong><small>{copy.ratedShort}</small></div>
          <div><span>{copy.averageRating}</span><strong>{averageRating}</strong><small>{copy.averageShort}</small></div>
        </div>
        <div className="hero-decoration" aria-hidden="true"><span>25</span><i>♪</i></div>
      </section>

      <section className="gallery-shell">
        <aside className="desktop-filter-panel">
          <FilterPanel
            selectedGroups={selectedGroups}
            setSelectedGroups={setSelectedGroups}
            selectedCharacters={selectedCharacters}
            setSelectedCharacters={setSelectedCharacters}
            selectedAttributes={selectedAttributes}
            setSelectedAttributes={setSelectedAttributes}
            selectedCardRarities={selectedCardRarities}
            setSelectedCardRarities={setSelectedCardRarities}
            selectedRatings={selectedRatings}
            setSelectedRatings={setSelectedRatings}
            resultCount={filteredCards.length}
            ratingsCount={ratedValues.length}
            ratingSyncStatus={ratingSyncStatus}
            ratingNotice={activeRatingNotice}
            language={language}
            exportRatings={exportRatings}
            importRatings={importRatings}
            clearFilters={clearFilters}
          />
        </aside>

        <div className="gallery-main">
          <div className="gallery-toolbar">
            <div className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchCards}
              />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label={copy.clearSearch}>×</button> : null}
            </div>
            <button type="button" className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
              {copy.filters} {activeFilterCount ? <b>{activeFilterCount}</b> : null}
            </button>
            <div className="language-switch" aria-label={copy.interfaceLanguage}>
              {LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={language === option.id ? "is-active" : ""}
                  onClick={() => setLanguage(option.id)}
                  title={option.label}
                >
                  <span>{option.shortLabel}</span><b>{option.label}</b>
                </button>
              ))}
            </div>
            <label className="sort-select">
              <span>{copy.sort}</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="catalog">{copy.catalogOrder}</option>
                <option value="rating">{copy.ratingOrder}</option>
                <option value="title">{copy.titleOrder}</option>
              </select>
            </label>
          </div>

          <div className="result-summary">
            <div><strong>{filteredCards.length}</strong><span>{copy.matchingLabel}</span></div>
            {activeFilterCount || query ? <button type="button" onClick={clearFilters}>{copy.clearFilters}</button> : <span>{copy.clickOriginal}</span>}
          </div>

          {filteredCards.length ? (
            <>
              <div className="card-grid">
                {filteredCards.slice(0, visibleCount).map((card) => {
                  const character = CHARACTER_BY_ID[card.character];
                  const group = GROUP_BY_CHARACTER[card.character];
                  const rating = ratings[card.id] ?? 0;
                  const displayTitle = cardTitle(card, language);
                  const displayCharacterName = characterName(character, language);
                  return (
                    <article
                      className="card-tile"
                      key={card.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(event) => {
                        if (selectedCardId) return;
                        if (event.key === "Enter" || event.key === " ") setSelectedCardId(card.id);
                      }}
                    >
                      <div className="card-image-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={assetUrl(card, true)}
                          alt={`${displayCharacterName} — ${displayTitle}`}
                          loading="lazy"
                          onError={(event) => {
                            const fallback = assetUrl(card);
                            if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
                          }}
                        />
                        <span className="card-open-hint">{copy.openOriginal}</span>
                      </div>
                      <div className="card-meta">
                        <div className="card-meta-heading">
                          <div className="card-character-row">
                            <CharacterAvatar character={character} className="mini-character-mark" />
                            <span><strong>{displayCharacterName}</strong><small style={{ color: group.color }}>{groupName(group, language)}</small></span>
                          </div>
                          <span className="card-meta-badges">
                            <WikiIcon src={ATTRIBUTES.find((item) => item.id === card.attribute)!.icon} alt={attributeName(card.attribute, language)} />
                            <RarityIcon rarityId={card.rarity} alt={rarityName(card.rarity, language)} />
                          </span>
                        </div>
                        <h3 title={displayTitle}>{displayTitle}</h3>
                        <StarRating compact language={language} value={rating} onChange={(next) => setRating(card.id, next)} />
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibleCount < filteredCards.length ? (
                <div className="load-more-wrap">
                  <button type="button" className="button button-primary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                    {copy.loadMore} <span>{Math.min(PAGE_SIZE, filteredCards.length - visibleCount)}</span>
                  </button>
                  <small>{displayedCount(language, Math.min(visibleCount, filteredCards.length), filteredCards.length)}</small>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <span>☆</span><h2>{copy.noCards}</h2><p>{copy.noCardsDescription}</p>
              <button type="button" className="button button-primary" onClick={clearFilters}>{copy.resetFilters}</button>
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>SEKAI ARCHIVE</span>
        <p>{copy.footer}</p>
      </footer>

      {filtersOpen ? (
        <div className="filter-drawer-backdrop" onMouseDown={() => setFiltersOpen(false)}>
          <div className="filter-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <FilterPanel
              selectedGroups={selectedGroups}
              setSelectedGroups={setSelectedGroups}
              selectedCharacters={selectedCharacters}
              setSelectedCharacters={setSelectedCharacters}
              selectedAttributes={selectedAttributes}
              setSelectedAttributes={setSelectedAttributes}
              selectedCardRarities={selectedCardRarities}
              setSelectedCardRarities={setSelectedCardRarities}
              selectedRatings={selectedRatings}
              setSelectedRatings={setSelectedRatings}
              resultCount={filteredCards.length}
              ratingsCount={ratedValues.length}
              ratingSyncStatus={ratingSyncStatus}
              ratingNotice={activeRatingNotice}
              language={language}
              exportRatings={exportRatings}
              importRatings={importRatings}
              clearFilters={clearFilters}
              onDone={() => setFiltersOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {selectedCard ? (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedCardTitle} — ${copy.openOriginal}`}
          ref={viewerRef}
          tabIndex={-1}
        >
          <button type="button" className="modal-close" onClick={() => setSelectedCardId(null)} aria-label={copy.closeOriginal}>×</button>
          <button type="button" className="modal-nav modal-prev" onClick={() => moveSelected(-1)} aria-label={copy.previousCard} />
          <div className="modal-image-stage" onClick={() => setSelectedCardId(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(selectedCard)}
              alt={`${characterName(CHARACTER_BY_ID[selectedCard.character], language)} — ${selectedCardTitle}`}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
          <button type="button" className="modal-nav modal-next" onClick={() => moveSelected(1)} aria-label={copy.nextCard} />
          <div className="modal-info">
            <div className="modal-title-block">
              <span style={{ color: GROUP_BY_CHARACTER[selectedCard.character].color }}>{groupName(GROUP_BY_CHARACTER[selectedCard.character], language)}</span>
              <h2>{selectedCardTitle}</h2>
              <p>
                {characterName(CHARACTER_BY_ID[selectedCard.character], language)} · {attributeName(selectedCard.attribute, language)} · {rarityName(selectedCard.rarity, language)} · {selectedIndex + 1} / {filteredCards.length}
              </p>
            </div>
            <div className="modal-rating-block">
              <small>{copy.myRating}</small>
              <StarRating dark language={language} value={ratings[selectedCard.id] ?? 0} onChange={(next) => setRating(selectedCard.id, next)} />
              <p className="modal-keyboard-hint">{copy.keyboardHint}</p>
            </div>
            <a href={assetUrl(selectedCard)} target="_blank" rel="noreferrer" className="original-link">{copy.openNewWindow}</a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
