printer:{[x]
    -1 "Add function to return a tree of all items in memory in a given q process #3";
    -1 "#3";
    -1 "  [1]  printed, not a frame";
    x+1};
caller:{[x]
    r:printer x;
    r};
caller[1];
-1 "done";
