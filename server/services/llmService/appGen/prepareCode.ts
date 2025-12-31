import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import stringSimilarity from 'string-similarity';
import * as lucide from 'lucide-react';
import axios from 'axios';

const validLucideIcons = new Set(Object.keys(lucide));

function findClosestLucideIcon(name: string): string {
  const match = stringSimilarity.findBestMatch(
    name,
    Array.from(validLucideIcons)
  );
  return match.bestMatch.target;
}

function isConfigFile(filePath: string): boolean {
  return (
    filePath.endsWith('config.js') ||
    filePath.endsWith('config.ts') ||
    filePath.endsWith('.eslintrc.js') ||
    filePath.endsWith('.eslintrc.ts') ||
    filePath.endsWith('.prettierrc.js') ||
    filePath.endsWith('.prettierrc.ts') ||
    filePath.endsWith('.json')
  );
}

function isInternalAlias(source: string): boolean {
  // Common internal module aliases
  const internalAliases = ['@/', '@app/', '@src/', '@components/'];
  return internalAliases.some((alias) => source.startsWith(alias));
}

export function fixCodeAndCollectImports(
  code: string,
  filePath: string = ''
): { fixedCode: string; imports: Set<string> } {
  // Skip processing config files entirely
  if (isConfigFile(filePath)) {
    return { fixedCode: code, imports: new Set() };
  }

  const imports = new Set<string>();
  let needsLucideIconImport = false;

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true, // Enable error recovery
    });

    const replaced: Record<string, string> = {};
    let changed = false;

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;

        // Skip internal aliases and relative imports
        if (
          source.startsWith('.') ||
          source.startsWith('/') ||
          isInternalAlias(source)
        ) {
          return;
        }

        // Collect all external dependencies
        const base = source.startsWith('@')
          ? source.split('/').slice(0, 2).join('/')
          : source.split('/')[0];
        imports.add(base);

        // Handle Lucide icon replacements
        if (source === 'lucide-react') {
          const newSpecifiers: t.ImportSpecifier[] = [];
          path.node.specifiers.forEach((spec) => {
            if (!t.isImportSpecifier(spec)) return;
            const imported = spec.imported as t.Identifier;
            const iconName = imported.name;

            if (!validLucideIcons.has(iconName)) {
              const replacement = findClosestLucideIcon(iconName);
              console.log(
                `in prepareCode.fixCodeAndCollectImports, replacing ${iconName} with ${replacement}`
              );
              replaced[iconName] = replacement;
              newSpecifiers.push(
                t.importSpecifier(
                  t.identifier(replacement),
                  t.identifier(replacement)
                )
              );
              changed = true;
            } else {
              newSpecifiers.push(spec);
            }
          });
          path.node.specifiers = newSpecifiers;
        }
      },

      JSXIdentifier(path) {
        const name = path.node.name;
        if (replaced[name]) {
          path.node.name = replaced[name];
          changed = true;
        }
      },

      // Fix empty value for SelectItem component in chadcn/ui, otherwise it will throw a runtime error
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        const tagName = openingElement.name;

        if (
          t.isJSXIdentifier(tagName) &&
          (tagName.name === 'SelectItem' || tagName.name === 'Select.Item')
        ) {
          const valueAttr = openingElement.attributes.find(
            (attr): attr is t.JSXAttribute =>
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              attr.name.name === 'value'
          );

          if (
            valueAttr &&
            valueAttr.value &&
            t.isStringLiteral(valueAttr.value) &&
            valueAttr.value.value === ''
          ) {
            console.log(
              `in prepareCode.fixCodeAndCollectImports, Fixing empty value for <${tagName.name}>`
            );

            // Replace empty string "" with "none"
            valueAttr.value = t.stringLiteral('none');
            changed = true;
          }
        }
      },

      // Check for LucideIcon type usage
      TSTypeReference(path) {
        if (
          t.isIdentifier(path.node.typeName) &&
          path.node.typeName.name === 'LucideIcon'
        ) {
          needsLucideIconImport = true;
        }
      },

      // Check for LucideIcon in interface properties
      TSPropertySignature(path) {
        if (t.isTSTypeAnnotation(path.node.typeAnnotation)) {
          const typeAnnotation = path.node.typeAnnotation.typeAnnotation;
          if (
            t.isTSTypeReference(typeAnnotation) &&
            t.isIdentifier(typeAnnotation.typeName) &&
            typeAnnotation.typeName.name === 'LucideIcon'
          ) {
            needsLucideIconImport = true;
          }
        }
      },
    });

    // Add LucideIcon import if needed and not already present
    if (needsLucideIconImport) {
      const hasLucideImport = ast.program.body.some(
        (node: any) =>
          t.isImportDeclaration(node) &&
          node.source.value === 'lucide-react' &&
          node.specifiers.some(
            (spec: any) =>
              t.isImportSpecifier(spec) &&
              t.isIdentifier(spec.imported) &&
              spec.imported.name === 'LucideIcon'
          )
      );

      if (!hasLucideImport) {
        // Find existing lucide-react import to add LucideIcon to it
        const lucideImportIndex = ast.program.body.findIndex(
          (node: any) =>
            t.isImportDeclaration(node) && node.source.value === 'lucide-react'
        );

        if (lucideImportIndex !== -1) {
          // Add LucideIcon to existing lucide-react import
          const lucideImport = ast.program.body[
            lucideImportIndex
          ] as t.ImportDeclaration;
          const lucideIconSpecifier = t.importSpecifier(
            t.identifier('LucideIcon'),
            t.identifier('LucideIcon')
          );
          lucideImport.specifiers.push(lucideIconSpecifier);
          changed = true;
        } else {
          // Create new import for LucideIcon
          const lucideIconImport = t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier('LucideIcon'),
                t.identifier('LucideIcon')
              ),
            ],
            t.stringLiteral('lucide-react')
          );
          ast.program.body.unshift(lucideIconImport);
          changed = true;
        }
        imports.add('lucide-react');
      }
    }

    const fixedCode = changed ? generate(ast, {}, code).code : code;
    return { fixedCode, imports };
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error);
    // Return original code if parsing fails
    return { fixedCode: code, imports: new Set() };
  }
}

async function getLatestVersion(pkg: string): Promise<string | null> {
  try {
    // Encode scoped package names properly
    const encodedPkg = pkg.startsWith('@') ? pkg.replace('/', '%2F') : pkg;
    const res = await axios.get(
      `https://registry.npmjs.org/${encodedPkg}/latest`
    );

    // Validate the response has the expected shape
    if (!res.data || typeof res.data.version !== 'string') {
      console.error(
        `Invalid response format from npm registry for package "${pkg}"`
      );
      return null;
    }

    return `^${res.data.version}`;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.log(`Package "${pkg}" not found in npm registry`);
    } else {
      // This means input is probably wrong, we don't pollute package.json with non-existent packages
      console.error(`Error fetching version for package "${pkg}":`, error);
    }
    return null;
  }
}

// We do not need to do code analysis for these files, as they are pre-installed in the starter react app
const uiComponentsToFilter = new Set([
  'frontend/src/components/ui/accordion.tsx',
  'frontend/src/components/ui/alert-dialog.tsx',
  'frontend/src/components/ui/alert.tsx',
  'frontend/src/components/ui/aspect-ratio.tsx',
  'frontend/src/components/ui/avatar.tsx',
  'frontend/src/components/ui/badge.tsx',
  'frontend/src/components/ui/breadcrumb.tsx',
  'frontend/src/components/ui/button.tsx',
  'frontend/src/components/ui/calendar.tsx',
  'frontend/src/components/ui/card.tsx',
  'frontend/src/components/ui/carousel.tsx',
  'frontend/src/components/ui/chart.tsx',
  'frontend/src/components/ui/checkbox.tsx',
  'frontend/src/components/ui/collapsible.tsx',
  'frontend/src/components/ui/command.tsx',
  'frontend/src/components/ui/context-menu.tsx',
  'frontend/src/components/ui/dialog.tsx',
  'frontend/src/components/ui/drawer.tsx',
  'frontend/src/components/ui/dropdown-menu.tsx',
  'frontend/src/components/ui/form.tsx',
  'frontend/src/components/ui/hover-card.tsx',
  'frontend/src/components/ui/input-otp.tsx',
  'frontend/src/components/ui/input.tsx',
  'frontend/src/components/ui/label.tsx',
  'frontend/src/components/ui/menubar.tsx',
  'frontend/src/components/ui/navigation-menu.tsx',
  'frontend/src/components/ui/pagination.tsx',
  'frontend/src/components/ui/popover.tsx',
  'frontend/src/components/ui/progress.tsx',
  'frontend/src/components/ui/radio-group.tsx',
  'frontend/src/components/ui/resizable.tsx',
  'frontend/src/components/ui/scroll-area.tsx',
  'frontend/src/components/ui/select.tsx',
  'frontend/src/components/ui/separator.tsx',
  'frontend/src/components/ui/sheet.tsx',
  'frontend/src/components/ui/sidebar.tsx',
  'frontend/src/components/ui/skeleton.tsx',
  'frontend/src/components/ui/slider.tsx',
  'frontend/src/components/ui/sonner.tsx',
  'frontend/src/components/ui/switch.tsx',
  'frontend/src/components/ui/table.tsx',
  'frontend/src/components/ui/tabs.tsx',
  'frontend/src/components/ui/textarea.tsx',
  'frontend/src/components/ui/toast.tsx',
  'frontend/src/components/ui/toaster.tsx',
  'frontend/src/components/ui/toggle-group.tsx',
  'frontend/src/components/ui/toggle.tsx',
  'frontend/src/components/ui/tooltip.tsx',
  'frontend/src/components/ui/use-toast.ts',
  'frontend/src/hooks/use-mobile.tsx',
  'frontend/src/hooks/use-toast.ts',
  'frontend/src/lib/utils.ts',
]);

export async function processSourceFiles(
  files: any[]
): Promise<{ files: any[]; allImports: Set<string> }> {
  const allImports = new Set<string>();

  const processedFiles = await Promise.all(
    files.map(async (file: any) => {
      // Skip processing for UI component files
      if (uiComponentsToFilter.has(file.path)) {
        return file;
      }

      if (
        file.path.endsWith('.tsx') ||
        file.path.endsWith('.ts') ||
        file.path.endsWith('.jsx') ||
        file.path.endsWith('.js')
      ) {
        // fix code issues and collect all imports (for dependencies to be added in package.json)
        const { fixedCode, imports } = fixCodeAndCollectImports(
          file.content,
          file.path
        );
        imports.forEach((i) => allImports.add(i));
        return { ...file, content: fixedCode };
      } else {
        return file;
      }
    })
  );

  return { files: processedFiles, allImports };
}

export async function updatePackageJsonDependencies(
  pkgFile: any,
  allImports: Set<string>
): Promise<any> {
  if (!pkgFile) throw new Error('package.json not found in LLM code output');

  const pkgJson = JSON.parse(pkgFile.content);
  pkgJson.dependencies = pkgJson.dependencies || {};

  const missing = [...allImports].filter(
    (dep) => !(dep in pkgJson.dependencies)
  );
  for (const dep of missing) {
    // get the latest version of the dependency, which is a network call. TODO: cache this
    const version = await getLatestVersion(dep);
    if (version !== null) {
      pkgJson.dependencies[dep] = version;
      console.log(
        `in prepareCode.updatePackageJsonDependencies, added ${dep}: ${version}`
      );
    }
  }

  return {
    ...pkgFile,
    content: JSON.stringify(pkgJson, null, 2),
  };
}

export async function prepareFinalReactCodeJson(codeObj: any): Promise<any> {
  // Filter files to only include those under the frontend folder
  const frontendFiles = codeObj.files.filter((file: any) =>
    file.path.startsWith('frontend/')
  );

  // Process only frontend files to fix imports and collect dependencies
  const { files: processedFiles, allImports } = await processSourceFiles(
    frontendFiles
  );

  // Find and update package.json within the frontend folder
  const pkgFile = processedFiles.find(
    (f: any) => f.path === 'frontend/package.json'
  );
  const updatedPkgFile = pkgFile
    ? await updatePackageJsonDependencies(pkgFile, allImports)
    : null;

  // Replace processed frontend files while keeping other files unchanged
  return {
    ...codeObj,
    files: codeObj.files.map((f: any) => {
      if (f.path === 'frontend/package.json' && updatedPkgFile) {
        return updatedPkgFile;
      } else if (f.path.startsWith('frontend/')) {
        // Replace with processed version of frontend files
        const processedFile = processedFiles.find(
          (pf: any) => pf.path === f.path
        );
        return processedFile || f;
      } else {
        // Keep non-frontend files as is
        return f;
      }
    }),
  };
}
