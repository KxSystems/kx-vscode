foo:{[x] x+1}
bar:{[y]
  s:"foo in a string";
  / a comment mentioning foo
  foo[y] }
