export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci'],
    ],
    'scope-enum': [
      2,
      'always',
      ['vue', 'tauri', 'sdk', 'workflow', 'knowledge', 'hooks', 'chat', 'ui'],
    ],
    'subject-case': [0],
  },
}
