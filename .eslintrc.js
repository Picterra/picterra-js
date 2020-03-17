module.exports = {
	'env': {
		'browser': true,
		'es6': true,
		'node': true
	},
	'extends': [
		"standard"
	],
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	// add your custom rules here
  'rules': {
    'prefer-const': 0,
    'no-prototype-builtins': 0,
    'dot-notation': 0,
    'array-bracket-spacing': 0,
    'lines-between-class-members': 0,
    'quote-props': ["error", "as-needed", { "unnecessary": false }],
    'object-curly-newline': ["error", { "consistent": true }],
    // callback-literal
    // see https://github.com/standard/eslint-plugin-standard/issues/27
    'standard/no-callback-literal': 0,
    // JS indent
    'indent': ['error', 2, {
      'FunctionDeclaration': { 'parameters': 'first' },
      'FunctionExpression': { 'parameters': 'first' },
      'ArrayExpression': 'first',
      'ObjectExpression': 'first',
      'ImportDeclaration': 'first',
      'CallExpression': { 'arguments': 'first' },
      'SwitchCase': 1
    }],
		'object-curly-spacing': 0,
	}
}