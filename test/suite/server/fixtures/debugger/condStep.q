fibonacci: {
    $[  x < 2;

        // The base case
        1;

        // Recurse
        .z.s[x-1]
            +
            .z.s[x-2]]
    }

fibonacci 1
