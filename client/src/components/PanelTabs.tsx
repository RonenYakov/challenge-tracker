import { useState, type ReactNode } from 'react'

export interface Panel {
  key: string
  label: string
  node: ReactNode
}

/**
 * One panel at a time, for narrow screens.
 *
 * The rules for today have to stay on screen, so everything that is reference or
 * reflection rather than action moves behind this. Tabs rather than accordions on
 * purpose: an accordion can end up with everything shut and nothing to look at, and
 * reopening costs a tap either way.
 *
 * Only mounted on narrow screens, so the panels here and the side rail on a wide
 * screen never both exist. Two live copies of the journal would each hold their own
 * unsaved draft.
 */
export function PanelTabs({ panels }: { panels: Panel[] }) {
  const [activeKey, setActiveKey] = useState(panels[0]?.key)
  const active = panels.find((p) => p.key === activeKey) ?? panels[0]

  if (!active) return null

  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 rounded-xl border border-mist/70 bg-paper p-1 shadow-sm"
      >
        {panels.map((panel) => {
          const selected = panel.key === active.key
          return (
            <button
              key={panel.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveKey(panel.key)}
              className="press min-h-11 flex-1 rounded-lg text-[13px] transition-colors duration-150"
              style={{
                backgroundColor: selected ? 'var(--color-cream-dark)' : 'transparent',
                color: selected ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                fontWeight: selected ? 500 : 400,
              }}
            >
              {panel.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-3">
        {active.node}
      </div>
    </div>
  )
}
