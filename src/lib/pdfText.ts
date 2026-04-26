import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface ExtractProgress {
  currentPage: number
  totalPages: number
}

export async function extractTextFromPdf(
  source: File | Blob | ArrayBuffer,
  onProgress?: (p: ExtractProgress) => void,
): Promise<string> {
  const data =
    source instanceof ArrayBuffer ? source : await source.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise

  try {
    const pages: string[] = []
    const total = pdf.numPages

    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i)
      try {
        const content = await page.getTextContent()
        const text = content.items
          .map((item) => {
            if (typeof item === 'object' && item && 'str' in item) {
              return (item as { str: string }).str
            }
            return ''
          })
          .filter(Boolean)
          .join(' ')
        pages.push(`--- עמוד ${i} ---\n${text}`)
        onProgress?.({ currentPage: i, totalPages: total })
      } finally {
        try {
          page.cleanup()
        } catch {
          /* noop */
        }
      }
    }

    return pages.join('\n\n')
  } finally {
    await pdf.destroy().catch(() => {})
  }
}
