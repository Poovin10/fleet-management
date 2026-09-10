'use client';

import { useState } from 'react';

export type Tab = {
  key: string;
  label: string;
};

type TabBarProps = {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
};

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <nav className="flex items-center gap-1 border-b border-border bg-surface px-2 h-12">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={[
              'relative h-9 px-4 rounded-md text-sm font-medium',
              'transition-colors duration-base ease-out',
              isActive
                ? 'bg-accent text-accent-fg'
                : 'text-fg-secondary hover:text-fg hover:bg-surface-raised',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}