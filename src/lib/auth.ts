// ---------------------------------------------------------------------------
// Accounts — temporary passwords, invitations, password rules.
// Real authentication (RHS.jo Microsoft 365 sign-in) is wired at deployment; until
// then the administrator issues a temporary password and the person sets their own.
// ---------------------------------------------------------------------------
import type { User } from '@/types'
import { DEPARTMENTS, effectiveAccess, ACCESS_LABEL } from './departments'
import { PERMISSIONS, can } from './permissions'

export const ORG_DOMAIN = 'rhs.jo'
export const isOrgEmail = (email: string) => email.trim().toLowerCase().endsWith('@' + ORG_DOMAIN)

/** Temporary password: unambiguous characters, e.g. RHS-7kq4-m9xw */
export function tempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const grp = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `RHS-${grp()}-${grp()}`
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mix letters and numbers.'
  return null
}

export const appLink = () => `${location.origin}${location.pathname}#/login`

/** Invitation text to share with a colleague (email, chat or in person). */
export function invitationText(u: User, password: string, orgName: string): string {
  const access = DEPARTMENTS.filter((d) => effectiveAccess(u)[d.id] !== 'none').map((d) => `${d.name} (${ACCESS_LABEL[effectiveAccess(u)[d.id]]})`)
  const fns = DEPARTMENTS.flatMap((d) => PERMISSIONS[d.id].filter((p) => can(u, p.key)).map((p) => `${d.name}: ${p.label}`))
  return [
    `Dear ${u.name.split(' ')[0]},`,
    '',
    `Your account on the ${orgName} PCM & Grants Management Platform is ready.`,
    '',
    `Link: ${appLink()}`,
    `Email: ${u.email}`,
    `Temporary password: ${password}`,
    '',
    'At your first sign-in you will be asked to choose your own password. Please do not share it.',
    '',
    `Workspaces: ${access.length ? access.join(', ') : 'none yet'}`,
    `Functions: ${fns.length ? '\n  - ' + fns.join('\n  - ') : 'none yet'}`,
    '',
    'Bilal Abbassi',
    'Director of Programs · System Administrator',
  ].join('\n')
}
