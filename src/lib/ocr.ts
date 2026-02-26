import Tesseract from "tesseract.js";

/**
 * OCR Utility — Extracted raw text from a base64-encoded image.
 * 
 * Uses Tesseract.js for local image-to-text conversion.
 */

export async function extractTextFromImage(
    base64Image: string,
    mimeType: string
): Promise<string> {
    try {
        console.log(`[OCR] Starting text extraction (type: ${mimeType})...`);

        // Ensure the base64 string doesn't have the data prefix if it was passed with one
        const base64Data = base64Image.includes(",")
            ? base64Image.split(",")[1]
            : base64Image;

        const imageBuffer = Buffer.from(base64Data, "base64");

        const result = await Tesseract.recognize(imageBuffer, "eng", {
            logger: (m) => {
                if (m.status === "recognizing text") {
                    // Log progress if needed
                }
            },
        });

        const text = result.data.text;

        if (!text || text.trim().length === 0) {
            console.warn("[OCR] Extraction completed but returned no text.");
            return "";
        }

        console.log(`[OCR] Extraction successful (${text.length} characters)`);
        return text;
    } catch (error) {
        console.error("[OCR] Extraction failed:", error);
        throw new Error(`OCR_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
}
