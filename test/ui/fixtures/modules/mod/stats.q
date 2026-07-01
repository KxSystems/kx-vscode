// stats module — simple aggregations
mean:{(sum x)%count x}
sumsq:{sum x*x}
varp:{(sumsq[x]%count x)-mean[x]*mean x}

export:([mean;sumsq;varp])
