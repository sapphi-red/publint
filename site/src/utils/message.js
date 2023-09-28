import { formatMessagePath as fp, getPkgPathValue } from 'publint/utils'

/**
 * @param {import('publint').Message} m
 * @param {Record<string, any>} pkg
 */
export function formatMessage(m, pkg) {
  let str = messageToString(m, pkg)
  if (str) {
    str += ` (<a href="/rules.html#${m.code.toLowerCase()}">More info</a>)`
  }
  return str
}

/**
 * @param {import('publint').Message} m
 * @param {Record<string, any>} pkg
 */
function messageToString(m, pkg) {
  /** @param {string[]} path */
  const pv = (path) => getPkgPathValue(pkg, path)
  /** @param {string} s */
  const bold = (s) => `<strong><code>${s}</code></strong>`
  /** @param {string} s */
  const warn = (s) => `<strong><code>${s}</code></strong>`

  switch (m.code) {
    case 'IMPLICIT_INDEX_JS_INVALID_FORMAT':
      return `index.js should be ${m.args.expectFormat} but it is ${m.args.actualFormat}`
    case 'FILE_INVALID_FORMAT': {
      const relativePath = m.args.actualFilePath ?? pv(m.path)
      // prettier-ignore
      return `${bold(relativePath)} is written in ${warn(m.args.actualFormat)}, but is interpreted as ${warn(m.args.expectFormat)}. Consider using the ${warn(m.args.expectExtension)} extension, e.g. ${bold(replaceLast(relativePath, '.js', m.args.expectExtension))}`
    }
    case 'FILE_INVALID_EXPLICIT_FORMAT': {
      const relativePath = m.args.actualFilePath ?? pv(m.path)
      // prettier-ignore
      return `${bold(relativePath)} ends with the ${warn(m.args.actualExtension)} extension, but the code is written in ${warn(m.args.actualFormat)}. Consider using the ${warn(m.args.expectExtension)} extension, e.g. ${bold(replaceLast(relativePath, m.args.actualExtension, m.args.expectExtension))}`
    }
    case 'FILE_DOES_NOT_EXIST':
      // prettier-ignore
      return `File does not exist`
    case 'FILE_NOT_PUBLISHED':
      // prettier-ignore
      return `${bold(fp(m.path))} is ${bold(pv(m.path))} but the file is not published. Is it specified in ${bold('pkg.files')}?`
    case 'HAS_ESM_MAIN_BUT_NO_EXPORTS':
      // prettier-ignore
      return `${bold('pkg.main')} is an ESM file, but it is usually better to use ${bold('pkg.exports')} instead. If you don't support NodeJS 12.6 and below, you can also remove ${bold('pkg.main')}. (This will be a breaking change)`
    case 'HAS_MODULE_BUT_NO_EXPORTS':
      // prettier-ignore
      return `${bold('pkg.module')} is used to output ESM, but ${bold('pkg.exports')} is not defined. As NodeJS doesn't read ${bold('pkg.module')}, the ESM output may be skipped. Consider adding ${bold('pkg.exports')} to export the ESM output. ${bold('pkg.module')} can usually be removed alongside too. (This will be a breaking change)`
    case 'MODULE_SHOULD_BE_ESM':
    case 'EXPORTS_MODULE_SHOULD_BE_ESM':
      // prettier-ignore
      return `Should be ESM, but the code is written in CJS.`
    case 'EXPORTS_GLOB_NO_MATCHED_FILES':
      // prettier-ignore
      return `Does not match any files.`
    case 'EXPORTS_GLOB_NO_DEPRECATED_SUBPATH_MAPPING':
      // prettier-ignore
      return `${bold(fp(m.path))} maps to a path that ends with ${bold('/')} which is deprecated. Use ${bold(fp(m.args.expectPath))}: "${bold(m.args.expectValue)}" instead.`
    case 'EXPORTS_TYPES_SHOULD_BE_FIRST':
      // prettier-ignore
      return `Should be the first in the object as required by TypeScript.`
    case 'EXPORTS_MODULE_SHOULD_PRECEDE_REQUIRE': {
      // prettier-ignore
      return `Should come before the "require" condition so it can take precedence when used by a bundler.`
    }
    case 'EXPORTS_DEFAULT_SHOULD_BE_LAST':
      // prettier-ignore
      return `Should be the last in the object so it doesn't take precedence over the keys following it.`
    case 'EXPORTS_VALUE_INVALID':
      // prettier-ignore
      return `${bold(pv(m.path))} is invalid as it does not start with "${bold('./')}". Use ${bold(m.args.suggestValue)} instead.`
    case 'USE_EXPORTS_BROWSER':
      // prettier-ignore
      return `${bold('pkg.browser')} with a string value can be refactored to use ${bold('pkg.exports')} and the ${bold('"browser"')} condition to declare browser-specific exports. `
        + `e.g. ${bold('pkg.exports["."].browser')}: "${bold(pv(m.path))}". (This will be a breaking change)`
    case 'USE_EXPORTS_OR_IMPORTS_BROWSER':
      // prettier-ignore
      return `${bold('pkg.browser')} with an object value can be refactored to use ${bold('pkg.exports')}/${bold('pkg.imports')} and the ${bold('"browser"')} condition to declare browser-specific exports. (This will be a breaking change)`
    case 'USE_FILES':
      // prettier-ignore
      return `The package ${bold('publishes internal tests or config files')}. You can use ${bold('pkg.files')} to only publish certain files and save user bandwidth.`
    case 'TYPES_NOT_EXPORTED': {
      const typesFilePath = exportsRel(m.args.typesFilePath)
      if (m.args.actualExtension && m.args.expectExtension) {
        // prettier-ignore
        return `The types is not exported. Consider adding ${bold(fp(m.path) + '.types')} to be compatible with TypeScript's ${bold('"moduleResolution": "bundler"')} compiler option. `
            + `Note that you cannot use "${bold(typesFilePath)}" because it has a mismatching format. Instead, you can duplicate the file and use the ${bold(m.args.expectExtension)} extension, e.g. `
            + `${bold(fp(m.path) + '.types')}: "${bold(replaceLast(typesFilePath,m.args.actualExtension, m.args.expectExtension))}"`
      } else {
        // prettier-ignore
        return `The types is not exported. Consider adding ${bold(fp(m.path) + '.types')}: "${bold(typesFilePath)}" to be compatible with TypeScript's ${bold('"moduleResolution": "bundler"')} compiler option.`
      }
    }
    case 'EXPORT_TYPES_INVALID_FORMAT': {
      // convert ['exports', 'types'] -> ['exports', '<condition>', 'types']
      // convert ['exports', 'types', 'node'] -> ['exports', 'types', 'node', '<condition>']
      const expectPath = m.path.slice()
      const typesIndex = m.path.findIndex((p) => p === 'types')
      if (typesIndex === m.path.length - 1) {
        expectPath.splice(typesIndex, 0, m.args.condition)
      } else {
        expectPath.push(m.args.condition)
      }

      let additionalMessage = ''
      // ambiguous default export
      if (m.args.expectFormat === 'ESM' && m.args.actualFormat === 'CJS') {
        additionalMessage = `This causes the types to be ambiguous when default importing the package due to its implied interop. `
      }
      // incorrect dynamic import restriction
      else if (m.args.expectFormat === 'CJS' && m.args.actualFormat === 'ESM') {
        additionalMessage = `This causes the types to only work when dynamically importing the package, even though the package exports CJS. `
      }

      // prettier-ignore
      return `The types is interpreted as ${m.args.actualFormat} when resolving with the "${bold(m.args.condition)}" condition. `
        + additionalMessage
        + `Consider splitting out two ${bold('"types"')} conditions for ${bold('"import"')} and ${bold('"require"')}, and use the ${warn(m.args.expectExtension)} extension, `
        + `e.g. ${bold(fp(expectPath))}: "${bold(replaceLast(pv(m.path), m.args.actualExtension, m.args.expectExtension))}"`
    }
    case 'FIELD_INVALID_VALUE_TYPE': {
      let expectStr = m.args.expectTypes[0]
      for (let i = 1; i < m.args.expectTypes.length; i++) {
        if (i === m.args.expectTypes.length - 1) {
          expectStr += ` or ${m.args.expectTypes[i]}`
        } else {
          expectStr += `, ${m.args.expectTypes[i]}`
        }
      }
      // prettier-ignore
      return `The field value has an invalid ${bold(m.args.actualType)} type. Expected a ${bold(expectStr)} type instead.`
    }
    case 'EXPORTS_VALUE_CONFLICTS_WITH_BROWSER':
      // prettier-ignore
      return `${bold(pv(m.path))} matches ${bold(fp(m.args.browserPath))}: "${bold(pv(m.args.browserPath))}", which overrides the path when building the library with the "${bold(m.args.browserishCondition)}" condition. This is usually unintentional and may cause build issues. Consider using a different file name for ${bold(pv(m.path))}.`
    default:
      return
  }
}

/**
 * Make sure s is an `"exports"` compatible relative path
 * @param {string} s
 */
function exportsRel(s) {
  if (s[0] === '.') return s
  if (s[0] === '/') return '.' + s
  return './' + s
}

/**
 * @param {string} str
 * @param {string} search
 * @param {string} replace
 */
function replaceLast(str, search, replace) {
  const index = str.lastIndexOf(search)
  if (index === -1) return str
  return str.slice(0, index) + replace + str.slice(index + search.length)
}
