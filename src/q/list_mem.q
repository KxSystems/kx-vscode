// @overview
// Build a tree of all items in memory.
//
// TODO this currently doesn't enumerate dictionary keys or table columns
// TODO may want to mark views as special in some way?
//
// @param blacklist  {symbols} A list of namespaces to skip.
//                             Good idea to provide at a minimum `.q`.Q`.h`.z`.o`.j`.m
// @return {table (
//  id        : int;
//  pid       : int;
//  name      : symbol;
//  fname     : symbol;
//  typeNum   : short;
//  namespace : symbol;
//  context   : symbol;
//  isNs      : boolean
//  )}
{[blacklist]
    blacklist: raze blacklist;
    isNs: {[ns]
        chk: {[ns] $[` in key ns; $[(::)~ns `; 11 = type key ns; 0b]; 0b] };
        @[chk; ns; 0b]
        };

    getNs: {[isNs; ns]
        ns : raze ns;
        if [ns ~ enlist (::); ns: `.`];
        : raze {[isNs; n]
            // Not a proper sub namespace if the keys aren't symbols
            if [not 11 = type key n; : ()];
            s: isNs each k: ` sv' n ,/: t: key n;
            : $[`. ~ n; t where s; k where s];
            }[isNs] each ns;
        }[isNs];

    exclude: { y where not any each x { y like string[x],"*" }\:/: y }[blacklist];

    buildRows: {[ids; pids; names; fnames; typs; ns; contexts; isNs]
        ([] id: ids; pid: pids; name: names; fname: fnames; typeNum: typs; namespace: ns; context: contexts; isNs: isNs)
        };

    getContext: {[ns] $[ns in ``.; `; ` sv 2#` vs ns] };

    prefix: {$[`. = x; y; ` sv/: x ,/: y]};

    // Get all namespaces except those that are blacklisted and give them an id
    nids:`int$til count n: `.,exclude getNs[];

    // Build the namespace table
    n: buildRows[nids; num#0ni; n; n; num#99h; num#`.; num#`] #[;1b] num:count[nids];

    enumerate: {[buildRows; getContext; getNs; prefix; exclude; x]
        // x[0] is the table of renaming namespaces to enumerate
        // x[1] is the table of results
        // both are in the table format returned by buildRows
        f: {[buildRows; getContext; getNs; prefix; exclude; x]
            ns: first x[0];
            lastId: last exec id from x[1];
            // Get all items in the namespace
            fnames: prefix[ns`fname] n: except[;`] key ns`fname;
            // Isolate namespaces specifically and build their entries
            nmsnum: count nms: $[`. ~ ns`fname; (::); exclude] allnms: getNs ns`fname;
            context: getContext ns`fname;
            nrow: buildRows[`int$1+ lastId + til nmsnum; nmsnum#ns`id; n where fnames in nms; nms; nmsnum#99h; nmsnum#ns`fname; nmsnum#context] nmsnum#1b;
            // Update the lastId to account for any new namespaces
            lastId: max lastId ,last exec id from nrow;
            // Build the information for each non-namespace item
            i: `int$1+ lastId + til num: count typs: {type get x} each items: prefix[ns`fname] names: n where not fnames in allnms;
            row: buildRows[i; num#ns`id; names; items; typs; num#ns`fname; num#context; num#0b];
            // Add the namespaces to both the namespaces remaining to be enumerated, and the list of finished items
            (1_x[0],nrow; x[1],nrow,row)
            }[buildRows; getContext; getNs; prefix; exclude];

        @[f; x; (1_x[0]; x[1])]

        }[buildRows; getContext; getNs; prefix; exclude];

    `namespace xasc @[;1] {count[x[0]]>0}enumerate/(n; n)
    }
