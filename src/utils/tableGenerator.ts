const TextAlignment = Object.freeze({
  LEFT: Symbol("LEFT"),
  RIGHT: Symbol("RIGHT"),
  CENTER: Symbol("CENTER"),
});

export class TableGenerator {
  constructor(options: any) {
    this.opts = Object.assign({}, { columnSpacer: " ", columns: {} }, options);
  }

  /* @public */
  public fromJson(json: any[]) {
    const fields = this.retrieveFields(json),
      colWidths = this.colWidth(json, fields);
    return [
      fields
        .map((field, index) => {
          return this.format(field, field, index, colWidths, {
            align: TextAlignment.LEFT,
          });
        })
        .join(this.opts.spacer),
      json
        .map((record: { [x: string]: any }) => {
          return fields
            .map((field, index) => {
              return this.format(record[field], field, index, colWidths);
            })
            .join(this.opts.spacer);
        })
        .join("\n"),
    ].join("\n" + this.generateHeaderDiv(fields, colWidths));
  }

  private generateHeaderDiv(fields: any[], colWidths: any) {
    const div = [];
    const auxCounter = fields
      .map((field: any, index: any) => {
        return this.format(field, field, index, colWidths, {
          align: TextAlignment.LEFT,
        });
      })
      .join(this.opts.spacer).length;
    for (let i = 0; i < auxCounter; i++) {
      div.push("-");
    }
    div.push("\n");
    return div.join("");
  }

  private format(
    value: any,
    field: any,
    index: number,
    colWidths: any,
    overrides?: { align: symbol } | undefined
  ) {
    value = this.cleanValueFromTbl(value);
    if (value)
      return this.alignContent(
        value,
        Object.assign(
          this.retrieveMeta(field, index, colWidths),
          overrides || {}
        )
      );
  }

  private cleanValueFromTbl(value: any) {
    if (Array.isArray(value)) {
      value = value.join(" ");
    }
    if (value.length > 22) {
      value = value.replace(/T00:00:00.000Z/g, "");
    }
    return value;
  }

  /* @private */
  private alignContent(
    content: string | number,
    metadata: { maxWidth: any; limit: number; align: symbol | null }
  ) {
    let isNumeric = !isNaN(content);
    content = ("" + (content || "")).trim();
    if (content.length === 0) {
      return content.padEnd(metadata.maxWidth);
    }
    if (metadata.limit !== -1 && content.length > metadata.limit) {
      content = content.substring(0, metadata.limit - 1) + "…";
    }
    if (content.length === metadata.maxWidth) {
      return content;
    }
    let alignment = metadata.align || TextAlignment.LEFT;
    if (isNumeric && metadata.align == null) {
      alignment = TextAlignment.RIGHT;
    }
    return content.padEnd(metadata.maxWidth);
  }

  /* @private */
  private retrieveMeta(
    field: string | number,
    index: string | number,
    colWidths: { [x: string]: any }
  ) {
    return Object.assign(
      {
        maxWidth: colWidths[index],
        limit: -1,
        field: field,
      },
      this.opts.columns[field]
    );
  }

  private retrieveFields(data: any[]) {
    return [...new Set(data.flatMap((record: {}) => Object.keys(record)))];
  }

  private colWidth(data: any[], fields: any[]) {
    const colWidths = fields.map((field: any) =>
      this.valueStringWidth(field, field)
    );
    data.forEach((item: { [x: string]: any }) => {
      fields.forEach((field: string | number, index: string | number) => {
        colWidths[index] = Math.max(
          colWidths[index],
          this.valueStringWidth(item[field], field)
        );
      });
    });
    return colWidths;
  }

  private valueStringWidth(
    value: string | any[] | null,
    field: string | number
  ) {
    if (value == null) return 0;
    value = ("" + value).trim();
    value = this.cleanValueFromTbl(value);
    const col = this.opts.columns[field] || {};
    return col.limit !== -1 && value.length > col.limit
      ? col.limit
      : value.length;
  }
}
