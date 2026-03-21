# Meeting Agenda PDF Export

## Overview

The meeting agenda can now be exported as a high-quality PDF document with pixel-perfect rendering across multiple A4 pages.

## How to Use

1. **Navigate to Meeting Agenda**: Go to any meeting's agenda view
2. **Visible Agenda Required**: The agenda must be set to "visible" for members
3. **Click Export Button**: Tap the download icon in the header (next to the edit button)
4. **Wait for Generation**: A progress overlay will show the export status (0-100%)
5. **Download PDF**: The PDF will automatically download to your device

## Technical Details

### Platform Support
- **Web**: Full support with high-quality PDF generation
- **Mobile (iOS/Android)**: Currently not supported (web version recommended)

### PDF Features
- **Format**: A4 portrait orientation
- **Quality**: 2x resolution (high quality)
- **Pages**: Automatically splits content across multiple pages
- **Filename**: `{ClubName}_Meeting_{Number}_Agenda_{Date}.pdf`
- **Content**: Complete agenda with all formatting, colors, and layout preserved

### What Gets Exported
- Club information banner with district/division/area
- Date, time, and meeting number
- All visible agenda items with times
- Prepared speaker details including pathway and project info
- Evaluator assignments
- Educational speaker topics
- Tag Team roles (Timer, Ah Counter, Grammarian)
- Theme of the day
- Meeting venue information
- All custom styling and colors

## Implementation

### Files Created
1. `lib/pdfExportUtils.ts` - PDF generation utility functions
2. `types/pdf-libs.d.ts` - TypeScript declarations for PDF libraries

### Files Modified
1. `app/meeting-agenda-view.tsx` - Added export button and functionality

### Dependencies Added
- `html2canvas` - Captures the DOM as an image
- `jspdf` - Generates PDF from images

## Troubleshooting

**Export button not visible?**
- Ensure the agenda is set to visible (ExComm can toggle this in the agenda editor)

**Export fails on mobile?**
- Use the web version for PDF export functionality

**PDF looks different from screen?**
- Clear browser cache and try again
- Ensure all images are loaded before exporting

**Large agendas take time?**
- Complex agendas with many speakers may take 10-20 seconds to generate
- The progress indicator shows the current status

## Future Enhancements

Potential improvements for future versions:
- Mobile platform support (iOS/Android)
- Landscape orientation option
- Custom page size selection
- Watermark/branding options
- Batch export for multiple meetings
