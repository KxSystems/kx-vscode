{[isString;code]
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
 
 def run_wrapped(code,as_string):
  try:
   return{
    'result':run(code,as_string),
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
  'find_strings':find_strings
 }";
 .pykx.pyexec"_kx_execution_context=_kx_execution_context()";
 run:{[returnResult;asString;code]
 removeExtraIndents:{[code]
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
 result:.pykx.qeval["_kx_execution_context['run_wrapped']"][code;asString];
 .pykx.util.defaultConv:defaultConv;
 result[`error]:string result`error;
 if [`backtrace in key result;
 result[`backtrace]:string result`backtrace];
 if[result `errored; :result];
 /ggplot - start
 if[type[result[`result]] = 99h;
 attrs: key[[result[`result]]]; 
 if[type[attrs] = 11h;
 if[`output in attrs; 
 output: result[`result][`output];
 if[type[output] = 99h;
 attrs: key[output];
 if[type[attrs] = 11h;
 if[`bytes in attrs;
 bytes: output[`bytes];
 if[type[bytes] = 4h;
 if[0x89504E470D0A1A0A ~ bytes til 8;
 result[`base64]: 1b; 
 result[`result]: .Q.btoa bytes; 
 :result]]]]]]]];
 /ggplot - end
 $[result`errored;
 ::;
 returnResult;
 $[asString;
 result[`result]:{[text]
 maxSize:250000;
 $[count[text]>maxSize;
 sublist[maxSize;text],$["\n" in text;"\n..";".."];
 text],"\n"
 }(),result`result;
 result`result];
 $[asString;"";::]];
 result
 };
 run[1b;isString;code]
 }