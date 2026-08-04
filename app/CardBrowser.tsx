"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import cardsData from "./cards.json";
import {
  CHARACTER_BY_ID,
  CHARACTERS,
  GROUP_BY_CHARACTER,
  GROUPS,
  type CardRecord,
} from "./data";

const cards = cardsData as CardRecord[];
const STORAGE_KEY = "pjsk-card-ratings-v1";
const PAGE_SIZE = 48;

type Ratings = Record<string, number>;
type ViewMode = "all" | "normal" | "trained";
type SortMode = "catalog" | "rating" | "title";

function thumbnailUrl(url: string) {
  const [base, query] = url.split("?", 2);
  const resized = base.includes("/revision/latest")
    ? base.replace("/revision/latest", "/revision/latest/scale-to-width-down/720")
    : base;
  return query ? `${resized}?${query}` : resized;
}

function toggleInSet<T>(current: Set<T>, value: T) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function StarRating({
  value,
  onChange,
  compact = false,
  dark = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={`star-rating ${compact ? "is-compact" : ""} ${dark ? "is-dark" : ""}`} aria-label={`当前评分 ${value || "未评分"}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "is-active" : ""}
          aria-label={`评分 ${star} 星`}
          title={`${star} 星`}
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
  selectedRatings: Set<number>;
  setSelectedRatings: (value: Set<number>) => void;
  resultCount: number;
  clearFilters: () => void;
  onDone?: () => void;
};

function FilterPanel({
  selectedGroups,
  setSelectedGroups,
  selectedCharacters,
  setSelectedCharacters,
  selectedRatings,
  setSelectedRatings,
  resultCount,
  clearFilters,
  onDone,
}: FilterPanelProps) {
  return (
    <div className="filter-panel-inner">
      <div className="filter-panel-heading">
        <div>
          <span className="eyebrow">MULTI FILTER</span>
          <h2>筛选卡面</h2>
        </div>
        {onDone ? (
          <button type="button" className="icon-button" onClick={onDone} aria-label="关闭筛选">
            ×
          </button>
        ) : null}
      </div>

      <section className="filter-section">
        <div className="filter-section-title">
          <h3>团体</h3>
          <button type="button" onClick={() => setSelectedGroups(new Set())}>全部</button>
        </div>
        <div className="group-filter-list">
          {GROUPS.map((group) => {
            const active = selectedGroups.has(group.id);
            return (
              <button
                key={group.id}
                type="button"
                className={`group-filter-row ${active ? "is-active" : ""}`}
                style={{ "--group-color": group.color, "--group-soft": group.softColor } as React.CSSProperties}
                onClick={() => setSelectedGroups(toggleInSet(selectedGroups, group.id))}
              >
                <span className="filter-checkbox">{active ? "✓" : ""}</span>
                <span className="group-filter-copy">
                  <strong>{group.name}</strong>
                  <small>{group.members.length} 名角色</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="filter-section character-filter-section">
        <div className="filter-section-title">
          <h3>角色</h3>
          <button type="button" onClick={() => setSelectedCharacters(new Set())}>选择所有人</button>
        </div>
        <div className="character-groups">
          {GROUPS.map((group) => (
            <div className="character-group" key={group.id}>
              <div className="character-group-label" style={{ color: group.color }}>{group.shortName}</div>
              <div className="character-pills">
                {group.members.map((character) => {
                  const active = selectedCharacters.has(character.id);
                  return (
                    <button
                      type="button"
                      key={character.id}
                      className={`character-pill ${active ? "is-active" : ""}`}
                      onClick={() => setSelectedCharacters(toggleInSet(selectedCharacters, character.id))}
                      title={character.romanized}
                    >
                      <span className="filter-checkbox">{active ? "✓" : ""}</span>
                      <span className="character-mark" style={{ "--character-color": character.color } as React.CSSProperties}>{character.mark}</span>
                      <span>{character.name}</span>
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
          <h3>我的星级</h3>
          <button type="button" onClick={() => setSelectedRatings(new Set())}>全部</button>
        </div>
        <div className="rating-filter-grid">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              type="button"
              key={rating}
              className={selectedRatings.has(rating) ? "is-active" : ""}
              onClick={() => setSelectedRatings(toggleInSet(selectedRatings, rating))}
            >
              <span>★</span>{rating}
            </button>
          ))}
          <button
            type="button"
            className={selectedRatings.has(0) ? "is-active" : ""}
            onClick={() => setSelectedRatings(toggleInSet(selectedRatings, 0))}
          >
            未评分
          </button>
        </div>
      </section>

      <p className="filter-logic-note">同类选项取并集，不同条件取交集。</p>
      <div className="filter-panel-actions">
        <button type="button" className="button button-secondary" onClick={clearFilters}>重置</button>
        {onDone ? (
          <button type="button" className="button button-primary" onClick={onDone}>查看 {resultCount} 张</button>
        ) : (
          <span className="filter-result-chip">{resultCount} 张结果</span>
        )}
      </div>
    </div>
  );
}

export default function CardBrowser() {
  const [ratings, setRatings] = useState<Ratings>({});
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedRatings, setSelectedRatings] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("catalog");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setRatings(JSON.parse(saved));
    } catch {
      // A malformed local value should never make the gallery unusable.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  }, [ratings]);

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

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = cards.filter((card) => {
      const character = CHARACTER_BY_ID[card.character];
      const group = GROUP_BY_CHARACTER[card.character];
      const rating = ratings[card.id] ?? 0;
      if (selectedGroups.size && !selectedGroups.has(group.id)) return false;
      if (selectedCharacters.size && !selectedCharacters.has(card.character)) return false;
      if (selectedRatings.size && !selectedRatings.has(rating)) return false;
      if (viewMode === "trained" && !card.trained) return false;
      if (viewMode === "normal" && card.trained) return false;
      if (
        normalizedQuery &&
        !`${card.title} ${card.filename} ${character.name} ${character.romanized} ${group.name}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      ) return false;
      return true;
    });

    if (sortMode === "rating") {
      filtered.sort((a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0) || a.id.localeCompare(b.id));
    } else if (sortMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    }
    return filtered;
  }, [query, ratings, selectedCharacters, selectedGroups, selectedRatings, sortMode, viewMode]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [query, selectedCharacters, selectedGroups, selectedRatings, sortMode, viewMode]);

  const selectedIndex = selectedCardId ? filteredCards.findIndex((card) => card.id === selectedCardId) : -1;
  const selectedCard = selectedIndex >= 0 ? filteredCards[selectedIndex] : null;

  const moveSelected = useCallback((direction: number) => {
    if (!filteredCards.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + direction + filteredCards.length) % filteredCards.length;
    setSelectedCardId(filteredCards[nextIndex].id);
  }, [filteredCards, selectedIndex]);

  useEffect(() => {
    if (!selectedCard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCardId(null);
      if (event.key === "ArrowLeft") moveSelected(-1);
      if (event.key === "ArrowRight") moveSelected(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelected, selectedCard]);

  const clearFilters = () => {
    setSelectedGroups(new Set());
    setSelectedCharacters(new Set());
    setSelectedRatings(new Set());
    setViewMode("all");
    setQuery("");
  };

  const activeFilterCount = selectedGroups.size + selectedCharacters.size + selectedRatings.size + (viewMode === "all" ? 0 : 1);
  const ratedValues = Object.values(ratings);
  const averageRating = ratedValues.length
    ? (ratedValues.reduce((sum, rating) => sum + rating, 0) / ratedValues.length).toFixed(1)
    : "—";

  return (
    <main>
      <header className="site-header">
        <div className="brand-block">
          <span className="brand-orbit"><i /><i /><i /></span>
          <div>
            <strong>SEKAI ARCHIVE</strong>
            <small>PJSK CARD VIEWER</small>
          </div>
        </div>
        <div className="header-status">
          <span><b>{cards.length}</b> 张卡面</span>
          <span><b>{ratedValues.length}</b> 已评分</span>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="hero-kicker">YOUR SEKAI, YOUR PICKS</span>
          <h1>PJSK<br /><em>卡面档案室</em></h1>
          <p>收藏每一个闪耀瞬间。浏览 26 名角色的完整卡面，为心动之作留下你的星级。</p>
        </div>
        <div className="hero-stats" aria-label="收藏统计">
          <div><span>完整收藏</span><strong>{cards.length}</strong><small>CARDS</small></div>
          <div><span>我的评分</span><strong>{ratedValues.length}</strong><small>RATED</small></div>
          <div><span>平均星级</span><strong>{averageRating}</strong><small>AVERAGE</small></div>
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
            selectedRatings={selectedRatings}
            setSelectedRatings={setSelectedRatings}
            resultCount={filteredCards.length}
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
                placeholder="搜索卡名或角色…"
                aria-label="搜索卡名或角色"
              />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="清空搜索">×</button> : null}
            </div>
            <button type="button" className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
              筛选 {activeFilterCount ? <b>{activeFilterCount}</b> : null}
            </button>
            <div className="view-mode-switch" aria-label="卡面类型">
              {([['all', '全部'], ['normal', '特训前'], ['trained', '特训后']] as [ViewMode, string][]).map(([mode, label]) => (
                <button key={mode} type="button" className={viewMode === mode ? "is-active" : ""} onClick={() => setViewMode(mode)}>{label}</button>
              ))}
            </div>
            <label className="sort-select">
              <span>排序</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="catalog">目录顺序</option>
                <option value="rating">星级最高</option>
                <option value="title">卡名 A–Z</option>
              </select>
            </label>
          </div>

          <div className="result-summary">
            <div><strong>{filteredCards.length}</strong><span>张符合条件的卡面</span></div>
            {activeFilterCount || query ? <button type="button" onClick={clearFilters}>清除筛选</button> : <span>点击卡面查看原图</span>}
          </div>

          {filteredCards.length ? (
            <>
              <div className="card-grid">
                {filteredCards.slice(0, visibleCount).map((card) => {
                  const character = CHARACTER_BY_ID[card.character];
                  const group = GROUP_BY_CHARACTER[card.character];
                  const rating = ratings[card.id] ?? 0;
                  return (
                    <article
                      className="card-tile"
                      key={card.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelectedCardId(card.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setSelectedCardId(card.id);
                      }}
                    >
                      <div className="card-image-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbnailUrl(card.imageUrl)} alt={`${character.name}「${card.title}」卡面`} loading="lazy" referrerPolicy="no-referrer" />
                        <span className="card-type-badge">{card.trained ? "特训后" : "特训前"}</span>
                        <span className="card-open-hint">查看原图 ↗</span>
                      </div>
                      <div className="card-meta">
                        <div className="card-character-row">
                          <span className="mini-character-mark" style={{ "--character-color": character.color } as React.CSSProperties}>{character.mark}</span>
                          <span><strong>{character.name}</strong><small style={{ color: group.color }}>{group.shortName}</small></span>
                        </div>
                        <h3 title={card.title}>{card.title}</h3>
                        <StarRating compact value={rating} onChange={(next) => setRating(card.id, next)} />
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibleCount < filteredCards.length ? (
                <div className="load-more-wrap">
                  <button type="button" className="button button-primary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                    加载更多 <span>{Math.min(PAGE_SIZE, filteredCards.length - visibleCount)}</span>
                  </button>
                  <small>已显示 {Math.min(visibleCount, filteredCards.length)} / {filteredCards.length}</small>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <span>☆</span><h2>没有找到卡面</h2><p>试试减少筛选条件，或换一个搜索词。</p>
              <button type="button" className="button button-primary" onClick={clearFilters}>重置筛选</button>
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>SEKAI ARCHIVE</span>
        <p>角色与团体信息参考萌娘百科；卡面图像来自 Project SEKAI Wiki。</p>
      </footer>

      {filtersOpen ? (
        <div className="filter-drawer-backdrop" onMouseDown={() => setFiltersOpen(false)}>
          <div className="filter-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <FilterPanel
              selectedGroups={selectedGroups}
              setSelectedGroups={setSelectedGroups}
              selectedCharacters={selectedCharacters}
              setSelectedCharacters={setSelectedCharacters}
              selectedRatings={selectedRatings}
              setSelectedRatings={setSelectedRatings}
              resultCount={filteredCards.length}
              clearFilters={clearFilters}
              onDone={() => setFiltersOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {selectedCard ? (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label={`${selectedCard.title} 原图`}>
          <button type="button" className="modal-close" onClick={() => setSelectedCardId(null)} aria-label="关闭原图">×</button>
          <button type="button" className="modal-nav modal-prev" onClick={() => moveSelected(-1)} aria-label="上一张">‹</button>
          <div className="modal-image-stage" onClick={() => setSelectedCardId(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedCard.imageUrl}
              alt={`${CHARACTER_BY_ID[selectedCard.character].name}「${selectedCard.title}」原图`}
              referrerPolicy="no-referrer"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
          <button type="button" className="modal-nav modal-next" onClick={() => moveSelected(1)} aria-label="下一张">›</button>
          <div className="modal-info">
            <div className="modal-title-block">
              <span style={{ color: GROUP_BY_CHARACTER[selectedCard.character].color }}>{GROUP_BY_CHARACTER[selectedCard.character].name}</span>
              <h2>{selectedCard.title}</h2>
              <p>{CHARACTER_BY_ID[selectedCard.character].name} · {selectedCard.trained ? "特训后" : "特训前"} · {selectedIndex + 1} / {filteredCards.length}</p>
            </div>
            <div className="modal-rating-block">
              <small>MY RATING</small>
              <StarRating dark value={ratings[selectedCard.id] ?? 0} onChange={(next) => setRating(selectedCard.id, next)} />
            </div>
            <a href={selectedCard.imageUrl} target="_blank" rel="noreferrer" className="original-link">新窗口打开原图 ↗</a>
          </div>
        </div>
      ) : null}
    </main>
  );
}
