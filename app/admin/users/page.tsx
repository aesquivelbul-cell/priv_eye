'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface UserRow {
  userId: string | null
  email: string
  age: number | null
  gender: string | null
  yearLevel: string | null
  fieldOfStudy: string | null
  lastLogDate: string
  lastRiskLevel: string
}

const RISK_LEVELS = ['All', 'Low', 'Moderate', 'High', 'Critical'] as const
type RiskFilter = (typeof RISK_LEVELS)[number]

const SOURCE_OPTIONS = ['All', 'Registered', 'Survey'] as const
type SourceFilter = (typeof SOURCE_OPTIONS)[number]

const FIELD_OPTIONS = ['All', 'IT / Computer Science', 'Engineering', 'Business', 'Health Sciences', 'Education', 'Arts and Humanities', 'Other'] as const
type FieldFilter = (typeof FIELD_OPTIONS)[number]

const YEAR_OPTIONS = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', 'Others'] as const
type YearFilter = (typeof YEAR_OPTIONS)[number]

type SortKey = 'email' | 'age' | 'gender' | 'yearLevel' | 'fieldOfStudy' | 'lastLogDate' | 'lastRiskLevel'
type SortDir = 'asc' | 'desc'

const RISK_ORDER: Record<string, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }

const riskColors: Record<string, string> = {
  Low: 'text-green-600',
  Moderate: 'text-yellow-600',
  High: 'text-orange-600',
  Critical: 'text-red-600',
}

const riskBadgeColors: Record<string, string> = {
  Low: 'bg-green-100 text-green-700 hover:bg-green-200',
  Moderate: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  High: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  Critical: 'bg-red-100 text-red-700 hover:bg-red-200',
}

const PAGE_SIZE = 20

// ── Sort icon helper ──────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 ml-1 opacity-40 inline-block" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-primary inline-block" />
    : <ChevronDown className="w-3.5 h-3.5 ml-1 text-primary inline-block" />
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [allUsers, setAllUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('All')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All')
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>('All')
  const [yearFilter, setYearFilter] = useState<YearFilter>('All')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('email')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [riskFilter, sourceFilter, fieldFilter, yearFilter])

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/users?page=1&pageSize=10000')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setAllUsers(json.users ?? [])
    } catch { setError('Failed to load respondents.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const riskCounts = useMemo(() => {
    const counts: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 }
    for (const u of allUsers) { if (u.lastRiskLevel in counts) counts[u.lastRiskLevel]++ }
    return counts
  }, [allUsers])

  const registeredCount = useMemo(() => allUsers.filter((u) => u.userId).length, [allUsers])
  const surveyCount = useMemo(() => allUsers.filter((u) => !u.userId).length, [allUsers])

  // Normalize year level: treat "5th Year or higher" as "Others" for matching
  const normalizeYear = (y: string | null) => {
    if (!y) return null
    if (y === '5th Year or higher') return 'Others'
    return y
  }

  const filteredUsers = useMemo(() => allUsers.filter((u) => {
    const matchesSearch = !debouncedSearch || u.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesRisk = riskFilter === 'All' || u.lastRiskLevel === riskFilter
    const matchesSource = sourceFilter === 'All' || (sourceFilter === 'Registered' ? !!u.userId : !u.userId)
    const matchesField = fieldFilter === 'All' || u.fieldOfStudy === fieldFilter
    const normalizedYear = normalizeYear(u.yearLevel)
    const matchesYear = yearFilter === 'All' || normalizedYear === yearFilter
    return matchesSearch && matchesRisk && matchesSource && matchesField && matchesYear
  }), [allUsers, debouncedSearch, riskFilter, sourceFilter, fieldFilter, yearFilter])

  // Sort
  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      if (sortKey === 'lastRiskLevel') {
        aVal = RISK_ORDER[a.lastRiskLevel] ?? -1
        bVal = RISK_ORDER[b.lastRiskLevel] ?? -1
      } else if (sortKey === 'age') {
        aVal = a.age ?? -1
        bVal = b.age ?? -1
      } else {
        aVal = (a[sortKey] ?? '').toString().toLowerCase()
        bVal = (b[sortKey] ?? '').toString().toLowerCase()
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredUsers, sortKey, sortDir])

  const handleSort = (col: SortKey) => {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const totalCount = sortedUsers.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageUsers = sortedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleRowClick = (userId: string | null, email: string) => {
    router.push(`/admin/users/${userId ?? encodeURIComponent(email)}`)
  }

  const thClass = (col: SortKey) =>
    `px-4 py-3 text-left font-semibold text-foreground cursor-pointer select-none whitespace-nowrap hover:bg-muted/70 transition-colors ${sortKey === col ? 'text-primary' : ''}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">All registered and active users in the system</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="search" placeholder="Search by email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search respondents by email" className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="risk-filter" className="text-sm text-muted-foreground whitespace-nowrap">Risk Level:</label>
          <select id="risk-filter" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskFilter)} className="py-2 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {RISK_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="field-filter" className="text-sm text-muted-foreground whitespace-nowrap">Field:</label>
          <select id="field-filter" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value as FieldFilter)} className="py-2 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {FIELD_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="year-filter" className="text-sm text-muted-foreground whitespace-nowrap">Year:</label>
          <select id="year-filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value as YearFilter)} className="py-2 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={() => setRiskFilter('All')} className={`px-3 py-1 rounded-full border transition-colors ${riskFilter === 'All' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`} aria-pressed={riskFilter === 'All'}>
            Total: {allUsers.length}
          </button>
          {(['Low', 'Moderate', 'High', 'Critical'] as const).map((level) => (
            <button key={level} onClick={() => setRiskFilter((prev) => prev === level ? 'All' : level)} className={`px-3 py-1 rounded-full border transition-colors font-medium ${riskFilter === level ? 'ring-2 ring-offset-1 ring-current ' + riskBadgeColors[level] : riskBadgeColors[level] + ' border-transparent'}`} aria-pressed={riskFilter === level}>
              {level}: {riskCounts[level]}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Respondents list — click column headers to sort</caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className={thClass('email')} onClick={() => handleSort('email')} aria-sort={sortKey === 'email' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Email <SortIcon col="email" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('age')} onClick={() => handleSort('age')} aria-sort={sortKey === 'age' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Age <SortIcon col="age" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('gender')} onClick={() => handleSort('gender')} aria-sort={sortKey === 'gender' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Gender <SortIcon col="gender" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('yearLevel')} onClick={() => handleSort('yearLevel')} aria-sort={sortKey === 'yearLevel' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Year Level <SortIcon col="yearLevel" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('fieldOfStudy')} onClick={() => handleSort('fieldOfStudy')} aria-sort={sortKey === 'fieldOfStudy' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Field of Study <SortIcon col="fieldOfStudy" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('lastLogDate')} onClick={() => handleSort('lastLogDate')} aria-sort={sortKey === 'lastLogDate' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Last Log <SortIcon col="lastLogDate" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th scope="col" className={thClass('lastRiskLevel')} onClick={() => handleSort('lastRiskLevel')} aria-sort={sortKey === 'lastRiskLevel' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  Risk Level <SortIcon col="lastRiskLevel" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground" aria-busy="true">Loading…</td></tr>
              ) : pageUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No respondents found.</td></tr>
              ) : (
                pageUsers.map((user, idx) => (
                  <tr key={user.userId ?? `${user.email}-${idx}`} onClick={() => handleRowClick(user.userId, user.email)} className="border-t border-border hover:bg-muted/50 cursor-pointer transition-colors" tabIndex={0} role="button" aria-label={`View details for ${user.email}`} onKeyDown={(e) => e.key === 'Enter' && handleRowClick(user.userId, user.email)}>
                    <td className="px-4 py-3 text-foreground">
                      {user.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.age ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.gender ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{normalizeYear(user.yearLevel) ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.fieldOfStudy ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.lastLogDate}</td>
                    <td className={`px-4 py-3 font-medium ${riskColors[user.lastRiskLevel] ?? 'text-foreground'}`}>{user.lastRiskLevel || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {safePage} of {totalPages} ({totalCount} total)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} aria-label="Previous page" className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} aria-label="Next page" className="p-2 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
