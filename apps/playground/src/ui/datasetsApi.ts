// Server persistence for imported datasets (self-hosted path). Only used when a
// real session exists; the demo keeps datasets in localStorage. Mirrors the
// dashboards API shape.
import type { ImportedDataset } from './dataImport'

export const datasetsApi = {
  list: () => fetch('/api/datasets', { credentials: 'include' }),
  create: (ds: ImportedDataset) =>
    fetch('/api/datasets', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ds.id, name: ds.name, source: ds.source, data: ds }),
    }),
  remove: (id: string) =>
    fetch(`/api/datasets/${id}`, { method: 'DELETE', credentials: 'include' }),
}
