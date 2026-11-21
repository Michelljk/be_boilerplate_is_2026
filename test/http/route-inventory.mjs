import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function routeInventory(projectDir) {
  const rows = [];
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory() && entry.name !== 'generated'
          ? walk(path.join(dir, entry.name))
          : entry.isFile() && entry.name.endsWith('controller.ts')
            ? [path.join(dir, entry.name)]
            : [],
      );
  for (const file of walk(path.join(projectDir, 'src'))) {
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      ),
      constants = new Map();
    const value = (node) => {
      if (!node) return '';
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        return node.text;
      if (ts.isPropertyAccessExpression(node)) return node.name.text;
      if (ts.isIdentifier(node)) return constants.get(node.text) ?? node.text;
      if (ts.isArrayLiteralExpression(node))
        return node.elements.flatMap((item) =>
          value(ts.isSpreadElement(item) ? item.expression : item),
        );
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
        return value(node.expression);
      if (ts.isObjectLiteralExpression(node)) {
        const field = node.properties.find(
          (p) =>
            ts.isPropertyAssignment(p) && p.name.getText(source) === 'path',
        );
        return field ? value(field.initializer) : '';
      }
      return '';
    };
    const declarations = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        constants.set(node.name.text, value(node.initializer));
      ts.forEachChild(node, declarations);
    };
    declarations(source);
    const decorators = (node) =>
      (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [])
        .map((deco) => deco.expression)
        .filter(ts.isCallExpression);
    const named = (calls, name) =>
      calls.find((call) => call.expression.getText(source) === name);
    const visit = (node) => {
      if (ts.isClassDeclaration(node)) {
        const decos = decorators(node),
          controller = named(decos, 'Controller');
        if (controller) {
          const bases = [value(controller.arguments[0])].flat(),
            classRoles = named(decos, 'Roles'),
            classPublic = !!named(decos, 'Public');
          for (const method of node.members) {
            if (!ts.isMethodDeclaration(method)) continue;
            const calls = decorators(method),
              http = calls.find((call) =>
                ['Get', 'Post', 'Patch', 'Put', 'Delete'].includes(
                  call.expression.getText(source),
                ),
              );
            if (!http) continue;
            const roles = named(calls, 'Roles') ?? classRoles,
              roleNames = roles ? roles.arguments.flatMap(value) : [],
              paths = [value(http.arguments[0])].flat();
            for (const base of bases)
              for (const route of paths)
                rows.push({
                  method: http.expression.getText(source).toUpperCase(),
                  path: '/api/v1/' + [base, route].filter(Boolean).join('/'),
                  roles: roleNames.join(','),
                  public: classPublic || !!named(calls, 'Public'),
                  file: path.relative(projectDir, file),
                });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return rows.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}
