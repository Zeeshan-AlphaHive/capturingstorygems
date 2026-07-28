import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import download from 'downloadjs';

interface Story {
  _id: string;
  story_title: string;
  read_time: string;
  genre: string;
  enhanced_story: string;
  heroImageUrl?: string | null;
  heroImageAlignment?: "left" | "center" | "right" | null;
}

export const createStoryPDF = async (story: Story): Promise<PDFDocument> => {
  const pdfDoc = await PDFDocument.create();
  let page: PDFPage = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const margin = 50;
  const titleSize = 24;
  const textSize = 12;
  const lineHeight = 1.6;

  const fontNormal: PDFFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold: PDFFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let y = height - margin;

  // Store image rect for wrapping decisions
  let heroRect: { x: number; y: number; width: number; height: number } | null = null;
  const isSideAligned = story.heroImageAlignment === 'left' || story.heroImageAlignment === 'right';
  const availableW = width - margin * 2;
  const sectionSpacing = 24; // consistent spacing between image, title and body

  // Track the page where the hero image is drawn
  let imagePageRef: PDFPage | null = null;

  // Draw hero image and/or title depending on alignment
  if (story.heroImageUrl) {
    // If image is side-aligned, draw the title first, then the image below it
    if (isSideAligned) {
      // Draw title at the top before embedding image so text can wrap around image below
      drawTitle();
      // Save the y position just below the title (top of the body area)
      const titleBottom = y;

      try {
        const resp = await fetch(story.heroImageUrl);
        const contentType = resp.headers.get('content-type') || '';
        const bytes = await resp.arrayBuffer();
        let embeddedImage: any = null;
        if (contentType.includes('png')) {
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(bytes);
        }

        const imgDims = embeddedImage.scale(1);
        const availableH = height - margin * 2;

        // Side images use ~40% of width and a taller max height
        const targetW = availableW * 0.4;
        const targetH = availableH * 0.6;

        const scaleW = targetW / imgDims.width;
        const scaleH = targetH / imgDims.height;
        const scale = Math.min(1, scaleW, scaleH);

        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;

        let imgX = margin;
        if (story.heroImageAlignment === 'right') {
          imgX = width - margin - drawW;
        }

        // Place image below the title with a consistent gap, and start body text at the image top
        const imageY = titleBottom - sectionSpacing - drawH;
        page.drawImage(embeddedImage, {
          x: imgX,
          y: imageY,
          width: drawW,
          height: drawH,
        });

        heroRect = { x: imgX, y: imageY, width: drawW, height: drawH };
        imagePageRef = page;

        // Start body text at the top of the image minus a small offset so first line baseline is beside the image
        const bodyStartY = heroRect.y + heroRect.height - (textSize * lineHeight * 0.3);
        y = bodyStartY;
      } catch (e) {
        console.warn('Failed to embed hero image for PDF:', e);
      }
    } else {
      // Center-aligned (or unspecified) images: draw image first, then title below it
      try {
        const resp = await fetch(story.heroImageUrl);
        const contentType = resp.headers.get('content-type') || '';
        const bytes = await resp.arrayBuffer();
        let embeddedImage: any = null;
        if (contentType.includes('png')) {
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(bytes);
        }

        const imgDims = embeddedImage.scale(1);
        const availableH = height - margin * 2;

        const targetW = availableW;
        const targetH = availableH * 0.35;

        const scaleW = targetW / imgDims.width;
        const scaleH = targetH / imgDims.height;
        const scale = Math.min(1, scaleW, scaleH);

        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;

        let imgX = margin + (availableW - drawW) / 2;
        if (story.heroImageAlignment === 'right') {
          imgX = width - margin - drawW;
        }

        const imageY = y - drawH;
        page.drawImage(embeddedImage, {
          x: imgX,
          y: imageY,
          width: drawW,
          height: drawH,
        });

        heroRect = { x: imgX, y: imageY, width: drawW, height: drawH };
        imagePageRef = page;

        // Place the title below the image
        y = imageY - sectionSpacing;
        drawTitle();
        y -= sectionSpacing;
      } catch (e) {
        console.warn('Failed to embed hero image for PDF:', e);
      }
    }
  } else {
    // No image -> just draw title at the top
    drawTitle();
    y -= sectionSpacing;
  }

  // Helper to check if current y overlaps with hero image (only on the image's page)
  const doesOverlapImage = (currentY: number, lineH: number, currentPage: PDFPage): boolean => {
    if (!heroRect || !isSideAligned || !imagePageRef || currentPage !== imagePageRef) return false;
    // Text baseline is at currentY, but text visually extends above (ascenders) and below (descenders)
    // Add buffer to prevent edge-case overlaps
    const buffer = lineH * 0.4;
    const lineVisualTop = currentY + buffer; // Account for ascenders above baseline
    const lineVisualBottom = currentY - lineH;
    const imgTop = heroRect.y + heroRect.height;
    const imgBottom = heroRect.y;
    // Check if line's visual extent overlaps with image
    return !(lineVisualBottom >= imgTop || lineVisualTop <= imgBottom);
  };

  // Helper to get text area considering image overlap
  const getTextArea = (currentY: number, lineH: number, currentPage: PDFPage): { xPos: number; maxW: number } => {
    const gap = 12;
    if (doesOverlapImage(currentY, lineH, currentPage) && heroRect) {
      if (story.heroImageAlignment === 'left') {
        const xPos = heroRect.x + heroRect.width + gap;
        return { xPos, maxW: width - margin - xPos };
      } else {
        return { xPos: margin, maxW: heroRect.x - margin - gap };
      }
    }
    return { xPos: margin, maxW: width - margin * 2 };
  };

  // Draw title centered (full-width)
  function drawTitle() {
    const words = story.story_title.split(' ');
    let line = '';
    const lineHeightPx = titleSize * 1.2;

    const pushLine = (ln: string) => {
      const textWidth = fontBold.widthOfTextAtSize(ln, titleSize);
      const centeredX = margin + (availableW - textWidth) / 2;
      page.drawText(ln, {
        x: centeredX,
        y,
        size: titleSize,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.4),
      });
      y -= lineHeightPx;
    };

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (fontBold.widthOfTextAtSize(test, titleSize) <= availableW) {
        line = test;
      } else {
        if (line) pushLine(line);
        line = w;
      }
      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - margin;
      }
    }
    if (line) pushLine(line);
  }

  

  // Draw body paragraphs with wrapping that respects side images
  const drawParagraph = (raw: string) => {
    const cleanParagraph = raw.replace(/\r?\n/g, ' ').trim();
    const words = cleanParagraph.split(' ');
    let line = '';
    const lineHeightPx = textSize * lineHeight;

    const pushLine = (ln: string) => {
      const { xPos, maxW } = getTextArea(y, lineHeightPx, page);
      page.drawText(ln, {
        x: xPos,
        y,
        size: textSize,
        font: fontNormal,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: maxW,
      });
      y -= lineHeightPx;
    };

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const { maxW: curMaxW } = getTextArea(y, lineHeightPx, page);

      if (fontNormal.widthOfTextAtSize(test, textSize) <= curMaxW) {
        line = test;
      } else {
        if (line) pushLine(line);
        line = w;
      }

      if (y < margin) {
        page = pdfDoc.addPage();
        y = height - margin;
      }
    }
    if (line) pushLine(line);
    y -= textSize * 0.6;
  };

  for (const paragraph of story.enhanced_story.split(/\n\s*\n/).filter((p) => p.trim())) {
    drawParagraph(paragraph);
  }

  // Add page numbers
  pdfDoc.getPages().forEach((p, idx) => {
    const num = `${idx + 1}`;
    p.drawText(num, {
      x: (width - fontNormal.widthOfTextAtSize(num, 10)) / 2,
      y: margin / 2,
      size: 10,
      font: fontNormal,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  return pdfDoc;
};

export const handleDownload = async (story: Story) => {
  const pdfDoc = await createStoryPDF(story);
  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, `${story.story_title}.pdf`, 'application/pdf');
};

export const handlePrintPDF = async (story: Story) => {
  const pdfDoc = await createStoryPDF(story);
  const pdfBytes = await pdfDoc.save();
  const pdfBytesCopy = new Uint8Array(pdfBytes);
  const blob = new Blob([pdfBytesCopy], { type: 'application/pdf' });
const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(blobUrl);

  printWindow?.addEventListener('load', () => {
    printWindow.focus();
    printWindow.print();
  });

  setTimeout(() => {
    printWindow?.focus();
    printWindow?.print();
  }, 1000);
};
