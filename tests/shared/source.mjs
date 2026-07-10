import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export const repoPath = (...parts) => path.join(repoRoot, ...parts)
export const exists = (...parts) => existsSync(repoPath(...parts))
export const read = (...parts) => readFileSync(repoPath(...parts), 'utf8')
export const readJson = (...parts) => JSON.parse(read(...parts))

export function fileNames(...parts) {
  return readdirSync(repoPath(...parts), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
}

export function dirNames(...parts) {
  return readdirSync(repoPath(...parts), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function walkFiles(...parts) {
  const root = path.join(...parts)
  const results = []

  const visit = (relativeDir) => {
    for (const entry of readdirSync(repoPath(relativeDir), { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name)
      if (entry.isDirectory()) {
        visit(relativePath)
      } else if (entry.isFile()) {
        results.push(relativePath)
      }
    }
  }

  visit(root)
  return results.sort()
}

export function parseSource(...parts) {
  const filePath = repoPath(...parts)
  const text = read(...parts)
  const ext = path.extname(filePath).toLowerCase()
  const scriptKind =
    ext === '.tsx'
      ? ts.ScriptKind.TSX
      : ext === '.jsx'
        ? ts.ScriptKind.JSX
        : ext === '.json'
          ? ts.ScriptKind.JSON
          : ts.ScriptKind.TS

  return {
    filePath,
    text,
    ast: ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind),
  }
}

export function collectStringLiteralUnion(source, typeName) {
  const node = findNode(source.ast, (candidate) => {
    return ts.isTypeAliasDeclaration(candidate) && candidate.name.text === typeName
  })

  assert.ok(node, `Missing type alias ${typeName} in ${source.filePath}`)
  assert.ok(ts.isUnionTypeNode(node.type), `${typeName} must be a string literal union`)

  return node.type.types
    .map((typeNode) => {
      assert.ok(
        ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal),
        `${typeName} contains a non-string-literal member`,
      )
      return typeNode.literal.text
    })
    .sort()
}

export function collectInterfaceMemberNames(source, interfaceName) {
  const node = findNode(source.ast, (candidate) => {
    return ts.isInterfaceDeclaration(candidate) && candidate.name.text === interfaceName
  })

  assert.ok(node, `Missing interface ${interfaceName} in ${source.filePath}`)
  return node.members.map(memberName).sort()
}

export function collectVariableObjectKeys(source, variableName) {
  const initializer = findVariableInitializer(source, variableName)
  assert.ok(
    initializer && ts.isObjectLiteralExpression(initializer),
    `${variableName} must be an object literal in ${source.filePath}`,
  )
  return initializer.properties.map(propertyName).sort()
}

export function collectVariableStringArray(source, variableName) {
  const initializer = findVariableInitializer(source, variableName)
  assert.ok(
    initializer && ts.isArrayLiteralExpression(initializer),
    `${variableName} must be an array literal in ${source.filePath}`,
  )
  return initializer.elements.map(stringLiteralText).sort()
}

export function collectNewSetStringLiterals(source, variableName) {
  const initializer = findVariableInitializer(source, variableName)
  assert.ok(
    initializer && ts.isNewExpression(initializer),
    `${variableName} must be initialized with new Set(...) in ${source.filePath}`,
  )
  const firstArg = initializer.arguments?.[0]
  assert.ok(
    firstArg && ts.isArrayLiteralExpression(firstArg),
    `${variableName} Set initializer must receive an array literal`,
  )
  return firstArg.elements.map(stringLiteralText).sort()
}

export function collectSwitchCaseTexts(source, functionName) {
  const fn = findFunctionLike(source, functionName)
  const switchNode = findNode(fn, ts.isSwitchStatement)
  assert.ok(switchNode, `Missing switch statement in ${functionName}`)

  const cases = new Map()
  for (const clause of switchNode.caseBlock.clauses) {
    if (ts.isCaseClause(clause)) {
      cases.set(stringLiteralText(clause.expression), clause.getText(source.ast))
    } else {
      cases.set('default', clause.getText(source.ast))
    }
  }
  return cases
}

export function collectAllSwitchCaseLabels(source) {
  const labels = []
  visit(source.ast, (node) => {
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) {
      labels.push(node.expression.text)
    }
  })
  return labels.sort()
}

export function collectImports(source) {
  const imports = []
  for (const statement of source.ast.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push(statement.moduleSpecifier.text)
    }
  }
  return imports.sort()
}

export function functionText(source, functionName) {
  return findFunctionLike(source, functionName).getText(source.ast)
}

export function variableText(source, variableName) {
  const declaration = findVariableDeclaration(source.ast, variableName)
  assert.ok(declaration, `Missing variable ${variableName} in ${source.filePath}`)
  return declaration.getText(source.ast)
}

export function objectPropertyText(source, variableName, key) {
  const initializer = findVariableInitializer(source, variableName)
  assert.ok(
    initializer && ts.isObjectLiteralExpression(initializer),
    `${variableName} must be an object literal`,
  )
  const property = initializer.properties.find((candidate) => propertyName(candidate) === key)
  assert.ok(property, `Missing property ${key} in ${variableName}`)
  return property.getText(source.ast)
}

export function deepKeyPaths(value, prefix = '') {
  const keys = []
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      keys.push(...deepKeyPaths(child, next))
    } else {
      keys.push(next)
    }
  }
  return keys.sort()
}

export function setDiff(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  return {
    onlyInA: [...setA].filter((value) => !setB.has(value)).sort(),
    onlyInB: [...setB].filter((value) => !setA.has(value)).sort(),
  }
}

export function assertSetEqual(actual, expected, message) {
  assert.deepEqual(setDiff(actual, expected), { onlyInA: [], onlyInB: [] }, message)
}

export function assertTextOrder(text, orderedSnippets, message = 'Unexpected source order') {
  let previousIndex = -1

  for (const snippet of orderedSnippets) {
    const index = text.indexOf(snippet, previousIndex + 1)
    assert.notEqual(index, -1, `${message}: missing ${JSON.stringify(snippet)}`)
    previousIndex = index
  }
}

function findNode(root, predicate) {
  let found = null
  visit(root, (node) => {
    if (!found && predicate(node)) {
      found = node
    }
  })
  return found
}

function visit(node, callback) {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}

function findVariableDeclaration(root, variableName) {
  return findNode(root, (node) => {
    return (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName
    )
  })
}

function findVariableInitializer(source, variableName) {
  const declaration = findVariableDeclaration(source.ast, variableName)
  assert.ok(declaration, `Missing variable ${variableName} in ${source.filePath}`)
  return declaration.initializer
}

function findFunctionLike(source, functionName) {
  const node = findNode(source.ast, (candidate) => {
    return ts.isFunctionDeclaration(candidate) && candidate.name?.text === functionName
  })
  if (node) {
    return node
  }

  const declaration = findVariableDeclaration(source.ast, functionName)
  if (
    declaration?.initializer &&
    (ts.isArrowFunction(declaration.initializer) ||
      ts.isFunctionExpression(declaration.initializer))
  ) {
    return declaration.initializer
  }

  assert.fail(`Missing function ${functionName} in ${source.filePath}`)
}

function memberName(member) {
  if (!member.name) {
    throw new Error('Interface member has no name')
  }
  return propertyName(member)
}

function propertyName(property) {
  const name = property.name
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  throw new Error(`Unsupported property name: ${name.getText()}`)
}

function stringLiteralText(node) {
  assert.ok(ts.isStringLiteral(node), `Expected string literal, got ${node.getText()}`)
  return node.text
}
