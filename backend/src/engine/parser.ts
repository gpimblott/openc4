/**
 * Structurizr DSL Lexer and Parser in TypeScript.
 * Parses standard Structurizr DSL into the AST model.
 */

import {
  Workspace,
  Model,
  Person,
  SoftwareSystem,
  Container,
  Component,
  DeploymentNode,
  InfrastructureNode,
  ContainerInstance,
  SoftwareSystemInstance,
  HealthCheck,
  Relationship,
  View,
  DynamicStep,
  ElementStyle,
  RelationshipStyle,
  Perspective,
  Terminology,
  Archetypes,
  ElementArchetype,
  RelationshipArchetype,
  ArchetypeBaseType,
  CustomElement
} from './ast.js';

export class ParseError extends Error {
  line: number;
  column: number;

  constructor(message: string, line: number, column: number = 1) {
    super(`Line ${line}, Col ${column}: ${message}`);
    this.name = 'ParseError';
    this.message = message;
    this.line = line;
    this.column = column;
  }

  toJSON() {
    return {
      message: this.message,
      line: this.line,
      column: this.column
    };
  }

  toDict() {
    return this.toJSON();
  }
}

export interface Token {
  type: 'IDENTIFIER' | 'STRING' | 'ARROW' | 'ARCHETYPE_ARROW' | 'REMOVE_ARROW' | 'LBRACE' | 'RBRACE' | 'EQUALS' | 'EOF';
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private text: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private length: number;

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
  }

  private peek(offset: number = 0): string | null {
    const idx = this.pos + offset;
    if (idx < this.length) {
      return this.text[idx];
    }
    return null;
  }

  private advance(): string | null {
    if (this.pos < this.length) {
      const ch = this.text[this.pos];
      this.pos += 1;
      if (ch === '\n') {
        this.line += 1;
        this.col = 1;
      } else {
        this.col += 1;
      }
      return ch;
    }
    return null;
  }

  private isArchetypeArrowAhead(): boolean {
    if (this.peek() !== '-' || this.peek(1) !== '-') return false;
    let offset = 2;
    while (this.pos + offset < this.length) {
      const c = this.peek(offset);
      if (c === '-' && this.peek(offset + 1) === '>') {
        return offset > 2; // must have at least one character in archetype name
      }
      if (c && /[a-zA-Z0-9_\-]/.test(c)) {
        offset++;
      } else {
        return false;
      }
    }
    return false;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      const ch = this.peek();
      if (!ch) break;

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\n') {
        this.advance();
        continue;
      }

      // Single line comment // or # (unless # is part of a hex color code like #85bbf0)
      const nextChar = this.peek(1);
      const isHexColor = ch === '#' && nextChar !== null && /^[0-9a-fA-F]/.test(nextChar);
      if (!isHexColor && (ch === '#' || (ch === '/' && nextChar === '/'))) {
        while (this.pos < this.length && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }

      // Multi-line comment /* ... */
      if (ch === '/' && this.peek(1) === '*') {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // /
        this.advance(); // *
        let closed = false;
        while (this.pos < this.length) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance(); // *
            this.advance(); // /
            closed = true;
            break;
          }
          this.advance();
        }
        if (!closed) {
          throw new ParseError('Unterminated multi-line comment', startLine, startCol);
        }
        continue;
      }

      // Punctuation & Operators
      if (ch === '{') {
        tokens.push({ type: 'LBRACE', value: '{', line: this.line, column: this.col });
        this.advance();
        continue;
      }
      if (ch === '}') {
        tokens.push({ type: 'RBRACE', value: '}', line: this.line, column: this.col });
        this.advance();
        continue;
      }
      if (ch === '=') {
        tokens.push({ type: 'EQUALS', value: '=', line: this.line, column: this.col });
        this.advance();
        continue;
      }
      if (ch === '-' && this.peek(1) === '/' && this.peek(2) === '>') {
        tokens.push({ type: 'REMOVE_ARROW', value: '-/>', line: this.line, column: this.col });
        this.advance();
        this.advance();
        this.advance();
        continue;
      }
      if (this.isArchetypeArrowAhead()) {
        const startLine = this.line;
        const startCol = this.col;
        const chars: string[] = [];
        chars.push(this.advance()!); // -
        chars.push(this.advance()!); // -
        while (this.pos < this.length) {
          if (this.peek() === '-' && this.peek(1) === '>') {
            chars.push(this.advance()!); // -
            chars.push(this.advance()!); // >
            break;
          }
          chars.push(this.advance()!);
        }
        tokens.push({ type: 'ARCHETYPE_ARROW', value: chars.join(''), line: startLine, column: startCol });
        continue;
      }
      if (ch === '-' && this.peek(1) === '>') {
        tokens.push({ type: 'ARROW', value: '->', line: this.line, column: this.col });
        this.advance();
        this.advance();
        continue;
      }

      // Strings: "..." or '...'
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // consume opening quote
        const val: string[] = [];
        while (this.pos < this.length && this.peek() !== quote) {
          const curr = this.peek();
          if (curr === '\\') {
            this.advance();
            const escaped = this.peek();
            if (escaped === 'n') val.push('\n');
            else if (escaped === 't') val.push('\t');
            else if (escaped === '"') val.push('"');
            else if (escaped === "'") val.push("'");
            else if (escaped === '\\') val.push('\\');
            else val.push(escaped || '');
            this.advance();
          } else {
            val.push(curr!);
            this.advance();
          }
        }
        if (this.pos >= this.length || this.peek() !== quote) {
          throw new ParseError(`Unterminated string starting at line ${startLine}`, startLine, startCol);
        }
        this.advance(); // consume closing quote
        tokens.push({ type: 'STRING', value: val.join(''), line: startLine, column: startCol });
        continue;
      }

      // Identifiers or unquoted words
      if (this.isIdentifierChar(ch)) {
        const startLine = this.line;
        const startCol = this.col;
        const word: string[] = [];
        while (this.pos < this.length) {
          const c = this.peek();
          if (c && this.isIdentifierChar(c)) {
            // Do not consume '-' if it forms an arrow operator '->', '-/>', or '--name->'
            if (
              c === '-' &&
              (this.peek(1) === '>' ||
                (this.peek(1) === '/' && this.peek(2) === '>') ||
                this.isArchetypeArrowAhead())
            ) {
              break;
            }
            word.push(c);
            this.advance();
          } else {
            break;
          }
        }
        tokens.push({ type: 'IDENTIFIER', value: word.join(''), line: startLine, column: startCol });
        continue;
      }

      if (ch === '>') {
        tokens.push({ type: 'IDENTIFIER', value: '>', line: this.line, column: this.col });
        this.advance();
        continue;
      }

      // Unknown character
      const unknown = this.advance();
      throw new ParseError(`Unexpected character '${unknown}'`, this.line, this.col - 1);
    }

    tokens.push({ type: 'EOF', value: '', line: this.line, column: this.col });
    return tokens;
  }

  private isIdentifierChar(ch: string): boolean {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '_' ||
      ch === '-' ||
      ch === '.' ||
      ch === '*' ||
      ch === '#' ||
      ch === '/' ||
      ch === '@' ||
      ch === ':' ||
      ch === '!'
    );
  }
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private sourceText: string;
  workspace: Workspace;
  private nextId: number = 1;
  identifierToId: Map<string, string> = new Map();
  idToElement: Map<string, any> = new Map();
  identifiersMode: 'flat' | 'hierarchical' = 'flat';
  private currentGroup: string | null = null;
  archetypes: Archetypes = { elements: {}, relationships: {} };

  constructor(tokens: Token[], sourceText: string = '') {
    this.tokens = tokens;
    this.sourceText = sourceText;
    this.workspace = {
      id: 1,
      name: 'Architecture Workspace',
      description: '',
      version: '1.0.0',
      archetypes: this.archetypes,
      model: {
        people: [],
        softwareSystems: [],
        deploymentNodes: [],
        relationships: [],
        customElements: [],
        archetypes: this.archetypes
      },
      views: [],
      elementStyles: [],
      relationshipStyles: [],
      themes: [],
      properties: {},
      dslSource: sourceText
    };
  }

  private getId(): string {
    const eid = String(this.nextId);
    this.nextId += 1;
    return eid;
  }

  private current(): Token {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : this.tokens[this.tokens.length - 1];
  }

  private peekNext(): Token {
    if (this.pos + 1 < this.tokens.length) {
      return this.tokens[this.pos + 1];
    }
    return this.tokens[this.tokens.length - 1];
  }

  private match(tokenType: string, value?: string): boolean {
    const curr = this.current();
    if (curr.type === tokenType) {
      if (value === undefined || curr.value.toLowerCase() === value.toLowerCase()) {
        this.pos += 1;
        return true;
      }
    }
    return false;
  }

  private expect(tokenType: string, value?: string): Token {
    const curr = this.current();
    if (curr.type === tokenType) {
      if (value === undefined || curr.value.toLowerCase() === value.toLowerCase()) {
        this.pos += 1;
        return curr;
      }
    }
    const expected = value ? `'${value}'` : tokenType;
    throw new ParseError(`Expected ${expected}, got '${curr.value}' (${curr.type})`, curr.line, curr.column);
  }

  parse(): Workspace {
    while (this.current().type === 'IDENTIFIER' && this.current().value.toLowerCase() === '!identifiers') {
      this.pos += 1;
      const arg = this.expectStringOrIdentifier().toLowerCase();
      if (arg === 'hierarchical') this.identifiersMode = 'hierarchical';
      else if (arg === 'flat') this.identifiersMode = 'flat';
    }

    if (this.match('IDENTIFIER', 'workspace')) {
      const args = this.parseStringArgs();
      if (args.length > 0) this.workspace.name = args[0];
      if (args.length > 1) this.workspace.description = args[1];

      this.expect('LBRACE');
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseWorkspaceBody();
      }
    } else {
      while (!this.match('EOF')) {
        this.parseWorkspaceBody();
      }
    }
    return this.workspace;
  }

  private addTags(targetList: string[], args: string[]) {
    for (const raw of args) {
      for (const t of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!targetList.includes(t)) targetList.push(t);
      }
    }
  }

  private parseStringArgs(sameLineOnly: boolean = true, targetLine?: number): string[] {
    const args: string[] = [];
    const prevTok = this.tokens[Math.max(0, this.pos - 1)];
    const startLine = targetLine ?? (prevTok ? prevTok.line : this.current().line);
    while (
      (this.current().type === 'STRING' || this.current().type === 'IDENTIFIER') &&
      this.current().type !== 'ARCHETYPE_ARROW' &&
      !['{', '}', '=', '->', '-/>'].includes(this.current().value)
    ) {
      const curr = this.current();
      if (sameLineOnly && curr.line !== startLine) {
        break;
      }
      if (curr.type === 'IDENTIFIER' && ['ARROW', 'ARCHETYPE_ARROW', 'REMOVE_ARROW', 'EQUALS'].includes(this.peekNext().type)) {
        break;
      }
      args.push(curr.value);
      this.pos += 1;
    }
    return args;
  }

  private parsePropertiesBody(target: Record<string, string>) {
    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        if (curr.type === 'STRING' || curr.type === 'IDENTIFIER') {
          const key = this.expectStringOrIdentifier();
          if (this.current().type === 'STRING' || this.current().type === 'IDENTIFIER') {
            const val = this.expectStringOrIdentifier();
            target[key] = val;
          } else {
            target[key] = '';
          }
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parsePerspectivesBody(target: Perspective[]) {
    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        if (curr.type === 'IDENTIFIER' && curr.value.toLowerCase() === 'perspective') {
          this.pos += 1;
          const name = this.expectStringOrIdentifier();
          const p: Perspective = { name, description: '' };
          if (this.match('LBRACE')) {
            while (!this.match('RBRACE') && !this.match('EOF')) {
              const field = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
              this.pos += 1;
              const val = this.expectStringOrIdentifier();
              if (field === 'description') p.description = val;
              else if (field === 'value') p.value = val;
              else if (field === 'url') p.url = val;
            }
          }
          target.push(p);
        } else if (curr.type === 'STRING' || curr.type === 'IDENTIFIER') {
          const name = this.expectStringOrIdentifier();
          const desc = this.expectStringOrIdentifier();
          let value: string | undefined;
          if (
            (this.current().type === 'STRING' || this.current().type === 'IDENTIFIER') &&
            this.current().line === curr.line
          ) {
            value = this.expectStringOrIdentifier();
          }
          target.push({ name, description: desc, value });
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseTerminologyBody(target: Terminology) {
    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        if (curr.type === 'IDENTIFIER') {
          const key = curr.value.toLowerCase();
          this.pos += 1;
          const term = this.expectStringOrIdentifier();
          if (key === 'person') target.person = term;
          else if (key === 'softwaresystem' || key === 'software_system') target.softwareSystem = term;
          else if (key === 'container') target.container = term;
          else if (key === 'component') target.component = term;
          else if (key === 'deploymentnode' || key === 'deployment_node') target.deploymentNode = term;
          else if (key === 'infrastructurenode' || key === 'infrastructure_node') target.infrastructureNode = term;
          else if (key === 'relationship') target.relationship = term;
          else if (key === 'metadata') target.metadata = term;
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseWorkspaceBody() {
    const curr = this.current();
    if (curr.type === 'IDENTIFIER') {
      const val = curr.value.toLowerCase();
      if (val === 'model') {
        const startLine = curr.line;
        this.pos += 1;
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseModelBody();
        }
        const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? startLine;
        this.workspace.model.lineRange = { startLine, endLine };
        return;
      } else if (val === 'views') {
        this.pos += 1;
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseViewsBody();
        }
        return;
      } else if (val === 'name') {
        this.pos += 1;
        this.workspace.name = this.expect('STRING').value;
        return;
      } else if (val === 'description') {
        this.pos += 1;
        this.workspace.description = this.expect('STRING').value;
        return;
      } else if (val === 'version') {
        this.pos += 1;
        const tok = this.current();
        if (tok.type === 'STRING' || tok.type === 'IDENTIFIER') {
          this.workspace.version = tok.value;
          this.pos += 1;
        }
        return;
      } else if (val === 'properties') {
        this.pos += 1;
        this.parsePropertiesBody(this.workspace.properties);
        return;
      } else if (val === 'theme' || val === 'themes') {
        this.pos += 1;
        const args = this.parseStringArgs();
        this.workspace.themes.push(...args);
        return;
      } else if (val === '!identifiers') {
        this.pos += 1;
        const arg = this.expectStringOrIdentifier().toLowerCase();
        if (arg === 'hierarchical') {
          this.identifiersMode = 'hierarchical';
        } else if (arg === 'flat') {
          this.identifiersMode = 'flat';
        }
        return;
      } else if (val === '!impliedrelationships' || val === 'impliedrelationships') {
        this.pos += 1;
        const arg = this.expectStringOrIdentifier();
        const low = arg.toLowerCase();
        const mode = low === 'false' ? false : low === 'true' ? true : arg;
        this.workspace.impliedRelationships = mode;
        this.workspace.model.impliedRelationships = mode;
        return;
      } else if (val === 'terminology') {
        this.pos += 1;
        if (!this.workspace.terminology) this.workspace.terminology = {};
        this.parseTerminologyBody(this.workspace.terminology);
        return;
      } else if (val === 'configuration') {
        this.pos += 1;
        if (this.match('LBRACE')) {
          while (!this.match('RBRACE') && !this.match('EOF')) {
            const cCurr = this.current();
            const cKw = cCurr.type === 'IDENTIFIER' ? cCurr.value.toLowerCase() : '';
            if (cKw === '!impliedrelationships' || cKw === 'impliedrelationships') {
              this.pos += 1;
              const arg = this.expectStringOrIdentifier();
              const low = arg.toLowerCase();
              const mode = low === 'false' ? false : low === 'true' ? true : arg;
              this.workspace.impliedRelationships = mode;
              this.workspace.model.impliedRelationships = mode;
            } else if (cKw === 'terminology') {
              this.pos += 1;
              if (!this.workspace.terminology) this.workspace.terminology = {};
              this.parseTerminologyBody(this.workspace.terminology);
            } else {
              this.pos += 1;
            }
          }
        }
        return;
      } else if (val === 'archetypes') {
        this.pos += 1;
        this.parseArchetypesBody();
        return;
      } else if (val.startsWith('!')) {
        this.pos += 1;
        while (this.pos < this.tokens.length && this.current().line === curr.line && this.current().type !== 'EOF') {
          this.pos += 1;
        }
        return;
      }
    }
    this.pos += 1;
  }

  getElementArchetype(name: string): ElementArchetype | undefined {
    if (!name) return undefined;
    if (this.archetypes.elements[name]) return this.archetypes.elements[name];
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(this.archetypes.elements)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }

  getRelationshipArchetype(name: string): RelationshipArchetype | undefined {
    if (!name) return undefined;
    if (this.archetypes.relationships[name]) return this.archetypes.relationships[name];
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(this.archetypes.relationships)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }

  private parseArchetypesBody() {
    this.expect('LBRACE');
    while (!this.match('RBRACE') && !this.match('EOF')) {
      const curr = this.current();
      if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
        const name = curr.value;
        this.pos += 2; // consume name and '='
        this.parseArchetypeDefinition(name);
      } else {
        this.pos += 1;
      }
    }
  }

  private parseArchetypeDefinition(name: string) {
    const curr = this.current();

    // Case 1: Relationship archetype sync = -> [ { ... } ]
    if (curr.type === 'ARROW') {
      this.pos += 1; // consume '->'
      const relArchetype: RelationshipArchetype = {
        name,
        baseType: '->',
        tags: [],
        properties: {},
        perspectives: []
      };

      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseRelationshipArchetypeProperty(relArchetype);
        }
      }

      this.archetypes.relationships[name] = relArchetype;
      return;
    }

    // Case 2: Extended relationship archetype https = --sync-> [ { ... } ]
    if (curr.type === 'ARCHETYPE_ARROW') {
      const baseName = curr.value.slice(2, -2);
      this.pos += 1; // consume '--sync->'
      const parentRelArchetype = this.getRelationshipArchetype(baseName);
      if (!parentRelArchetype) {
        throw new ParseError(`Unknown relationship archetype base '${baseName}'`, curr.line, curr.column);
      }

      const relArchetype: RelationshipArchetype = {
        name,
        baseType: baseName,
        description: parentRelArchetype.description,
        technology: parentRelArchetype.technology,
        tags: [...(parentRelArchetype.tags || [])],
        properties: { ...(parentRelArchetype.properties || {}) },
        perspectives: parentRelArchetype.perspectives ? JSON.parse(JSON.stringify(parentRelArchetype.perspectives)) : []
      };

      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseRelationshipArchetypeProperty(relArchetype);
        }
      }

      this.archetypes.relationships[name] = relArchetype;
      return;
    }

    // Case 3: Element archetype application = container [ { ... } ] or springBootApplication = application [ { ... } ]
    if (curr.type === 'IDENTIFIER') {
      const baseName = curr.value;
      this.pos += 1; // consume baseName

      let resolvedBaseType: ArchetypeBaseType;
      let inheritedDesc: string | undefined;
      let inheritedTech: string | undefined;
      let inheritedTags: string[] = [];
      let inheritedProps: Record<string, string> = {};
      let inheritedPersp: Perspective[] = [];
      let inheritedMeta: string | undefined;

      const normalizedBase = baseName.toLowerCase();
      const parentElemArchetype = this.getElementArchetype(baseName);

      if (parentElemArchetype) {
        resolvedBaseType = parentElemArchetype.resolvedBaseType;
        inheritedDesc = parentElemArchetype.description;
        inheritedTech = parentElemArchetype.technology;
        inheritedTags = [...(parentElemArchetype.tags || [])];
        inheritedProps = { ...(parentElemArchetype.properties || {}) };
        inheritedPersp = parentElemArchetype.perspectives ? JSON.parse(JSON.stringify(parentElemArchetype.perspectives)) : [];
        inheritedMeta = parentElemArchetype.metadata;
      } else if (
        [
          'person',
          'softwaresystem',
          'system',
          'container',
          'component',
          'deploymentnode',
          'infrastructurenode',
          'group',
          'element'
        ].includes(normalizedBase)
      ) {
        if (normalizedBase === 'system' || normalizedBase === 'softwaresystem') {
          resolvedBaseType = 'softwareSystem';
        } else if (normalizedBase === 'deploymentnode') {
          resolvedBaseType = 'deploymentNode';
        } else if (normalizedBase === 'infrastructurenode') {
          resolvedBaseType = 'infrastructureNode';
        } else {
          resolvedBaseType = normalizedBase as ArchetypeBaseType;
        }
      } else {
        throw new ParseError(`Unknown archetype base type '${baseName}'`, curr.line, curr.column);
      }

      const elemArchetype: ElementArchetype = {
        name,
        baseType: baseName,
        resolvedBaseType,
        description: inheritedDesc,
        technology: inheritedTech,
        tags: inheritedTags,
        properties: inheritedProps,
        perspectives: inheritedPersp,
        metadata: inheritedMeta
      };

      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseElementArchetypeProperty(elemArchetype);
        }
      }

      this.archetypes.elements[name] = elemArchetype;
      return;
    }

    throw new ParseError(`Unexpected token '${curr.value}' in archetype definition`, curr.line, curr.column);
  }

  private parseRelationshipArchetypeProperty(rel: RelationshipArchetype) {
    const tok = this.current();
    const kw = tok.type === 'IDENTIFIER' ? tok.value.toLowerCase() : '';

    if (kw === 'description') {
      this.pos += 1;
      rel.description = this.expectStringOrIdentifier();
    } else if (kw === 'technology') {
      this.pos += 1;
      rel.technology = this.expectStringOrIdentifier();
    } else if (kw === 'tag') {
      this.pos += 1;
      const t = this.expectStringOrIdentifier();
      if (!rel.tags) rel.tags = [];
      if (!rel.tags.includes(t)) rel.tags.push(t);
    } else if (kw === 'tags') {
      this.pos += 1;
      const tList = this.parseStringArgs();
      if (!rel.tags) rel.tags = [];
      this.addTags(rel.tags, tList);
    } else if (kw === 'properties') {
      this.pos += 1;
      if (!rel.properties) rel.properties = {};
      this.parsePropertiesBody(rel.properties);
    } else if (kw === 'perspectives') {
      this.pos += 1;
      if (!rel.perspectives) rel.perspectives = [];
      this.parsePerspectivesBody(rel.perspectives);
    } else {
      this.pos += 1;
    }
  }

  private parseElementArchetypeProperty(elem: ElementArchetype) {
    const tok = this.current();
    const kw = tok.type === 'IDENTIFIER' ? tok.value.toLowerCase() : '';

    if (kw === 'description') {
      this.pos += 1;
      elem.description = this.expectStringOrIdentifier();
    } else if (kw === 'technology') {
      this.pos += 1;
      elem.technology = this.expectStringOrIdentifier();
    } else if (kw === 'metadata') {
      this.pos += 1;
      elem.metadata = this.expectStringOrIdentifier();
    } else if (kw === 'tag') {
      this.pos += 1;
      const t = this.expectStringOrIdentifier();
      if (!elem.tags) elem.tags = [];
      if (!elem.tags.includes(t)) elem.tags.push(t);
    } else if (kw === 'tags') {
      this.pos += 1;
      const tList = this.parseStringArgs();
      if (!elem.tags) elem.tags = [];
      this.addTags(elem.tags, tList);
    } else if (kw === 'properties') {
      this.pos += 1;
      if (!elem.properties) elem.properties = {};
      this.parsePropertiesBody(elem.properties);
    } else if (kw === 'perspectives') {
      this.pos += 1;
      if (!elem.perspectives) elem.perspectives = [];
      this.parsePerspectivesBody(elem.perspectives);
    } else {
      this.pos += 1;
    }
  }

  private parseCustomElement(identifier: string | null = null, startLine?: number, archetype?: ElementArchetype) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Element');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const explicitTags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const customElem: CustomElement = {
      id: eid,
      identifier: ident,
      name,
      description: desc,
      tags,
      metadata: archetype?.metadata,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, customElem);
    if (!this.workspace.model.customElements) this.workspace.model.customElements = [];
    this.workspace.model.customElements.push(customElem);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        if (kw === 'description') {
          this.pos += 1;
          customElem.description = this.expectStringOrIdentifier();
        } else if (kw === 'metadata') {
          this.pos += 1;
          customElem.metadata = this.expectStringOrIdentifier();
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(customElem.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(customElem.tags, this.parseStringArgs());
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(customElem.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!customElem.perspectives) customElem.perspectives = [];
          this.parsePerspectivesBody(customElem.perspectives);
        } else {
          this.pos += 1;
        }
      }
    }
    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    customElem.lineRange = { startLine: sLine, endLine };
  }

  private parseModelBody() {
    const curr = this.current();
    if (curr.type === 'RBRACE' || curr.type === 'EOF') {
      return;
    }

    let identifier: string | null = null;
    let startLine = curr.line;
    if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
      identifier = curr.value;
      startLine = curr.line;
      this.pos += 2;
    } else {
      startLine = this.current().line;
    }

    const nextCurr = this.current();
    const keyword = nextCurr.type === 'IDENTIFIER' ? nextCurr.value.toLowerCase() : '';

    if (keyword === '!identifiers') {
      this.pos += 1;
      const arg = this.expectStringOrIdentifier().toLowerCase();
      if (arg === 'hierarchical') {
        this.identifiersMode = 'hierarchical';
      } else if (arg === 'flat') {
        this.identifiersMode = 'flat';
      }
      return;
    } else if (keyword === '!element') {
      this.pos += 1;
      const targetIdent = this.expectStringOrIdentifier();
      this.parseElementExtension(targetIdent);
      return;
    } else if (keyword === '!relationship') {
      this.pos += 1;
      this.parseRelationshipExtension();
      return;
    } else if (keyword === '!impliedrelationships' || keyword === 'impliedrelationships') {
      this.pos += 1;
      const arg = this.expectStringOrIdentifier();
      const low = arg.toLowerCase();
      const mode = low === 'false' ? false : low === 'true' ? true : arg;
      this.workspace.impliedRelationships = mode;
      this.workspace.model.impliedRelationships = mode;
      return;
    } else if (keyword.startsWith('!')) {
      this.pos += 1;
      while (this.pos < this.tokens.length && this.current().line === nextCurr.line && this.current().type !== 'EOF') {
        this.pos += 1;
      }
      return;
    }

    if (keyword === 'archetypes') {
      this.pos += 1;
      this.parseArchetypesBody();
      return;
    }

    if (keyword === 'properties') {
      this.pos += 1;
      this.parsePropertiesBody(this.workspace.properties);
      return;
    }

    if (keyword === 'group') {
      this.pos += 1;
      const groupName = this.expectStringOrIdentifier();
      this.expect('LBRACE');
      const prevGroup = this.currentGroup;
      this.currentGroup = prevGroup ? `${prevGroup}/${groupName}` : groupName;
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseModelBody();
      }
      this.currentGroup = prevGroup;
      return;
    }

    if (keyword === 'person') {
      this.pos += 1;
      this.parsePerson(identifier, startLine);
      return;
    } else if (keyword === 'softwaresystem' || keyword === 'system') {
      this.pos += 1;
      this.parseSoftwareSystem(identifier, startLine);
      return;
    } else if (keyword === 'container') {
      // Tolerate container directly under model by attaching to existing or implicit software system
      if (this.workspace.model.softwareSystems.length === 0) {
        const defaultSys: SoftwareSystem = {
          id: this.getId(),
          identifier: 'default_system',
          name: 'System',
          description: '',
          location: 'Unspecified',
          tags: ['Software System', 'Element'],
          properties: {},
          containers: []
        };
        this.workspace.model.softwareSystems.push(defaultSys);
        this.idToElement.set(defaultSys.id, defaultSys);
        this.identifierToId.set(defaultSys.identifier, defaultSys.id);
        this.identifierToId.set(defaultSys.name, defaultSys.id);
      }
      const targetSys = this.workspace.model.softwareSystems[this.workspace.model.softwareSystems.length - 1];
      this.pos += 1;
      this.parseContainer(targetSys, identifier, startLine);
      return;
    } else if (keyword === 'deploymentenvironment') {
      this.pos += 1;
      this.parseDeploymentEnvironment();
      return;
    } else {
      const elemArchetype = this.getElementArchetype(keyword);
      if (elemArchetype) {
        this.pos += 1;
        if (elemArchetype.resolvedBaseType === 'person') {
          this.parsePerson(identifier, startLine, elemArchetype);
        } else if (elemArchetype.resolvedBaseType === 'softwareSystem') {
          this.parseSoftwareSystem(identifier, startLine, elemArchetype);
        } else if (elemArchetype.resolvedBaseType === 'container') {
          if (this.workspace.model.softwareSystems.length === 0) {
            const defaultSys: SoftwareSystem = {
              id: this.getId(),
              identifier: 'default_system',
              name: 'System',
              description: '',
              location: 'Unspecified',
              tags: ['Software System', 'Element'],
              properties: {},
              containers: []
            };
            this.workspace.model.softwareSystems.push(defaultSys);
            this.idToElement.set(defaultSys.id, defaultSys);
            this.identifierToId.set(defaultSys.identifier, defaultSys.id);
            this.identifierToId.set(defaultSys.name, defaultSys.id);
          }
          const targetSys = this.workspace.model.softwareSystems[this.workspace.model.softwareSystems.length - 1];
          this.parseContainer(targetSys, identifier, startLine, elemArchetype);
        } else if (elemArchetype.resolvedBaseType === 'group') {
          const groupName = this.expectStringOrIdentifier();
          this.expect('LBRACE');
          const prevGroup = this.currentGroup;
          this.currentGroup = prevGroup ? `${prevGroup}/${groupName}` : groupName;
          while (!this.match('RBRACE') && !this.match('EOF')) {
            this.parseModelBody();
          }
          this.currentGroup = prevGroup;
        } else if (elemArchetype.resolvedBaseType === 'element') {
          this.parseCustomElement(identifier, startLine, elemArchetype);
        }
        return;
      }
    }

    if (nextCurr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
      this.parseRelationship(nextCurr.value, nextCurr.line);
      return;
    } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
      this.parseRelationshipRemoval(nextCurr.value, nextCurr.line);
      return;
    } else {
      this.pos += 1;
    }
  }

  private findElementByIdentifier(ident: string): any {
    const id = this.identifierToId.get(ident) || ident;
    if (this.idToElement.has(id)) return this.idToElement.get(id);

    for (const p of this.workspace.model.people) {
      if (p.id === id || p.identifier === ident || p.name === ident) return p;
    }
    for (const s of this.workspace.model.softwareSystems) {
      if (s.id === id || s.identifier === ident || s.name === ident) return s;
      for (const c of s.containers) {
        if (c.id === id || c.identifier === ident || c.name === ident) return c;
        for (const comp of c.components) {
          if (comp.id === id || comp.identifier === ident || comp.name === ident) return comp;
        }
      }
    }
    for (const n of this.workspace.model.deploymentNodes) {
      if (n.id === id || n.identifier === ident || n.name === ident) return n;
      for (const ch of n.children) {
        if (ch.id === id || ch.identifier === ident || ch.name === ident) return ch;
      }
    }
    return null;
  }

  private parseElementExtension(targetIdent: string) {
    const target =
      this.idToElement.get(targetIdent) ||
      this.idToElement.get(this.identifierToId.get(targetIdent) || '') ||
      this.findElementByIdentifier(targetIdent);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';

        if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(targetIdent, dest, curr.line);
        } else if (curr.type === 'ARCHETYPE_ARROW') {
          const archName = curr.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(targetIdent, dest, curr.line, archName);
        } else if (curr.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(targetIdent, dest);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          if (target) this.addTags(target.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          const tList = this.parseStringArgs();
          if (target) this.addTags(target.tags, tList);
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(target ? target.properties : {});
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (target) {
            if (!target.perspectives) target.perspectives = [];
            this.parsePerspectivesBody(target.perspectives);
          }
        } else if (kw === 'description') {
          this.pos += 1;
          const d = this.expectStringOrIdentifier();
          if (target) target.description = d;
        } else if (kw === 'technology') {
          this.pos += 1;
          const tech = this.expectStringOrIdentifier();
          if (target && 'technology' in target) target.technology = tech;
        } else if (kw === 'url') {
          this.pos += 1;
          const u = this.expectStringOrIdentifier();
          if (target) target.url = u;
        } else if (kw === 'container' && target && 'containers' in target) {
          this.pos += 1;
          this.parseContainer(target as SoftwareSystem, null, curr.line);
        } else if (kw === 'component' && target && 'components' in target) {
          this.pos += 1;
          this.parseComponent(target as Container, null, curr.line);
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseRelationshipExtension() {
    let sourceIdent = '';
    let destIdent = '';
    const first = this.expectStringOrIdentifier();
    if (this.match('ARROW')) {
      sourceIdent = first;
      destIdent = this.expectStringOrIdentifier();
    } else {
      sourceIdent = first;
    }

    const rel = this.workspace.model.relationships.find((r) =>
      destIdent
        ? (r.sourceId === sourceIdent || r.sourceIdentifier === sourceIdent) &&
          (r.destinationId === destIdent || r.destinationIdentifier === destIdent)
        : r.id === sourceIdent
    );

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const kw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          if (rel) this.addTags(rel.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          const tList = this.parseStringArgs();
          if (rel) this.addTags(rel.tags, tList);
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(rel ? rel.properties : {});
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (rel) {
            if (!rel.perspectives) rel.perspectives = [];
            this.parsePerspectivesBody(rel.perspectives);
          }
        } else if (kw === 'description') {
          this.pos += 1;
          const d = this.expectStringOrIdentifier();
          if (rel) rel.description = d;
        } else if (kw === 'technology') {
          this.pos += 1;
          const tech = this.expectStringOrIdentifier();
          if (rel) rel.technology = tech;
        } else if (kw === 'url') {
          this.pos += 1;
          const u = this.expectStringOrIdentifier();
          if (rel) rel.url = u;
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseRelationshipRemoval(sourceIdent: string, startLine?: number) {
    this.pos += 1; // consume source identifier
    this.expect('REMOVE_ARROW');
    const destIdent = this.expectStringOrIdentifier();
    this.parseStringArgs(); // optional description or args
    this.removeRelationship(sourceIdent, destIdent);
  }

  private removeRelationship(sourceIdent: string, destIdent: string) {
    const sId = this.identifierToId.get(sourceIdent) || sourceIdent;
    const dId = this.identifierToId.get(destIdent) || destIdent;
    this.workspace.model.relationships = this.workspace.model.relationships.filter(
      (r) =>
        !(
          (r.sourceId === sId || r.sourceIdentifier === sourceIdent) &&
          (r.destinationId === dId || r.destinationIdentifier === destIdent)
        )
    );
  }

  private parsePerson(identifier: string | null = null, startLine?: number, archetype?: ElementArchetype) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Person');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const explicitTags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (!tags.includes('Person')) tags.unshift('Person');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const person: Person = {
      id: eid,
      identifier: ident,
      name,
      description: desc,
      location: 'Unspecified',
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, person);
    this.workspace.model.people.push(person);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const tok = this.current();
        const kw = tok.type === 'IDENTIFIER' ? tok.value.toLowerCase() : '';
        if (tok.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, tok.line);
        } else if (tok.type === 'ARCHETYPE_ARROW') {
          const archName = tok.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, tok.line, archName);
        } else if (tok.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(ident, dest);
        } else if (tok.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(tok.value, tok.line);
        } else if (tok.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(tok.value, tok.line);
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(person.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(person.tags, this.parseStringArgs());
        } else if (kw === 'description') {
          this.pos += 1;
          person.description = this.expectStringOrIdentifier();
        } else if (kw === 'url') {
          this.pos += 1;
          person.url = this.expectStringOrIdentifier();
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(person.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!person.perspectives) person.perspectives = [];
          this.parsePerspectivesBody(person.perspectives);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    person.lineRange = { startLine: sLine, endLine };
  }

  private parseSoftwareSystem(identifier: string | null = null, startLine?: number, archetype?: ElementArchetype) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Software System');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const explicitTags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (!tags.includes('Software System')) tags.unshift('Software System');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const system: SoftwareSystem = {
      id: eid,
      identifier: ident,
      name,
      description: desc,
      location: 'Unspecified',
      containers: [],
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, system);
    this.workspace.model.softwareSystems.push(system);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseSoftwareSystemBody(system, ident);
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    system.lineRange = { startLine: sLine, endLine };
  }

  private parseSoftwareSystemBody(system: SoftwareSystem, ident: string) {
    let cIdent: string | null = null;
    let cStartLine = this.current().line;
    const curr = this.current();
    if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
      cIdent = curr.value;
      cStartLine = curr.line;
      this.pos += 2;
    } else {
      cStartLine = this.current().line;
    }

    const nextCurr = this.current();
    const kw = nextCurr.type === 'IDENTIFIER' ? nextCurr.value.toLowerCase() : '';
    const elemArchetype = this.getElementArchetype(kw);

    if (kw === 'container' || (elemArchetype && elemArchetype.resolvedBaseType === 'container')) {
      this.pos += 1;
      this.parseContainer(system, cIdent, cStartLine, elemArchetype);
    } else if (kw === 'group' || (elemArchetype && elemArchetype.resolvedBaseType === 'group')) {
      this.pos += 1;
      const groupName = this.expectStringOrIdentifier();
      this.expect('LBRACE');
      const prevGroup = this.currentGroup;
      this.currentGroup = prevGroup ? `${prevGroup}/${groupName}` : groupName;
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseSoftwareSystemBody(system, ident);
      }
      this.currentGroup = prevGroup;
    } else if (nextCurr.type === 'ARROW') {
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseRelationshipDetails(ident, dest, nextCurr.line);
    } else if (nextCurr.type === 'ARCHETYPE_ARROW') {
      const archName = nextCurr.value.slice(2, -2);
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseRelationshipDetails(ident, dest, nextCurr.line, archName);
    } else if (nextCurr.type === 'REMOVE_ARROW') {
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseStringArgs();
      this.removeRelationship(ident, dest);
    } else if (nextCurr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
      this.parseRelationship(nextCurr.value, nextCurr.line);
    } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
      this.parseRelationshipRemoval(nextCurr.value, nextCurr.line);
    } else if (kw === 'tag') {
      this.pos += 1;
      const t = this.expectStringOrIdentifier();
      this.addTags(system.tags, [t]);
    } else if (kw === 'tags') {
      this.pos += 1;
      this.addTags(system.tags, this.parseStringArgs());
    } else if (kw === 'description') {
      this.pos += 1;
      system.description = this.expectStringOrIdentifier();
    } else if (kw === 'url') {
      this.pos += 1;
      system.url = this.expectStringOrIdentifier();
    } else if (kw === 'properties') {
      this.pos += 1;
      this.parsePropertiesBody(system.properties);
    } else if (kw === 'perspectives') {
      this.pos += 1;
      if (!system.perspectives) system.perspectives = [];
      this.parsePerspectivesBody(system.perspectives);
    } else {
      this.pos += 1;
    }
  }

  private parseContainer(system: SoftwareSystem, identifier: string | null = null, startLine?: number, archetype?: ElementArchetype) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Container');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const tech = args.length > 2 ? args[2] : (archetype?.technology || '');
    const explicitTags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (!tags.includes('Container')) tags.unshift('Container');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const qualifiedIdent = system.identifier ? `${system.identifier}.${ident}` : ident;
    const containerIdent = this.identifiersMode === 'hierarchical' ? qualifiedIdent : ident;

    const container: Container = {
      id: eid,
      identifier: containerIdent,
      systemId: system.id,
      name,
      description: desc,
      technology: tech,
      components: [],
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    if (system.identifier) {
      this.identifierToId.set(`${system.identifier}.${ident}`, eid);
      this.identifierToId.set(`${system.identifier}.${name}`, eid);
    }
    this.idToElement.set(eid, container);
    system.containers.push(container);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseContainerBody(container, containerIdent);
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    container.lineRange = { startLine: sLine, endLine };
  }

  private parseContainerBody(container: Container, containerIdent: string) {
    let compIdent: string | null = null;
    let compStartLine = this.current().line;
    const curr = this.current();
    if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
      compIdent = curr.value;
      compStartLine = curr.line;
      this.pos += 2;
    } else {
      compStartLine = this.current().line;
    }

    const nextCurr = this.current();
    const kw = nextCurr.type === 'IDENTIFIER' ? nextCurr.value.toLowerCase() : '';
    const elemArchetype = this.getElementArchetype(kw);

    if (kw === 'component' || (elemArchetype && elemArchetype.resolvedBaseType === 'component')) {
      this.pos += 1;
      this.parseComponent(container, compIdent, compStartLine, elemArchetype);
    } else if (kw === 'group' || (elemArchetype && elemArchetype.resolvedBaseType === 'group')) {
      this.pos += 1;
      const groupName = this.expectStringOrIdentifier();
      this.expect('LBRACE');
      const prevGroup = this.currentGroup;
      this.currentGroup = prevGroup ? `${prevGroup}/${groupName}` : groupName;
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseContainerBody(container, containerIdent);
      }
      this.currentGroup = prevGroup;
    } else if (nextCurr.type === 'ARROW') {
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseRelationshipDetails(containerIdent, dest, nextCurr.line);
    } else if (nextCurr.type === 'ARCHETYPE_ARROW') {
      const archName = nextCurr.value.slice(2, -2);
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseRelationshipDetails(containerIdent, dest, nextCurr.line, archName);
    } else if (nextCurr.type === 'REMOVE_ARROW') {
      this.pos += 1;
      const dest = this.expect('IDENTIFIER').value;
      this.parseStringArgs();
      this.removeRelationship(containerIdent, dest);
    } else if (nextCurr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
      this.parseRelationship(nextCurr.value, nextCurr.line);
    } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
      this.parseRelationshipRemoval(nextCurr.value, nextCurr.line);
    } else if (kw === 'tag') {
      this.pos += 1;
      const t = this.expectStringOrIdentifier();
      this.addTags(container.tags, [t]);
    } else if (kw === 'tags') {
      this.pos += 1;
      this.addTags(container.tags, this.parseStringArgs());
    } else if (kw === 'description') {
      this.pos += 1;
      container.description = this.expectStringOrIdentifier();
    } else if (kw === 'technology') {
      this.pos += 1;
      container.technology = this.expectStringOrIdentifier();
    } else if (kw === 'url') {
      this.pos += 1;
      container.url = this.expectStringOrIdentifier();
    } else if (kw === 'properties') {
      this.pos += 1;
      this.parsePropertiesBody(container.properties);
    } else if (kw === 'perspectives') {
      this.pos += 1;
      if (!container.perspectives) container.perspectives = [];
      this.parsePerspectivesBody(container.perspectives);
    } else {
      this.pos += 1;
    }
  }

  private parseComponent(container: Container, identifier: string | null = null, startLine?: number, archetype?: ElementArchetype) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Component');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const tech = args.length > 2 ? args[2] : (archetype?.technology || '');
    const explicitTags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (!tags.includes('Component')) tags.unshift('Component');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const parentSys = this.workspace.model.softwareSystems.find((s) => s.id === container.systemId);
    const sysIdent = parentSys?.identifier;
    const contIdent = container.identifier;

    let componentIdent = ident;
    if (this.identifiersMode === 'hierarchical') {
      if (contIdent.includes('.')) {
        componentIdent = `${contIdent}.${ident}`;
      } else if (sysIdent) {
        componentIdent = `${sysIdent}.${contIdent}.${ident}`;
      } else {
        componentIdent = `${contIdent}.${ident}`;
      }
    }

    const component: Component = {
      id: eid,
      identifier: componentIdent,
      containerId: container.id,
      name,
      description: desc,
      technology: tech,
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.identifierToId.set(`${contIdent}.${ident}`, eid);
    if (sysIdent) {
      const shortCont = contIdent.startsWith(`${sysIdent}.`) ? contIdent.slice(sysIdent.length + 1) : contIdent;
      this.identifierToId.set(`${sysIdent}.${shortCont}.${ident}`, eid);
      this.identifierToId.set(`${sysIdent}.${shortCont}.${name}`, eid);
    }
    this.idToElement.set(eid, component);
    container.components.push(component);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(componentIdent, dest, curr.line);
        } else if (curr.type === 'ARCHETYPE_ARROW') {
          const archName = curr.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(componentIdent, dest, curr.line, archName);
        } else if (curr.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(componentIdent, dest);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(component.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(component.tags, this.parseStringArgs());
        } else if (kw === 'description') {
          this.pos += 1;
          component.description = this.expectStringOrIdentifier();
        } else if (kw === 'technology') {
          this.pos += 1;
          component.technology = this.expectStringOrIdentifier();
        } else if (kw === 'url') {
          this.pos += 1;
          component.url = this.expectStringOrIdentifier();
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(component.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!component.perspectives) component.perspectives = [];
          this.parsePerspectivesBody(component.perspectives);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    component.lineRange = { startLine: sLine, endLine };
  }

  private parseDeploymentEnvironment() {
    const envName = this.expectStringOrIdentifier();
    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseDeploymentEnvironmentBody(envName);
      }
    }
  }

  private parseDeploymentEnvironmentBody(envName: string) {
    const curr = this.current();
    if (curr.type === 'RBRACE' || curr.type === 'EOF') return;

    let identifier: string | null = null;
    let startLine = curr.line;
    if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
      identifier = curr.value;
      startLine = curr.line;
      this.pos += 2;
    }

    const nextCurr = this.current();
    const kw = nextCurr.type === 'IDENTIFIER' ? nextCurr.value.toLowerCase() : '';
    const elemArchetype = this.getElementArchetype(kw);

    if (kw === 'deploymentnode' || (elemArchetype && elemArchetype.resolvedBaseType === 'deploymentNode')) {
      this.pos += 1;
      this.parseDeploymentNode(envName, null, identifier, startLine, elemArchetype);
    } else if (kw === 'infrastructurenode' || (elemArchetype && elemArchetype.resolvedBaseType === 'infrastructureNode')) {
      this.pos += 1;
      this.parseInfrastructureNode(envName, null, identifier, startLine, elemArchetype);
    } else if (kw === 'group' || (elemArchetype && elemArchetype.resolvedBaseType === 'group')) {
      this.pos += 1;
      const groupName = this.expectStringOrIdentifier();
      this.expect('LBRACE');
      const prevGroup = this.currentGroup;
      this.currentGroup = prevGroup ? `${prevGroup}/${groupName}` : groupName;
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseDeploymentEnvironmentBody(envName);
      }
      this.currentGroup = prevGroup;
    } else if (kw === 'deploymentgroup') {
      this.pos += 1;
      this.parseStringArgs();
    } else if (nextCurr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
      this.parseRelationship(nextCurr.value, nextCurr.line);
    } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
      this.parseRelationshipRemoval(nextCurr.value, nextCurr.line);
    } else {
      this.pos += 1;
    }
  }

  private parseDeploymentNode(
    envName: string,
    parentNodeId: string | null = null,
    identifier: string | null = null,
    startLine?: number,
    archetype?: ElementArchetype
  ): DeploymentNode {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Deployment Node');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const tech = args.length > 2 ? args[2] : (archetype?.technology || '');
    const explicitTags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    const instances = args.length > 4 ? args[4] : 1;

    if (!tags.includes('Deployment Node')) tags.unshift('Deployment Node');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const node: DeploymentNode = {
      id: eid,
      identifier: ident,
      name,
      description: desc,
      technology: tech,
      environment: envName,
      instances,
      children: [],
      containerInstances: [],
      typedContainerInstances: [],
      typedSoftwareSystemInstances: [],
      infrastructureNodes: [],
      parentNodeId,
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, node);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        let childIdent: string | null = null;
        let cStartLine = this.current().line;
        if (this.current().type === 'IDENTIFIER' && this.peekNext().type === 'EQUALS') {
          childIdent = this.current().value;
          cStartLine = this.current().line;
          this.pos += 2;
        }

        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        const elemArchetype = this.getElementArchetype(kw);

        if (kw === 'deploymentnode' || (elemArchetype && elemArchetype.resolvedBaseType === 'deploymentNode')) {
          this.pos += 1;
          const childNode = this.parseDeploymentNode(envName, node.id, childIdent, cStartLine, elemArchetype);
          node.children.push(childNode);
        } else if (kw === 'infrastructurenode' || (elemArchetype && elemArchetype.resolvedBaseType === 'infrastructureNode')) {
          this.pos += 1;
          const infra = this.parseInfrastructureNode(envName, node.id, childIdent, cStartLine, elemArchetype);
          if (!node.infrastructureNodes) node.infrastructureNodes = [];
          node.infrastructureNodes.push(infra);
        } else if (kw === 'containerinstance' || kw === 'instanceof') {
          this.pos += 1;
          this.parseContainerInstance(node, envName);
        } else if (kw === 'softwareinstance' || kw === 'softwaresysteminstance') {
          this.pos += 1;
          this.parseSoftwareSystemInstance(node, envName);
        } else if (kw === 'instances') {
          this.pos += 1;
          node.instances = this.expectStringOrIdentifier();
        } else if (kw === 'description') {
          this.pos += 1;
          node.description = this.expectStringOrIdentifier();
        } else if (kw === 'technology') {
          this.pos += 1;
          node.technology = this.expectStringOrIdentifier();
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(node.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(node.tags, this.parseStringArgs());
        } else if (kw === 'url') {
          this.pos += 1;
          node.url = this.expectStringOrIdentifier();
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(node.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!node.perspectives) node.perspectives = [];
          this.parsePerspectivesBody(node.perspectives);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    node.lineRange = { startLine: sLine, endLine };

    if (!parentNodeId) {
      this.workspace.model.deploymentNodes.push(node);
    }

    return node;
  }

  private parseInfrastructureNode(
    envName: string,
    parentNodeId: string | null = null,
    identifier: string | null = null,
    startLine?: number,
    archetype?: ElementArchetype
  ): InfrastructureNode {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : (archetype ? archetype.name : 'Infrastructure Node');
    const desc = args.length > 1 ? args[1] : (archetype?.description || '');
    const tech = args.length > 2 ? args[2] : (archetype?.technology || '');
    const explicitTags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    const tags = [...explicitTags];
    if (archetype?.tags) {
      for (const t of archetype.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }

    if (!tags.includes('Infrastructure Node')) tags.unshift('Infrastructure Node');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const infra: InfrastructureNode = {
      id: eid,
      identifier: ident,
      name,
      description: desc,
      technology: tech,
      environment: envName,
      parentNodeId,
      tags,
      properties: archetype?.properties ? { ...archetype.properties } : {},
      perspectives: archetype?.perspectives ? JSON.parse(JSON.stringify(archetype.perspectives)) : [],
      group: this.currentGroup || undefined,
      archetype: archetype?.name
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, infra);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        if (kw === 'description') {
          this.pos += 1;
          infra.description = this.expectStringOrIdentifier();
        } else if (kw === 'technology') {
          this.pos += 1;
          infra.technology = this.expectStringOrIdentifier();
        } else if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(infra.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(infra.tags, this.parseStringArgs());
        } else if (kw === 'url') {
          this.pos += 1;
          infra.url = this.expectStringOrIdentifier();
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(infra.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!infra.perspectives) infra.perspectives = [];
          this.parsePerspectivesBody(infra.perspectives);
        } else if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, curr.line);
        } else if (curr.type === 'ARCHETYPE_ARROW') {
          const archName = curr.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, curr.line, archName);
        } else if (curr.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(ident, dest);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    infra.lineRange = { startLine: sLine, endLine };
    return infra;
  }

  private parseContainerInstance(node: DeploymentNode, envName: string) {
    const sLine = this.current().line;
    const target = this.expectStringOrIdentifier();
    const args = this.parseStringArgs();
    const groups = args.length > 0 ? args[0].split(',').map((g) => g.trim()) : [];
    const tags = args.length > 1 ? args[1].split(',').map((t) => t.trim()) : [];

    node.containerInstances.push(target);

    const eid = this.getId();
    const instanceId = (node.typedContainerInstances?.length || 0) + 1;
    const cInst: ContainerInstance = {
      id: eid,
      identifier: `${target}_instance_${instanceId}`,
      name: `${target} [Instance ${instanceId}]`,
      description: '',
      containerId: target,
      environment: envName,
      instanceId,
      deploymentGroups: groups,
      healthChecks: [],
      parentNodeId: node.id,
      tags: ['Container Instance', 'Element', ...tags],
      properties: {}
    };

    if (!node.typedContainerInstances) node.typedContainerInstances = [];
    node.typedContainerInstances.push(cInst);
    this.idToElement.set(eid, cInst);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        if (kw === 'healthcheck') {
          this.pos += 1;
          const hName = this.expectStringOrIdentifier();
          const hUrl = this.expectStringOrIdentifier();
          const hArgs = this.parseStringArgs();
          const interval = hArgs[0] ? parseInt(hArgs[0], 10) : undefined;
          const timeout = hArgs[1] ? parseInt(hArgs[1], 10) : undefined;
          cInst.healthChecks.push({ name: hName, url: hUrl, interval, timeout });
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(cInst.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!cInst.perspectives) cInst.perspectives = [];
          this.parsePerspectivesBody(cInst.perspectives);
        } else if (kw === 'tag') {
          this.pos += 1;
          this.addTags(cInst.tags, [this.expectStringOrIdentifier()]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(cInst.tags, this.parseStringArgs());
        } else if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(cInst.identifier, dest, curr.line);
        } else if (curr.type === 'ARCHETYPE_ARROW') {
          const archName = curr.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(cInst.identifier, dest, curr.line, archName);
        } else if (curr.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(cInst.identifier, dest);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseSoftwareSystemInstance(node: DeploymentNode, envName: string) {
    const sLine = this.current().line;
    const target = this.expectStringOrIdentifier();
    const args = this.parseStringArgs();
    const groups = args.length > 0 ? args[0].split(',').map((g) => g.trim()) : [];
    const tags = args.length > 1 ? args[1].split(',').map((t) => t.trim()) : [];

    node.containerInstances.push(target);

    const eid = this.getId();
    const instanceId = (node.typedSoftwareSystemInstances?.length || 0) + 1;
    const sInst: SoftwareSystemInstance = {
      id: eid,
      identifier: `${target}_instance_${instanceId}`,
      name: `${target} [Instance ${instanceId}]`,
      description: '',
      softwareSystemId: target,
      environment: envName,
      instanceId,
      deploymentGroups: groups,
      healthChecks: [],
      parentNodeId: node.id,
      tags: ['Software System Instance', 'Element', ...tags],
      properties: {}
    };

    if (!node.typedSoftwareSystemInstances) node.typedSoftwareSystemInstances = [];
    node.typedSoftwareSystemInstances.push(sInst);
    this.idToElement.set(eid, sInst);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
        if (kw === 'healthcheck') {
          this.pos += 1;
          const hName = this.expectStringOrIdentifier();
          const hUrl = this.expectStringOrIdentifier();
          const hArgs = this.parseStringArgs();
          const interval = hArgs[0] ? parseInt(hArgs[0], 10) : undefined;
          const timeout = hArgs[1] ? parseInt(hArgs[1], 10) : undefined;
          sInst.healthChecks.push({ name: hName, url: hUrl, interval, timeout });
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(sInst.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!sInst.perspectives) sInst.perspectives = [];
          this.parsePerspectivesBody(sInst.perspectives);
        } else if (kw === 'tag') {
          this.pos += 1;
          this.addTags(sInst.tags, [this.expectStringOrIdentifier()]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(sInst.tags, this.parseStringArgs());
        } else if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(sInst.identifier, dest, curr.line);
        } else if (curr.type === 'ARCHETYPE_ARROW') {
          const archName = curr.value.slice(2, -2);
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(sInst.identifier, dest, curr.line, archName);
        } else if (curr.type === 'REMOVE_ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseStringArgs();
          this.removeRelationship(sInst.identifier, dest);
        } else if (curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'REMOVE_ARROW') {
          this.parseRelationshipRemoval(curr.value, curr.line);
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseRelationship(sourceIdent: string, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    this.pos += 1; // consume source identifier
    let archetypeName: string | undefined;
    if (this.current().type === 'ARCHETYPE_ARROW') {
      archetypeName = this.expect('ARCHETYPE_ARROW').value.slice(2, -2);
    } else {
      this.expect('ARROW');
    }
    const destIdent = this.expectStringOrIdentifier();
    this.parseRelationshipDetails(sourceIdent, destIdent, sLine, archetypeName);
  }

  private parseRelationshipDetails(sourceIdent: string, destIdent: string, startLine?: number, archetypeName?: string) {
    const sLine = startLine ?? this.current().line;
    let relArchetype: RelationshipArchetype | undefined;
    if (archetypeName) {
      relArchetype = this.getRelationshipArchetype(archetypeName);
      if (!relArchetype) {
        throw new ParseError(`Unknown relationship archetype '${archetypeName}'`, sLine, 0);
      }
    }

    const args = this.parseStringArgs();
    const desc = args.length > 0 ? args[0] : (relArchetype?.description || '');
    const tech = args.length > 1 ? args[1] : (relArchetype?.technology || '');
    const explicitTags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
    const tags = ['Relationship', ...(relArchetype?.tags || [])];
    this.addTags(tags, explicitTags);

    const rid = this.getId();
    const rel: Relationship = {
      id: rid,
      sourceId: sourceIdent,
      destinationId: destIdent,
      sourceIdentifier: sourceIdent,
      destinationIdentifier: destIdent,
      description: desc,
      technology: tech,
      interactionStyle: 'Synchronous',
      tags,
      properties: { ...(relArchetype?.properties || {}) },
      perspectives: relArchetype?.perspectives ? JSON.parse(JSON.stringify(relArchetype.perspectives)) : undefined
    };
    if (archetypeName) {
      rel.archetype = archetypeName;
    }
    this.workspace.model.relationships.push(rel);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const kw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (kw === 'tag') {
          this.pos += 1;
          const t = this.expectStringOrIdentifier();
          this.addTags(rel.tags, [t]);
        } else if (kw === 'tags') {
          this.pos += 1;
          this.addTags(rel.tags, this.parseStringArgs());
        } else if (kw === 'description') {
          this.pos += 1;
          rel.description = this.expectStringOrIdentifier();
        } else if (kw === 'technology') {
          this.pos += 1;
          rel.technology = this.expectStringOrIdentifier();
        } else if (kw === 'url') {
          this.pos += 1;
          rel.url = this.expectStringOrIdentifier();
        } else if (kw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(rel.properties);
        } else if (kw === 'perspectives') {
          this.pos += 1;
          if (!rel.perspectives) rel.perspectives = [];
          this.parsePerspectivesBody(rel.perspectives);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    rel.lineRange = { startLine: sLine, endLine };
  }

  private parseViewsBody() {
    const curr = this.current();
    if (curr.type === 'RBRACE' || curr.type === 'EOF') {
      return;
    }

    const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
    const vStartLine = curr.line;
    if (['systemlandscape', 'systemcontext', 'container', 'component', 'dynamic', 'deployment', 'filtered'].includes(kw)) {
      this.pos += 1;
      this.parseView(kw, vStartLine);
      return;
    } else if (kw === 'styles') {
      this.pos += 1;
      this.expect('LBRACE');
      while (!this.match('RBRACE') && !this.match('EOF')) {
        this.parseStylesBody();
      }
      return;
    } else if (kw === 'theme' || kw === 'themes') {
      this.pos += 1;
      this.workspace.themes.push(...this.parseStringArgs());
      return;
    } else if (kw === 'terminology') {
      this.pos += 1;
      if (!this.workspace.terminology) this.workspace.terminology = {};
      this.parseTerminologyBody(this.workspace.terminology);
      return;
    } else {
      this.pos += 1;
    }
  }

  private parseViewExpressions(): string[] {
    const expressions: string[] = [];
    const startLine = this.current().line;
    while (
      this.current().type !== 'EOF' &&
      this.current().type !== 'RBRACE' &&
      this.current().type !== 'LBRACE' &&
      this.current().line === startLine
    ) {
      const curr = this.current();

      // Check for incoming arrow: ->element
      if (curr.type === 'ARROW' || curr.type === 'ARCHETYPE_ARROW') {
        this.pos += 1;
        if (this.current().type === 'IDENTIFIER' || this.current().type === 'STRING') {
          const target = this.expectStringOrIdentifier();
          expressions.push(`->${target}`);
        }
        continue;
      }

      // Check for string expression: "element.tag == Core"
      if (curr.type === 'STRING') {
        expressions.push(curr.value);
        this.pos += 1;
        continue;
      }

      // Check for identifier or expressions
      if (curr.type === 'IDENTIFIER') {
        const idVal = curr.value;
        this.pos += 1;

        // Check if followed by -> (outgoing: elem->, or specific: elem -> elem2)
        if ((this.current().type === 'ARROW' || this.current().type === 'ARCHETYPE_ARROW') && this.current().line === startLine) {
          this.pos += 1;
          if (
            (this.current().type === 'IDENTIFIER' || this.current().type === 'STRING') &&
            this.current().line === startLine
          ) {
            const destVal = this.expectStringOrIdentifier();
            expressions.push(`${idVal}->${destVal}`);
          } else {
            expressions.push(`${idVal}->`);
          }
          continue;
        }

        // Check if followed by == or != (e.g. element.tag == X)
        if (this.current().type === 'EQUALS' && this.peekNext().type === 'EQUALS') {
          this.pos += 2;
          const val = this.expectStringOrIdentifier();
          expressions.push(`${idVal} == ${val}`);
          continue;
        }

        expressions.push(idVal);
        continue;
      }

      this.pos += 1;
    }
    return expressions;
  }

  private parseView(viewType: string, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    let targetRef: string | null = null;
    let key: string | null = null;
    let desc = '';
    let env: string | null = null;
    let baseKey: string | null = null;
    let filterMode: 'include' | 'exclude' | null = null;
    let filterTags: string[] = [];

    if (viewType === 'filtered') {
      baseKey = args.length > 0 ? args[0] : '';
      const modeRaw = (args.length > 1 ? args[1] : 'include').toLowerCase();
      filterMode = modeRaw === 'exclude' ? 'exclude' : 'include';
      const tagsRaw = args.length > 2 ? args[2] : '';
      filterTags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
      key = args.length > 3 ? args[3] : `${baseKey}_filtered_${tagsRaw.replace(/[^a-zA-Z0-9]/g, '_')}`;
      desc = args.length > 4 ? args[4] : '';
    } else if (['systemcontext', 'container', 'component'].includes(viewType)) {
      if (args.length > 0) targetRef = args[0];
      if (args.length > 1) key = args[1];
      if (args.length > 2) desc = args[2];
    } else if (viewType === 'deployment') {
      targetRef = args.length > 0 && args[0] !== '*' ? args[0] : null;
      env = args.length > 1 ? args[1] : 'Default';
      key = args.length > 2 ? args[2] : (targetRef ? `${targetRef}-${env}-Deployment` : `${env}-Deployment`);
      desc = args.length > 3 ? args[3] : '';
    } else if (viewType === 'dynamic') {
      targetRef = args.length > 0 && args[0] !== '*' ? args[0] : null;
      key = args.length > 1 ? args[1] : `dynamic_${this.workspace.views.length + 1}`;
      desc = args.length > 2 ? args[2] : '';
    } else {
      if (args.length > 0) key = args[0];
      if (args.length > 1) desc = args[1];
    }

    if (!key) {
      key = `${viewType}_${this.workspace.views.length + 1}`;
    }

    const view: View = {
      key,
      viewType,
      title: key,
      description: desc,
      softwareSystemId: ['systemcontext', 'container', 'deployment'].includes(viewType) ? targetRef : null,
      containerId: viewType === 'component' ? targetRef : null,
      environment: env,
      baseViewKey: baseKey,
      filterMode,
      filterTags,
      includeAll: false,
      includedElementIds: [],
      excludedElementIds: [],
      properties: {},
      layoutCoordinates: {},
      dynamicSteps: viewType === 'dynamic' ? [] : undefined
    };

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        const vkw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';

        // Check dynamic step in dynamic view: source -> destination "description" [technology]
        if (viewType === 'dynamic' && curr.type === 'IDENTIFIER' && (this.peekNext().type === 'ARROW' || this.peekNext().type === 'ARCHETYPE_ARROW')) {
          const sIdent = curr.value;
          this.pos += 1; // consume identifier
          let stepArchName: string | undefined;
          if (this.current().type === 'ARCHETYPE_ARROW') {
            stepArchName = this.expect('ARCHETYPE_ARROW').value.slice(2, -2);
          } else {
            this.expect('ARROW');
          }
          const relArch = stepArchName ? this.getRelationshipArchetype(stepArchName) : undefined;
          const dIdent = this.expectStringOrIdentifier();
          const stepArgs = this.parseStringArgs();
          const stepDesc = stepArgs[0] || relArch?.description || '';
          const stepTech = stepArgs[1] || relArch?.technology || '';
          if (!view.dynamicSteps) view.dynamicSteps = [];
          view.dynamicSteps.push({
            order: view.dynamicSteps.length + 1,
            sourceId: sIdent,
            destinationId: dIdent,
            sourceIdentifier: sIdent,
            destinationIdentifier: dIdent,
            description: stepDesc,
            technology: stepTech
          });
          continue;
        }

        if (vkw === 'include') {
          this.pos += 1;
          const exprs = this.parseViewExpressions();
          if (exprs.includes('*')) {
            view.includeAll = true;
          }
          view.includedElementIds.push(...exprs);
        } else if (vkw === 'exclude') {
          this.pos += 1;
          const exprs = this.parseViewExpressions();
          view.excludedElementIds.push(...exprs);
        } else if (vkw === 'autolayout') {
          this.pos += 1;
          const layoutArgs = this.parseStringArgs();
          view.autoLayout = layoutArgs.length > 0 ? layoutArgs[0].toLowerCase() : 'tb';
          if (layoutArgs.length > 1) {
            const rank = parseInt(layoutArgs[1], 10);
            if (!isNaN(rank)) view.rankSeparation = rank;
          }
          if (layoutArgs.length > 2) {
            const node = parseInt(layoutArgs[2], 10);
            if (!isNaN(node)) view.nodeSeparation = node;
          }
        } else if (vkw === 'title') {
          this.pos += 1;
          view.title = this.expectStringOrIdentifier();
        } else if (vkw === 'description') {
          this.pos += 1;
          view.description = this.expectStringOrIdentifier();
        } else if (vkw === 'default') {
          this.pos += 1;
          view.isDefault = true;
          this.workspace.defaultView = view.key;
        } else if (vkw === 'properties') {
          this.pos += 1;
          this.parsePropertiesBody(view.properties);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    view.lineRange = { startLine: sLine, endLine };

    this.workspace.views.push(view);
  }

  private parseStylesBody(mode: 'light' | 'dark' | null = null) {
    const curr = this.current();
    if (curr.type === 'RBRACE' || curr.type === 'EOF') {
      return;
    }

    const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
    if (kw === 'light' || kw === 'dark') {
      const subMode = kw as 'light' | 'dark';
      this.pos += 1;
      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseStylesBody(subMode);
        }
      }
      return;
    } else if (kw === 'element') {
      this.pos += 1;
      const tag = this.expectStringOrIdentifier();
      const style: ElementStyle = { tag, mode };
      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const prop = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
          this.pos += 1;
          const val = this.expectStringOrIdentifier();
          if (prop === 'shape') style.shape = val;
          else if (prop === 'background') style.background = val;
          else if (prop === 'color' || prop === 'colour') style.color = val;
          else if (prop === 'stroke') style.stroke = val;
          else if (prop === 'strokewidth' || prop === 'stroke_width') style.strokeWidth = parseInt(val, 10) || null;
          else if (prop === 'fontsize' || prop === 'font_size') style.fontSize = parseInt(val, 10) || null;
          else if (prop === 'opacity') style.opacity = parseInt(val, 10) || null;
          else if (prop === 'border') style.border = val;
          else if (prop === 'icon') style.icon = val;
          else if (prop === 'width') style.width = parseInt(val, 10) || null;
          else if (prop === 'height') style.height = parseInt(val, 10) || null;
          else if (prop === 'metadata') style.metadata = val.toLowerCase() === 'true';
          else if (prop === 'description') style.description = val.toLowerCase() === 'true';
        }
      }
      this.workspace.elementStyles.push(style);
    } else if (kw === 'relationship') {
      this.pos += 1;
      const tag = this.expectStringOrIdentifier();
      const relStyle: RelationshipStyle = { tag, mode };
      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const prop = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
          this.pos += 1;
          const val = this.expectStringOrIdentifier();
          if (prop === 'thickness') relStyle.thickness = parseInt(val, 10) || null;
          else if (prop === 'color' || prop === 'colour') relStyle.color = val;
          else if (prop === 'style') relStyle.style = val;
          else if (prop === 'routing') relStyle.routing = val;
          else if (prop === 'dashed') relStyle.dashed = val.toLowerCase() === 'true';
          else if (prop === 'fontsize' || prop === 'font_size') relStyle.fontSize = parseInt(val, 10) || null;
          else if (prop === 'width') relStyle.width = parseInt(val, 10) || null;
          else if (prop === 'position') relStyle.position = parseInt(val, 10) || null;
          else if (prop === 'opacity') relStyle.opacity = parseInt(val, 10) || null;
        }
      }
      this.workspace.relationshipStyles.push(relStyle);
    } else {
      this.pos += 1;
    }
  }

  private expectStringOrIdentifier(): string {
    const curr = this.current();
    if (curr.type === 'STRING' || curr.type === 'IDENTIFIER') {
      this.pos += 1;
      return curr.value;
    }
    throw new ParseError(`Expected string or identifier, got '${curr.value}'`, curr.line, curr.column);
  }

  resolveReferences() {
    for (const rel of this.workspace.model.relationships) {
      if (!rel.sourceIdentifier) rel.sourceIdentifier = rel.sourceId;
      if (!rel.destinationIdentifier) rel.destinationIdentifier = rel.destinationId;
      if (this.identifierToId.has(rel.sourceId)) {
        rel.sourceId = this.identifierToId.get(rel.sourceId)!;
      }
      if (this.identifierToId.has(rel.destinationId)) {
        rel.destinationId = this.identifierToId.get(rel.destinationId)!;
      }
    }

    this.generateImpliedRelationships();

    const resolveDeploymentNodeReferences = (node: DeploymentNode) => {
      node.containerInstances = node.containerInstances.map((ci) =>
        this.identifierToId.has(ci) ? this.identifierToId.get(ci)! : ci
      );
      if (node.typedContainerInstances) {
        for (const ci of node.typedContainerInstances) {
          if (this.identifierToId.has(ci.containerId)) {
            ci.containerId = this.identifierToId.get(ci.containerId)!;
          }
        }
      }
      if (node.typedSoftwareSystemInstances) {
        for (const si of node.typedSoftwareSystemInstances) {
          if (this.identifierToId.has(si.softwareSystemId)) {
            si.softwareSystemId = this.identifierToId.get(si.softwareSystemId)!;
          }
        }
      }
      for (const child of node.children) {
        resolveDeploymentNodeReferences(child);
      }
    };

    for (const node of this.workspace.model.deploymentNodes) {
      resolveDeploymentNodeReferences(node);
    }

    for (const view of this.workspace.views) {
      if (view.softwareSystemId && this.identifierToId.has(view.softwareSystemId)) {
        view.softwareSystemId = this.identifierToId.get(view.softwareSystemId)!;
      }
      if (view.containerId && this.identifierToId.has(view.containerId)) {
        view.containerId = this.identifierToId.get(view.containerId)!;
      }

      const resolveExpr = (item: string): string => {
        if (item === '*') return '*';
        if (item.startsWith('->')) {
          const target = item.slice(2);
          const resolved = this.identifierToId.get(target) || target;
          return `->${resolved}`;
        }
        if (item.endsWith('->')) {
          const target = item.slice(0, -2);
          const resolved = this.identifierToId.get(target) || target;
          return `${resolved}->`;
        }
        if (item.includes('->')) {
          const parts = item.split('->');
          const r0 = this.identifierToId.get(parts[0]) || parts[0];
          const r1 = this.identifierToId.get(parts[1]) || parts[1];
          return `${r0}->${r1}`;
        }
        if (this.identifierToId.has(item)) {
          return this.identifierToId.get(item)!;
        }
        return item;
      };

      view.includedElementIds = view.includedElementIds.map(resolveExpr);
      view.excludedElementIds = view.excludedElementIds.map(resolveExpr);

      if (view.dynamicSteps) {
        for (const step of view.dynamicSteps) {
          if (this.identifierToId.has(step.sourceId)) {
            step.sourceId = this.identifierToId.get(step.sourceId)!;
          }
          if (this.identifierToId.has(step.destinationId)) {
            step.destinationId = this.identifierToId.get(step.destinationId)!;
          }
        }
      }
    }
  }

  private generateImpliedRelationships() {
    const strategy = this.workspace.impliedRelationships;
    if (strategy === false || strategy === undefined) {
      return;
    }

    // Helper to get ancestry chain from child to root: [self, parent, grandParent]
    const getAncestry = (elemId: string): any[] => {
      const chain: any[] = [];
      const elem = this.idToElement.get(elemId);
      if (!elem) return chain;
      chain.push(elem);

      if ('containerId' in elem && elem.containerId) {
        const cont = this.idToElement.get(elem.containerId);
        if (cont) {
          chain.push(cont);
          if ('systemId' in cont && cont.systemId) {
            const sys = this.idToElement.get(cont.systemId);
            if (sys) chain.push(sys);
          }
        }
      } else if ('systemId' in elem && elem.systemId) {
        const sys = this.idToElement.get(elem.systemId);
        if (sys) chain.push(sys);
      }

      return chain;
    };

    // Helper to check if a is an ancestor of b
    const isAncestorOf = (aId: string, bId: string): boolean => {
      const bAncestors = getAncestry(bId);
      return bAncestors.slice(1).some((anc) => anc.id === aId);
    };

    const strategyStr = typeof strategy === 'string' ? strategy.toLowerCase() : 'unlessSameRelationshipExists';
    const isUnlessAny = strategyStr.includes('unlessanyrelationship');
    const isDefaultStrategy = strategyStr === 'defaultimpliedrelationshipstrategy' || strategyStr === 'default';

    // Only inspect explicit relationships to generate implied ones
    const explicitRels = this.workspace.model.relationships.filter((r) => !r.implied);
    const newImpliedRels: Relationship[] = [];

    for (const rel of explicitRels) {
      const sourceAncestors = getAncestry(rel.sourceId);
      const destAncestors = getAncestry(rel.destinationId);

      for (const sElem of sourceAncestors) {
        for (const dElem of destAncestors) {
          // 1. Cannot imply relationship from element to itself
          if (sElem.id === dElem.id) continue;

          // 2. Skip the original explicit relationship itself
          if (sElem.id === rel.sourceId && dElem.id === rel.destinationId) continue;

          // 3. Implied relationships are not created between an element and its own parent/child
          if (isAncestorOf(sElem.id, dElem.id) || isAncestorOf(dElem.id, sElem.id)) continue;

          // 4. Check if existing relationship satisfies strategy
          const existing = this.workspace.model.relationships.concat(newImpliedRels).find((r) => {
            if (isUnlessAny) {
              return (
                (r.sourceId === sElem.id && r.destinationId === dElem.id) ||
                (r.sourceId === dElem.id && r.destinationId === sElem.id)
              );
            }
            if (isDefaultStrategy) {
              // DefaultImpliedRelationshipStrategy creates implied relationships regardless of duplicates,
              // but avoid exact duplicate created from the same source relationship in the current pass
              return (
                r.sourceId === sElem.id &&
                r.destinationId === dElem.id &&
                r.description === rel.description &&
                r.linkedRelationshipId === rel.id
              );
            }
            // Default (CreateImpliedRelationshipsUnlessSameRelationshipExistsStrategy):
            // creates implied relationships unless relationship with same source, destination, and description exists
            return (
              r.sourceId === sElem.id &&
              r.destinationId === dElem.id &&
              r.description === rel.description
            );
          });

          if (existing) continue;

          // Create implied relationship
          const impliedRel: Relationship = {
            id: `implied_${rel.id}_${sElem.id}_${dElem.id}`,
            sourceId: sElem.id,
            destinationId: dElem.id,
            sourceIdentifier: sElem.identifier || sElem.name,
            destinationIdentifier: dElem.identifier || dElem.name,
            description: rel.description,
            technology: rel.technology,
            interactionStyle: (rel.interactionStyle as any) || 'Synchronous',
            tags: ['Relationship', ...(rel.tags || []).filter((t: string) => t !== 'Relationship')],
            properties: { ...(rel.properties || {}), 'structurizr.implied': 'true' },
            implied: true,
            linkedRelationshipId: rel.id
          };

          newImpliedRels.push(impliedRel);
        }
      }
    }

    this.workspace.model.relationships.push(...newImpliedRels);
  }
}

export function parseDsl(dslCode: string): Workspace {
  const lexer = new Lexer(dslCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, dslCode);
  const workspace = parser.parse();
  parser.resolveReferences();
  return workspace;
}
