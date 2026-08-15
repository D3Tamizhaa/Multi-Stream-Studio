import {
  AudioLines,
  ChevronRight,
  Clapperboard,
  Cog,
  FileOutput,
  LockKeyhole,
  Network,
  Settings,
  SlidersHorizontal,
  Video,
} from 'lucide-react'
import type { SettingsSection } from '../types/studio'

interface NavigationProps {
  collapsed: boolean
  page: 'editor' | 'settings'
  settingsSection: SettingsSection
  onPageChange: (page: 'editor' | 'settings') => void
  onSettingsChange: (section: SettingsSection) => void
}

const settingsItems: {
  label: SettingsSection
  icon: React.ReactNode
}[] = [
  { label: 'Authorization', icon: <LockKeyhole size={15} /> },
  { label: 'Stream', icon: <Network size={15} /> },
  { label: 'Output', icon: <FileOutput size={15} /> },
  { label: 'Audio', icon: <AudioLines size={15} /> },
  { label: 'Video', icon: <Video size={15} /> },
  { label: 'Advanced', icon: <SlidersHorizontal size={15} /> },
]

export function Navigation({
  collapsed,
  page,
  settingsSection,
  onPageChange,
  onSettingsChange,
}: NavigationProps) {
  return (
    <aside className={`navigation ${collapsed ? 'collapsed' : ''}`}>
      <button
        className={`nav-main ${page === 'editor' ? 'active' : ''}`}
        onClick={() => onPageChange('editor')}
      >
        <Clapperboard size={17} />
        {!collapsed && <span>Editor</span>}
      </button>

      <button
        className={`nav-main ${page === 'settings' ? 'active' : ''}`}
        onClick={() => onPageChange('settings')}
      >
        <Cog size={17} />
        {!collapsed && <span>Settings</span>}
        {!collapsed && <ChevronRight size={14} className={page === 'settings' ? 'rotate-90' : ''} />}
      </button>

      {!collapsed && page === 'settings' && (
        <div className="settings-nav">
          {settingsItems.map((item) => (
            <button
              key={item.label}
              className={settingsSection === item.label ? 'active' : ''}
              onClick={() => onSettingsChange(item.label)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {!collapsed && (
        <div className="nav-footer">
          <Settings size={14} />
          <span>Studio v0.1.0</span>
        </div>
      )}
    </aside>
  )
}
