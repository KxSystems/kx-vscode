show0:{[x]
    -1 "#0";
    x};
caller:{[x]
    a:show0 x;
    b:a+1;
    b};
caller 1;
