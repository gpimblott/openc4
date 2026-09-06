import { describe, it, expect } from 'vitest';
import { preprocessWorkspace, mapParseError, resolveRelativePath, normalizePath } from '../src/engine/preprocessor.js';
import { parseDsl, ParseError } from '../src/engine/parser.js';

describe('DSL Preprocessor', () => {
  it('handles a single file with no includes', () => {
    const files = {
      'workspace.dsl': `workspace "Test" {
  model {
    u = person "User"
  }
}`
    };

    const res = preprocessWorkspace('workspace.dsl', files);
    expect(res.fullDsl).toBe(files['workspace.dsl']);
    expect(res.lineMap.length).toBe(5);
    expect(res.lineMap[0]).toEqual({ file: 'workspace.dsl', originalLine: 1 });
  });

  it('resolves relative !include directives', () => {
    const files = {
      'workspace.dsl': `workspace "Test" {
  model {
    !include people.dsl
    !include systems/bank.dsl
  }
}`,
      'people.dsl': `user = person "Customer"`,
      'systems/bank.dsl': `bank = softwareSystem "Bank" {
  !include components/api.dsl
}`,
      'systems/components/api.dsl': `container "API" "Application" "Node.js"`
    };

    const res = preprocessWorkspace('workspace.dsl', files);
    expect(res.fullDsl).toContain('user = person "Customer"');
    expect(res.fullDsl).toContain('bank = softwareSystem "Bank"');
    expect(res.fullDsl).toContain('container "API" "Application" "Node.js"');

    // Verify parser can parse the preprocessed result
    const workspace = parseDsl(res.fullDsl + '\nviews {}\n}');
    expect(workspace.name).toBe('Test');
    expect(workspace.model.people.length).toBe(1);
    expect(workspace.model.softwareSystems.length).toBe(1);
  });

  it('detects circular includes', () => {
    const files = {
      'workspace.dsl': `!include a.dsl`,
      'a.dsl': `!include b.dsl`,
      'b.dsl': `!include a.dsl`
    };

    expect(() => preprocessWorkspace('workspace.dsl', files)).toThrow(/Circular !include detected/);
  });

  it('throws when an included file is missing', () => {
    const files = {
      'workspace.dsl': `workspace {
  model {
    !include missing.dsl
  }
}`
    };

    expect(() => preprocessWorkspace('workspace.dsl', files)).toThrow(/Included file not found: 'missing.dsl'/);
  });

  it('resolves directory includes', () => {
    const files = {
      'workspace.dsl': `workspace {
  model {
    !include systems/
  }
}`,
      'systems/order.dsl': `orderSys = softwareSystem "Orders"`,
      'systems/pay.dsl': `paySys = softwareSystem "Payments"`
    };

    const res = preprocessWorkspace('workspace.dsl', files);
    expect(res.fullDsl).toContain('orderSys = softwareSystem "Orders"');
    expect(res.fullDsl).toContain('paySys = softwareSystem "Payments"');
  });

  it('maps parse errors back to original file and line', () => {
    const files = {
      'workspace.dsl': `workspace "Bank" {
  model {
    !include systems/broken.dsl
  }
}`,
      'systems/broken.dsl': `"unterminated string`
    };

    const res = preprocessWorkspace('workspace.dsl', files);
    let parseFailed = false;
    try {
      parseDsl(res.fullDsl);
    } catch (err: any) {
      parseFailed = true;
      const mapped = mapParseError(err, res.lineMap, 'workspace.dsl');
      expect(mapped.file).toBe('systems/broken.dsl');
      expect(mapped.line).toBe(1);
    }
    expect(parseFailed).toBe(true);
  });
});
