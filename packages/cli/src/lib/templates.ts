// Template metadata, read straight from the app's template definitions so the
// CLI always lists exactly what the product offers (single source of truth).
import { DASH_TEMPLATES } from '../../../../apps/playground/src/ui/data/dashboards'

export interface TemplateInfo {
  id: string
  name: string
  category: string
  theme: string
}

export const templates: TemplateInfo[] = DASH_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.n,
  category: t.cat,
  theme: t.theme,
}))

export const templateIds = templates.map((t) => t.id)
export const findTemplate = (id: string) => templates.find((t) => t.id === id)
