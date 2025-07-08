// !!! WARNING
// This file was automatically generated, and should not be manually edited.
// Changes must be made to https://gitlab.com/kxdev/kxinsights/platform/scratchpad/-/blob/main/src/python.q
// python.q - Python scratchpad
// Copyright (c) 2022 Kx Systems Inc
//
// @namespace   .com_kx_edi
// @category    Scratchpad
//
// @end

\d .com_kx_edi

// Set default conversion for objects when evaluated in Python
// !!! Note
//     This is required to ensure that ensure the scratchpad returns data as
//     a q object rather than a numpy array which is PyKX's default
.pykx.i.defaultConv:"k"

// @overview
// Checks if code is an expression (returns a value) or statement (doesn't return anything).
// Separate functions are needed to evaluate each.
//
// @param code {string} Python code
//
// @returns {boolean}
.pykx.pyexec "import traceback";
.pykx.pyexec "import sys";
.pykx.pyexec "import ast as com_kx_edi_ast";
.pykx.pyexec "def com_kx_edi_is_expr(code):
    try:
        com_kx_edi_ast.parse(code, mode='eval')
        return True
    except SyntaxError:
        return False";
python.i.isExpr:{.pykx.qeval["com_kx_edi_is_expr"][x]};

// @overview
// Runs a logical line of Python code, supporting both expressions and statements
//
// @param code {string} Python code
//
// @returns {any}
.pykx.pyexec "def com_kx_edi_run_line(code):
    return eval(code) if com_kx_edi_is_expr(code) else exec(code, globals(), globals())";

// @overview
// Extracts a range from a list of lines
//
// @param lines {string[]}
// @param range {Long[][]} A 0-indexed range ((line, col),(line, col)) where the end column is exclusive
//
// @returns {string[]}
.pykx.pyexec "def com_kx_edi_range_to_text(lines, range):
    code = lines[range[0][0]:range[1][0] + 1]
    # The end must be removed first, as if the start is removed first,
    # indices after it will have shifted
    code[-1] = code[-1][:range[1][1]]
    code[0] = code[0][range[0][1]:]

    return code";

// @overview
// Runs Python code, supporting multiline inputs containing expressions and statements,
// returning the result of the last line
//
// @param payload {string}
// @param as_string {boolean} 1b to return a string, 0b to return the actual value
//
// @returns {any}
.pykx.pyexec "def com_kx_edi_run(payload, as_string):

    payload = payload.py().decode('utf-8')

    # Adding newlines to the end makes it easier to extract the final expression
    payload += '\\n\\n'

    # Get the start of each expression/statement
    def get_start_pos(node):
        if  hasattr(node, 'decorator_list') and len(node.decorator_list):
                return (min([x.lineno - 1 for x in node.decorator_list]), node.col_offset)
        else:
            return (node.lineno - 1, node.col_offset)

    # Get the start of each expression/statement
    starts = [get_start_pos(x) for x in com_kx_edi_ast.parse(payload).body]


    if len(starts) == 0:
        # encode('UTF-8') is to return a string, to avoid polluting the symbol table.
        return str(None).encode('UTF-8') if as_string else None
    
    # Since ast.parse only returns the start of each expression,
    # the ranges must be made by joining consecutive pairs.
    # This means the end must be added manually
    lines = str.splitlines(payload)
    starts.append((len(lines) - 1, 0))

    # Join consecutive pairs
    ranges = list(zip(starts, starts[1:]))

    # Run all expressions, except the last one
    [com_kx_edi_run_line('\\n'.join(com_kx_edi_range_to_text(lines, bounds))) for bounds in ranges[:-1]]

    # Run the last expression
    last_line = '\\n'.join(com_kx_edi_range_to_text(lines, ranges[-1]))
    result = com_kx_edi_run_line(last_line)

    # Preserve the result of python query execution for cases it doesn't need to run again.
    # ie tab changes in the scratchpad UI. 
    global com_kx_edi_last_query
    com_kx_edi_last_query = result

    # encode('UTF-8') is to return a string, to avoid polluting the symbol table.
    return str(result).encode('UTF-8') if as_string else result"

// @overview
// Runs arbitrary Python code, returning a stack trace for any errors
//
// @param code {string}
// @param as_string {boolean} 1b to return a string, 0b to return the actual value
//
// @returns {any}
.pykx.pyexec "def com_kx_edi_run_wrapped(code, as_string):
    try:
        return {
            'error': False,
            'errorMsg': '',
            'data': com_kx_edi_run(code, as_string)
        }

    except Exception as e:
        type, error, tb = sys.exc_info()
        stacktrace = traceback.extract_tb(tb)

        # The first four stack frames are internal, so omit these.
        # When offset is negative, the top n frames will be shown
        offset = -1 * (len(stacktrace) - 3)

        formatted_tb = traceback.format_exception(type, error, tb, offset)
        formatted_tb = ''.join(formatted_tb)
        formatted_tb = formatted_tb.rstrip()

        return {
            'error': True,
            'errorMsg': str(e.args),
            'data': None,
            'stacktrace': formatted_tb
        }"

python.i.run: .pykx.qeval "com_kx_edi_run_wrapped";

// @overview
// Finds lines containing either normal or multiline strings
//
// @param code {String} Python code
//
// @returns {long[][]} A list of pairs of the start and end line (0-indexed, inclusive) for each string
.pykx.pyexec "from io import BytesIO as com_kx_edi_BytesIO";
.pykx.pyexec "import tokenize as com_kx_edi_tokenize";
.pykx.pyexec "def com_kx_edi_find_strings (code):
    tokens = com_kx_edi_tokenize.tokenize(com_kx_edi_BytesIO(code.py()).readline)
    strings = filter(lambda x: x.type == com_kx_edi_tokenize.STRING, tokens)
    # The -1 is to convert line numbers to 0-indexed
    return [(token.start[0] - 1, token.end[0] - 1) for token in strings]";
python.i.findStrings:{.pykx.qeval["com_kx_edi_find_strings"][x]};

// @overview
// Removes extra indents to allow evaluating code inside indented regions
//
// @param code {string} Python code
//
// @returns {string} The code with extra indents removed
python.i.removeExtraIndents: {[code]
    // Calculate which lines have their leading whitespace in a multiline string,
    // as these shouldn't be modified.
    // Only tokenize code when it is required (i.e. when it has multiline strings),
    // as tokenizing will error on inputs like "  1 + 2\n 1+3" where there is no indent to match the dedent
    inStrings: $[   (count ss[code; "'''"]) or count ss[code; "\"\"\""];
                    1 + raze {x + til y - x} ./: python.i.findStrings code;
                    ()];

    // Skip blank lines to avoid treating empty lines as lines with no indent
    // Skip lines in multi-line strings so they are not modified
    lines: "\n" vs code;
    skippedLines: all each lines in " \t";
    skippedLines[inStrings]: 1b;

    // This removes leading whitespace for each line,
    // up to the col of the least indented line seen up to that point.
    // Since mixing tabs and spaces gives a compile error in Python,
    // it isn't necessary to convert tabs to spaces for this.
    // Skip newlines in multiline strings and skip whitespace-only lines
    ii: where not skippedLines;
    extraWS: &\[{(x in " \t")?0b} each lines ii];
    lines[ii]: extraWS _' lines ii;

    : "\n" sv lines;
    }

// @overview
// Removes extra indents to allow evaluating code inside indented regions
//
// @param returnResult {boolean} If this is 0b, the function will return ""
// @param asString     {boolean} 1b to return the value as a string
// @param code         {string}  Python code
//
// @returns {dict} The result of running the expression
python.run: {[returnResult; asString; code]
    // This allows running indented code
    code: python.i.removeExtraIndents code;
    result: python.i.run[code; asString];
    result[`errorMsg]: string result `errorMsg;

    if [`stacktrace in key result;
        result[`stacktrace]: string result `stacktrace];

    result[`data]:
        $[  result`error;
                ::;
            returnResult;
                $[  asString;
                    // The length of the string is capped to avoid sending arbitrarily large messages over the network.
                    result[`data]: python.i.truncate () , result`data;
                    result`data];
            // else
                $[  asString; ""; ::]];

    result
    }

// @overview
// Truncates any strings over a max size, replacing the truncated text with an ellipsis.
//
// @param text {string}
//
// @returns {string}
python.i.truncate: {[text]
    maxSize: 250000;
    $[  count[text] > maxSize;
        sublist[maxSize; text] , $["\n" in text; "\n.."; ".."];
        text]
    };

// @overview
// Converts any data to structured text
//
// @param data {Any} 
// @param length {Int} The length of data, or 1 if length doesn't apply.
//   This is passed in, since it needs to be the pre-sampling length.
//
// @returns Json representation of structured text, to be used in scratchpad display
.pykx.pyexec "def com_kx_edi_to_structured_text(data, length):
    # Importing libraries needed for code execution inside the function
    import json
    import numpy as np
    import pandas as pd
    from collections.abc import Iterator
    import pykx as kx

    if isinstance(data, list):
        columns = [com_kx_edi_generate_columns(False, data, 'values')]
    # First we have to find out if the table is keyed or unkeyed. Since keyed tables also return true in dictionary case, we put this one here first
    elif isinstance(data, pykx.KeyedTable):
        columns = []

        for element in kx.q.key(data).columns:
            columns.append(com_kx_edi_generate_columns(True, data.get([element]).values(), str(element)))

        for element in data.values():
            columns.append(com_kx_edi_generate_columns(False, data.get([element]).values(), str(element)))
            
    elif isinstance(data, dict) or isinstance(data, pykx.Dictionary):
        columns = [com_kx_edi_generate_columns(True,list(data.keys()), 'keys'),com_kx_edi_generate_columns(False, list(data.values()), 'values')]
    elif isinstance(data, pd.DataFrame):
        columns = []
        # Adding multi indexes; if more than one index use data.index.names, else use name. 
        # This eliminates the issue of a single name being enlisted
        if not pd.Index(np.arange(0, len(data))).equals(data.index):
            if len(data.index.names) > 1:
                columns.append(com_kx_edi_generate_columns(True, data.index.to_list(), str(data.index.names)))
            else:
                columns.append(com_kx_edi_generate_columns(True, data.index.to_list(), str(data.index.name)))
        # Edge case to add a empty dataframe while still giving it a column entry
        if(data.empty):
            columns.append(com_kx_edi_generate_columns(False, data, 'value'))    
        # Getting the values of a data frame that are not index
        for element in data:
            columns.append(com_kx_edi_generate_columns(False,data[element].to_list(),element))
    # This case is for unkeyed tables
    elif isinstance(data, pykx.Table):
        columns = []
        for element in data:
            columns.append(com_kx_edi_generate_columns(False, data.get([element]).values(), str(element)))

    else:
        columns = [com_kx_edi_generate_columns(False, data, 'value' if length == 1 else 'values')]

    finalData = {
        'count': length,
        'columns': columns
    }

    # Strings returned from Python should be explicitly cast to strings.
    # Otherwise they will be added to the q symbol table for the life of the process
    return kx.CharVector(json.dumps(finalData, ensure_ascii=False))"
python.i.to_structured_text: .pykx.qeval "com_kx_edi_to_structured_text";

// @overview
// Generates the columns needed for structured Python text
//
// @param isKey {Boolean} 
// @param data  {Any} 
// @param name  {String} 
//
// @returns Dictionary containing column info for structured text
.pykx.pyexec "def com_kx_edi_generate_columns(isKey,data,name):
    # Importing libraries needed for code execution inside the function
    import numpy as np
    import pandas as pd
    from collections.abc import Iterator

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
    # Check for strings and ranges, stringify whole value instead of iterating
    elif t.__name__ == 'str' or t.__name__ == 'range' or t.__name__ == 'CharVector':
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
            order = 'Sort unsupported: ' + str(e)

    result = {
        'name': name,
        'type': t.__name__,
        'values': values,
        'order': order
        }

    if isKey:
        result['isKey'] = True

    return result"

// @overview
// Samples Python data, used for structuredText queries where sampling is applied first before conversion,
// returning the result of the sample
//
// @param   data        {any}    Python data structure
// @param   sample_fn   {String} One of "first", "last", or "random"
// @param   sample_size {Long}   The maximum number of records to return
//
// @returns data         {any}    The result of sampling
// * NOTE Sampling first and last will not work with data that cannot be deterministic, e.g., sets
// Current list of data types that were tested to work with sample. This is not an exhaustive list and related data types may work.
// List
// Dictionaries (only first and last, cannot sample random)
// Sets, frozensets (only random)
// Pandas dataframe, series, categorical indexes
// Numpy vectors
// Tuples, named tuples
// Iterators, ranges
//
.pykx.pyexec "def com_kx_edi_sample(data, sample_fn, sample_size):
    
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

// @overview
// Samples and converts to structured text in a single function.
// Note: This is needed to avoid issues with returning q values back into python functions.
// All python functions will still work in python
//
// @param code        {Any}    Python code
// @param sample_fn   {String} One of "first", "last", or "random"
// @param sample_size {Long}   The maximum number of records to return
//
// @returns {any} The structured text json string 
.pykx.pyexec "def com_kx_edi_to_structured_text_wrapper(code, sample_fn, sample_size):

    # Need to have these checks here because com_kx_edi_run does not support splayed or partitioned tables
    if isinstance(code, pykx.wrappers.SplayedTable):
        result = 'Splayed tables cannot be displayed in this view'
    elif isinstance(code, pykx.wrappers.PartitionedTable):
        result = 'Partitioned tables cannot be displayed in this view'
    else:
        result = com_kx_edi_run(code, False)

    # If length is not possible (e.g. functions) then assign length to 1 
    try:
        length = len(result)
    except:
        length = 1

    # Sampling can be a destructive operation, so only do it when necessary
    # e.g. When sampling a named tuple, the type of the result will be a regular tuple
    if sample_size < length or (sample_fn == 'random'):
        result = com_kx_edi_sample(result, str(sample_fn), int(sample_size))

    return com_kx_edi_to_structured_text(result, length)";
python.i.to_structured_text_wrapper: .pykx.qeval "com_kx_edi_to_structured_text_wrapper";