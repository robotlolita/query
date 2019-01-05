const { union, derivations } = require("folktale/adt/union");

const Expr = union("Expr", {
  Let(name, init, body) {
    return { type: "Let", name, init, body };
  },
  Var(name) {
    return { type: "Var", name };
  },
  Call(expr, args) {
    return { type: "Call", expr, args };
  },
  Lambda(params, body) {
    return { type: "Lambda", params, body };
  },
  Num(value) {
    return { type: "Num", value };
  },
  Seq(exprs) {
    return { type: "Seq", exprs };
  }
}).derive(derivations.debugRepresentation);

const { Let, Var, Call, Lambda, Num, Seq } = Expr;
const tree = Let(
  "x",
  Num(1),
  Let(
    "y",
    Num(2),
    Seq([
      Call(Var("add"), [Var("x"), Var("y")]),
      Call(Var("add"), [Var("y"), Var("y")]),
      Call(Var("add"), [Var("x"), Var("x")])
    ])
  )
);

const { unify, search, Pattern: P } = require("./source/query");
const eq = x => P.Satisfy(y => x === y);

console.log(unify(tree, P.Bind("let", P.Record({ type: eq("Let") }))));

console.log(
  [
    ...search(
      tree,
      P.Bind(
        "call",
        P.Record({
          type: eq("Call"),
          args: P.Array([P.Record({ type: eq("Var"), name: eq("x") }), P.Any()])
        })
      )
    )
  ].map(x => x.get("call"))
);
