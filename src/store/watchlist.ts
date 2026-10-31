import { create } from 'zustand';

export const WATCHLIST_STORAGE_KEY = 'marketlens.watchlist.v1';

export interface WatchGroup {
  id: string;
  name: string;
  items: string[];
}

export interface WatchlistState {
  groups: WatchGroup[];
  activeGroupId: string;
  recent: string[];
  toggle: (tickerId: string, groupId?: string) => void;
  add: (tickerId: string, groupId?: string) => void;
  remove: (tickerId: string, groupId?: string) => void;
  move: (tickerId: string, direction: -1 | 1, groupId?: string) => void;
  setActiveGroup: (groupId: string) => void;
  createGroup: (name: string) => string;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  pushRecent: (tickerId: string) => void;
  clearRecent: () => void;
  replaceAll: (groups: WatchGroup[], activeGroupId: string, recent: string[]) => void;
}

const DEFAULT_GROUP_ID = 'default';
const MAX_RECENT = 8;

function makeGroupId(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultGroup(): WatchGroup {
  return { id: DEFAULT_GROUP_ID, name: '', items: [] };
}

export const useWatchlist = create<WatchlistState>()((set, get) => ({
  groups: [defaultGroup()],
  activeGroupId: DEFAULT_GROUP_ID,
  recent: [],

  add: (tickerId, groupId) =>
    set((state) => {
      const targetId = groupId ?? state.activeGroupId;
      return {
        groups: state.groups.map((group) =>
          group.id === targetId && !group.items.includes(tickerId)
            ? { ...group, items: [...group.items, tickerId] }
            : group,
        ),
      };
    }),

  remove: (tickerId, groupId) =>
    set((state) => {
      const targetId = groupId ?? state.activeGroupId;
      return {
        groups: state.groups.map((group) =>
          group.id === targetId ? { ...group, items: group.items.filter((item) => item !== tickerId) } : group,
        ),
      };
    }),

  toggle: (tickerId, groupId) => {
    const state = get();
    const targetId = groupId ?? state.activeGroupId;
    const group = state.groups.find((entry) => entry.id === targetId);
    if (group?.items.includes(tickerId)) {
      state.remove(tickerId, targetId);
    } else {
      state.add(tickerId, targetId);
    }
  },

  move: (tickerId, direction, groupId) =>
    set((state) => {
      const targetId = groupId ?? state.activeGroupId;
      return {
        groups: state.groups.map((group) => {
          if (group.id !== targetId) return group;
          const index = group.items.indexOf(tickerId);
          const next = index + direction;
          if (index < 0 || next < 0 || next >= group.items.length) return group;
          const items = [...group.items];
          [items[index], items[next]] = [items[next], items[index]];
          return { ...group, items };
        }),
      };
    }),

  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  createGroup: (name) => {
    const id = makeGroupId();
    set((state) => ({ groups: [...state.groups, { id, name: name.trim() || '', items: [] }], activeGroupId: id }));
    return id;
  },

  renameGroup: (groupId, name) =>
    set((state) => ({
      groups: state.groups.map((group) => (group.id === groupId ? { ...group, name: name.trim() } : group)),
    })),

  deleteGroup: (groupId) =>
    set((state) => {
      if (state.groups.length <= 1) return state;
      const groups = state.groups.filter((group) => group.id !== groupId);
      return {
        groups,
        activeGroupId: state.activeGroupId === groupId ? groups[0].id : state.activeGroupId,
      };
    }),

  pushRecent: (tickerId) =>
    set((state) => {
      const recent = [tickerId, ...state.recent.filter((item) => item !== tickerId)].slice(0, MAX_RECENT);
      return { recent };
    }),

  clearRecent: () => set({ recent: [] }),

  replaceAll: (groups, activeGroupId, recent) =>
    set({
      groups: groups.length > 0 ? groups : [defaultGroup()],
      activeGroupId,
      recent,
    }),
}));

export function isWatched(groups: WatchGroup[], tickerId: string, groupId?: string): boolean {
  const group = groupId ? groups.find((entry) => entry.id === groupId) : groups[0];
  if (!group) return false;
  return group.items.includes(tickerId);
}

export function watchedIds(groups: WatchGroup[], groupId: string): string[] {
  return groups.find((group) => group.id === groupId)?.items ?? [];
}

interface PersistedShape {
  groups: WatchGroup[];
  activeGroupId: string;
  recent: string[];
}

export function loadWatchlist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    const groups = Array.isArray(parsed.groups)
      ? parsed.groups
          .filter((group): group is WatchGroup => typeof group?.id === 'string' && Array.isArray(group?.items))
          .map((group) => ({
            id: group.id,
            name: typeof group.name === 'string' ? group.name : '',
            items: group.items.filter((item) => typeof item === 'string'),
          }))
      : [];
    const recent = Array.isArray(parsed.recent) ? parsed.recent.filter((item) => typeof item === 'string') : [];
    if (groups.length === 0) return;
    const activeGroupId = groups.some((group) => group.id === parsed.activeGroupId)
      ? (parsed.activeGroupId as string)
      : groups[0].id;
    useWatchlist.getState().replaceAll(groups, activeGroupId, recent.slice(0, MAX_RECENT));
  } catch {
    /* corrupted storage — start clean */
  }
}

export function persistWatchlist(state: WatchlistState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PersistedShape = {
      groups: state.groups,
      activeGroupId: state.activeGroupId,
      recent: state.recent,
    };
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable */
  }
}
