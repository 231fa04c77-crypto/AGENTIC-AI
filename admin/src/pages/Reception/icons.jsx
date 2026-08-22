import React from 'react'

/**
 * Reception filled / duotone icons — solid shapes with soft secondary layer
 * (not thin Heroicon outlines). Color via currentColor.
 */
export const RecGlyph = ({ name, className = 'w-5 h-5' }) => {
  const c = className
  const icons = {
    dashboard: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='3' y='3' width='8' height='8' rx='2' fill='currentColor' opacity='0.35' />
        <rect x='13' y='3' width='8' height='5' rx='2' fill='currentColor' />
        <rect x='13' y='10' width='8' height='11' rx='2' fill='currentColor' opacity='0.35' />
        <rect x='3' y='13' width='8' height='8' rx='2' fill='currentColor' />
      </svg>
    ),
    clipboard: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M7 4h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z' />
        <path fill='currentColor' d='M9 2h6a1 1 0 011 1v2H8V3a1 1 0 011-1z' />
        <rect x='8' y='10' width='8' height='2' rx='1' fill='currentColor' />
        <rect x='8' y='14' width='5' height='2' rx='1' fill='currentColor' opacity='0.7' />
        <circle cx='16.5' cy='16.5' r='3.5' fill='currentColor' />
        <path stroke='#fff' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round' d='M15.2 16.5l1 1 2-2' />
      </svg>
    ),
    patients: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='9' cy='8' r='3.5' fill='currentColor' />
        <path fill='currentColor' opacity='0.35' d='M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5v.5H3.5v-.5z' />
        <circle cx='16.5' cy='9' r='2.5' fill='currentColor' opacity='0.55' />
        <path fill='currentColor' opacity='0.35' d='M14 19.5c.4-2.2 2-3.7 4.2-3.9 1.8.2 3.3 1.4 3.8 3.4v.5H14v-.5z' />
      </svg>
    ),
    ambulance: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M3 10h11v7H3a1 1 0 01-1-1v-5a1 1 0 011-1z' />
        <path fill='currentColor' d='M14 10h3.2a1 1 0 01.8.4l2.4 3.2a1 1 0 01.2.6V16a1 1 0 01-1 1h-5.6V10z' />
        <circle cx='7' cy='18' r='2.2' fill='currentColor' />
        <circle cx='17' cy='18' r='2.2' fill='currentColor' />
        <rect x='5.5' y='11.5' width='5' height='1.4' rx='0.7' fill='#fff' opacity='0.9' />
        <rect x='7.3' y='9.7' width='1.4' height='5' rx='0.7' fill='#fff' opacity='0.9' />
      </svg>
    ),
    billing: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='2' y='5' width='20' height='14' rx='2.5' fill='currentColor' opacity='0.3' />
        <rect x='2' y='8' width='20' height='3.5' fill='currentColor' />
        <rect x='5' y='14' width='5' height='2' rx='1' fill='currentColor' />
        <rect x='12' y='14' width='3' height='2' rx='1' fill='currentColor' opacity='0.5' />
      </svg>
    ),
    reports: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M5 3h9l5 5v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z' />
        <path fill='currentColor' d='M14 3v5h5' />
        <rect x='7' y='12' width='2.2' height='6' rx='1' fill='currentColor' />
        <rect x='11' y='9.5' width='2.2' height='8.5' rx='1' fill='currentColor' />
        <rect x='15' y='14' width='2.2' height='4' rx='1' fill='currentColor' opacity='0.7' />
      </svg>
    ),
    settings: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.35' d='M19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.5-2.4 1a7.7 7.7 0 00-1.7-1L15 3h-6l-.3 2.5a7.7 7.7 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 000 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1L9 21h6l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5z' />
        <circle cx='12' cy='12' r='3.2' fill='currentColor' />
      </svg>
    ),
    logout: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M4 4h8a2 2 0 012 2v3h-2V6H4v12h8v-3h2v3a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z' />
        <path fill='currentColor' d='M11 11h6.2l-1.6-1.6 1.2-1.2L21 12l-4.2 4.2-1.2-1.2L17.2 13H11v-2z' />
      </svg>
    ),
    online: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <circle cx='12' cy='12' r='5.5' fill='currentColor' opacity='0.45' />
        <circle cx='12' cy='12' r='2.5' fill='currentColor' />
        <path fill='currentColor' d='M12 2.5a9.5 9.5 0 019.5 9.5h-2.2A7.3 7.3 0 0012 4.7V2.5z' opacity='0.8' />
      </svg>
    ),
    walkin: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='10' cy='7' r='3' fill='currentColor' />
        <path fill='currentColor' opacity='0.35' d='M5 20v-1.5c0-2.5 2.2-4.5 5-4.5 1.2 0 2.3.4 3.2 1l-1.4 1.8c-.5-.3-1.1-.5-1.8-.5-1.7 0-3 1.1-3 2.5V20H5z' />
        <path fill='currentColor' d='M14.5 13.5l2.2 1.2 2.8-4.2 1.7 1.1-3.5 5.3-3.8-2.1.6-1.3z' />
      </svg>
    ),
    queue: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <circle cx='12' cy='12' r='7' fill='currentColor' opacity='0.15' />
        <path fill='currentColor' d='M12 6a1 1 0 011 1v4.2l2.6 2.6a1 1 0 01-1.4 1.4l-3-3A1 1 0 0111 12V7a1 1 0 011-1z' />
        <circle cx='12' cy='12' r='1.4' fill='currentColor' />
      </svg>
    ),
    noshow: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <path fill='currentColor' d='M8.2 7.1l8.7 8.7-1.4 1.4-8.7-8.7 1.4-1.4z' />
        <path fill='currentColor' d='M16.9 7.1l1.4 1.4-8.7 8.7-1.4-1.4 8.7-8.7z' />
      </svg>
    ),
    calendar: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='3' y='5' width='18' height='16' rx='2.5' fill='currentColor' opacity='0.25' />
        <rect x='3' y='5' width='18' height='5' rx='2.5' fill='currentColor' />
        <rect x='7' y='3' width='2' height='4' rx='1' fill='currentColor' />
        <rect x='15' y='3' width='2' height='4' rx='1' fill='currentColor' />
        <rect x='7' y='13' width='3' height='3' rx='0.8' fill='currentColor' />
        <rect x='11.5' y='13' width='3' height='3' rx='0.8' fill='currentColor' opacity='0.55' />
        <rect x='16' y='13' width='3' height='3' rx='0.8' fill='currentColor' opacity='0.35' />
      </svg>
    ),
    refund: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <path fill='currentColor' d='M13.5 8H9.8L11.4 6.4 10 5 6.5 8.5 10 12l1.4-1.4L9.8 9H13.5a3.5 3.5 0 010 7H11v2h2.5a5.5 5.5 0 000-11z' />
      </svg>
    ),
    revenue: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <path fill='currentColor' d='M12 6.5c-2.5 0-4.2 1.3-4.2 3.2 0 1.6 1.1 2.5 3.2 3l1.5.4c1.2.3 1.8.7 1.8 1.5s-.8 1.4-2.3 1.4c-1.3 0-2.2-.5-2.5-1.3l-1.9.5c.5 1.7 2.1 2.7 4.1 2.9V19.5h2v-1.8c2.3-.3 4-1.6 4-3.7 0-2-1.4-3-3.5-3.5l-1.6-.4c-1-.3-1.5-.7-1.5-1.3 0-.7.7-1.2 1.9-1.2 1.1 0 1.9.4 2.2 1.1l1.8-.6c-.5-1.4-1.9-2.3-3.9-2.5V6.5H12z' />
      </svg>
    ),
    qr: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='3' y='3' width='8' height='8' rx='1.5' fill='currentColor' opacity='0.3' />
        <rect x='5' y='5' width='4' height='4' rx='0.8' fill='currentColor' />
        <rect x='13' y='3' width='8' height='8' rx='1.5' fill='currentColor' opacity='0.3' />
        <rect x='15' y='5' width='4' height='4' rx='0.8' fill='currentColor' />
        <rect x='3' y='13' width='8' height='8' rx='1.5' fill='currentColor' opacity='0.3' />
        <rect x='5' y='15' width='4' height='4' rx='0.8' fill='currentColor' />
        <rect x='13' y='13' width='3' height='3' fill='currentColor' />
        <rect x='18' y='13' width='3' height='3' fill='currentColor' opacity='0.55' />
        <rect x='13' y='18' width='3' height='3' fill='currentColor' opacity='0.55' />
        <rect x='17' y='17' width='4' height='4' fill='currentColor' />
      </svg>
    ),
    token: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M4 4h9.2L20 10.8V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z' />
        <path fill='currentColor' d='M13 4v6h6' />
        <circle cx='10' cy='15' r='3.2' fill='currentColor' />
        <path stroke='#fff' strokeWidth='1.3' strokeLinecap='round' d='M10 13.6v2.8M8.6 15h2.8' />
      </svg>
    ),
    check: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <circle cx='12' cy='12' r='7' fill='currentColor' />
        <path stroke='#fff' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' d='M8.5 12.2l2.3 2.3 4.7-5' />
      </svg>
    ),
    search: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='10.5' cy='10.5' r='6.5' fill='currentColor' opacity='0.3' />
        <circle cx='10.5' cy='10.5' r='4.5' fill='currentColor' />
        <rect x='15.2' y='14.5' width='6' height='2.4' rx='1.2' transform='rotate(45 15.2 14.5)' fill='currentColor' />
      </svg>
    ),
    badge: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='3' y='5' width='18' height='14' rx='2' fill='currentColor' opacity='0.3' />
        <circle cx='9' cy='12' r='3' fill='currentColor' />
        <rect x='13.5' y='9.5' width='5.5' height='1.6' rx='0.8' fill='currentColor' />
        <rect x='13.5' y='12.8' width='4' height='1.6' rx='0.8' fill='currentColor' opacity='0.55' />
      </svg>
    ),
    phone: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M6.6 3.2l2.8 1c.5.2.8.7.7 1.2l-.7 2.8a1 1 0 01-.6.7l-2 1a12 12 0 006.5 6.5l1-2a1 1 0 01.7-.6l2.8-.7c.5-.1 1 .2 1.2.7l1 2.8c.2.6 0 1.2-.5 1.5A16 16 0 013.5 6.2c.3-.5.9-.8 1.5-.6.6.1 1.2.3 1.6.6z' />
        <path fill='currentColor' d='M15.5 14.2l1 2a14.5 14.5 0 01-8.7-8.7l2 1-.7 2.8-2 1a12.5 12.5 0 006.9 6.9l1-2 2.8-.7z' />
      </svg>
    ),
    mail: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='2' y='5' width='20' height='14' rx='2.5' fill='currentColor' opacity='0.3' />
        <path fill='currentColor' d='M3.2 7.2L12 13l8.8-5.8V7a2 2 0 00-2-2H5a2 2 0 00-1.8 1.2z' />
      </svg>
    ),
    map: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z' />
        <circle cx='12' cy='10' r='3' fill='currentColor' />
      </svg>
    ),
    eye: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M12 5c5.5 0 9.8 4.2 10.8 7-1 2.8-5.3 7-10.8 7S2.2 14.8 1.2 12C2.2 9.2 6.5 5 12 5z' />
        <circle cx='12' cy='12' r='3.5' fill='currentColor' />
        <circle cx='12' cy='12' r='1.5' fill='#fff' opacity='0.9' />
      </svg>
    ),
    close: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='12' r='9' fill='currentColor' opacity='0.25' />
        <path fill='currentColor' d='M8.2 7.8l8 8-1.4 1.4-8-8 1.4-1.4z' />
        <path fill='currentColor' d='M16.2 7.8l1.4 1.4-8 8-1.4-1.4 8-8z' />
      </svg>
    ),
    inbox: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' />
        <path fill='currentColor' d='M3 13h5.2a2.8 2.8 0 005.6 0H21v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z' />
      </svg>
    ),
    refresh: (
      <svg className={c} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path fill='currentColor' opacity='0.3' d='M12 4a8 8 0 018 8h-2.2A5.8 5.8 0 0012 6.2V4z' />
        <path fill='currentColor' d='M12 20a8 8 0 01-8-8h2.2A5.8 5.8 0 0012 17.8V20z' />
        <path fill='currentColor' d='M18.5 7.5L21 4.5V10h-5.5l3-2.5z' />
        <path fill='currentColor' opacity='0.7' d='M5.5 16.5L3 19.5V14h5.5l-3 2.5z' />
      </svg>
    ),
  }

  return icons[name] || icons.dashboard
}

/** Alias used by page components */
export const RdIcon = ({ name, className = 'w-4 h-4' }) => {
  const map = {
    calendar: 'calendar',
    badge: 'badge',
    clipboard: 'clipboard',
    users: 'patients',
    ambulance: 'ambulance',
    close: 'close',
    phone: 'phone',
    mail: 'mail',
    map: 'map',
    eye: 'eye',
    search: 'search',
    inbox: 'inbox',
    refresh: 'refresh',
  }
  return <RecGlyph name={map[name] || name} className={className} />
}
