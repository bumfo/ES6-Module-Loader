import * as PaperModule from 'Paper.js'

export default class Scissor {
  isStrongerThan(other) {
    return other instanceof PaperModule.default
  }
}
