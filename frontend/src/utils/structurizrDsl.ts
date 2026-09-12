import type { Monaco } from '@monaco-editor/react';

export const registerStructurizrDsl = (monaco: Monaco) => {
  monaco.languages.register({ id: 'structurizr' });

  monaco.languages.setLanguageConfiguration('structurizr', {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  monaco.languages.setMonarchTokensProvider('structurizr', {
    keywords: [
      'workspace', 'model', 'views', 'styles', 'configuration', 'theme', 'themes',
      'person', 'softwareSystem', 'system', 'container', 'component',
      'deploymentEnvironment', 'deploymentNode', 'infrastructureNode',
      'containerInstance', 'softwareInstance', 'softwareSystemInstance', 'instances', 'healthCheck',
      'systemLandscape', 'systemContext', 'dynamic', 'deployment', 'filtered',
      'include', 'exclude', 'autoLayout', 'title', 'description', 'properties', 'tag', 'tags', 'url', 'technology', 'default',
      'element', 'relationship', 'shape', 'background', 'color', 'stroke', 'strokeWidth',
      'fontSize', 'border', 'opacity', 'thickness', 'style', 'routing', 'dashed'
    ],

    directives: [
      '!include', '!ref', '!plugin', '!docs', '!adrs', '!script', '!identifiers', '!element', '!relationship'
    ],

    typeKeywords: [
      'Person', 'SoftwareSystem', 'Container', 'Component', 'DeploymentNode', 'InfrastructureNode',
      'Box', 'RoundedBox', 'Circle', 'Cylinder', 'WebBrowser', 'MobileDevice',
      'TopBottom', 'LeftRight', 'tb', 'lr', 'rl', 'bt'
    ],

    operators: ['=', '->', '-/>'],

    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/#.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/!(?:include|ref|plugin|docs|adrs|script|identifiers|element|relationship)\b/, 'keyword.directive'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/-\/>/, 'operator.remove_arrow'],
        [/->/, 'operator.arrow'],
        [/=/, 'operator.equals'],
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@default': 'identifier'
          }
        }],
        [/\d+/, 'number'],
        [/#[0-9a-fA-F]{3,6}/, 'number.hex'],
        [/[{}()\[\]]/, '@brackets'],
      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ],
    }
  });

  monaco.languages.registerCompletionItemProvider('structurizr', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        {
          label: '!include',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '!include ${1:file.dsl}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'person',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'person "${1:Name}" "${2:Description}" "${3:Tags}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'softwareSystem',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'softwareSystem "${1:Name}" "${2:Description}" "${3:Tags}" {\n    $0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'container',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'container "${1:Name}" "${2:Description}" "${3:Technology}" "${4:Tags}" {\n    $0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'component',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'component "${1:Name}" "${2:Description}" "${3:Technology}" "${4:Tags}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'deploymentNode',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'deploymentNode "${1:Name}" "${2:Description}" "${3:Technology}" {\n    $0\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'infrastructureNode',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'infrastructureNode "${1:Name}" "${2:Description}" "${3:Technology}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'containerInstance',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'containerInstance ${1:containerIdentifier}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'dynamicView',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'dynamic ${1:*} "${2:Key}" "${3:Description}" {\n    ${4:source} -> ${5:target} "${6:1. Step description}"\n    autoLayout lr\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'deploymentView',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'deployment ${1:systemIdentifier} "${2:Environment}" "${3:Key}" {\n    include *\n    autoLayout lr\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'properties',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'properties {\n    "${1:key}" "${2:value}"\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'systemContext',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'systemContext ${1:systemIdentifier} "${2:Key}" {\n    include *\n    autoLayout lr\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'containerView',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'container ${1:systemIdentifier} "${2:Key}" {\n    include *\n    autoLayout tb\n}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ];

      return { suggestions };
    },
  });
};
