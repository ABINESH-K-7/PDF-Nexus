import * as pdfjsLib from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url"
import { PDFDocument, StandardFonts } from "pdf-lib"

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export const extractPdfText = async (file) => {
  const pdf = await pdfjsLib.getDocument(file.url).promise
  let finalText = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // Sort text items by Y (top → bottom), then X (left → right)
    const items = textContent.items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5]
      if (Math.abs(yDiff) > 2) return yDiff
      return a.transform[4] - b.transform[4]
    })

    let line = ""
    let lastY = null

    for (const item of items) {
      const y = item.transform[5]

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        finalText += line.trim() + "\n"
        line = ""
      }

      line += item.str + " "
      lastY = y
    }

    finalText += line.trim() + "\n\n"
  }

  return finalText
}



export const exportTextToPdf = async (content) => {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pageWidth = 595
  const pageHeight = 842
  const margin = 40
  const fontSize = 12
  const lineHeight = 16
  const maxWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const wrapLine = (text) => {
    const words = text.split(" ")
    let lines = []
    let current = ""

    for (let word of words) {
      const test = current ? current + " " + word : word
      const width = font.widthOfTextAtSize(test, fontSize)

      if (width <= maxWidth) current = test
      else {
        lines.push(current)
        current = word
      }
    }

    if (current) lines.push(current)
    return lines
  }

  for (let para of content.split("\n")) {
    for (let line of wrapLine(para)) {
      if (y < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }

      page.drawText(line || " ", { x: margin, y, size: fontSize, font })
      y -= lineHeight
    }
    y -= lineHeight / 2
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: "application/pdf" })
}
