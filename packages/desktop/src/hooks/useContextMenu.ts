import { useState, useEffect, useCallback } from 'react';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export interface ContextMenuItem {
  id: string;
  label?: string;
  shortcut?: string;
  separator?: boolean;
  danger?: boolean;
}

export type MenuContext = { type: 'desktop' | 'icon'; targetId?: string } | null;

const DESKTOP_ITEMS: ContextMenuItem[] = [
  { id: 'refresh', label: 'Refresh', shortcut: 'F5' },
  { id: 'change_wallpaper', label: 'Change Wallpaper' },
  { id: 'reset_wallpaper', label: 'Reset to Default' },
  { id: 'separator1', separator: true },
  { id: 'display_settings', label: 'Display Settings' },
  { id: 'separator2', separator: true },
  { id: 'open_terminal', label: 'Open Terminal' },
];

const ICON_ITEMS: ContextMenuItem[] = [
  { id: 'open', label: 'Open' },
  { id: 'separator1', separator: true },
  { id: 'properties', label: 'Properties' },
];

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [menuContext, setMenuContext] = useState<MenuContext>(null);
  const [menuItems, setMenuItems] = useState<readonly ContextMenuItem[]>(DESKTOP_ITEMS);

  const showMenu = useCallback((x: number, y: number, context?: MenuContext) => {
    const clampedX = Math.min(x, window.innerWidth - 200);
    const items = context?.type === 'icon' ? ICON_ITEMS : DESKTOP_ITEMS;
    const clampedY = Math.min(y, window.innerHeight - items.length * 36 - 8);
    setMenu({ visible: true, x: clampedX, y: clampedY });
    setMenuContext(context || null);
    setMenuItems(items);
  }, []);

  const hideMenu = useCallback(() => {
    setMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
  }, []);

  useEffect(() => {
    const close = () => hideMenu();
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [hideMenu]);

  // Global contextmenu fallback on desktop areas
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Only show desktop menu if right-clicking on the desktop background
      const target = e.target as HTMLElement;
      if (target.closest('.os-window') || target.closest('.desktop-icon') || target.closest('[data-context]')) {
        return; // Let the element's own handler deal with it
      }
      e.preventDefault();
      showMenu(e.clientX, e.clientY, { type: 'desktop' });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [showMenu]);

  const execute = useCallback((action: string) => {
    hideMenu();
    return { action, context: menuContext };
  }, [hideMenu, menuContext]);

  return { menu, menuItems, menuContext, showMenu, hideMenu, execute };
}
