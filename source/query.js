const { union } = require("folktale/adt/union");
const { Just, Nothing } = require("folktale/maybe");
const { Map: ImmutableMap } = require("immutable");

function isObject(value) {
  return value !== null && typeof value === "object";
}

/**
 * Pattern expressions.
 */
const Pattern = union("query:Pattern", {
  /**
   * Matches anything.
   */
  Any() {},

  /**
   * Matches if the pattern matches, and binds the matched value
   * to the given name.
   *
   * @param {Pattern} pattern -- the pattern to match
   * @param {string} name -- a name for the binding
   */
  Bind(name, pattern) {
    return { pattern, name };
  },

  /**
   * Tries to match the left pattern. If it fails, tries to
   * match the right pattern.
   *
   * @param {Pattern} left -- left pattern
   * @param {Pattern} right -- right pattern
   */
  Or(left, right) {
    return { left, right };
  },

  /**
   * Matches if the given pattern doesn't.
   *
   * Note that this means that any binding information within
   * the pattern is lost.
   *
   * @param {Pattern} pattern
   */
  Not(pattern) {
    return { pattern };
  },

  /**
   * Matches if both patterns match.
   *
   * @param {Pattern} left
   * @param {Pattern} right
   */
  And(left, right) {
    return { left, right };
  },

  /**
   * Matches if the value satisfies the predicate.
   *
   * @param {(_: any) => boolean} predicate
   */
  Satisfy(predicate) {
    return { predicate };
  },

  /**
   * Matches if all patterns match.
   *
   * @param {Array<Pattern>} patterns
   */
  Array(patterns) {
    return { patterns };
  },

  /**
   * Partially matches a record value.
   *
   * @param {Record<Pattern>} pairs
   */
  Record(pairs) {
    return { pairs };
  }
});

/**
 * Unifies a value with a pattern, and returns a map of the bound
 * values if a match is found.
 *
 * @param {any} value
 * @param {Pattern} pattern
 * @returns {Maybe<Map<string, any>>} -- the bindings found
 */
function unify(value, pattern) {
  return pattern.matchWith({
    Any: () => Just(ImmutableMap()),

    Bind: ({ pattern, name }) =>
      unify(value, pattern).map(bindings => bindings.set(name, value)),

    Or: ({ left, right }) =>
      unify(value, left).orElse(() => unify(value, right)),

    And: ({ left, right }) =>
      unify(value, left).chain(leftBindings =>
        unify(value, right).map(rightBindings =>
          leftBindings.merge(rightBindings)
        )
      ),

    Not: ({ pattern }) =>
      unify(value, pattern).orElse(() => Just(ImmutableMap())),

    Satisfy: ({ predicate }) => {
      if (predicate(value)) {
        return Just(ImmutableMap());
      } else {
        return Nothing();
      }
    },

    Array: ({ patterns }) => {
      if (!Array.isArray(value) || value.length > patterns.length)
        return Nothing();

      return patterns.reduce((result, pattern, index) => {
        return result.chain(currentBindings => {
          if (!(index in value)) return Nothing();

          return unify(value[index], pattern).map(bindings =>
            currentBindings.merge(bindings)
          );
        });
      }, Just(ImmutableMap()));
    },

    Record: ({ pairs }) => {
      if (!isObject(value)) return Nothing();

      return Object.entries(pairs).reduce((result, [name, pattern]) => {
        return result.chain(currentBindings => {
          if (!(name in value)) return Nothing();

          return unify(value[name], pattern).map(newBindings =>
            currentBindings.merge(newBindings)
          );
        });
      }, Just(ImmutableMap()));
    }
  });
}

/**
 * Recurses down the provided value looking for the given pattern,
 * and returns a stream of all matches.
 *
 * Search is restricted to own properties. Recursive objects are
 * properly handled.
 *
 * @param {any} value
 * @param {Pattern} pattern
 * @returns {Iterable<Map<string, any>>} -- the bindings
 */
function* search(value, pattern, seen = new Set()) {
  if (seen.has(value)) return;

  seen.add(value);
  const match = unify(value, pattern);
  if (Just.hasInstance(match)) {
    yield match.unsafeGet();
  }

  if (Array.isArray(value)) {
    for (x of value) {
      yield* search(x, pattern, seen);
    }
  } else if (isObject(value)) {
    for (const key of Reflect.ownKeys(value)) {
      yield* search(value[key], pattern, seen);
    }
  }
}

module.exports = { Pattern, unify, search };
