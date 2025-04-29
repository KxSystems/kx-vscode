{[returnFormat;code;sample_fn;sample_size]
 if [`histogram in key `.qp;
 if [not `display2 in key `.qp; 
 .qp.display2: (')[{x[`output][`bytes]}; .qp.display]
 ]]; 
 if[()~key`.pykx;
 :(!). flip(
 (`result;::);
 (`errored;1b);
 (`error;".pykx is not defined: please load pykx"))];
 .pykx.pyexec "def _kx_execution_context():
 import traceback
 import sys
 import ast as ast
 from io import BytesIO
 import tokenize
 
 def is_expr(code):
  try:
   ast.parse(code,mode='eval')
   return True
  except SyntaxError:
   return False
  
 def run_line(code):
  return eval(code)if is_expr(code)else exec(code,globals(),globals())
 
 def range_to_text(lines,range):
  code=lines[range[0][0]:range[1][0]+1]
  code[-1]=code[-1][:range[1][1]]
  code[0]=code[0][range[0][1]:]
  return code
 
 def run(code,as_string):
  code=code.py().decode('utf-8')
  code+='\\n\\n'
  starts=[(x.lineno-1,x.col_offset)for x in ast.parse(code).body]
  if len(starts)==0:
   return str(None).encode('UTF-8') if as_string else None

  lines=str.splitlines(code)
  starts.append((len(lines)-1,0))
  ranges=list(zip(starts,starts[1:]))

  [run_line('\\n'.join(range_to_text(lines,range))) for range in ranges[:-1]]
  last_line='\\n'.join(range_to_text(lines,ranges[-1]))
  result=run_line(last_line)

  return str(result).encode('UTF-8') if as_string else result
 

 def run_wrapped(code,returnFormat):
  try:
   return{
    'result': run(code,returnFormat),
    'errored':False,
    'error':''
   }
  except Exception as e:
   type,error,tb=sys.exc_info()
   stacktrace=traceback.extract_tb(tb)
   offset=-1*(len(stacktrace)-3)
   tb2=traceback.format_exception(type,error,tb,offset)
   tb2=''.join(tb2)
   tb2=tb2.rstrip()
   return{
    'result':None,
    'errored':True,
    'error':str(e),
    'backtrace':tb2
   }

 def find_strings(code):
  tokens=tokenize.tokenize(BytesIO(code.py()).readline)
  strings=filter(lambda x:x.type==tokenize.STRING,tokens)
  return[(token.start[0]-1,token.end[0]-1)for token in strings]

 return{
  'run_wrapped':run_wrapped,
  'run':run,
  'find_strings':find_strings
 }";
 .pykx.pyexec"_kx_execution_context=_kx_execution_context()";

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
    return kx.CharVector(json.dumps(finalData, ensure_ascii=False))";

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
    elif t.__name__ == 'str' or t.__name__ == 'range':
        values = [str(data)]
    else:
        try:
            values = [repr(x) for x in data]
        except:
            values = [str(data)]

    if len(values) == 1 or isinstance(values, str):
        order = [0]
    else:
        try:
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

    return result";

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
  
 .pykx.pyexec "def com_kx_edi_to_structured_text_wrapper(code, sample_fn, sample_size):
    result = _kx_execution_context['run'](code, False)

    # If length is not possible (e.g. functions) then assign length to 1 
    try:
        length = len(result)
    except:
        length = 1

    # Sampling can be a destructive operation, so only do it when necessary
    # e.g. When sampling a named tuple, the type of the result will be a regular tuple
    if sample_size < length or (sample_fn == 'random'):
        result = com_kx_edi_sample(result, str(sample_fn), int(sample_size))

    try:
      return{
      'result': com_kx_edi_to_structured_text(result, length),
      'errored': False,
      'error':''
      }
    except Exception as e:
      type,error,tb=sys.exc_info()
      stacktrace=traceback.extract_tb(tb)
      offset=-1*(len(stacktrace)-3)
      tb2=traceback.format_exception(type,error,tb,offset)
      tb2=''.join(tb2)
      tb2=tb2.rstrip()
      return{
       'result':None,
       'errored':True,
      'error':str(e),
      'backtrace':tb2
      }";
  
 run:{[returnResult;asString;code;sample_fn;sample_size]
 removeExtraIndents:{[code]
 if[1 ~ count code; code: enlist code];
 inStrings:$[(count ss[code;"'''"])or count ss[code;"\"\"\""];
 1+raze{x+til y-x}./:.pykx.qeval["_kx_execution_context['find_strings']"]code;
 ()];
 lines:"\n" vs code;
 skippedLines:all each lines in " \t";
 skippedLines[inStrings]:1b;
 ii:where not skippedLines;
 extraWS:&\[{(x in" \t")?0b}each lines ii];
 lines[ii]:extraWS _'lines ii;
 "\n" sv lines
 };
 code:removeExtraIndents code;
 defaultConv:.pykx.util.defaultConv;
 .pykx.util.defaultConv:"k";
 result: $[asString ~ "text"; .pykx.qeval["_kx_execution_context['run_wrapped']"][code;1b];
           asString ~ "serialized"; .pykx.qeval["_kx_execution_context['run_wrapped']"][code;0b];
           asString ~ "structuredText"; .pykx.qeval["com_kx_edi_to_structured_text_wrapper"][code;sample_fn;sample_size];
           // What should we return as the error case in which no return format is specified? I took this from db.q
           `error`errorMsg`data!(1b; "Invalid returnFormat specified"; ::)
    ];
 .pykx.util.defaultConv:defaultConv;
 result[`error]:string result`error;
 if [`backtrace in key result;
 result[`backtrace]:string result`backtrace];
 if[result `errored; :result];
 $[result`errored;
 ::;
 returnResult;
 $[asString ~ "string";
 result[`result]:{[text]
 maxSize:250000;
 $[count[text]>maxSize;
 sublist[maxSize;text],$["\n" in text;"\n..";".."];
 text],"\n"
 }(),result`result;
 result`result];
 // not sure what this line does if anything. why is it in here
 $[asString;"";::]];
 result
 };
 run[1b;returnFormat;code;sample_fn;sample_size]
 }