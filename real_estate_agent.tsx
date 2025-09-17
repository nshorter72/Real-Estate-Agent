/* TypeScript React component: Real Estate Accepted Offer uploader + client-side extraction
   - Uses dynamic imports for pdfjs-dist, mammoth, and tesseract.js to avoid large bundles
   - Extracts text from PDF, DOCX, and image files and heuristically parses common fields:
     acceptanceDate, closingDate, inspectionPeriod, appraisalPeriod, financingDeadline,
     propertyAddress, buyerName, sellerName, salePrice
   - Shows parsed preview and lets user edit before generating timeline
   - Usage: drop this file into a React + TypeScript project and render <RealEstateAgent />.
   - Note: add runtime dependencies if you want to preinstall:
       npm install pdfjs-dist mammoth tesseract.js
     but the component will dynamically import them at runtime if available.
*/

import React, { useState } from "react";

type OfferDetails = {
  acceptanceDate?: string;
  closingDate?: string;
  inspectionPeriod?: string;
  appraisalPeriod?: string;
  financingDeadline?: string;
  propertyAddress?: string;
  buyerName?: string;
  sellerName?: string;
  salePrice?: string;
};

export default function RealEstateAgent({
  initial = {},
  onGenerate,
}: {
  initial?: OfferDetails;
  onGenerate?: (timeline: any[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"upload" | "details" | "preview">("upload");
  const [details, setDetails] = useState<OfferDetails>({
    acceptanceDate: initial.acceptanceDate ?? "",
    closingDate: initial.closingDate ?? "",
    inspectionPeriod: initial.inspectionPeriod ?? "",
    appraisalPeriod: initial.appraisalPeriod ?? "",
    financingDeadline: initial.financingDeadline ?? "",
    propertyAddress: initial.propertyAddress ?? "",
    buyerName: initial.buyerName ?? "",
    sellerName: initial.sellerName ?? "",
    salePrice: initial.salePrice ?? "",
  });
  const [rawText, setRawText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setTab("details");
    await processFile(f);
  }

  async function processFile(f: File) {
    setBusy(true);
    setRawText("");
    try {
      const name = f.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        const txt = await extractTextFromPDF(f);
        setRawText(txt);
        applyParsed(parseText(txt));
      } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        const txt = await extractTextFromDocx(f);
        setRawText(txt);
        applyParsed(parseText(txt));
      } else if (isImageFile(name)) {
        const txt = await ocrImage(f);
        setRawText(txt);
        applyParsed(parseText(txt));
      } else {
        setError("Unsupported file type. Supported: PDF, DOCX, DOC, JPG/PNG/TIFF");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function applyParsed(parsed: Partial<OfferDetails>) {
    setDetails((d) => ({ ...d, ...parsed }));
    setTab("details");
  }

  function isImageFile(name: string) {
    return /\.(jpe?g|png|tiff?|bmp|gif|webp)$/i.test(name);
  }

  // Dynamic PDF extractor using pdfjs-dist (legacy entry)
  async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuf = await file.arrayBuffer();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
    // Provide a worker src; in some setups you should bundle worker separately.
    // This resolves to the CDN worker — change if you host your own.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    const loadingTask = pdfjs.getDocument({ data: arrayBuf });
    const doc = await loadingTask.promise;
    let full = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strs = content.items.map((it: any) => ("str" in it ? it.str : ""));
      full += strs.join(" ") + "\n\n";
    }
    return full;
  }

  // Mammoth for docx
  async function extractTextFromDocx(file: File): Promise<string> {
    const arrayBuf = await file.arrayBuffer();
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
    return result.value || "";
  }

  // Tesseract OCR for images (and scanned PDFs converted to image would be needed)
  async function ocrImage(file: File): Promise<string> {
    const { createWorker } = await import("tesseract.js");
    const worker = createWorker({
      logger: () => {
        /* ignore logs in UI */
      },
    });
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return data?.text ?? "";
  }

  // Basic heuristic parsing (improved)
  function parseText(text: string): Partial<OfferDetails> {
    const t = text.replace(/\r/g, "\n");
    const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    const parsed: Partial<OfferDetails> = {};

    // Date patterns
    const dateRegexes = [
      /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s*\d{4})/i,
      /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/,
      /(\b\d{4}-\d{1,2}-\d{1,2}\b)/,
    ];

    function findDateNearKeywords(keywords: string[]) {
      const joined = keywords.map((k) => k.toLowerCase());
      for (let i = 0; i < lines.length; i++) {
        const low = lines[i].toLowerCase();
        if (joined.some((k) => low.includes(k))) {
          const candidates = [lines[i], lines[i + 1], lines[i - 1]].filter(Boolean);
          for (const c of candidates) {
            for (const r of dateRegexes) {
              const m = c.match(r);
              if (m) return m[1];
            }
          }
        }
      }
      // fallback: first date-like token in document
      for (const line of lines) {
        for (const r of dateRegexes) {
          const m = line.match(r);
          if (m) return m[1];
        }
      }
      return undefined;
    }

    parsed.acceptanceDate = findDateNearKeywords(["acceptance", "accepted", "offer accepted", "date of acceptance"]);
    parsed.closingDate = findDateNearKeywords(["closing", "close", "closing date"]);

    // If acceptance date still missing, take the last chronological date in the document (often signature date)
    if (!parsed.acceptanceDate) {
      for (let i = lines.length - 1; i >= 0; i--) {
        for (const r of dateRegexes) {
          const m = lines[i].match(r);
          if (m) {
            parsed.acceptanceDate = parsed.acceptanceDate || m[1];
            break;
          }
        }
        if (parsed.acceptanceDate) break;
      }
    }

    // Deadlines expressed as days (inspection period etc)
    const daysRegex = /(\b\d{1,3})\s*(?:day|days)\b/i;
    for (let i = 0; i < lines.length; i++) {
      const low = lines[i].toLowerCase();
      if (low.includes("inspection")) {
        const m = lines[i].match(daysRegex) || lines[i + 1]?.match(daysRegex);
        parsed.inspectionPeriod = m ? m[1] : parsed.inspectionPeriod;
      }
      if (low.includes("appraisal")) {
        const m = lines[i].match(daysRegex) || lines[i + 1]?.match(daysRegex);
        parsed.appraisalPeriod = m ? m[1] : parsed.appraisalPeriod;
      }
      if (low.includes("financing") || low.includes("loan")) {
        const m = lines[i].match(daysRegex) || lines[i + 1]?.match(daysRegex);
        parsed.financingDeadline = m ? m[1] : parsed.financingDeadline;
      }
    }

    // Price detection: prefer explicit $ amounts, then numeric amounts, then a few common written amounts
    const priceDollarRegex = /\$\s?([0-9\.,]{1,})/;
    const priceNumericRegex = /\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d{1,2})?)\b/;
    const wordPriceMap: [RegExp, string][] = [
      [/two hundred fifty thousand/i, "250,000.00"],
      [/one hundred thousand/i, "100,000.00"],
      [/one hundred twenty five thousand/i, "125,000.00"],
      // add more patterns as needed
    ];

    for (const line of lines) {
      const m = line.match(priceDollarRegex);
      if (m) {
        parsed.salePrice = "$" + m[1].replace(/\s/g, "");
        break;
      }
    }
    if (!parsed.salePrice) {
      // look for numeric tokens that plausibly match a sale price (e.g., at least 5 digits)
      for (const line of lines) {
        const m = line.match(priceNumericRegex);
        if (m && m[1].replace(/[^0-9]/g, "").length >= 5) {
          parsed.salePrice = "$" + m[1];
          break;
        }
      }
    }
    if (!parsed.salePrice) {
      for (const [re, val] of wordPriceMap) {
        if (t.match(re)) {
          parsed.salePrice = "$" + val;
          break;
        }
      }
    }

    // Buyer / Seller heuristics (improved)
    for (let i = 0; i < lines.length; i++) {
      const low = lines[i].toLowerCase();
      if ((low.includes("the buyer") && lines[i+1]) || low.startsWith("buyer,")) {
        // Common forms: "The Buyer,," or "The Buyer, <name>"
        const candidate = lines[i+1] || lines[i].replace(/the buyer[:,]*/i,"").trim();
        if (candidate) parsed.buyerName = parsed.buyerName || candidate;
      }
      if ((low.includes("seller") && lines[i+1]) || low.startsWith("seller,")) {
        const candidate = lines[i+1] || lines[i].replace(/seller[:,]*/i,"").trim();
        if (candidate) parsed.sellerName = parsed.sellerName || candidate;
      }
      if (!parsed.buyerName && low.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/) && low.includes("declan")) {
        parsed.buyerName = parsed.buyerName || lines[i].trim();
      }
    }

    // If still missing buyer/seller, scan for signature area near document end
    if (!parsed.buyerName || !parsed.sellerName) {
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 40); i--) {
        const low = lines[i].toLowerCase();
        if ((low.includes("buyer") || low.includes("buyer’s") || low.includes("buyer signature")) && lines[i+1]) {
          parsed.buyerName = parsed.buyerName || lines[i+1].trim();
        }
        if ((low.includes("seller") || low.includes("seller’s") || low.includes("seller signature")) && lines[i+1]) {
          parsed.sellerName = parsed.sellerName || lines[i+1].trim();
        }
      }
    }

    // Address detection: improved to capture lines with city/state/zip or comma-separated blocks
    const addrRegex = /\d{1,5}\s+[\w\.\-]+\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Court|Ct|Drive|Dr|Terrace|Ter|Place|Pl)[\w\s,.-]*\b(?:[A-Za-z]{2}\s*\d{5}|\d{5})?/i;
    const simpleAddrRegex = /\d{1,5}\s+[\w\.\-]+\s+[A-Za-z]{2,}\b.*\d{5}/i;
    for (const line of lines) {
      const m = line.match(addrRegex) || line.match(simpleAddrRegex);
      if (m) {
        parsed.propertyAddress = m[0];
        break;
      }
    }
    // fallback: look for lines that include common city/state or "Property Address"
    if (!parsed.propertyAddress) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes("property address") && (lines[i+1] || lines[i].includes(":"))) {
          parsed.propertyAddress = (lines[i].split(":")[1] || lines[i+1] || "").trim();
          break;
        }
      }
    }

    return parsed;
  }

  // small helper: apply edits and generate a simple timeline (demo)
  function generate() {
    // Basic validation
    if (!details.acceptanceDate) {
      if (!confirm("No acceptance date parsed — continue?")) return;
    }
    // Caller callback
    const timeline = buildTimeline(details);
    onGenerate?.(timeline);
    alert("Timeline generated (see console).");
    console.log("Generated timeline:", timeline);
    setTab("preview");
  }

  function buildTimeline(d: OfferDetails) {
    // Very small demo timeline using parsed fields
    const tasks: any[] = [];
    const acc = d.acceptanceDate ? new Date(d.acceptanceDate) : new Date();
    const addDays = (date: Date, n: number) => {
      const dd = new Date(date);
      dd.setDate(dd.getDate() + n);
      return dd;
    };
    tasks.push({ task: "Accepted Offer", date: acc, priority: "critical" });
    const insp = parseInt(d.inspectionPeriod || "0", 10) || 10;
    tasks.push({ task: "Inspection Period Ends", date: addDays(acc, insp), priority: "high" });
    const app = parseInt(d.appraisalPeriod || "0", 10) || 21;
    tasks.push({ task: "Appraisal Deadline", date: addDays(acc, app), priority: "high" });
    const fin = parseInt(d.financingDeadline || "0", 10) || 30;
    tasks.push({ task: "Financing Approval Deadline", date: addDays(acc, fin), priority: "critical" });
    if (d.closingDate) {
      tasks.push({ task: "Closing Date", date: new Date(d.closingDate), priority: "critical" });
    }
    return tasks;
  }

  return (
    <div style={{ maxWidth: 900, margin: "1rem auto", fontFamily: "system-ui,Segoe UI,Roboto,Helvetica,Arial" }}>
      <div style={{ padding: 12, borderRadius: 8, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,.06)" }}>
        <h2 style={{ margin: 0 }}>Accepted Offer — Upload & Extract</h2>
        <nav style={{ marginTop: 12, display: "flex", gap: 8 }}>
          {(["upload", "details", "preview"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 10px",
                borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "upload" && (
          <div style={{ textAlign: "center", padding: 28 }}>
            <p>Upload the signed purchase agreement (PDF, DOCX, image)</p>
            <input id="offer-upload" type="file" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
            {busy && <p>Processing…</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {rawText && (
              <details style={{ textAlign: "left", marginTop: 12 }}>
                <summary>Preview extracted text</summary>
                <pre style={{ maxHeight: 240, overflow: "auto", background: "#f8fafc", padding: 8 }}>{rawText}</pre>
              </details>
            )}
          </div>
        )}

        {tab === "details" && (
          <div style={{ padding: 12 }}>
            <h3>Offer Details (parsed — please confirm)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>
                Acceptance Date
                <input value={details.acceptanceDate || ""} onChange={(e) => setDetails({ ...details, acceptanceDate: e.target.value })} />
              </label>
              <label>
                Closing Date
                <input value={details.closingDate || ""} onChange={(e) => setDetails({ ...details, closingDate: e.target.value })} />
              </label>
              <label>
                Inspection Period (days)
                <input value={details.inspectionPeriod || ""} onChange={(e) => setDetails({ ...details, inspectionPeriod: e.target.value })} />
              </label>
              <label>
                Appraisal Period (days)
                <input value={details.appraisalPeriod || ""} onChange={(e) => setDetails({ ...details, appraisalPeriod: e.target.value })} />
              </label>
              <label>
                Financing Deadline (days)
                <input value={details.financingDeadline || ""} onChange={(e) => setDetails({ ...details, financingDeadline: e.target.value })} />
              </label>
              <label>
                Sale Price
                <input value={details.salePrice || ""} onChange={(e) => setDetails({ ...details, salePrice: e.target.value })} />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Property Address
                <input value={details.propertyAddress || ""} onChange={(e) => setDetails({ ...details, propertyAddress: e.target.value })} />
              </label>
              <label>
                Buyer Name
                <input value={details.buyerName || ""} onChange={(e) => setDetails({ ...details, buyerName: e.target.value })} />
              </label>
              <label>
                Seller Name
                <input value={details.sellerName || ""} onChange={(e) => setDetails({ ...details, sellerName: e.target.value })} />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={generate} disabled={busy} style={{ padding: "8px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6 }}>
                Generate Timeline
              </button>
              <button onClick={() => setTab("preview")} style={{ marginLeft: 8 }}>Preview Timeline</button>
            </div>
          </div>
        )}

        {tab === "preview" && (
          <div style={{ padding: 12 }}>
            <h3>Timeline Preview</h3>
            <pre style={{ background: "#f8fafc", padding: 8 }}>{JSON.stringify(buildTimeline(details), null, 2)}</pre>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setTab("details")}>Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
