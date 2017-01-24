import { maxSpeed } from 'rules.js'

export function sq(x) {
  return x * x
}

export function bestSpeed(x) {
  return 0.5 * maxSpeed(x)
}
