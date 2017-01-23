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
