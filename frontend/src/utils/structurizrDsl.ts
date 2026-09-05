import type { Monaco } from '@monaco-editor/react';

export const registerStructurizrDsl = (monaco: Monaco) => {
  monaco.languages.register({ id: 'structurizr' });

  monaco.languages.setMonarchTokensProvider('structurizr', {
    keywords: [
      'workspace', 'model', 'views', 'styles', 'configuration', 'theme', 'themes',
      'person', 'softwareSystem', 'system', 'container', 'component',
      'deploymentEnvironment', 'deploymentNode', 'infrastructureNode',
      'containerInstance', 'softwareInstance',
      'systemLandscape', 'systemContext', 'dynamic', 'deployment', 'filtered',
      'include', 'exclude', 'autoLayout', 'title', 'description', 'properties', 'tags', 'url',
      'element', 'relationship', 'shape', 'background', 'color', 'stroke', 'strokeWidth',
      'fontSize', 'border', 'opacity', 'thickness', 'style', 'routing', 'dashed'
    ],

    typeKeywords: [
      'Person', 'SoftwareSystem', 'Container', 'Component', 'DeploymentNode',
      'Box', 'RoundedBox', 'Circle', 'Cylinder', 'WebBrowser', 'MobileDevice',
      'TopBottom', 'LeftRight', 'tb', 'lr', 'rl', 'bt'
    ],

    operators: ['=', '->'],

    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/#.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
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
