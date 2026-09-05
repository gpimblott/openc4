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
  Relationship,
  View,
  ElementStyle,
  RelationshipStyle
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
  type: 'IDENTIFIER' | 'STRING' | 'ARROW' | 'LBRACE' | 'RBRACE' | 'EQUALS' | 'EOF';
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

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      const ch = this.peek();
      if (!ch) break;

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
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
          throw new ParseError("Unterminated multi-line comment", startLine, startCol);
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
            word.push(c);
            this.advance();
          } else {
            break;
          }
        }
        tokens.push({ type: 'IDENTIFIER', value: word.join(''), line: startLine, column: startCol });
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

  constructor(tokens: Token[], sourceText: string = '') {
    this.tokens = tokens;
    this.sourceText = sourceText;
    this.workspace = {
      id: 1,
      name: 'Architecture Workspace',
      description: '',
      version: '1.0.0',
      model: {
        people: [],
        softwareSystems: [],
        deploymentNodes: [],
        relationships: []
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

  private parseStringArgs(sameLineOnly: boolean = true): string[] {
    const args: string[] = [];
    const startLine = this.current().line;
    while (
      (this.current().type === 'STRING' || this.current().type === 'IDENTIFIER') &&
      !['{', '}', '=', '->'].includes(this.current().value)
    ) {
      const curr = this.current();
      if (sameLineOnly && curr.line !== startLine && curr.type !== 'STRING') {
        break;
      }
      if (curr.type === 'IDENTIFIER' && ['ARROW', 'EQUALS'].includes(this.peekNext().type)) {
        break;
      }
      args.push(curr.value);
      this.pos += 1;
    }
    return args;
  }

  private parseWorkspaceBody() {
    const curr = this.current();
    if (curr.type === 'IDENTIFIER') {
      const val = curr.value.toLowerCase();
      if (val === 'model') {
        this.pos += 1;
        this.expect('LBRACE');
        while (!this.match('RBRACE') && !this.match('EOF')) {
          this.parseModelBody();
        }
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
      } else if (val === 'theme' || val === 'themes') {
        this.pos += 1;
        const args = this.parseStringArgs();
        this.workspace.themes.push(...args);
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

    if (keyword.startsWith('!')) {
      this.pos += 1;
      while (this.pos < this.tokens.length && this.current().line === nextCurr.line && this.current().type !== 'EOF') {
        this.pos += 1;
      }
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
    } else if (keyword === 'deploymentenvironment') {
      this.pos += 1;
      this.parseDeploymentEnvironment();
      return;
    } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'ARROW') {
      this.parseRelationship(nextCurr.value, nextCurr.line);
      return;
    } else {
      this.pos += 1;
    }
  }

  private parsePerson(identifier: string | null = null, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : 'Person';
    const desc = args.length > 1 ? args[1] : '';
    const tags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
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
      properties: {}
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, person);
    this.workspace.model.people.push(person);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const tok = this.current();
        if (tok.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, tok.line);
        } else if (tok.type === 'IDENTIFIER' && tok.value.toLowerCase() === 'tags') {
          this.pos += 1;
          person.tags.push(...this.parseStringArgs());
        } else if (tok.type === 'IDENTIFIER' && tok.value.toLowerCase() === 'url') {
          this.pos += 1;
          person.url = this.expectStringOrIdentifier();
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    person.lineRange = { startLine: sLine, endLine };
  }

  private parseSoftwareSystem(identifier: string | null = null, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : 'Software System';
    const desc = args.length > 1 ? args[1] : '';
    const tags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
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
      properties: {}
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, system);
    this.workspace.model.softwareSystems.push(system);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
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
        if (kw === 'container') {
          this.pos += 1;
          this.parseContainer(system, cIdent, cStartLine);
        } else if (nextCurr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, nextCurr.line);
        } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'ARROW') {
          this.parseRelationship(nextCurr.value, nextCurr.line);
        } else if (kw === 'tags') {
          this.pos += 1;
          system.tags.push(...this.parseStringArgs());
        } else if (kw === 'url') {
          this.pos += 1;
          system.url = this.expectStringOrIdentifier();
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    system.lineRange = { startLine: sLine, endLine };
  }

  private parseContainer(system: SoftwareSystem, identifier: string | null = null, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : 'Container';
    const desc = args.length > 1 ? args[1] : '';
    const tech = args.length > 2 ? args[2] : '';
    const tags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    if (!tags.includes('Container')) tags.unshift('Container');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const container: Container = {
      id: eid,
      identifier: ident,
      systemId: system.id,
      name,
      description: desc,
      technology: tech,
      components: [],
      tags,
      properties: {}
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, container);
    system.containers.push(container);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
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
        if (kw === 'component') {
          this.pos += 1;
          this.parseComponent(container, compIdent, compStartLine);
        } else if (nextCurr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, nextCurr.line);
        } else if (nextCurr.type === 'IDENTIFIER' && this.peekNext().type === 'ARROW') {
          this.parseRelationship(nextCurr.value, nextCurr.line);
        } else if (kw === 'tags') {
          this.pos += 1;
          container.tags.push(...this.parseStringArgs());
        } else if (kw === 'url') {
          this.pos += 1;
          container.url = this.expectStringOrIdentifier();
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    container.lineRange = { startLine: sLine, endLine };
  }

  private parseComponent(container: Container, identifier: string | null = null, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : 'Component';
    const desc = args.length > 1 ? args[1] : '';
    const tech = args.length > 2 ? args[2] : '';
    const tags = args.length > 3 ? args[3].split(',').map((t) => t.trim()) : [];
    if (!tags.includes('Component')) tags.unshift('Component');
    if (!tags.includes('Element')) tags.push('Element');

    const eid = this.getId();
    const ident = identifier || name.toLowerCase().replace(/ /g, '_');
    const component: Component = {
      id: eid,
      identifier: ident,
      containerId: container.id,
      name,
      description: desc,
      technology: tech,
      tags,
      properties: {}
    };

    this.identifierToId.set(ident, eid);
    this.identifierToId.set(name, eid);
    this.idToElement.set(eid, component);
    container.components.push(component);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const curr = this.current();
        if (curr.type === 'ARROW') {
          this.pos += 1;
          const dest = this.expect('IDENTIFIER').value;
          this.parseRelationshipDetails(ident, dest, curr.line);
        } else if (curr.type === 'IDENTIFIER' && this.peekNext().type === 'ARROW') {
          this.parseRelationship(curr.value, curr.line);
        } else if (curr.type === 'IDENTIFIER' && curr.value.toLowerCase() === 'tags') {
          this.pos += 1;
          component.tags.push(...this.parseStringArgs());
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
        const kw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (kw === 'deploymentnode') {
          this.pos += 1;
          this.parseDeploymentNode(envName);
        } else {
          this.pos += 1;
        }
      }
    }
  }

  private parseDeploymentNode(envName: string) {
    const startLine = this.current().line;
    const args = this.parseStringArgs();
    const name = args.length > 0 ? args[0] : 'Deployment Node';
    const desc = args.length > 1 ? args[1] : '';
    const tech = args.length > 2 ? args[2] : '';

    const eid = this.getId();
    const node: DeploymentNode = {
      id: eid,
      identifier: name.toLowerCase().replace(/ /g, '_'),
      name,
      description: desc,
      technology: tech,
      environment: envName,
      instances: 1,
      children: [],
      containerInstances: [],
      tags: ['Deployment Node', 'Element'],
      properties: {}
    };

    this.identifierToId.set(node.identifier, eid);
    this.workspace.model.deploymentNodes.push(node);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const kw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (kw === 'containerinstance' || kw === 'softwareinstance') {
          this.pos += 1;
          const target = this.expectStringOrIdentifier();
          node.containerInstances.push(target);
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? startLine;
    node.lineRange = { startLine, endLine };
  }

  private parseRelationship(sourceIdent: string, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    this.pos += 1; // consume source identifier
    this.expect('ARROW');
    const destIdent = this.expectStringOrIdentifier();
    this.parseRelationshipDetails(sourceIdent, destIdent, sLine);
  }

  private parseRelationshipDetails(sourceIdent: string, destIdent: string, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    const desc = args.length > 0 ? args[0] : '';
    const tech = args.length > 1 ? args[1] : '';
    const tags = args.length > 2 ? args[2].split(',').map((t) => t.trim()) : [];
    if (!tags.includes('Relationship')) tags.unshift('Relationship');

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
      properties: {}
    };
    this.workspace.model.relationships.push(rel);

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const kw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (kw === 'tags') {
          this.pos += 1;
          rel.tags.push(...this.parseStringArgs());
        } else if (kw === 'url') {
          this.pos += 1;
          rel.url = this.expectStringOrIdentifier();
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
    if (['systemlandscape', 'systemcontext', 'container', 'component', 'dynamic', 'deployment'].includes(kw)) {
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
    } else {
      this.pos += 1;
    }
  }

  private parseView(viewType: string, startLine?: number) {
    const sLine = startLine ?? this.current().line;
    const args = this.parseStringArgs();
    let targetRef: string | null = null;
    let key: string | null = null;
    let desc = '';

    if (['systemcontext', 'container', 'component'].includes(viewType)) {
      if (args.length > 0) targetRef = args[0];
      if (args.length > 1) key = args[1];
      if (args.length > 2) desc = args[2];
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
      includeAll: false,
      includedElementIds: [],
      excludedElementIds: [],
      properties: {},
      layoutCoordinates: {}
    };

    if (['systemcontext', 'container'].includes(viewType)) {
      view.softwareSystemId = targetRef;
    } else if (viewType === 'component') {
      view.containerId = targetRef;
    }

    if (this.match('LBRACE')) {
      while (!this.match('RBRACE') && !this.match('EOF')) {
        const vkw = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
        if (vkw === 'include') {
          this.pos += 1;
          const iargs = this.parseStringArgs();
          if (iargs.includes('*')) {
            view.includeAll = true;
          }
          view.includedElementIds.push(...iargs);
        } else if (vkw === 'exclude') {
          this.pos += 1;
          view.excludedElementIds.push(...this.parseStringArgs());
        } else if (vkw === 'autolayout') {
          this.pos += 1;
          const layoutArgs = this.parseStringArgs();
          view.autoLayout = layoutArgs.length > 0 ? layoutArgs[0].toLowerCase() : 'tb';
        } else if (vkw === 'title') {
          this.pos += 1;
          view.title = this.expectStringOrIdentifier();
        } else if (vkw === 'description') {
          this.pos += 1;
          view.description = this.expectStringOrIdentifier();
        } else {
          this.pos += 1;
        }
      }
    }

    const endLine = this.tokens[Math.max(0, this.pos - 1)]?.line ?? sLine;
    view.lineRange = { startLine: sLine, endLine };

    this.workspace.views.push(view);
  }

  private parseStylesBody() {
    const curr = this.current();
    if (curr.type === 'RBRACE' || curr.type === 'EOF') {
      return;
    }

    const kw = curr.type === 'IDENTIFIER' ? curr.value.toLowerCase() : '';
    if (kw === 'element') {
      this.pos += 1;
      const tag = this.expectStringOrIdentifier();
      const style: ElementStyle = { tag };
      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const prop = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
          this.pos += 1;
          const val = this.expectStringOrIdentifier();
          if (prop === 'shape') style.shape = val;
          else if (prop === 'background') style.background = val;
          else if (prop === 'color') style.color = val;
          else if (prop === 'stroke') style.stroke = val;
          else if (prop === 'strokewidth' || prop === 'stroke_width') style.strokeWidth = parseInt(val, 10) || null;
          else if (prop === 'fontsize' || prop === 'font_size') style.fontSize = parseInt(val, 10) || null;
          else if (prop === 'opacity') style.opacity = parseInt(val, 10) || null;
        }
      }
      this.workspace.elementStyles.push(style);
    } else if (kw === 'relationship') {
      this.pos += 1;
      const tag = this.expectStringOrIdentifier();
      const relStyle: RelationshipStyle = { tag };
      if (this.match('LBRACE')) {
        while (!this.match('RBRACE') && !this.match('EOF')) {
          const prop = this.current().type === 'IDENTIFIER' ? this.current().value.toLowerCase() : '';
          this.pos += 1;
          const val = this.expectStringOrIdentifier();
          if (prop === 'thickness') relStyle.thickness = parseInt(val, 10) || null;
          else if (prop === 'color') relStyle.color = val;
          else if (prop === 'style') relStyle.style = val;
          else if (prop === 'routing') relStyle.routing = val;
          else if (prop === 'dashed') relStyle.dashed = val.toLowerCase() === 'true';
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

    for (const view of this.workspace.views) {
      if (view.softwareSystemId && this.identifierToId.has(view.softwareSystemId)) {
        view.softwareSystemId = this.identifierToId.get(view.softwareSystemId)!;
      }
      if (view.containerId && this.identifierToId.has(view.containerId)) {
        view.containerId = this.identifierToId.get(view.containerId)!;
      }

      const resolvedIncluded: string[] = [];
      for (const item of view.includedElementIds) {
        if (item === '*') {
          resolvedIncluded.push('*');
        } else if (this.identifierToId.has(item)) {
          resolvedIncluded.push(this.identifierToId.get(item)!);
        } else {
          resolvedIncluded.push(item);
        }
      }
      view.includedElementIds = resolvedIncluded;
    }
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
