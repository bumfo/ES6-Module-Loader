# ES6-Module-Loader

## Supports Circular Dependencies

```javascript
// Rock.js
import * as ScissorModule from 'Scissor.js'

export default class Rock {
  isStrongerThan(other) {
    return other instanceof ScissorModule.default
  }
}

// Scissor.js
import * as PaperModule from 'Paper.js'

export default class Scissor {
  isStrongerThan(other) {
    return other instanceof PaperModule.default
  }
}

// Paper.js
import * as RockModule from 'Rock.js'

export default class Paper {
  isStrongerThan(other) {
    return other instanceof RockModule.default
  }
}

```

Entry module:
```javascript
import Rock from 'Rock.js'
import Scissor from 'Scissor.js'
import Paper from 'Paper.js'

let a = new Rock()
let b = new Scissor()
let c = new Paper()

console.log(a.isStrongerThan(b))
console.log(a.isStrongerThan(c))

console.log(b.isStrongerThan(a))
console.log(b.isStrongerThan(c))

console.log(c.isStrongerThan(a))
console.log(c.isStrongerThan(b))

```

```html
<!-- include import.js -->
<script src="import.js"></script>
<!-- use in scripts -->
<script>
  System.import('./entry.js')
</script>
```

## Import stdandard JS interface as modules

```javascript
import { PI, sqrt, abs } from 'std/math'
import { create as createObject } from 'std/object'

console.log(sqrt(2), PI)
console.log(createObject(null))

```
