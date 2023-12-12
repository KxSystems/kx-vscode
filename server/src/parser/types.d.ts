import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface ScriptCstNode extends CstNode {
  name: "script";
  children: ScriptCstChildren;
}

export type ScriptCstChildren = {
  expression?: ExpressionCstNode[];
};

export interface ExpressionCstNode extends CstNode {
  name: "expression";
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  iterator?: IteratorCstNode[];
  assignment?: AssignmentCstNode[];
  group?: GroupCstNode[];
  lambda?: LambdaCstNode[];
  bracket?: BracketCstNode[];
  symbol?: SymbolCstNode[];
  command?: CommandCstNode[];
  operator?: OperatorCstNode[];
  semiColon?: SemiColonCstNode[];
};

export interface IteratorCstNode extends CstNode {
  name: "iterator";
  children: IteratorCstChildren;
}

export type IteratorCstChildren = {
  Iterator: IToken[];
};

export interface AssignmentCstNode extends CstNode {
  name: "assignment";
  children: AssignmentCstChildren;
}

export type AssignmentCstChildren = {
  operator?: OperatorCstNode[];
  DoubleColon?: IToken[];
  Colon?: IToken[];
  expression?: ExpressionCstNode[];
};

export interface GroupCstNode extends CstNode {
  name: "group";
  children: GroupCstChildren;
}

export type GroupCstChildren = {
  LParen: IToken[];
  bracket?: BracketCstNode[];
  expression?: ExpressionCstNode[];
  RParen: IToken[];
};

export interface LambdaCstNode extends CstNode {
  name: "lambda";
  children: LambdaCstChildren;
}

export type LambdaCstChildren = {
  LCurly: IToken[];
  bracket?: BracketCstNode[];
  expression?: ExpressionCstNode[];
  RCurly: IToken[];
};

export interface BracketCstNode extends CstNode {
  name: "bracket";
  children: BracketCstChildren;
}

export type BracketCstChildren = {
  LBracket: IToken[];
  expression?: ExpressionCstNode[];
  RBracket: IToken[];
};

export interface SymbolCstNode extends CstNode {
  name: "symbol";
  children: SymbolCstChildren;
}

export type SymbolCstChildren = {
  literal?: LiteralCstNode[];
  keyword?: KeywordCstNode[];
  identifier?: IdentifierCstNode[];
};

export interface LiteralCstNode extends CstNode {
  name: "literal";
  children: LiteralCstChildren;
}

export type LiteralCstChildren = {
  charLiteral?: CharLiteralCstNode[];
  symbolLiteral?: SymbolLiteralCstNode[];
  fileLiteral?: FileLiteralCstNode[];
  infinityLiteral?: InfinityLiteralCstNode[];
  timeStampLiteral?: TimeStampLiteralCstNode[];
  dateTimeLiteral?: DateTimeLiteralCstNode[];
  miliTimeLiteral?: MiliTimeLiteralCstNode[];
  nanoTimeLiteral?: NanoTimeLiteralCstNode[];
  dateLiteral?: DateLiteralCstNode[];
  monthLiteral?: MonthLiteralCstNode[];
  secondLiteral?: SecondLiteralCstNode[];
  minuteLiteral?: MinuteLiteralCstNode[];
  binaryLiteral?: BinaryLiteralCstNode[];
  byteLiteral?: ByteLiteralCstNode[];
  numberLiteral?: NumberLiteralCstNode[];
};

export interface CharLiteralCstNode extends CstNode {
  name: "charLiteral";
  children: CharLiteralCstChildren;
}

export type CharLiteralCstChildren = {
  CharLiteral: IToken[];
};

export interface SymbolLiteralCstNode extends CstNode {
  name: "symbolLiteral";
  children: SymbolLiteralCstChildren;
}

export type SymbolLiteralCstChildren = {
  SymbolLiteral: IToken[];
};

export interface FileLiteralCstNode extends CstNode {
  name: "fileLiteral";
  children: FileLiteralCstChildren;
}

export type FileLiteralCstChildren = {
  FileLiteral: IToken[];
};

export interface InfinityLiteralCstNode extends CstNode {
  name: "infinityLiteral";
  children: InfinityLiteralCstChildren;
}

export type InfinityLiteralCstChildren = {
  InfinityLiteral: IToken[];
};

export interface TimeStampLiteralCstNode extends CstNode {
  name: "timeStampLiteral";
  children: TimeStampLiteralCstChildren;
}

export type TimeStampLiteralCstChildren = {
  TimeStampLiteral: IToken[];
};

export interface DateTimeLiteralCstNode extends CstNode {
  name: "dateTimeLiteral";
  children: DateTimeLiteralCstChildren;
}

export type DateTimeLiteralCstChildren = {
  DateTimeLiteral: IToken[];
};

export interface MiliTimeLiteralCstNode extends CstNode {
  name: "miliTimeLiteral";
  children: MiliTimeLiteralCstChildren;
}

export type MiliTimeLiteralCstChildren = {
  MiliTimeLiteral: IToken[];
};

export interface NanoTimeLiteralCstNode extends CstNode {
  name: "nanoTimeLiteral";
  children: NanoTimeLiteralCstChildren;
}

export type NanoTimeLiteralCstChildren = {
  NanoTimeLiteral: IToken[];
};

export interface DateLiteralCstNode extends CstNode {
  name: "dateLiteral";
  children: DateLiteralCstChildren;
}

export type DateLiteralCstChildren = {
  DateLiteral: IToken[];
};

export interface MonthLiteralCstNode extends CstNode {
  name: "monthLiteral";
  children: MonthLiteralCstChildren;
}

export type MonthLiteralCstChildren = {
  MonthLiteral: IToken[];
};

export interface SecondLiteralCstNode extends CstNode {
  name: "secondLiteral";
  children: SecondLiteralCstChildren;
}

export type SecondLiteralCstChildren = {
  SecondLiteral: IToken[];
};

export interface MinuteLiteralCstNode extends CstNode {
  name: "minuteLiteral";
  children: MinuteLiteralCstChildren;
}

export type MinuteLiteralCstChildren = {
  MinuteLiteral: IToken[];
};

export interface BinaryLiteralCstNode extends CstNode {
  name: "binaryLiteral";
  children: BinaryLiteralCstChildren;
}

export type BinaryLiteralCstChildren = {
  BinaryLiteral: IToken[];
};

export interface ByteLiteralCstNode extends CstNode {
  name: "byteLiteral";
  children: ByteLiteralCstChildren;
}

export type ByteLiteralCstChildren = {
  ByteLiteral: IToken[];
};

export interface NumberLiteralCstNode extends CstNode {
  name: "numberLiteral";
  children: NumberLiteralCstChildren;
}

export type NumberLiteralCstChildren = {
  NumberLiteral: IToken[];
};

export interface KeywordCstNode extends CstNode {
  name: "keyword";
  children: KeywordCstChildren;
}

export type KeywordCstChildren = {
  Keyword: IToken[];
};

export interface IdentifierCstNode extends CstNode {
  name: "identifier";
  children: IdentifierCstChildren;
}

export type IdentifierCstChildren = {
  Identifier: IToken[];
};

export interface CommandCstNode extends CstNode {
  name: "command";
  children: CommandCstChildren;
}

export type CommandCstChildren = {
  Command: IToken[];
};

export interface OperatorCstNode extends CstNode {
  name: "operator";
  children: OperatorCstChildren;
}

export type OperatorCstChildren = {
  Operator: IToken[];
};

export interface SemiColonCstNode extends CstNode {
  name: "semiColon";
  children: SemiColonCstChildren;
}

export type SemiColonCstChildren = {
  SemiColon: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  script(children: ScriptCstChildren, param?: IN): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  iterator(children: IteratorCstChildren, param?: IN): OUT;
  assignment(children: AssignmentCstChildren, param?: IN): OUT;
  group(children: GroupCstChildren, param?: IN): OUT;
  lambda(children: LambdaCstChildren, param?: IN): OUT;
  bracket(children: BracketCstChildren, param?: IN): OUT;
  symbol(children: SymbolCstChildren, param?: IN): OUT;
  literal(children: LiteralCstChildren, param?: IN): OUT;
  charLiteral(children: CharLiteralCstChildren, param?: IN): OUT;
  symbolLiteral(children: SymbolLiteralCstChildren, param?: IN): OUT;
  fileLiteral(children: FileLiteralCstChildren, param?: IN): OUT;
  infinityLiteral(children: InfinityLiteralCstChildren, param?: IN): OUT;
  timeStampLiteral(children: TimeStampLiteralCstChildren, param?: IN): OUT;
  dateTimeLiteral(children: DateTimeLiteralCstChildren, param?: IN): OUT;
  miliTimeLiteral(children: MiliTimeLiteralCstChildren, param?: IN): OUT;
  nanoTimeLiteral(children: NanoTimeLiteralCstChildren, param?: IN): OUT;
  dateLiteral(children: DateLiteralCstChildren, param?: IN): OUT;
  monthLiteral(children: MonthLiteralCstChildren, param?: IN): OUT;
  secondLiteral(children: SecondLiteralCstChildren, param?: IN): OUT;
  minuteLiteral(children: MinuteLiteralCstChildren, param?: IN): OUT;
  binaryLiteral(children: BinaryLiteralCstChildren, param?: IN): OUT;
  byteLiteral(children: ByteLiteralCstChildren, param?: IN): OUT;
  numberLiteral(children: NumberLiteralCstChildren, param?: IN): OUT;
  keyword(children: KeywordCstChildren, param?: IN): OUT;
  identifier(children: IdentifierCstChildren, param?: IN): OUT;
  command(children: CommandCstChildren, param?: IN): OUT;
  operator(children: OperatorCstChildren, param?: IN): OUT;
  semiColon(children: SemiColonCstChildren, param?: IN): OUT;
}
