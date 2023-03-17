// TODO this currently doesn't enumerate dictionary keys or table columns
// TODO mark views as special in some way?
{[blacklist]
    blacklist: raze blacklist;
    isNs: {[ns]
        chk: {[ns]
            : $[` in key ns;
                $[(::)~ns `; 11 = type key ns; 0b];
                0b]
            };
        : @[chk; ns; 0b];
        };

    getSubNs: {[isNs; ns]
        ns : raze ns;
        if [ns ~ enlist (::); ns: `.`];


        : raze {[isNs; n]
            // Not a proper sub namespace if the keys aren't symbols
            if [not 11 = type key n; : ()];
            s: isNs each k: ` sv' n ,/: t: key n;

            : $[`. ~ n; t where s; k where s];
            }[isNs] each ns;
        }[isNs];

    getNs: {[getSubNs; ns]
        ns : raze ns;
        if[ns ~ enlist (::); ns:`.`];

        : distinct except[ns; `], raze
            {[getSubNs; dir]
                subdirs: getSubNs dir;
                : raze subdirs , .z.s[getSubNs] each subdirs;
                }[getSubNs] each ns
        }[getSubNs];

    exclude:{ y where not ?[` ~/: (` vs/: y)[;0]; ` sv/: 2#/: ` vs/: y; y] in x };

    buildRows: {[ids; pids; names; fnames; typs; ns; contexts; isNs]
        ([] id: ids; pid: pids; name: names; fname: fnames; typeNum: typs; namespace: ns; context: contexts; isNs: isNs)
        };

    getContext: {[ns] $[ns in ``.; `; ` sv 2#` vs ns] };

    // Get all namespaces except those that are blacklisted and give them an id
    nids:`int$til count n: exclude[blacklist] getNs[];

    // Build the namespace table
    n: buildRows[nids; num#0ni; n; n; num#99h; n; getContext each n] #[;1b] num:count[nids];

    enumerate: {[buildRows; getContext; x]
        // x[0] is the table of renaming namespaces to enumerate
        // x[1] is the table of results
        // both are in the table format returned by buildRows
        f: {[buildRows; getContext; x]
            ns: first x[0];
            lastId: last exec id from x[1];
            i: `int$1+ lastId + til num: count typs: {type get x} each items: {$[`. = x; y; ` sv/: x ,/: y]}[ns`fname] names: except[;`] key ns`fname;
            r: buildRows[i; num#ns`id; names; items; typs; num#ns`fname; num#getContext ns`fname; num#0b];
            (1_x[0]; x[1],r)
            }[buildRows; getContext];

        @[f; x; (1_x[0]; x[1])]

        }[buildRows; getContext];

    `namespace xasc @[;1] {count[x[0]]>0}enumerate/(n; n)
    }
