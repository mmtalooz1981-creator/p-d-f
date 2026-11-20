package com.mued.pdftools

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PDFBoxResourceLoader.init(applicationContext)

        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme(
                    colorScheme = lightColorScheme(
                        primary = Color(0xFF1565C0),
                        onPrimary = Color.White,
                        surface = Color.White,
                        background = Color(0xFFF8FAFC)
                    )
                ) {
                    MuedPdfProApp()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MuedPdfProApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var selectedTab by remember { mutableIntStateOf(0) }
    var selectedFile by remember { mutableStateOf<File?>(null) }
    var fileName by remember { mutableStateOf("لم يتم اختيار ملف") }
    var totalPages by remember { mutableIntStateOf(0) }
    var message by remember { mutableStateOf("مرحباً بك في موعد اللوز PDF PRO") }
    var isBusy by remember { mutableStateOf(false) }

    var ranges by remember { mutableStateOf("1-3,4-6") }
    var watermark by remember { mutableStateOf("موعد اللوز العبيدي") }
    var pageFrom by remember { mutableStateOf("1") }
    var pageTo by remember { mutableStateOf("1") }
    var lastOutputs by remember { mutableStateOf<List<File>>(emptyList()) }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { pickedUri ->
            scope.launch {
                isBusy = true
                try {
                    val result = withContext(Dispatchers.IO) {
                        var resolvedName = "selected_document.pdf"
                        context.contentResolver.query(pickedUri, null, null, null, null)?.use { c ->
                            val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                            if (c.moveToFirst() && idx >= 0) resolvedName = c.getString(idx)
                        }
                        val cacheFile = File(context.cacheDir, "selected_document.pdf")
                        context.contentResolver.openInputStream(pickedUri)?.use { input ->
                            cacheFile.outputStream().use { out -> input.copyTo(out) }
                        }
                        val count = PDDocument.load(cacheFile).use { it.numberOfPages }
                        Triple(cacheFile, resolvedName, count)
                    }
                    selectedFile = result.first
                    fileName = result.second
                    totalPages = result.third
                    pageFrom = "1"
                    pageTo = result.third.toString()
                    message = "تم اختيار الملف بنجاح (${result.third} صفحة)"
                } catch (e: Exception) {
                    message = "خطأ في فتح الملف: ${e.message}"
                } finally {
                    isBusy = false
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "موعد اللوز PDF PRO",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1565C0)
                    )
                },
                actions = {
                    TextButton(onClick = { picker.launch(arrayOf("application/pdf")) }) {
                        Text("اختيار PDF")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.ContentCut, contentDescription = null) },
                    label = { Text("تجزئة") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Image, contentDescription = null) },
                    label = { Text("صور PNG") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.EditNote, contentDescription = null) },
                    label = { Text("علامة مائية") }
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(fileName, fontWeight = FontWeight.SemiBold)
                    if (totalPages > 0) {
                        Text(
                            text = "عدد الصفحات: $totalPages",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B)
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { picker.launch(arrayOf("application/pdf")) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (selectedFile == null) "اختيار ملف PDF" else "تغيير الملف")
                    }
                }
            }

            if (isBusy) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            when (selectedTab) {
                0 -> {
                    Text("تجزئة ملف PDF", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = ranges,
                        onValueChange = { ranges = it },
                        label = { Text("نطاقات الصفحات") },
                        placeholder = { Text("1-3,4-6,7-10") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        enabled = !isBusy && selectedFile != null,
                        onClick = {
                            val file = selectedFile ?: return@Button
                            scope.launch {
                                isBusy = true
                                try {
                                    val files = withContext(Dispatchers.IO) {
                                        splitPDF(file, ranges, context.cacheDir).also { list ->
                                            list.forEach { f ->
                                                FileExportHelper.saveToDownloads(context, f, "application/pdf")
                                            }
                                        }
                                    }
                                    lastOutputs = files
                                    message = "تم إنشاء ${files.size} ملفات وحفظها في التنزيلات (Downloads/MuedPdfPro)"
                                } catch (e: Exception) {
                                    message = "تعذر التجزئة: ${e.message}"
                                } finally {
                                    isBusy = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("تنفيذ التجزئة")
                    }
                }

                1 -> {
                    Text("تحويل PDF إلى صور PNG", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Button(
                        enabled = !isBusy && selectedFile != null,
                        onClick = {
                            val file = selectedFile ?: return@Button
                            scope.launch {
                                isBusy = true
                                try {
                                    val imgs = withContext(Dispatchers.IO) {
                                        convertPDFToImages(context, file, scale = 2).also { list ->
                                            list.forEach { f ->
                                                FileExportHelper.saveToDownloads(context, f, "image/png")
                                            }
                                        }
                                    }
                                    lastOutputs = imgs
                                    message = "تم تحويل ${imgs.size} صفحة إلى صور PNG وحفظها في التنزيلات"
                                } catch (e: Exception) {
                                    message = "خطأ في التحويل: ${e.message}"
                                } finally {
                                    isBusy = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("تحويل إلى PNG بدقة 2x")
                    }
                }

                2 -> {
                    Text("إضافة نص أو علامة مائية عربية", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = watermark,
                        onValueChange = { watermark = it },
                        label = { Text("النص المراد إضافته") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = pageFrom,
                            onValueChange = { pageFrom = it },
                            label = { Text("من الصفحة") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = pageTo,
                            onValueChange = { pageTo = it },
                            label = { Text("إلى الصفحة") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Button(
                        enabled = !isBusy && selectedFile != null,
                        onClick = {
                            val file = selectedFile ?: return@Button
                            scope.launch {
                                isBusy = true
                                try {
                                    val output = withContext(Dispatchers.IO) {
                                        addWatermark(
                                            file,
                                            watermark,
                                            pageFrom.toInt(),
                                            pageTo.toInt(),
                                            context.cacheDir
                                        ).also {
                                            FileExportHelper.saveToDownloads(context, it, "application/pdf")
                                        }
                                    }
                                    lastOutputs = listOf(output)
                                    message = "تم تحرير الملف وحفظه في التنزيلات: ${output.name}"
                                } catch (e: Exception) {
                                    message = "خطأ: ${e.message}"
                                } finally {
                                    isBusy = false
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("إضافة النص إلى الملف")
                    }
                }
            }

            Text(
                text = message,
                color = Color(0xFF15803D),
                fontWeight = FontWeight.SemiBold
            )

            if (lastOutputs.isNotEmpty()) {
                HorizontalDivider()
                Text("الملفات الناتجة:", fontWeight = FontWeight.Bold)
                lastOutputs.forEach { outFile ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(outFile.name, modifier = Modifier.weight(1f))
                        TextButton(
                            onClick = {
                                val mime = if (outFile.name.endsWith(".png")) "image/png" else "application/pdf"
                                FileExportHelper.shareFile(context, outFile, mime)
                            }
                        ) {
                            Text("مشاركة")
                        }
                    }
                }
            }
        }
    }
}
