const path = require('node:path');
const ts = require('typescript');

// Compile with TypeScript's own resolver so emitted CommonJS and declarations
// use relative paths without a separate globbing/rewriting dependency.
function build(directory = process.cwd()) {
  const configPath = ts.findConfigFile(directory, ts.sys.fileExists);
  if (!configPath) throw new Error('tsconfig.json was not found');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return report([config.error]);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [...(config.error ? [config.error] : []), ...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) return report(diagnostics);

  const aliases = Object.keys(parsed.options.paths || {}).map((alias) => {
    const star = alias.indexOf('*');
    return star < 0 ? (name) => name === alias : (name) => name.startsWith(alias.slice(0, star)) && name.endsWith(alias.slice(star + 1));
  });
  const root = path.resolve(parsed.options.rootDir || path.dirname(configPath));
  const rewrite = (context) => (file) => {
    const replace = (specifier) => {
      if (!ts.isStringLiteral(specifier) || !aliases.some((matches) => matches(specifier.text))) return specifier;
      const resolved = ts.resolveModuleName(specifier.text, file.fileName, parsed.options, ts.sys).resolvedModule;
      if (!resolved || !path.resolve(resolved.resolvedFileName).startsWith(root + path.sep)) {
        throw new Error(`Cannot emit repository alias ${specifier.text} in ${file.fileName}`);
      }
      let relative = path.relative(path.dirname(file.fileName), resolved.resolvedFileName).split(path.sep).join('/');
      relative = relative.replace(/(?:\.d)?\.cts$/, '.cjs').replace(/(?:\.d)?\.mts$/, '.mjs').replace(/(?:\.d)?\.tsx?$/, '.js');
      if (!relative.startsWith('.')) relative = './' + relative;
      return context.factory.createStringLiteral(relative);
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) return context.factory.updateImportDeclaration(node, node.modifiers, node.importClause, replace(node.moduleSpecifier), node.attributes);
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) return context.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, replace(node.moduleSpecifier), node.attributes);
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) {
        return context.factory.updateImportEqualsDeclaration(node, node.modifiers, node.isTypeOnly, node.name, context.factory.updateExternalModuleReference(node.moduleReference, replace(node.moduleReference.expression)));
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        return context.factory.updateImportTypeNode(node, context.factory.updateLiteralTypeNode(node.argument, replace(node.argument.literal)), node.attributes, node.qualifier, node.typeArguments, node.isTypeOf);
      }
      if (ts.isCallExpression(node) && node.arguments.length === 1 && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        return context.factory.updateCallExpression(node, node.expression, node.typeArguments, [replace(node.arguments[0])]);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(file, visit);
  };
  const emitted = program.emit(undefined, undefined, undefined, undefined, { before: [rewrite], afterDeclarations: [rewrite] });
  return emitted.emitSkipped || emitted.diagnostics.length ? report(emitted.diagnostics) : 0;
}

function report(diagnostics) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  }));
  return 1;
}

module.exports = { build };
if (require.main === module) process.exitCode = build();
