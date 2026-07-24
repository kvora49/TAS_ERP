declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    type?: string;
    quality?: number;
    margin?: number;
    scale?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H" | "low" | "medium" | "quartile" | "high";
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string | Array<any>,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;

  export function toDataURL(
    text: string | Array<any>,
    callback: (error: Error | null, url: string) => void
  ): void;
}
