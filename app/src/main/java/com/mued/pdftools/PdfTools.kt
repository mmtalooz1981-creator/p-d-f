package com.mued.pdftools

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import java.io.File
import java.io.FileOutputStream

fun splitPDF(sourceFile: File, rangesInput: String, outputDir: File): List<File> {
    val outputs = mutableListOf<File>()
    val cleanRanges = rangesInput
        .replace('،', ',')
        .split(',')
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    require(cleanRanges.isNotEmpty()) { "يرجى إدخال نطاق صفحات صالح مثل 1-3,4-6" }

    PDDocument.load(sourceFile).use { sourceDoc ->
        val totalPages = sourceDoc.numberOfPages
        cleanRanges.forEachIndexed { index, token ->
            val (startPage, endPage) = if (token.contains('-')) {
                val parts = token.split('-').map { it.trim() }
                require(parts.size == 2) { "نطاق غير صالح: $token" }
                parts[0].toInt() to parts[1].toInt()
            } else {
                val single = token.toInt()
                single to single
            }

            require(startPage in 1..totalPages && endPage in 1..totalPages && startPage <= endPage) {
                "النطاق $token خارج حدود الملف (1 إلى $totalPages)"
            }

            val outFile = File(outputDir, "split_part${index + 1}_p${startPage}-${endPage}.pdf")
            PDDocument().use { partDoc ->
                for (p in startPage..endPage) {
                    partDoc.importPage(sourceDoc.getPage(p - 1))
                }
                partDoc.save(outFile)
            }
            outputs.add(outFile)
        }
    }
    return outputs
}

fun convertPDFToImages(context: Context, sourceFile: File, scale: Int = 2): List<File> {
    val outputs = mutableListOf<File>()
    val descriptor = ParcelFileDescriptor.open(sourceFile, ParcelFileDescriptor.MODE_READ_ONLY)
    descriptor.use { pfd ->
        PdfRenderer(pfd).use { renderer ->
            for (i in 0 until renderer.pageCount) {
                renderer.openPage(i).use { page ->
                    val width = (page.width * scale).coerceAtLeast(1)
                    val height = (page.height * scale).coerceAtLeast(1)
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    try {
                        val canvas = Canvas(bitmap)
                        canvas.drawColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

                        val outFile = File(context.cacheDir, "page_${i + 1}.png")
                        FileOutputStream(outFile).use { fos ->
                            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
                        }
                        outputs.add(outFile)
                    } finally {
                        bitmap.recycle()
                    }
                }
            }
        }
    }
    return outputs
}

fun addWatermark(
    sourceFile: File,
    watermarkText: String,
    pageFrom: Int,
    pageTo: Int,
    outputDir: File
): File {
    val trimmed = watermarkText.trim()
    require(trimmed.isNotEmpty()) { "يرجى إدخال نص العلامة المائية" }

    val outFile = File(outputDir, "watermarked_${System.currentTimeMillis()}.pdf")

    PDDocument.load(sourceFile).use { doc ->
        val total = doc.numberOfPages
        require(pageFrom in 1..total && pageTo in 1..total && pageFrom <= pageTo) {
            "نطاق الصفحات غير صالح (1 إلى $total)"
        }

        for (pageIndex in (pageFrom - 1) until pageTo) {
            val page = doc.getPage(pageIndex)
            val mediaBox = page.mediaBox
            val bmpW = (mediaBox.width * 2f).toInt().coerceIn(400, 2000)
            val bmpH = (mediaBox.height * 2f).toInt().coerceIn(400, 2400)

            val watermarkBitmap = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888)
            try {
                val canvas = Canvas(watermarkBitmap)
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.argb(72, 21, 101, 192)
                    textSize = (bmpW * 0.07f).coerceAtLeast(36f)
                    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                    textAlign = Paint.Align.CENTER
                }

                canvas.save()
                canvas.translate(bmpW / 2f, bmpH / 2f)
                canvas.rotate(-35f)
                canvas.drawText(trimmed, 0f, 0f, paint)
                canvas.restore()

                val pdImage = LosslessFactory.createFromImage(doc, watermarkBitmap)
                PDPageContentStream(
                    doc,
                    page,
                    PDPageContentStream.AppendMode.APPEND,
                    true,
                    true
                ).use { contentStream ->
                    contentStream.drawImage(pdImage, 0f, 0f, mediaBox.width, mediaBox.height)
                }
            } finally {
                watermarkBitmap.recycle()
            }
        }

        doc.save(outFile)
    }

    return outFile
}
