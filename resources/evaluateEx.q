{[ctx; code; returnFormat]
  if [`histogram in key `.qp;
  if [not `display2 in key `.qp; 
  .qp.display2: (')[{x[`output][`bytes]}; .qp.display]
  ]]; 
  if [-10h ~ type ctx; ctx: enlist ctx];  
  result: .com_kx_edi.evalInContext[ctx; 
    .com_kx_edi.i.splitExpression
    .com_kx_edi.i.stripTrailingSemi
    .com_kx_edi.i.wrapLines[ctx]
    .com_kx_edi.i.removeMultilineComments
    code
  ];
  if [result `errored; :result];
  if [returnFormat ~ "text";
  result[`result]: .com_kx_edi.toString result `result];
  if [returnFormat ~ "structuredText";
  result[`result]: .com_kx_edi.toStructuredText[result `result; count result`result; .com_kx_edi.isAtom result`result; .com_kx_edi.typeOf result`result]];
  result
  }
