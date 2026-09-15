import { createWorker } from 'tesseract.js';

// Inside your image upload / scan function:
const handleImageScan = async (fileOrBase64: string) => {
  setIsScanning(true);
  try {
    // 1. Run 100% local OCR using Tesseract (Free, offline-friendly)
    const worker = await createWorker('eng');
    const ret = await worker.recognize(fileOrBase64);
    const extractedText = ret.data.text;
    await worker.terminate();

    // 2. Send the extracted text to your local pattern matching route
    const res = await fetch('/api/parse-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: "TRIP_INVOICE",
        rawOcrText: extractedText // Pass the local OCR text
      })
    });

    const json = await res.json();
    if (json.success) {
      setParsedData(json.data);
      alert("Document parsed locally and successfully!");
    } else {
      alert("Parsing failed: " + json.error);
    }
  } catch (err: any) {
    alert("OCR Error: " + err.message);
  } finally {
    setIsScanning(false);
  }
};
