export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(): string {
  // TODO: introduce type of view, ex: console, table and define wrapper for each one
  //default return for now: console wrapper
  return '.Q.trp[{x:parse$[-11=type x;-3!x;x];x:eval$[0h=type x;_[;x]neg(";";(::))~(first;last)@\\:x;x];system"c ",-3!20 200|c:system "c";r:`result`type`keys`meta`data!(1b;0h;();();.Q.s x);system"c ",-3!c;r};;{\'(x,"\n\n","\n"sv 2 sublist"\n"vs .Q.sbt y)}]';
}
