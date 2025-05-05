"use client"

import Link from 'next/link'
import styles from './navbar.module.css'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { ClientAuthProvider, useAuth } from '@/contexts/AuthContext'

function NavbarContent() {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Initialize theme based on system preference and saved preference
  useEffect(() => {
    // Check for stored theme preference
    const storedTheme = localStorage.getItem('theme')
    
    if (storedTheme) {
      setTheme(storedTheme as 'light' | 'dark')
      document.documentElement.setAttribute('data-theme', storedTheme)
    } else {
      // Use system preference as fallback
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setTheme(systemPreference)
      document.documentElement.setAttribute('data-theme', systemPreference)
    }
  }, [])
  
  // Close the menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    
    // Add event listener when menu is open
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Cleanup on unmount or when menu closes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }
  
  // Always show the navbar, even on auth pages
  
  const handleLogout = async () => {
    await logout();
  };
  
  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return user ? 'U' : 'G'; // U for user, G for guest
    return user.name.split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
            <path d="M7 7h.01"></path>
          </svg>
          <span>STIX Analyzer</span>
        </Link>
        <div className={styles.actions}>
          <button onClick={toggleTheme} className={styles.iconButton} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-color)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="M4.93 4.93l1.41 1.41"></path>
                <path d="M17.66 17.66l1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="M6.34 17.66l-1.41 1.41"></path>
                <path d="M19.07 4.93l-1.41 1.41"></path>
              </svg>
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--text-color)" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
              </svg>
            )}
          </button>
          {user || isAuthPage ? (
            <div className={styles.userMenu} ref={menuRef}>
              <Avatar 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className={styles.userAvatar}
              >
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              {isMenuOpen && (
                <div className={styles.userMenuDropdown}>
                  <div className={styles.userInfo}>
                    <p className={styles.userName}>{user?.name || 'Guest User'}</p>
                    <p className={styles.userEmail}>{user?.email || 'Not logged in'}</p>
                  </div>
                  <div className={styles.userMenuDivider}></div>
                  <Link href="/settings" className={styles.userMenuButton}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.userMenuButtonIcon}
                    >
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Settings
                  </Link>
                  {user && (
                    <button 
                      className={styles.userMenuButton}
                      onClick={handleLogout}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.userMenuButtonIcon}
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Sign out
                    </button>
                  )}
                  {!user && (
                    <Link href="/login" className={styles.userMenuButton}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.userMenuButtonIcon}
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                        <polyline points="10 17 15 12 10 7"></polyline>
                        <line x1="15" y1="12" x2="3" y2="12"></line>
                      </svg>
                      Sign in
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.authLink}>
                Sign in
              </Link>
              <Link href="/register">
                <button className={styles.registerButton}>
                  Sign up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export function Navbar() {
  return (
    <ClientAuthProvider>
      <NavbarContent />
    </ClientAuthProvider>
  )
}
