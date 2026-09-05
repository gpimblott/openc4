/**
 * Core AST models for Structurizr DSL and C4 Architecture Models.
 */

export interface ElementStyle {
  tag: string;
  shape?: string | null;
  background?: string | null;
  color?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  fontSize?: number | null;
  border?: string | null;
  opacity?: number | null;
  metadata?: boolean | null;
  description?: boolean | null;
}

export interface RelationshipStyle {
  tag: string;
  thickness?: number | null;
  color?: string | null;
  style?: string | null;
  routing?: string | null;
  fontSize?: number | null;
  width?: number | null;
  dashed?: boolean | null;
  position?: number | null;
  opacity?: number | null;
}

export interface Relationship {
  id: string;
  sourceId: string;
  destinationId: string;
  sourceIdentifier?: string;
  destinationIdentifier?: string;
  description: string;
  technology: string;
  interactionStyle: string;
  tags: string[];
  properties: Record<string, string>;
  url?: string | null;
  lineRange?: { startLine: number; endLine: number };
}

export interface BaseElement {
  id: string;
  identifier: string;
  name: string;
  description: string;
  tags: string[];
  properties: Record<string, string>;
  url?: string | null;
  lineRange?: { startLine: number; endLine: number };
}

export interface Person extends BaseElement {
  location: string; // Internal, External, Unspecified
}

export interface Component extends BaseElement {
  containerId: string;
  technology: string;
}

export interface Container extends BaseElement {
  systemId: string;
  technology: string;
  components: Component[];
}

export interface SoftwareSystem extends BaseElement {
  location: string;
  containers: Container[];
}

export interface DeploymentNode extends BaseElement {
  technology: string;
  environment: string;
  instances: number;
  children: DeploymentNode[];
  containerInstances: string[];
}

export interface View {
  key: string;
  viewType: string; // systemLandscape, systemContext, container, component, dynamic, deployment
  title: string;
  description: string;
  softwareSystemId?: string | null;
  containerId?: string | null;
  environment?: string | null;
  includeAll: boolean;
  includedElementIds: string[];
  excludedElementIds: string[];
  autoLayout?: string | null; // "tb", "lr", "bt", "rl", or null
  properties: Record<string, string>;
  // Visual layout coordinates saved from UI: element_id -> {x, y}
  layoutCoordinates: Record<string, { x: number; y: number }>;
  lineRange?: { startLine: number; endLine: number };
}

export interface Model {
  people: Person[];
  softwareSystems: SoftwareSystem[];
  deploymentNodes: DeploymentNode[];
  relationships: Relationship[];
}

export interface Workspace {
  id: number;
  name: string;
  description: string;
  version?: string | null;
  model: Model;
  views: View[];
  elementStyles: ElementStyle[];
  relationshipStyles: RelationshipStyle[];
  themes: string[];
  properties: Record<string, string>;
  dslSource: string;
}
