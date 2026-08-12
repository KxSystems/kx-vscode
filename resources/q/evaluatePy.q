{[args]
    returnFormat:args`returnFormat;
    code:args`code;
    sampleFn:args`sample_fn;
    sampleSize:args`sample_size;

    if [`histogram in key `.qp;
        if [not `display2 in key `.qp;
            .qp.display2: (')[{x[`output][`bytes]}; .qp.display]]];
    
    if [() ~ key`.pykx;
        : (!) . flip (
            (`data;::);
            (`error;1b);
            (`errorMsg;".pykx is not defined: please load pykx"))];

    .pykx.pyexec "def _kx_execution_context():
    import traceback
    import sys
    import ast as pystruct_ast
    from io import BytesIO
    import tokenize

    def pystruct_is_expr(code):
        try:
            pystruct_ast.parse(code,mode='eval')
            return True
        except SyntaxError:
            return False

    def pystruct_run_line(code):
        return eval(code) if pystruct_is_expr(code) else exec(code, globals(), globals())

    def pystruct_range_to_text(lines, range):
        code = lines[range[0][0]:range[1][0] + 1]
        # The end must be removed first, as if the start is removed first,
        # indices after it will have shifted
        code[-1]=code[-1][:range[1][1]]
        code[0]=code[0][range[0][1]:]
        return code

    def pystruct_format_exception():
        type, error, tb = sys.exc_info()
        stacktrace = traceback.extract_tb(tb)
        offset = -1 * (len(stacktrace) - 3)
        formatted_tb = traceback.format_exception(type, error, tb, offset)
        formatted_tb = ''.join(formatted_tb)
        # encode('UTF-8') is to return a string, to avoid polluting the symbol table.
        return formatted_tb.rstrip().encode('UTF-8')

    def pystruct_run(payload):
        payload = payload.py().decode('utf-8')
        payload += '\\n\\n'
        # Get the start of each expression/statement
        def get_start_pos(node):
            if  hasattr(node, 'decorator_list') and len(node.decorator_list):
                return (min([x.lineno - 1 for x in node.decorator_list]), node.col_offset)
            else:
                return (node.lineno - 1, node.col_offset)

        # Get the start of each expression/statement
        starts = [get_start_pos(x) for x in pystruct_ast.parse(payload).body]


        if len(starts) == 0:
            return None

        # Since ast.parse only returns the start of each expression,
        # the ranges must be made by joining consecutive pairs.
        # This means the end must be added manually
        lines = str.splitlines(payload)
        starts.append((len(lines) - 1, 0))

        # Join consecutive pairs
        ranges = list(zip(starts, starts[1:]))

        # Run all expressions, except the last one
        [pystruct_run_line('\\n'.join(pystruct_range_to_text(lines, bounds))) for bounds in ranges[:-1]]

        # Run the last expression
        last_line = '\\n'.join(pystruct_range_to_text(lines, ranges[-1]))
        result = pystruct_run_line(last_line)

        # Preserve the result of python query execution for cases it doesn't need to run again.
        global pystruct_last_query
        pystruct_last_query = result

        return result


    def pystruct_run_wrapped(code):
        try:
            return{
                'error': False,
                'errorMsg': str(None).encode('UTF-8'),
                'data': pystruct_run(code)
            }
        except Exception as e:
            return{
                'error': True,
                'errorMsg': str(e.args).encode('UTF-8'),
                'data': None,
                'stacktrace': pystruct_format_exception()
            }

    def pystruct_to_text(data):
        # encode('UTF-8') is to return a string, to avoid polluting the symbol table.
        return repr(data).encode('UTF-8')

    def pystruct_find_strings (code):
        from io import BytesIO as pystruct_BytesIO
        import tokenize as pystruct_tokenize
        tokens = pystruct_tokenize.tokenize(pystruct_BytesIO(code.py()).readline)
        strings = filter(lambda x: x.type == pystruct_tokenize.STRING, tokens)
        return [(token.start[0] - 1, token.end[0] - 1) for token in strings]

    return{
        'pystruct_run_wrapped':pystruct_run_wrapped,
        'pystruct_run':pystruct_run,
        'pystruct_find_strings':pystruct_find_strings,
        'pystruct_to_text':pystruct_to_text,
        'pystruct_format_exception':pystruct_format_exception
    }";
    .pykx.pyexec"_kx_execution_context=_kx_execution_context()";

    .pykx.pyexec "def pystruct_to_structured_text(data, length):
    # Importing libraries needed for code execution inside the function
    import json
    import numpy as np
    import pandas as pd
    import os
    from collections.abc import Iterator
    import pykx as kx
    import math
    import sys

    # Read TABULAR_LIMIT, set to DEFAULT_TABULAR_LIMIT if no variable found
    DEFAULT_TABULAR_LIMIT = 600000

    try:
        raw = kx.q('.struct.TABULAR_LIMIT')
    except kx.QError:
        # Use default
        limit = DEFAULT_TABULAR_LIMIT
    else:
        # Convert to a Python int
        try:
            # If it's a PyKX object .py() gives the Python value; if it's already
            # a plain Python value won't affect it
            val = raw.py() if hasattr(raw, 'py') else raw
            limit = int(val)
        except (TypeError, ValueError, kx.QError):
            limit = DEFAULT_TABULAR_LIMIT

    # create warnings list, append if any warnings
    warnings = []

    # Custom limits depending on data types
    # for tables
    if (isinstance(data, pd.DataFrame) and data.shape[1] > 0) or isinstance(data, pykx.Table):
        truncateSize = math.ceil(limit / data.shape[1])
    # dictionaries have two 'columns', so halve the limit
    elif isinstance(data, dict) or isinstance(data, pykx.Dictionary):
        truncateSize = limit // 2
    elif isinstance(data, str):
        truncateSize = sys.maxsize
    else:
        truncateSize = limit

    if(length > truncateSize):
        data = pystruct_sample(data, 'first', truncateSize)
        warnings.append(kx.CharVector('Results truncated to TABULAR_LIMIT. Console view is faster for large data.'))

    if isinstance(data, list):
        columns = [pystruct_generate_columns(False, data, 'values')]
    # First we have to find out if the table is keyed or unkeyed. Since keyed tables also return true in dictionary case, we put this one here first
    elif isinstance(data, pykx.KeyedTable):
        columns = []

        for element in kx.q.key(data).columns:
            columns.append(pystruct_generate_columns(True, data.get([element]).values()[0], str(element)))

        for element in data.values():
            columns.append(pystruct_generate_columns(False, data.get([element]).values()[0], str(element)))

    elif isinstance(data, dict) or isinstance(data, pykx.Dictionary):
        columns = [pystruct_generate_columns(True,list(data.keys()), 'keys'),pystruct_generate_columns(False, list(data.values()), 'values')]
    elif isinstance(data, pd.DataFrame):
        columns = []
        # Adding multi indexes; if more than one index use data.index.names, else use name.
        # This eliminates the issue of a single name being enlisted
        if not pd.Index(np.arange(0, len(data))).equals(data.index):
            if len(data.index.names) > 1:
                columns.append(pystruct_generate_columns(True, data.index.to_list(), str(data.index.names)))
            else:
                columns.append(pystruct_generate_columns(True, data.index.to_list(), str(data.index.name)))
        # Edge case to add a empty dataframe while still giving it a column entry
        if(data.empty):
            columns.append(pystruct_generate_columns(False, data, 'value'))
        # Getting the values of a data frame that are not index
        for element in data:
            columns.append(pystruct_generate_columns(False,data[element].to_list(),element))
    # This case is for unkeyed tables
    elif isinstance(data, pykx.Table):
        columns = []
        for element in data:
            columns.append(pystruct_generate_columns(False, data.get([element]).values()[0], str(element)))

    else:
        columns = [pystruct_generate_columns(False, data, 'value' if length == 1 else 'values')]

    finalData = {
        'count': length,
        'columns': columns,
        'warnings': warnings
    }


    return finalData";

    .pykx.pyexec "def pystruct_generate_columns(isKey,data,name):
    # Importing libraries needed for code execution inside the function
    import numpy as np
    import pandas as pd
    from collections.abc import Iterator
    import pykx as kx

    # Cache the original type of the data
    t = type(data)

    # Convert sets to lists
    # Sets are converted to lists in order to grab values and order properly.
    if t.__name__ == 'set' or t.__name__ == 'frozenset':
        try:
            data = list(data)
        except:
            data = data
        values = [repr(x) for x in data]
    # Getting function definition from function
    elif t.__name__ == 'function' or t.__name__ == 'SelfReferencingClass':
        try:
            # premade functions not created in C or made by users can get source, otherwise print repr of data
            import inspect
            values = [inspect.getsource(data)]
        except:
            values = [repr(data)]
    # Panda dataframes need to be extracted like so or data is lost
    elif t.__name__ == 'DataFrame':
        values = [repr(data)]
    # Check explicitly for iterators, cannot iterate through iterators as it is destructive
    elif isinstance(data, Iterator):
        values = [str(data)]
    # explicit check for strings to wrap return values in quotes
    elif t.__name__ == 'str':
        values = [repr(data)]
    # Check for ranges and stringify whole value instead of iterating
    elif t.__name__ == 'range' or t.__name__ == 'CharVector':
        values = [str(data)]
    else:
        try:
            values = [repr(x) for x in data]
        except:
            values = [str(data)]

    if len(values) == 1 or isinstance(values, str) or ((isinstance(data, pykx.List) and (pykx.q.count(values) == 0).py())):
        order = [0]
    else:
        try:
            if isinstance(data, pd.Series):
                order = np.argsort(data.fillna(np.inf), kind='stable').tolist()
            elif  isinstance(data, pd.CategoricalIndex):
                # Categorical indexes cannot have a axis when sorting
                order = np.argsort(data, kind='stable').tolist()
            else:
                # Axis is along which way to sort, axis 0 means just cols, but -1(default) is rows and cols, None is a flattened array
                order = np.argsort(data, axis=None,kind='stable').tolist()

            # For 2d lists, or lists of tuples, np.argsort flattens the array before sorting,
            # which isn't useful for our purposes.
            # If this happens, use this algorithm instead, which is an order of magnitude slower
            if len(values) != len(order):
                order = [i for (v, i) in sorted((v, i) for (i, v) in enumerate(data))]

        except Exception as e:
            order = kx.CharVector('Sort unsupported: ' + str(e))

    result = {
        'name': kx.CharVector(name),
        'type': kx.CharVector(t.__name__),
        'values': [kx.CharVector(x) for x in values],
        'order': order
        }

    if isKey:
        result['isKey'] = True

    return result";

    .pykx.pyexec "def pystruct_sample(data, sample_fn, sample_size):
    from random import sample
    import pandas as pd
    import numpy as np

    if sample_size < 0:
        return data

    # Try catch is used to check if object can be sliced, will return whole object if sample cannot be applied
    try:
        if sample_fn == 'first':
            if isinstance(data, pd.DataFrame):
                return data.iloc[:sample_size]
            else:
                x = slice(sample_size)

        elif sample_fn == 'last':
            if isinstance(data, pd.DataFrame):
                return data.iloc[sample_size:]
            else:
                x = slice(- sample_size, None)

        elif sample_fn == 'random':
            if isinstance(data, pd.DataFrame) or isinstance(data, pd.Series):
                return data.sample(n=sample_size)
            elif isinstance(data, np.ndarray):
                return np.random.choice(data, sample_size, replace=False)
            elif isinstance(data, set):
                return set(sample(list(data),sample_size))
            elif isinstance(data, frozenset):
                return frozenset(sample(list(data),sample_size))
            elif isinstance(data, dict):
                return dict(sample(list(data.items()), sample_size))
            else:
                return sample(data,sample_size)

        else:
            raise Exception('Invalid sample function: ' + sample_fn)

        # If dictionary, edge case to slice dictionaries by sample size
        if isinstance(data, dict):
            return dict(list(data.items())[x])
        else:
            return data[x]

    except:

        return data";

    .pykx.pyexec "def pystruct_format_structured_text(data, sample_fn, sample_size):
    # If length is not possible (e.g. functions) then assign length to 1
    try:
        length = len(data)
    except:
        length = 1

    # Sampling can be a destructive operation, so only do it when necessary
    # e.g. When sampling a named tuple, the type of the result will be a regular tuple
    if sample_size < length or (sample_fn == 'random'):
        data = pystruct_sample(data, str(sample_fn), int(sample_size))

    try:
        return{
            'data': pystruct_to_structured_text(data, length),
            'error': False,
            'errorMsg':str(None).encode('UTF-8')
        }
    except Exception as e:
        return{
            'error': True,
            'errorMsg': str(e).encode('UTF-8'),
            'data': None,
            'stacktrace': _kx_execution_context['pystruct_format_exception']()
        }";

    removeExtraIndents:{[code]
        if[1 ~ count code; code: enlist code];
        inStrings:$[(count ss[code;"'''"])or count ss[code;"\"\"\""];
            1+raze{x+til y-x}./:.pykx.qeval["_kx_execution_context['pystruct_find_strings']"]code;
            ()];
        lines:"\n" vs code;
        skippedLines:all each lines in " \t";
        skippedLines[inStrings]:1b;
        ii:where not skippedLines;
        extraWS:&\[{(x in" \t")?0b}each lines ii];
        lines[ii]:extraWS _'lines ii;
        "\n" sv lines
        };

    // Runs the code and returns `data`error`errorMsg (with `stacktrace appended on error).
    // data is left in Python as a wrapped pykx object, so nothing is converted
    // (or interned into the symbol table) until the formatter decides how to render it.
    evaluate:{[code]
        result: .pykx.eval["_kx_execution_context['pystruct_run_wrapped']"][code];
        errorMsg:.pykx.qeval["lambda r: r['errorMsg']"]result;
        $[.pykx.qeval["lambda r: r['error']"]result;
            (!). flip(
                (`error;1b);
                (`errorMsg;errorMsg);
                (`data;::);
                (`stacktrace;.pykx.qeval["lambda r: r['stacktrace']"]result));
            (!). flip(
                (`error;0b);
                (`errorMsg;errorMsg);
                (`data;.pykx.eval["lambda r: r['data']"]result))]
        };

    // text and serialized results return the stacktrace as a symbol, structuredText as a string
    format:{[returnFormat; sampleFn; sampleSize; result]
        if [returnFormat ~ "text";
            result[`data]: {[text]
                // If the text is longer than 250,000 characters,
                // truncate the text and add a q style ".."
                maxSize: 250000;
                $[  count[text]>maxSize;
                    sublist[maxSize;text],$["\n" in text;"\n..";".."];
                    text],"\n"
                }(),.pykx.qeval["_kx_execution_context['pystruct_to_text']"]result`data;
            :result];
        
        if [returnFormat ~ "serialized";
            result[`data]: result[`data]`;
            :result];
    
        if [returnFormat ~ "structuredText";
            result:.pykx.qeval["pystruct_format_structured_text"][result`data;sampleFn;sampleSize];
            result[`data]:.j.j result`data;
            :result];
        
        // Unrecognized return format
        : `error`errorMsg`data!(1b; "Invalid returnFormat specified"; ::)
        };

    // This can't be replaced with something simpler, like
    // (type[result[`data]`]=4h) and 0x89504e470d0a1a0a ~ 8#result[`data]`;
    // because there are side-effects and overhead to casting some values to q, and some values will error when cast to q.
    // The default value of None is required so that passing in :: isn't treated as a missing parameter.
    .pykx.pyexec "def is_png_bytevector(x=None):
        import pykx as kx

        return (
            isinstance(x, kx.ByteVector)
            and len(x) >= 8
            and bytes(x[:8].py()) == bytes.fromhex('89504e470d0a1a0a')
        )";
    
    code:removeExtraIndents code;
    defaultConv:.pykx.util.defaultConv;
    .pykx.util.defaultConv:"k";

    response: .[
        {[evaluate; format; returnFormat; sampleFn; sampleSize; code]
            result: evaluate code;
            
            // This is a hack to display PNGs, such as those generated by matplotlib
            // regardless of what the expected return type is.
            // It should be replaced by PNGs coming back over websocket.
            if [.pykx.qeval["is_png_bytevector"]result `data;
                returnFormat: "serialized"];
            
            $[  result`error;
                result;
                format[returnFormat; sampleFn; sampleSize; result]]
            };
        (evaluate; format; returnFormat; sampleFn; sampleSize; code);
        {[defaultConv; error]
            .pykx.util.defaultConv:defaultConv;
            ' error;
            } defaultConv];    
        
    .pykx.util.defaultConv:defaultConv;
    response
    }
