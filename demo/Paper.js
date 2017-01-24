import * as RockModule from 'Rock.js'

export default class Paper {
  isStrongerThan(other) {
    return other instanceof RockModule.default
  }
}
