/**
 * Theme Engine for Structurizr:
 * Loads, caches, and merges external and built-in Structurizr themes.
 */

import { ElementStyle, RelationshipStyle, Workspace } from './ast.js';

export interface ThemeJson {
  name?: string;
  description?: string;
  elements?: Array<{
    tag: string;
    shape?: string;
    icon?: string;
    width?: number;
    height?: number;
    background?: string;
    color?: string;
    colour?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    border?: string;
    opacity?: number;
    metadata?: boolean;
    description?: boolean;
  }>;
  relationships?: Array<{
    tag: string;
    thickness?: number;
    color?: string;
    colour?: string;
    style?: string;
    routing?: string;
    fontSize?: number;
    width?: number;
    dashed?: boolean;
    position?: number;
    opacity?: number;
  }>;
}

// In-memory cache for fetched themes
const themeCache = new Map<string, ThemeJson>();

// Standard theme aliases and built-in offline fallbacks
export const BUILTIN_THEMES: Record<string, ThemeJson> = {
  default: {
    name: 'Default',
    description: 'Default Structurizr Theme',
    elements: [
      { tag: 'Person', shape: 'Person', background: '#08427b', color: '#ffffff' },
      { tag: 'Software System', shape: 'RoundedBox', background: '#1168bd', color: '#ffffff' },
      { tag: 'Container', shape: 'RoundedBox', background: '#438dd5', color: '#ffffff' },
      { tag: 'Component', shape: 'Box', background: '#85bbf0', color: '#000000' }
    ],
    relationships: [
      { tag: 'Relationship', color: '#707070', thickness: 2, routing: 'Direct' }
    ]
  },
  aws: {
    name: 'Amazon Web Services',
    description: 'AWS Icons and Styles',
    elements: [
      { tag: 'Amazon Web Services', background: '#232f3e', color: '#ffffff', shape: 'RoundedBox' },
      { tag: 'AWS Lambda', background: '#d9534f', color: '#ffffff', icon: 'https://static.structurizr.com/themes/amazon-web-services-2020.04.30/aws-lambda.png' },
      { tag: 'Amazon S3', background: '#5cb85c', color: '#ffffff', icon: 'https://static.structurizr.com/themes/amazon-web-services-2020.04.30/amazon-s3.png' },
      { tag: 'Amazon RDS', background: '#337ab7', color: '#ffffff', shape: 'Cylinder' }
    ],
    relationships: [
      { tag: 'HTTPS', color: '#ff9900', style: 'dashed' }
    ]
  },
  azure: {
    name: 'Microsoft Azure',
    description: 'Azure Cloud Theme',
    elements: [
      { tag: 'Microsoft Azure', background: '#0072c6', color: '#ffffff' },
      { tag: 'Azure Function', background: '#008ad7', color: '#ffffff' },
      { tag: 'Azure SQL Database', background: '#0072c6', color: '#ffffff', shape: 'Cylinder' }
    ]
  },
  gcp: {
    name: 'Google Cloud Platform',
    description: 'Google Cloud Theme',
    elements: [
      { tag: 'Google Cloud Platform', background: '#4285f4', color: '#ffffff' },
      { tag: 'Cloud Run', background: '#4285f4', color: '#ffffff' },
      { tag: 'Cloud SQL', background: '#ea4335', color: '#ffffff', shape: 'Cylinder' }
    ]
  },
  kubernetes: {
    name: 'Kubernetes',
    description: 'Kubernetes Theme',
    elements: [
      { tag: 'Kubernetes', background: '#326ce5', color: '#ffffff' },
      { tag: 'Pod', background: '#326ce5', color: '#ffffff', shape: 'RoundedBox' },
      { tag: 'Service', background: '#326ce5', color: '#ffffff' }
    ]
  }
};

// Aliases mapping to canonical themes
export const THEME_ALIASES: Record<string, string> = {
  'amazon-web-services': 'aws',
  'amazonwebservices': 'aws',
  'microsoft-azure': 'azure',
  'microsoftazure': 'azure',
  'google-cloud-platform': 'gcp',
  'googlecloudplatform': 'gcp',
  'k8s': 'kubernetes'
};

/**
 * Normalizes a theme reference (URL, name, alias)
 */
export function normalizeThemeRef(ref: string): string {
  const trimmed = ref.trim();
  const lower = trimmed.toLowerCase();

  if (THEME_ALIASES[lower]) {
    return THEME_ALIASES[lower];
  }

  // Check URL patterns for known themes
  if (lower.includes('amazon-web-services')) return 'aws';
  if (lower.includes('microsoft-azure')) return 'azure';
  if (lower.includes('google-cloud-platform')) return 'gcp';
  if (lower.includes('kubernetes')) return 'kubernetes';
  if (lower.endsWith('/default/theme.json') || lower === 'default') return 'default';

  return trimmed;
}

/**
 * Fetches or retrieves a theme definition by reference
 */
export async function fetchTheme(ref: string): Promise<ThemeJson | null> {
  const key = normalizeThemeRef(ref);

  if (themeCache.has(key)) {
    return themeCache.get(key)!;
  }

  if (BUILTIN_THEMES[key]) {
    themeCache.set(key, BUILTIN_THEMES[key]);
    return BUILTIN_THEMES[key];
  }

  // If it's a URL, attempt fetch with timeout
  if (ref.startsWith('http://') || ref.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(ref, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = (await res.json()) as ThemeJson;
        themeCache.set(ref, json);
        themeCache.set(key, json);
        return json;
      }
    } catch {
      // Fall back to built-in if URL matches any known alias
      if (BUILTIN_THEMES[key]) {
        return BUILTIN_THEMES[key];
      }
    }
  }

  return null;
}

/**
 * Merges theme element styles and relationship styles into workspace styles.
 * User-defined styles have precedence over theme styles.
 * Later themes in the list take precedence over earlier themes.
 */
export function applyThemeData(
  existingElementStyles: ElementStyle[],
  existingRelationshipStyles: RelationshipStyle[],
  themes: ThemeJson[]
): { elementStyles: ElementStyle[]; relationshipStyles: RelationshipStyle[] } {
  const elemMap = new Map<string, ElementStyle>();
  const relMap = new Map<string, RelationshipStyle>();

  // 1. Process themes in order (later theme overrides earlier theme)
  for (const th of themes) {
    for (const te of th.elements || []) {
      const tagKey = te.tag.toLowerCase();
      elemMap.set(tagKey, {
        tag: te.tag,
        shape: te.shape ?? elemMap.get(tagKey)?.shape ?? null,
        icon: te.icon ?? elemMap.get(tagKey)?.icon ?? null,
        width: te.width ?? elemMap.get(tagKey)?.width ?? null,
        height: te.height ?? elemMap.get(tagKey)?.height ?? null,
        background: te.background ?? elemMap.get(tagKey)?.background ?? null,
        color: (te.color || te.colour) ?? elemMap.get(tagKey)?.color ?? null,
        stroke: te.stroke ?? elemMap.get(tagKey)?.stroke ?? null,
        strokeWidth: te.strokeWidth ?? elemMap.get(tagKey)?.strokeWidth ?? null,
        fontSize: te.fontSize ?? elemMap.get(tagKey)?.fontSize ?? null,
        border: te.border ?? elemMap.get(tagKey)?.border ?? null,
        opacity: te.opacity ?? elemMap.get(tagKey)?.opacity ?? null,
        metadata: te.metadata ?? elemMap.get(tagKey)?.metadata ?? null,
        description: te.description ?? elemMap.get(tagKey)?.description ?? null
      });
    }

    for (const tr of th.relationships || []) {
      const tagKey = tr.tag.toLowerCase();
      relMap.set(tagKey, {
        tag: tr.tag,
        thickness: tr.thickness ?? relMap.get(tagKey)?.thickness ?? null,
        color: (tr.color || tr.colour) ?? relMap.get(tagKey)?.color ?? null,
        style: tr.style ?? relMap.get(tagKey)?.style ?? null,
        routing: tr.routing ?? relMap.get(tagKey)?.routing ?? null,
        fontSize: tr.fontSize ?? relMap.get(tagKey)?.fontSize ?? null,
        width: tr.width ?? relMap.get(tagKey)?.width ?? null,
        dashed: tr.dashed ?? (tr.style === 'dashed' ? true : relMap.get(tagKey)?.dashed ?? null),
        position: tr.position ?? relMap.get(tagKey)?.position ?? null,
        opacity: tr.opacity ?? relMap.get(tagKey)?.opacity ?? null
      });
    }
  }

  // 2. User-defined explicit styles override theme styles
  for (const ue of existingElementStyles) {
    const tagKey = ue.tag.toLowerCase();
    const existing = elemMap.get(tagKey);
    elemMap.set(tagKey, {
      tag: ue.tag,
      shape: ue.shape ?? existing?.shape ?? null,
      icon: ue.icon ?? existing?.icon ?? null,
      width: ue.width ?? existing?.width ?? null,
      height: ue.height ?? existing?.height ?? null,
      background: ue.background ?? existing?.background ?? null,
      color: ue.color ?? existing?.color ?? null,
      stroke: ue.stroke ?? existing?.stroke ?? null,
      strokeWidth: ue.strokeWidth ?? existing?.strokeWidth ?? null,
      fontSize: ue.fontSize ?? existing?.fontSize ?? null,
      border: ue.border ?? existing?.border ?? null,
      opacity: ue.opacity ?? existing?.opacity ?? null,
      metadata: ue.metadata ?? existing?.metadata ?? null,
      description: ue.description ?? existing?.description ?? null,
      mode: ue.mode ?? existing?.mode ?? null
    });
  }

  for (const ur of existingRelationshipStyles) {
    const tagKey = ur.tag.toLowerCase();
    const existing = relMap.get(tagKey);
    relMap.set(tagKey, {
      tag: ur.tag,
      thickness: ur.thickness ?? existing?.thickness ?? null,
      color: ur.color ?? existing?.color ?? null,
      style: ur.style ?? existing?.style ?? null,
      routing: ur.routing ?? existing?.routing ?? null,
      fontSize: ur.fontSize ?? existing?.fontSize ?? null,
      width: ur.width ?? existing?.width ?? null,
      dashed: ur.dashed ?? existing?.dashed ?? null,
      position: ur.position ?? existing?.position ?? null,
      opacity: ur.opacity ?? existing?.opacity ?? null,
      mode: ur.mode ?? existing?.mode ?? null
    });
  }

  return {
    elementStyles: Array.from(elemMap.values()),
    relationshipStyles: Array.from(relMap.values())
  };
}

/**
 * Synchronous theme resolver using cached & built-in themes.
 */
export function resolveThemesSync(ws: Workspace): Workspace {
  if (!ws.themes || ws.themes.length === 0) {
    return ws;
  }

  const loadedThemes: ThemeJson[] = [];
  for (const t of ws.themes) {
    const key = normalizeThemeRef(t);
    const theme = themeCache.get(key) || BUILTIN_THEMES[key];
    if (theme) {
      loadedThemes.push(theme);
    }
  }

  if (loadedThemes.length === 0) {
    return ws;
  }

  const merged = applyThemeData(ws.elementStyles, ws.relationshipStyles, loadedThemes);
  ws.elementStyles = merged.elementStyles;
  ws.relationshipStyles = merged.relationshipStyles;
  return ws;
}

/**
 * Asynchronous theme resolver that fetches external theme JSON and merges styles.
 */
export async function resolveThemes(ws: Workspace): Promise<Workspace> {
  if (!ws.themes || ws.themes.length === 0) {
    return ws;
  }

  const loadedThemes: ThemeJson[] = [];
  for (const t of ws.themes) {
    const theme = await fetchTheme(t);
    if (theme) {
      loadedThemes.push(theme);
    }
  }

  if (loadedThemes.length === 0) {
    return ws;
  }

  const merged = applyThemeData(ws.elementStyles, ws.relationshipStyles, loadedThemes);
  ws.elementStyles = merged.elementStyles;
  ws.relationshipStyles = merged.relationshipStyles;
  return ws;
}
