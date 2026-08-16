import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { EmptyState, ErrorState, LoadingRows } from './States'
import ShipmentDetail from './ShipmentDetail'
import ShipmentForm from './ShipmentForm'
import {
  PRIORITIES,
  SHIPMENT_STATUSES,
  formatDateTime,
  formatStatus,
  priorityTone,
  statusTone
} from '../lib/domain'

/**
 * Shipments list.
 *
 * Role-scoped by the backend: a CUSTOMER only ever receives their own rows.
 * Supports search, filters, saved filter presets, bulk status updates and a
 * detail view — all against live endpoints.
 */

const EMPTY_FILTERS = {
  search: '',
  status: '',
  priority: '',
  carrier_id: ''
}

export default function Shipments() {
  const { isStaff, isCustomer } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState([])
  const [carriers, setCarriers] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)

  const [presets, setPresets] = useState([])
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState(() => new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const [detailId, setDetailId] = useState(null)
  const [formState, setFormState] = useState(null) // { mode, shipment }

  // ----------------------------------------------------
  // Data loading
  // ----------------------------------------------------

  const buildQuery = useCallback((source) => {
    const params = new URLSearchParams()

    Object.entries(source).forEach(([key, value]) => {
      if (value !== '' && value != null) {
        params.set(key, value)
      }
    })

    const query = params.toString()
    return query ? `?${query}` : ''
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.get(`/shipments${buildQuery(appliedFilters)}`)
      setRows(response.data || [])
      setSelected(new Set())
    } catch (loadError) {
      setError(loadError.message || 'Could not load shipments.')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, buildQuery])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api
      .get('/carriers')
      .then((response) => setCarriers(response.data || []))
      .catch(() => setCarriers([]))

    api
      .get('/filters')
      .then((response) => {
        const list = response.data || []
        setPresets(list)

        // Apply a default preset on first load.
        const preset = list.find((item) => item.is_default)

        if (preset) {
          const merged = { ...EMPTY_FILTERS, ...preset.filter_json }
          setFilters(merged)
          setAppliedFilters(merged)
        }
      })
      .catch(() => setPresets([]))
  }, [])

  // ----------------------------------------------------
  // Filters
  // ----------------------------------------------------

  const updateFilter = (key) => (event) =>
    setFilters((current) => ({ ...current, [key]: event.target.value }))

  const applyFilters = (event) => {
    event?.preventDefault()
    setAppliedFilters(filters)
  }

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
  }

  const hasActiveFilters = useMemo(
    () => Object.values(appliedFilters).some((value) => value !== ''),
    [appliedFilters]
  )

  const savePreset = async () => {
    const name = presetName.trim()

    if (!name) {
      toast.error('Give the preset a name first.')
      return
    }

    setSavingPreset(true)

    try {
      const response = await api.post('/filters', { name, filter: filters })
      setPresets((current) => [...current, response.data])
      setPresetName('')
      toast.success(`Preset "${name}" saved.`)
    } catch (presetError) {
      toast.error(presetError.message || 'Could not save the preset.')
    } finally {
      setSavingPreset(false)
    }
  }

  const applyPreset = (preset) => {
    const merged = { ...EMPTY_FILTERS, ...preset.filter_json }
    setFilters(merged)
    setAppliedFilters(merged)
    toast.info(`Preset "${preset.name}" applied.`)
  }

  const deletePreset = async (preset) => {
    try {
      await api.delete(`/filters/${preset.id}`)
      setPresets((current) => current.filter((item) => item.id !== preset.id))
      toast.success(`Preset "${preset.name}" deleted.`)
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the preset.')
    }
  }

  // ----------------------------------------------------
  // Selection + bulk
  // ----------------------------------------------------

  const toggleRow = (id) =>
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((current) =>
      current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id))
    )

  const runBulkUpdate = async () => {
    if (!bulkStatus || selected.size === 0) return

    setBulkBusy(true)

    try {
      const response = await api.patch('/shipments/bulk-status', {
        shipment_ids: Array.from(selected),
        status: bulkStatus
      })

      const result = response.data || {}

      if (result.failed_count > 0) {
        toast.info(
          `${result.updated_count} updated · ${result.failed_count} rejected by transition rules.`
        )
      } else {
        toast.success(`${result.updated_count} shipment(s) updated.`)
      }

      setBulkStatus('')
      await load()
    } catch (bulkError) {
      toast.error(bulkError.message || 'Bulk update failed.')
    } finally {
      setBulkBusy(false)
    }
  }

  const deleteShipment = async (row) => {
    if (!window.confirm(`Delete shipment ${row.tracking_number}?`)) return

    try {
      await api.delete(`/shipments/${row.id}`)
      toast.success(`${row.tracking_number} deleted.`)
      await load()
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the shipment.')
    }
  }

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Operations
          </div>
          <h1 className="h1-page">Shipments</h1>
          <div className="body-text-secondary" style={{ marginTop: 4 }}>
            {loading ? 'Loading consignments…' : `${rows.length} consignment(s)`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isCustomer && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setFormState({ mode: 'request' })}
            >
              Request Shipment
            </button>
          )}
          {isStaff && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setFormState({ mode: 'create' })}
            >
              New Shipment
            </button>
          )}
        </div>
      </div>

      {/* Filters ------------------------------------------------------- */}
      <form
        onSubmit={applyFilters}
        className="p-4 glass-surface rule rounded-md"
        style={{ marginBottom: 16 }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Filters
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 12
          }}
        >
          <div>
            <label className="field-label" htmlFor="filter-search">Search</label>
            <input
              id="filter-search"
              className="input-control"
              placeholder="Tracking, customer, carrier…"
              value={filters.search}
              onChange={updateFilter('search')}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="input-control"
              value={filters.status}
              onChange={updateFilter('status')}
            >
              <option value="">All statuses</option>
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="filter-priority">Priority</label>
            <select
              id="filter-priority"
              className="input-control"
              value={filters.priority}
              onChange={updateFilter('priority')}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {formatStatus(priority)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="filter-carrier">Carrier</label>
            <select
              id="filter-carrier"
              className="input-control"
              value={filters.carrier_id}
              onChange={updateFilter('carrier_id')}
            >
              <option value="">All carriers</option>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary btn-sm">
            Apply filters
          </button>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm" onClick={resetFilters}>
              Clear
            </button>
          )}

          <span style={{ flex: 1 }} />

          <input
            className="input-control"
            style={{ width: 'auto', minWidth: 150 }}
            placeholder="Preset name…"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            aria-label="Preset name"
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={savePreset}
            disabled={savingPreset}
          >
            {savingPreset ? 'Saving…' : 'Save preset'}
          </button>
        </div>

        {presets.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <span className="eyebrow">Saved</span>
            {presets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  padding: '3px 6px 3px 10px'
                }}
              >
                <button
                  type="button"
                  className="clickable"
                  onClick={() => applyPreset(preset)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#d4d4d8',
                    fontSize: 12
                  }}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(preset)}
                  aria-label={`Delete preset ${preset.name}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#71717a',
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: '0 2px'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </form>

      {/* Bulk bar ------------------------------------------------------ */}
      {isStaff && selected.size > 0 && (
        <div
          className="p-3 glass-surface rule rounded-md"
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <span className="body-text" style={{ fontWeight: 600 }}>
            {selected.size} selected
          </span>

          <select
            className="input-control"
            style={{ width: 'auto', minWidth: 180 }}
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value)}
            aria-label="Bulk status"
          >
            <option value="">Set status to…</option>
            {SHIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={runBulkUpdate}
            disabled={!bulkStatus || bulkBusy}
          >
            {bulkBusy ? 'Updating…' : 'Apply to selected'}
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table --------------------------------------------------------- */}
      <div className="glass-surface rule rounded-md stagger-1" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div className="pill-badge">Shipments</div>
            <span className="eyebrow">{loading ? 'Syncing' : 'Live feed'}</span>
          </div>
          <span className="live-dot cyan blink" aria-hidden />
        </div>

        {loading ? (
          <div style={{ padding: 18 }}>
            <LoadingRows rows={6} />
          </div>
        ) : error ? (
          <div style={{ padding: 18 }}>
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No shipments match those filters' : 'No shipments yet'}
            description={
              hasActiveFilters
                ? 'Try widening or clearing your filters.'
                : isCustomer
                  ? 'Request a shipment to get started.'
                  : 'Create a shipment to get started.'
            }
            action={
              hasActiveFilters ? (
                <button type="button" className="btn btn-sm" onClick={resetFilters}>
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-scroll scroll-area">
            <table className="data-table">
              <thead>
                <tr>
                  {isStaff && (
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={selected.size === rows.length && rows.length > 0}
                        onChange={toggleAll}
                        aria-label="Select all shipments"
                      />
                    </th>
                  )}
                  <th>Tracking #</th>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Expected</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {isStaff && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.tracking_number}`}
                        />
                      </td>
                    )}
                    <td className="cell-mono">{row.tracking_number}</td>
                    <td>{row.customer}</td>
                    <td>{row.carrier}</td>
                    <td className="cell-muted">
                      {row.origin} → {row.destination}
                    </td>
                    <td>
                      <span className={`status-pill ${statusTone(row.status)}`}>
                        {formatStatus(row.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${priorityTone(row.priority)}`}>
                        {formatStatus(row.priority)}
                      </span>
                    </td>
                    <td className="cell-mono cell-muted">
                      {formatDateTime(row.expected_delivery)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setDetailId(row.id)}
                      >
                        View
                      </button>
                      {isStaff && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginLeft: 6 }}
                          onClick={() => setFormState({ mode: 'edit', shipment: row })}
                        >
                          Edit
                        </button>
                      )}
                      {isStaff && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ marginLeft: 6 }}
                          onClick={() => deleteShipment(row)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && (
        <ShipmentDetail
          shipmentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}

      {formState && (
        <ShipmentForm
          mode={formState.mode}
          shipment={formState.shipment}
          carriers={carriers}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null)
            load()
          }}
        />
      )}
    </section>
  )
}
