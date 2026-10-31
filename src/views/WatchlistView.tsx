import { useMemo, useState } from 'react';
import { useLang, useT } from '../hooks/useI18n';
import { useNow } from '../hooks/useNow';
import { tickerIndex, useMarkets } from '../store/markets';
import { useWatchlist, watchedIds } from '../store/watchlist';import { formatAge, formatCompact, formatPrice } from '../lib/format';
import { openPair } from '../lib/router';
import { sourceLabel } from '../data';
import { Delta, EmptyState, StarButton, Skeleton } from '../components/ui';
import { SourceStatus } from '../components/SourceStatus';

export function WatchlistView() {
  const t = useT();
  const lang = useLang();
  const now = useNow(2000);
  const sources = useMarkets((state) => state.sources);
  const index = useMemo(() => tickerIndex(sources), [sources]);

  const groups = useWatchlist((state) => state.groups);
  const activeGroupId = useWatchlist((state) => state.activeGroupId);
  const setActiveGroup = useWatchlist((state) => state.setActiveGroup);
  const createGroup = useWatchlist((state) => state.createGroup);
  const renameGroup = useWatchlist((state) => state.renameGroup);
  const deleteGroup = useWatchlist((state) => state.deleteGroup);
  const remove = useWatchlist((state) => state.remove);
  const move = useWatchlist((state) => state.move);

  const [newGroup, setNewGroup] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const ids = watchedIds(groups, activeGroupId);
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const missing = ids.filter((id) => !index.has(id));
  const entries = ids.map((id) => index.get(id)).filter((ticker): ticker is NonNullable<typeof ticker> => Boolean(ticker));
  const streaming = Object.values(sources).some((source) => source.status === 'loading');

  const groupName = (group: { id: string; name: string }) => group.name || (group.id === 'default' ? t('watch.defaultGroup') : t('watch.group'));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1 px-0.5">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight text-ink">{t('watch.title')}</h1>
          <p className="hidden text-[10px] text-muted sm:block">{t('watch.subtitle')}</p>
        </div>
        <span className="text-[10px] text-muted">{t('watch.persistNote')}</span>
      </div>

      <SourceStatus compact />

      <div className="panel flex flex-wrap items-center gap-1 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {groups.map((group) => {
            const active = group.id === activeGroupId;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={active}
                className={`rounded border px-1.5 py-0.5 text-2xs font-medium transition-colors ${
                  active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {groupName(group)}
                <span className="num ml-1 text-[9px] opacity-70">{group.items.length}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {renaming ? (
            <>
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder={t('watch.groupName')}
                aria-label={t('watch.groupName')}
                className="input h-6 w-28 text-2xs"
              />
              <button
                type="button"
                className="btn h-6 text-2xs"
                onClick={() => {
                  if (activeGroup) renameGroup(activeGroup.id, renameValue);
                  setRenaming(false);
                }}
              >
                {t('common.ok')}
              </button>
              <button type="button" className="btn btn-ghost h-6 text-2xs" onClick={() => setRenaming(false)}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <input
                value={newGroup}
                onChange={(event) => setNewGroup(event.target.value)}
                placeholder={t('watch.newGroup')}
                aria-label={t('watch.newGroup')}
                className="input h-6 w-28 text-2xs"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newGroup.trim()) {
                    createGroup(newGroup);
                    setNewGroup('');
                  }
                }}
              />
              <button
                type="button"
                className="btn h-6 text-2xs"
                disabled={!newGroup.trim()}
                onClick={() => {
                  createGroup(newGroup);
                  setNewGroup('');
                }}
              >
                +
              </button>
              <button
                type="button"
                className="btn btn-ghost h-6 text-2xs"
                onClick={() => {
                  setRenameValue(activeGroup?.name ?? '');
                  setRenaming(true);
                }}
              >
                {t('watch.groupName')}
              </button>
              <button
                type="button"
                className="btn btn-ghost h-6 text-2xs text-down"
                disabled={groups.length <= 1}
                onClick={() => {
                  if (!activeGroup) return;
                  const ok = window.confirm(
                    t('watch.deleteConfirm', { name: groupName(activeGroup), n: activeGroup.items.length }),
                  );
                  if (ok) deleteGroup(activeGroup.id);
                }}
              >
                {t('watch.deleteGroup')}
              </button>
            </>
          )}
        </div>
      </div>

      <section className="panel" aria-label={t('watch.title')}>
        {entries.length === 0 && streaming ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 5 }).map((_, index2) => (
              <Skeleton key={index2} className="h-5 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState message={t('watch.empty')} hint={t('watch.persistNote')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-line bg-raised/40 text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-1 py-1 text-left font-semibold"> </th>
                  <th className="px-2 py-1 text-left font-semibold">{t('common.pair')}</th>
                  <th className="px-2 py-1 text-left font-semibold">{t('common.exchange')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.price')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.change24h')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.high24h')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.low24h')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.quoteVolume24h')}</th>
                  <th className="px-2 py-1 text-right font-semibold">{t('common.updated')}</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {entries.map((ticker) => (
                  <tr
                    key={ticker.id}
                    className="cursor-pointer border-b border-line/50 hover:bg-raised/50"
                    onClick={() => openPair(ticker.exchange, ticker.rawSymbol)}
                  >
                    <td className="px-1 py-1">
                      <StarButton active onToggle={() => remove(ticker.id)} />
                    </td>
                    <td className="px-2 py-1 font-mono text-ink">{ticker.symbol}</td>
                    <td className="px-2 py-1 text-muted">{sourceLabel(ticker.exchange, lang)}</td>
                    <td className="num px-2 py-1 text-right text-ink">{formatPrice(ticker.price, lang)}</td>
                    <td className="px-2 py-1 text-right">
                      <Delta value={ticker.changePercent24h} />
                    </td>
                    <td className="num px-2 py-1 text-right text-muted">{formatPrice(ticker.high24h, lang)}</td>
                    <td className="num px-2 py-1 text-right text-muted">{formatPrice(ticker.low24h, lang)}</td>
                    <td className="num px-2 py-1 text-right text-muted">{formatCompact(ticker.quoteVolume24h, lang)}</td>
                    <td className="num px-2 py-1 text-right text-muted">{formatAge(ticker.fetchedAt, now, lang)}</td>
                    <td className="px-2 py-1 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          className="btn btn-ghost h-5 w-5 px-0 text-[10px]"
                          title={t('watch.moveUp')}
                          aria-label={t('watch.moveUp')}
                          onClick={(event) => {
                            event.stopPropagation();
                            move(ticker.id, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost h-5 w-5 px-0 text-[10px]"
                          title={t('watch.moveDown')}
                          aria-label={t('watch.moveDown')}
                          onClick={(event) => {
                            event.stopPropagation();
                            move(ticker.id, 1);
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {missing.length > 0 && (
          <p className="border-t border-line px-2 py-1 text-[10px] text-muted">
            {t('pair.notFound')}: {missing.join(', ')}
          </p>
        )}
      </section>

      <p className="px-0.5 text-[10px] text-muted">{t('watch.items', { n: ids.length })}</p>
    </div>
  );
}
