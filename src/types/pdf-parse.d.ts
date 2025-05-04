declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }

  interface PDFOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
    renderPage?: unknown;
  }

  function PDFParse(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  
  export = PDFParse;
}

declare module 'pdf-parse/lib/pdf-parse' {
  import PDFParse from 'pdf-parse';
  export = PDFParse;
}
