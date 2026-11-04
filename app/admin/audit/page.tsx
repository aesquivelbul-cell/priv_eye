'use client'

import { useEffect, useState } from 'react'

interface AuditEvent {
  id: string
  target_user_id: string | null
  target_email: string | null
  event_type: string
  description: string
  event_data: Record<string, unknown> | null
  actor_id: string | null
  actor_email: string | null
  created_at: string
}

const EVENT_TYPES = [
  'All',
  'profile_update',
  'password_reset_request',
  'temporary_password_generated',
  'log_hidden',
  'log_unhidden',
  'log_deleted',
  'user_deleted',
  'survey_import',
  'admin_user_update',
]

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('All')
  const [limit, setLimit] = useState(100)

  const fetchAuditEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (search.trim()) params.set('search', search.trim())
      if (eventType !== 'All') params.set('eventType', eventType)

      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load audit history')
      }
      setEvents(json.events || [])
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else if (typeof err === 'string') {
        setError(err)
      } else {
        setError(JSON.stringify(err))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditEvents()
  }, [search, eventType, limit])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit History</h1>
        <p className="text-muted-foreground mt-1">Track changes, admin actions, and important user events.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="audit-search" className="text-sm font-medium text-muted-foreground">Search</label>
            <input
              id="audit-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, actor, or description"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="event-type" className="text-sm font-medium text-muted-foreground">Event type</label>
            <select
              id="event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-2 sm:justify-end">
          <label htmlFor="limit" className="text-sm font-medium text-muted-foreground">Rows</label>
          <select
            id="limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {[25, 50, 100, 200].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p aria-busy="true" className="text-muted-foreground">Loading audit history…</p>
      ) : error ? (
        <p role="alert" className="text-destructive">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">No audit events found.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Audit history table</caption>
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Event</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Actor</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{event.event_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.target_user_id ? (
                        <a href={`/admin/users/${event.target_user_id}`} className="text-primary hover:underline">
                          {(() => {
                            const before = event.event_data?.before as Record<string, unknown> | undefined
                            const name = [before?.first_name, before?.last_name].filter(Boolean).join(' ')
                            return name || event.target_user_id
                          })()}
                        </a>
                      ) : event.target_email ? (
                        <a href={`/admin/users/${encodeURIComponent(event.target_email)}`} className="text-primary hover:underline">
                          {event.target_email}
                        </a>
                      ) : (
                        'System'
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{event.actor_email || 'Unknown'}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xl break-words">
                      {(() => {
                        const fieldLabels: Record<string, string> = {
                          first_name: 'First Name',
                          last_name: 'Last Name',
                          age: 'Age',
                          gender: 'Gender',
                          year_level: 'Year Level',
                          field_of_study: 'Field of Study',
                        }
                        const changedFields = event.event_data?.changedFields
                        const before = event.event_data?.before as Record<string, unknown> | undefined
                        const after = event.event_data?.after as Record<string, unknown> | undefined

                        if (Array.isArray(changedFields) && changedFields.length > 0 && before !== undefined && after !== undefined) {
                          return (
                            <div className="space-y-1">
                              {changedFields.map((field: string) => {
                                const label = fieldLabels[field] ?? field.replace(/_/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase())
                                const beforeVal = before?.[field]
                                const afterVal = after?.[field]
                                return (
                                  <div key={field} className="text-sm">
                                    <span className="font-medium text-foreground">{label}:</span>{' '}
                                    <span className="line-through text-muted-foreground">{beforeVal != null && beforeVal !== '' ? String(beforeVal) : '—'}</span>
                                    {' → '}
                                    <span className="text-foreground">{afterVal != null && afterVal !== '' ? String(afterVal) : '—'}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        }

                        return <div>{event.description}</div>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
