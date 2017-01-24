import * as ScissorModule from 'Scissor.js'

export default class Rock {
  isStrongerThan(other) {
    return other instanceof ScissorModule.default
  }
}
