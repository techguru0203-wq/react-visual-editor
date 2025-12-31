// Type declarations for modules without official TypeScript types

declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  }

  interface PDFMetadata {
    info: PDFInfo;
    metadata: any;
    version: string;
  }

  interface PDFData extends PDFMetadata {
    numpages: number;
    numrender: number;
    text: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: any
  ): Promise<PDFData>;

  export = pdfParse;
}

