import { Platform } from 'react-native';

export async function exportAgendaToPDF(
  elementId: string,
  fileName: string,
  _onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error('PDF export is only supported on web platform');
  }

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found: ' + elementId);
  }

  printElement(element, fileName);
}

export function printElement(element: HTMLElement, fileName: string): void {
  const styleSheets = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName.replace('.pdf', '')}</title>
  <style>
    ${styleSheets}

    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #1a1a1a;
    }

    .t360-print-root {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
    }

    @media print {
      html, body {
        width: 210mm;
        margin: 0;
        padding: 0;
      }

      .t360-print-root {
        width: 100%;
        max-width: 100%;
      }

      @page {
        size: A4 portrait;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="t360-print-root">
    ${element.outerHTML}
  </div>
  <script>
    document.title = ${JSON.stringify(fileName.replace('.pdf', ''))};
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1000);
      }, 400);
    };
  </script>
</body>
</html>`);

  printWindow.document.close();
}

export function generatePDFFilename(
  clubName: string,
  meetingNumber: string,
  meetingDate: string
): string {
  const date = new Date(meetingDate).toISOString().split('T')[0];
  const safeName = clubName.replace(/[^a-z0-9]/gi, '_');
  return `${safeName}_Meeting_${meetingNumber}_Agenda_${date}.pdf`;
}
