import { ChevronDown, Menu, Radio } from 'lucide-react'

interface HeaderProps {
  onMenu: () => void
  collapsed: boolean
}

export function Header({ onMenu }: HeaderProps) {
  return (
    <header className="topbar">
      <button className="icon-button" onClick={onMenu} aria-label="Toggle navigation">
        <Menu size={20} />
      </button>

      <div className="brand">
        <div className="brand-mark">
          <Radio size={18} />
        </div>
        <span>Multi Stream Studio</span>
      </div>

      <button className="user-menu">
        <span className="avatar">U</span>
        <span>User</span>
        <ChevronDown size={15} />
      </button>
    </header>
  )
}
