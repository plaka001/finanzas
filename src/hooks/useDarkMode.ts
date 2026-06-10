import { useEffect, useState } from 'react'

const STORAGE_KEY = 'panorama-theme'

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? stored === 'dark' : true // dark por defecto
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0b1014' : '#f5f5f4')
  }, [dark])

  return { dark, toggle: () => setDark((d) => !d) }
}
