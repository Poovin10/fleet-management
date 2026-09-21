'use client';

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
    <nav className="flex items-center gap-1 rounded-xl border border-border bg-surface/80 p-1 backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={[
              'relative h-9 rounded-md px-4 text-sm font-medium',
              'transition-all duration-normal ease-spring',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
              isActive
                ? 'bg-accent text-accent-fg shadow-orange'
                : 'text-fg-secondary hover:bg-surface-raised hover:text-fg',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
