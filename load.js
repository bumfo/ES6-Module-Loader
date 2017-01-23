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

    return function parse(source, resolve, refers) {
      let isImport = false
      let backrefer = ''
      let exported = []

      let parsed = source.replace(parser, (whole, qmark, string, kimport, idefault, kas, ias, kas2, ias2, limports, kfrom, kexport, kdefault, lexports, sexport, iexport) => {
        if (qmark) {
          if (isImport) {
            // console.log(string)
            isImport = false

            let uri = resolve(string)

            refers.push(uri)

            let rtn = `require(${qmark}${uri}${qmark})` + backrefer
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
            // console.log(importDefault)
          }
          if (limports) {
            let importList = parseAsList(limports)
            rtn.push(...importList.map(item => item[0] === item[1] ? item[0] : `${item[0]}: ${item[1]}`))

            // console.log(importList)
          }
          if (ias2) {
            if (rtn.length) {
              backrefer = ', { ' + rtn.join(', ') + ` } = ${ias2}`
            }
            return `const ${ias2} = `
            // console.log(['*', ias2])
          }

          return 'const { ' + rtn.join(', ') + ' } = '
        } else if (kexport) {
          if (lexports) {
            let exportList = parseAsList(lexports)
            exported.push(...exportList)

            return ''
          } else {
            exported.push([iexport, kdefault ? 'default' : iexport])

            return `${sexport} ${iexport}`
          }
        }
      })

      parsed += '\n' + exported.map(item => `exports.${item[1]} = ${item[0]}`).join('\n')

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

  const { load, require } = (() => {
    const baseuri = (() => {
      try {
        return window.location.pathname;
      } catch (e) {
        return module.id;
      }
    })()

    const requests = {}
    const sources = {}
    const exported = {}

    function context(baseuri, uri) {
      return { baseuri, uri }
    }

    function resolve(baseuri, uri) {
      return path.resolve(baseuri, uri)
    }

    async function preprocess({ baseuri, uri }) {
      let cururi = uri
      let refers = []
      if (requests[cururi]) {
        return []
      } else {
        console.log(cururi)
        requests[cururi] = request(cururi)
        sources[cururi] = parse(await requests[cururi], (str) => resolve(cururi, str), refers)
        // console.log(sources[cururi])
        // console.log(sources[cururi])
        console.log(refers)
      }
      return refers.map(uri => context(cururi, uri))
    }

    async function load(...uris) {
      const loads = uris.map(uri => context(baseuri, resolve(baseuri, uri)))
      await aqueue(...loads)
        .grow(context => preprocess(context))

      loads.forEach(({ baseuri, uri }) => require(uri))
    }

    function require(cururi) {
      let exports = exported[cururi]
      if (exports)
        return exports
      console.log(`--- ${cururi}`)
      exports = exported[cururi] = {}
      let source = 'return function(exports) {\'use strict\';\n' + sources[cururi] + '}'
      new Function(source)()(exports)
      return exports
    }

    return { load, require }
  })()

  this.load = load
  this.require = require
})()
