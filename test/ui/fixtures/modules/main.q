// Example: importing workspace modules with `use`

bar:use`bar
stats:use`stats

// type `bar.`
r1:bar.f[10]
r2:bar.g 5

// type `stats.`
r3:stats.mean 1 2 3 4 5f
r4:stats.varp 1 2 3 4 5f
