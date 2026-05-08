import { useRef } from 'react';
import QRCode from 'react-qr-code';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  // QR foreground in brand primary navy for visual cohesion. White background
  // keeps contrast at the level scanners expect.
  return <QRCode value={value} size={size} bgColor="#ffffff" fgColor="#0c1830" />;
}

/** Downloads the QR code as an SVG file. Pass the ref of the wrapping <div>. */
export function downloadQRSvg(svgElement: SVGSVGElement | null, filename = 'qr-code.svg') {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgElement);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Hook-friendly wrapper: returns a ref to attach to the wrapping div and a download trigger. */
export function useQRDownload(filename = 'qr-code.svg') {
  const ref = useRef<HTMLDivElement>(null);
  const download = () => {
    const svg = ref.current?.querySelector('svg') as SVGSVGElement | null;
    downloadQRSvg(svg, filename);
  };
  return { ref, download };
}
