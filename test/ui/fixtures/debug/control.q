run:{[n]
  r:0;
  if[n>0;
    r:r+1;
    r:r+n];
  vals:(1*2;3*4;4;5);
  s:$[n>5;`big;`small];
  i:0;
  while[i<n;
    i:i+1;
    r:r+i];
  do[3;
    r:r+10];
  r+count vals }

greeting:`hello
run[3]
