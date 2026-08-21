import { ChevronDown, LogOut, Menu, Radio, User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface HeaderProps {
  onMenu: () => void
  collapsed: boolean
  username: string
  onLogout: () => void
}

export function Header({
  onMenu,
  username,
  onLogout,
}: HeaderProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  const displayName = username.trim() || 'User'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <header className="topbar">
      <button
        className="icon-button"
        onClick={onMenu}
        aria-label="Toggle navigation"
      >
        <Menu size={20} />
      </button>

      <div className="brand">
        <div className="brand-mark">
          <Radio size={18} />
        </div>
        <span>Multi Stream Studio</span>
      </div>

      <div className="user-menu-container" ref={menuRef}>
        <button
          className="user-menu"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="avatar">{avatarLetter}</span>
          <span>{displayName}</span>
          <ChevronDown size={15} />
        </button>

        {open && (
          <div className="user-dropdown" role="menu">
            <div className="user-dropdown-name">
              <UserIcon size={15} />
              <span>{displayName}</span>
            </div>

            <button
              className="user-dropdown-item logout"
              type="button"
              onClick={handleLogout}
              role="menuitem"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
