!(() => {
  const path = new (class {
    explicit(p) {
      let firstChar = p[0]

      return firstChar === '.' || firstChar === '/'
    }
    foldername(p) {
      let lastSlash = p.lastIndexOf('/')

      return path.filename(p.substring(p.lastIndexOf('/', lastSlash - 1) + 1, lastSlash))
    }
    filename(p) {
      return p.substr(p.lastIndexOf('/') + 1)
    }
    extension(p) {
      let fname = path.filename(p)

      let dotIndex = fname.lastIndexOf('.')
      if (dotIndex !== -1)
        return fname.substr(dotIndex + 1)
      return ''
    }
    basedir(p) {
      return p.substr(0, p.lastIndexOf('/') + 1)
    }
    basedir2(p) {
      let lastSlash = p.lastIndexOf('/')
      if (lastSlash !== -1)
        return p.substr(0, lastSlash)
      return p
    }
    normalize(url) {
      let parts = url.split('/')

      for (let i = 0; i < parts.length; ++i) {
        switch (parts[i]) {
          case '.':
            parts.splice(i--, 1)
            break
          case '..':
            if (i > 0 && (i > 1 || parts[0] !== '')) {
              parts.splice(--i, 2)
              --i
            } else {
              parts.splice(i--, 1)
            }
            break
        }
      }
      return parts.join('/')
    }
    resolve(...args) {
      return path.normalize(args.reduce((dir, p) => {
        return path.basedir(dir) + p
      }))
    }
  })

  const parse = (() => {
    function regex(flags, ...args) {
      return new RegExp(
        args
          .map(re => re.source)
          .join('|'), 
      flags)
    }

    const strings = /(['"])((?:(?!\1|\\).|\\.)*)\1/
    const comments = /\/\/.*$|\/\*(?:[^*]|\*(?!\/))\*\//
    const imports = /\b(import)\b\s*(?:([A-Za-z_$][\w$]*)\s*(?:\b(as)\b\s*([A-Za-z_$][\w$]*)\s*)?(?:,\s*(?=\{|\*)|(?=\b(?:from)\b)))?(?:\*\s*(?:\b(as)\b\s*([A-Za-z_$][\w$]*)\s*)?|\{([^}]*)\})?\s*?\b(from)\b\s*(?=['"])/
    const exports = /\b(export)\b\s*(?:\b(default)\b\s*)?(?:\{([^}]*)\}|(?:\b(var|let|const|class|function|async[ \t]+function)\b\s*)(?:([A-Za-z_$][\w$]*)))\s*/
    const parser = regex('gm', strings, comments, imports, exports)

    function parseAsList(list) {
      return list.split(',')
        .map(str => str.trim().split(/\b(?:as)\b/).map(str => str.trim()))
        .map(arr => [arr[0], arr[1] || arr[0]])
    }

    function joinExported(exported) {
      return exported.map(item => `exports.${item[1]} = ${item[0]}`).join('\n')
    }

    return function parse(source, resolve, refers) {
      let isImport = false
      let backrefer = ''
      let exported = []
      let forwardExported = []

      let parsed = source.replace(parser, (whole, qmark, string, kimport, idefault, kas, ias, kas2, ias2, limports, kfrom, kexport, kdefault, lexports, sexport, iexport) => {
        if (qmark) {
          if (isImport) {
            isImport = false

            let uri = resolve(string)

            refers.push(uri)

            let rtn = `__import(${qmark}${uri}${qmark})` + backrefer
            backrefer = ''
            return rtn
          }
          return whole
        } else if (kimport) {
          isImport = true

          let rtn = []

          if (idefault) {
            let importDefault = [idefault, ias || idefault]
            rtn.push(`default: ${importDefault[1]}`)
          }
          if (limports) {
            let importList = parseAsList(limports)
            rtn.push(...importList.map(item => item[0] === item[1] ? item[0] : `${item[0]}: ${item[1]}`))
          }
          if (ias2) {
            if (rtn.length) {
              backrefer = ', { ' + rtn.join(', ') + ` } = ${ias2}`
            }
            return `const ${ias2} = `
          }

          return 'const { ' + rtn.join(', ') + ' } = '
        } else if (kexport) {
          if (lexports) {
            let exportList = parseAsList(lexports)
            exported.push(...exportList)

            return ''
          } else {
            (sexport.substr(-8) === 'function' ? forwardExported : exported).push([iexport, kdefault ? 'default' : iexport])

            return `${sexport} ${iexport}`
          }
        }
      })

      parsed = [joinExported(forwardExported), parsed, joinExported(exported)].join('\n')

      return parsed
    }
  })()

  const aqueue = (() => {
    function aqueue(...args) {
      return {
        grow(resolver) {
          return new Promise((done) => {
            let waiting = 0
            let resolveAll = (args) => args.forEach(async (arg) => {
              ++waiting
              resolveAll(await resolver(arg))
              --waiting
              if (waiting === 0) {
                done()
              }
            })
            resolveAll(args)
          })
        }
      }
    }

    return aqueue
  })()

  const request = (() => {
    function request(uri) {
      return new Promise((done, reject) => {
        let xhr = new XMLHttpRequest()
        xhr.open('post', uri)
        xhr.onload = () => {
          if (xhr.status === 200) {
            // setTimeout(() => {
              done(xhr.responseText)
            // }, 1000)
          } else {
            reject(xhr.status)
          }
        }
        xhr.send()
      })
    }

    return request
  })()

  const { System } = (() => {
    const requests = {}
    const sources = {}
    const exported = {
      'std/math': Math,
      'std/object': Object,
    }
    const reserved = {
      'std/math': 1,
      'std/object': 1,
    }

    function context(baseuri, uri) {
      return { baseuri, uri }
    }

    function resolve(baseuri, uri) {
      if (reserved[uri]) {
        return uri
      }
      return path.resolve(baseuri, uri)
    }

    async function preprocess({ baseuri, uri }) {
      let absuri = uri
      let refers = []
      if (reserved[absuri] || requests[absuri]) {
        return []
      } else {
        requests[absuri] = request(absuri)
        sources[absuri] = parse(await requests[absuri], (str) => resolve(absuri, str), refers)
      }
      return refers.map(uri => context(absuri, uri))
    }

    async function __load(baseuri, absuri) {
      await aqueue(context(baseuri, absuri))
        .grow(context => preprocess(context))

      return __import(absuri)
    }

    function getSystem(baseuri) {
      return {
        async import(uri) {
          let absuri = resolve(baseuri, uri)
          if (exported[absuri] || sources[absuri])
            return __import(absuri)

          return await __load(baseuri, absuri)
        }
      }
    }

    function createExports() {
      return Object.create(null)
    }

    function __import(absuri) {
      let exports = exported[absuri]
      if (exports)
        return exports
      console.log(`--- ${absuri}`)
      exports = exported[absuri] = createExports()
      let source = 'return function(exports, __import, System) {\'use strict\';\n' + sources[absuri] + '}'
      new Function(source)()(exports, __import, getSystem(absuri))
      Object.freeze(exports)
      return exports
    }

    return {
      System: getSystem((() => {
        try {
          return window.location.pathname;
        } catch (e) {
          return module.id;
        }
      })())
    }
  })()

  this.System = System
})()
