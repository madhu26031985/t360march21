declare module 'html2canvas' {
  interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string | null;
    logging?: boolean;
    imageTimeout?: number;
    removeContainer?: boolean;
  }

  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions
  ): Promise<HTMLCanvasElement>;

  export default html2canvas;
}

declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape';
    unit?: 'mm' | 'cm' | 'in' | 'px' | 'pt' | 'pc' | 'em' | 'ex';
    format?: string | number[];
    compress?: boolean;
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions);
    addImage(
      imageData: string | HTMLImageElement | HTMLCanvasElement | Uint8Array,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW',
      rotation?: number
    ): jsPDF;
    addPage(format?: string | number[], orientation?: 'portrait' | 'landscape'): jsPDF;
    save(filename: string): jsPDF;
  }
}
