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

const DEFAULT_ITEMS: ContextMenuItem[] = [
  { id: 'refresh', label: 'Refresh' },
];

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [menuContext, setMenuContext] = useState<MenuContext>(null);
  const [menuItems, setMenuItems] = useState<readonly ContextMenuItem[]>(DEFAULT_ITEMS);

  const showMenu = useCallback((x: number, y: number, context?: MenuContext) => {
    const clampedX = Math.min(x, window.innerWidth - 200);
    const items = DEFAULT_ITEMS;
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

  const execute = useCallback((action: string) => {
    hideMenu();
    return { action, context: menuContext };
  }, [hideMenu, menuContext]);

  return { menu, menuItems, menuContext, showMenu, hideMenu, execute };
}
