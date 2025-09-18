import React, { useState } from 'react';
import { Calendar, Mail, Upload, FileText, Clock, Home } from 'lucide-react';

type OfferDetails = {
  acceptanceDate: string;
  closingDate: string;
  inspectionPeriod: string;
  appraisalPeriod: string;
  financingDeadline: string;
  propertyAddress: string;
  buyerName: string;
  sellerName: string;
  salePrice: string;
};

export const RealEstateAgent: React.FC<{ onGenerate?: () => void }> = ({ onGenerate }) => {
  const [uploadedOffer, setUploadedOffer] = useState<File | null>(null);
  const [offerDetails, setOfferDetails] = useState<OfferDetails>({
    acceptanceDate: '',
    closingDate: '',
    inspectionPeriod: '',
    appraisalPeriod: '',
    financingDeadline: '',
    propertyAddress: '',
    buyerName: '',
    sellerName: '',
    salePrice: ''
  });
  const [generatedTimeline, setGeneratedTimeline] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'details' | 'timeline' | 'emails'>('upload');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedOffer(file);
    setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));

    const extractTextFromFile = async (f: File) => {
      const name = f.name.toLowerCase();
      const arrayBuffer = await f.arrayBuffer().catch(() => null);

      // quick diagnostics
      try {
        // eslint-disable-next-line no-console
        console.debug('[RealEstateAgent] uploadInfo:', { name: f.name, type: f.type, size: f.size, arrayBufferBytes: arrayBuffer ? (arrayBuffer.byteLength ?? null) : null });
      } catch (_) { /* ignore */ }

      // DOCX extraction (mammoth)
      if (name.endsWith('.docx') && arrayBuffer) {
        try {
          const mammoth = await import('mammoth');
          // mammoth.extractRawText expects a buffer-like; use as any to avoid bundler typing issues
          const res = await (mammoth as any).extractRawText({ arrayBuffer });
          if (res && res.value) return String(res.value);
        } catch (err) { 
          // eslint-disable-next-line no-console
          console.debug('[RealEstateAgent] mammoth failed:', (err as any)?.message ?? err);
        }
      }

      // PDF extraction: try multiple strategies (data buffer, object URL)
      if (name.endsWith('.pdf') && arrayBuffer) {
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
          // set workerSrc early and log current value
          try {
            (pdfjsLib as any).GlobalWorkerOptions.workerSrc = (pdfjsLib as any).GlobalWorkerOptions?.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] pdfjs workerSrc set to', (pdfjsLib as any).GlobalWorkerOptions.workerSrc);
          } catch (wErr) {
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] setting pdfjs workerSrc failed:', (wErr as any)?.message ?? wErr);
          }

          try {
            const uint8 = new Uint8Array(arrayBuffer);
            const loadingTask = (pdfjsLib as any).getDocument({ data: uint8 });
            const pdf = await loadingTask.promise;
            let fullText = '';
            const numPages = typeof pdf.numPages === 'number' ? pdf.numPages : 0;
            for (let i = 1; i <= numPages; i++) {
              /* eslint-disable no-await-in-loop */
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = (content.items || []).map((it: any) => it.str).join(' ');
              fullText += pageText + '\n';
            }
            if (fullText.trim()) return fullText;
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] pdfjs extracted no text from data buffer');
          } catch (innerErr) {
            // fallback to object URL approach if data buffer approach fails
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] pdfjs data-buffer extraction failed:', (innerErr as any)?.message ?? innerErr);
            try {
              const url = URL.createObjectURL(f);
              const loadingTask2 = (pdfjsLib as any).getDocument({ url });
              const pdf2 = await loadingTask2.promise;
              let fullText2 = '';
              const numPages2 = typeof pdf2.numPages === 'number' ? pdf2.numPages : 0;
              for (let i = 1; i <= numPages2; i++) {
                /* eslint-disable no-await-in-loop */
                const page = await pdf2.getPage(i);
                const content = await page.getTextContent();
                const pageText = (content.items || []).map((it: any) => it.str).join(' ');
                fullText2 += pageText + '\n';
              }
              URL.revokeObjectURL(url);
              if (fullText2.trim()) return fullText2;
              // eslint-disable-next-line no-console
              console.debug('[RealEstateAgent] pdfjs extracted no text from object URL');
            } catch (urlErr) {
              // eslint-disable-next-line no-console
              console.debug('[RealEstateAgent] pdfjs extraction failed:', (urlErr as any)?.message ?? urlErr);
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.debug('[RealEstateAgent] pdfjs import failed:', (err as any)?.message ?? err);
        }
      }

      // Fallback: try reading as text (some environments will return PDF bytes here)
      try {
        const txt = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = reject;
          reader.readAsText(f);
        });

        // If readAsText returned raw PDF bytes (starts with %PDF) try to extract with pdfjs if available
        if (typeof txt === 'string' && txt.trim().startsWith('%PDF')) {
          // eslint-disable-next-line no-console
          const sample = txt.slice(0, 1000);
          console.debug('[RealEstateAgent] extracted raw PDF bytes; length:', txt.length, 'sample:', sample);
          // first attempt pdfjs object-URL extraction (again) in case earlier paths failed
          try {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
            try {
              (pdfjsLib as any).GlobalWorkerOptions.workerSrc = (pdfjsLib as any).GlobalWorkerOptions?.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
              // eslint-disable-next-line no-console
              console.debug('[RealEstateAgent] pdfjs workerSrc set to', (pdfjsLib as any).GlobalWorkerOptions.workerSrc);
            } catch (_) { /* ignore */ }
            const url = URL.createObjectURL(f);
            const loadingTask = (pdfjsLib as any).getDocument({ url });
            const pdf = await loadingTask.promise;
            let fullText = '';
            const numPages = typeof pdf.numPages === 'number' ? pdf.numPages : 0;
            for (let i = 1; i <= numPages; i++) {
              /* eslint-disable no-await-in-loop */
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = (content.items || []).map((it: any) => it.str).join(' ');
              fullText += pageText + '\n';
            }
            URL.revokeObjectURL(url);
            if (fullText.trim()) return fullText;
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] pdfjs fallback extracted no text');
          } catch (pdfErr) {
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] pdfjs fallback failed:', (pdfErr as any)?.message ?? pdfErr);
          }

            // If pdfjs couldn't extract text, attempt OCR via tesseract.js by rendering pages to images
          try {
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] attempting OCR fallback with tesseract.js');
            const { createWorker } = await import('tesseract.js');
            // createWorker implementations vary; await the call to ensure we have the worker instance
            const worker = await (createWorker as any)({
              logger: (m: any) => {
                // eslint-disable-next-line no-console
                console.debug('[RealEstateAgent][tesseract]', m);
              }
            });
            await (worker as any).load();
            await (worker as any).loadLanguage('eng');
            await (worker as any).initialize('eng');

            // render each PDF page to canvas and run OCR
            try {
              const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
              try {
                (pdfjsLib as any).GlobalWorkerOptions.workerSrc = (pdfjsLib as any).GlobalWorkerOptions?.workerSrc || 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
              } catch (_) { /* ignore */ }

              const url = URL.createObjectURL(f);
              const loadingTask = (pdfjsLib as any).getDocument({ url });
              const pdf = await loadingTask.promise;
              const numPages = typeof pdf.numPages === 'number' ? pdf.numPages : 0;
              let ocrText = '';

              for (let p = 1; p <= numPages; p++) {
                /* eslint-disable no-await-in-loop */
                const page = await pdf.getPage(p);
                const viewport = page.getViewport({ scale: 2.0 });
                // create canvas
                const canvas = (typeof OffscreenCanvas !== 'undefined')
                  ? (new OffscreenCanvas(viewport.width, viewport.height) as any)
                  : (document.createElement('canvas') as HTMLCanvasElement);
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const renderContext = {
                  canvasContext: (canvas as any).getContext ? (canvas as any).getContext('2d') : null,
                  viewport
                };
                if (!renderContext.canvasContext) {
                  // eslint-disable-next-line no-console
                  console.debug('[RealEstateAgent] unable to get canvas context for OCR rendering; skipping page', p);
                  continue;
                }
                await page.render(renderContext).promise;
                // convert canvas to data URL
                let dataUrl: string;
                if (typeof (canvas as any).convertToBlob === 'function') {
                  const blob = await (canvas as any).convertToBlob();
                  dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result ?? ''));
                    reader.readAsDataURL(blob);
                  });
                } else {
                  dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
                }

                const { data: { text } } = await worker.recognize(dataUrl);
                ocrText += (text || '') + '\n';
              }

              await worker.terminate();
              URL.revokeObjectURL(url);
              if (ocrText.trim()) return ocrText;
              // eslint-disable-next-line no-console
              console.debug('[RealEstateAgent] OCR returned no text');
            } catch (ocrErr) {
              // eslint-disable-next-line no-console
              console.debug('[RealEstateAgent] OCR page render failed:', (ocrErr as any)?.message ?? ocrErr);
              try {
                await (await import('tesseract.js')).createWorker().then(w => w.terminate());
              } catch (_) { /* ignore */ }
            }
          } catch (tessErr) {
            // eslint-disable-next-line no-console
            console.debug('[RealEstateAgent] tesseract import/ocr failed:', (tessErr as any)?.message ?? tessErr);
          }
        }

        return txt;
      } catch (readErr) {
        // eslint-disable-next-line no-console
        console.debug('[RealEstateAgent] readAsText failed:', (readErr as any)?.message ?? readErr);
        return '';
      }
    };

    const parseTextForFields = (text: string) => {
      const result: Partial<OfferDetails> = {
        propertyAddress: '',
        salePrice: '',
        buyerName: '',
        sellerName: '',
        acceptanceDate: '',
        closingDate: '',
        inspectionPeriod: '',
        appraisalPeriod: '',
        financingDeadline: ''
      };

      if (!text) return result;

      // Work with both line-oriented and whole-text heuristics
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const whole = text.replace(/\s+/g, ' ').trim();

      // ADDRESS: try line-first, then whole-text search
      const addrRegex = /\d{1,5}\s+[A-Za-z0-9.\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Place)\b/i;
      const addrLine = lines.find((l) => addrRegex.test(l));
      const addrWhole = whole.match(addrRegex)?.[0];
      if (addrLine) result.propertyAddress = addrLine;
      else if (addrWhole) result.propertyAddress = addrWhole;

      // PRICE: look for $... or large numbers; prefer lines containing "price" or "sale"
      const priceRegex = /\$?\s?((?:\d{1,3}(?:,\d{3})+)|\d{4,})(?:\.\d{2})?/g;
      const prioritized = lines.concat([whole]);
      for (const l of prioritized) {
        const m = Array.from(l.matchAll(priceRegex));
        if (m.length) {
          // pick first plausible large number
          const found = m.map((x) => x[0]).find((s) => {
            const n = Number(String(s).replace(/[^0-9]/g, ''));
            return !Number.isNaN(n) && n > 1000;
          });
          if (found) {
            result.salePrice = found.toString().trim().startsWith('$') ? found.toString().trim() : `$${found.toString().replace(/[^\d]/g, '')}`;
            break;
          }
        }
      }

      // DATES: numeric, month-name, and label+next-line patterns
      const numericDateRegex = /(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b)/g;
      const monthNameRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/ig;
      const foundDates: Date[] = [];

      // scan lines and whole text
      const collectDateStrings = (s: string) => {
        const out: string[] = [];
        const mm = Array.from((s.matchAll(monthNameRegex)));
        mm.forEach(x => out.push(String(x[0])));
        const nn = Array.from((s.matchAll(numericDateRegex)));
        nn.forEach(x => out.push(String(x[0])));
        return out;
      };

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        // label + next-line
        if (/\bAcceptance Date\b/i.test(l) && i + 1 < lines.length) {
          collectDateStrings(lines[i + 1]).forEach(ds => {
            const d = new Date(ds); if (!isNaN(d.getTime())) foundDates.push(d);
          });
        }
        if (/\bClosing Date\b/i.test(l) && i + 1 < lines.length) {
          collectDateStrings(lines[i + 1]).forEach(ds => {
            const d = new Date(ds); if (!isNaN(d.getTime())) foundDates.push(d);
          });
        }
        collectDateStrings(l).forEach(ds => {
          const d = new Date(ds); if (!isNaN(d.getTime())) foundDates.push(d);
        });
      }
      // whole-text fallback
      collectDateStrings(whole).forEach(ds => {
        const d = new Date(ds); if (!isNaN(d.getTime())) foundDates.push(d);
      });

      if (foundDates.length) {
        const parsedDates = foundDates.sort((a, b) => a.getTime() - b.getTime());
        result.acceptanceDate = parsedDates[0].toISOString().slice(0, 10);
        if (parsedDates.length > 1) result.closingDate = parsedDates[parsedDates.length - 1].toISOString().slice(0, 10);
      }

      // PERIODS: global regex over whole text (covers many formats)
      const inspectionGlobal = whole.match(/inspection(?: period)?[:\s\-]*?(\d{1,3})\b/i);
      const appraisalGlobal = whole.match(/apprais(?:al|e)(?: period)?[:\s\-]*?(\d{1,3})\b/i);
      const financingGlobal = whole.match(/financ(?:ing|e)(?: deadline| period)?[:\s\-]*?(\d{1,3})\b/i);
      if (inspectionGlobal && !result.inspectionPeriod) result.inspectionPeriod = inspectionGlobal[1];
      if (appraisalGlobal && !result.appraisalPeriod) result.appraisalPeriod = appraisalGlobal[1];
      if (financingGlobal && !result.financingDeadline) result.financingDeadline = financingGlobal[1];

      // NAMES: aggressive multi-strategy approach
      // 1) direct labels "Buyer: John Doe" / "Buyer Name: John Doe"
      const buyerRegex = /\bBuyer(?: Name)?[:\s\-]{0,6}([A-Z][A-Za-z ,.'\-]{2,120})/i;
      const sellerRegex = /\bSeller(?: Name)?[:\s\-]{0,6}([A-Z][A-Za-z ,.'\-]{2,120})/i;
      const buyerMatch = whole.match(buyerRegex);
      const sellerMatch = whole.match(sellerRegex);
      if (buyerMatch) result.buyerName = buyerMatch[1].trim();
      if (sellerMatch) result.sellerName = sellerMatch[1].trim();

      // 2) label + next-line patterns already handled earlier per-line — check lines for next-line names
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!result.buyerName && /\bBuyer\b/i.test(l) && i + 1 < lines.length) {
          const nxt = lines[i + 1].trim();
          if (/^[A-Z][A-Za-z ,.'\-]{2,120}$/.test(nxt)) result.buyerName = nxt;
        }
        if (!result.sellerName && /\bSeller\b/i.test(l) && i + 1 < lines.length) {
          const nxt = lines[i + 1].trim();
          if (/^[A-Z][A-Za-z ,.'\-]{2,120}$/.test(nxt)) result.sellerName = nxt;
        }
      }

      // 3) signature or block heuristics: find nearby capitalized 2-word chunks after keywords like "Buyer" or "Buyer Signature"
      const signatureRegex = /\b(Buyer|Buyer Signature|Buyer Name|Seller|Seller Signature|Seller Name)\b[:\s\-]{0,6}([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i;
      // aggressive context search: up to 60 chars after keyword
      const contextBuyer = whole.match(/\bBuyer\b[\s\-_.,:;]{0,60}([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i);
      const contextSeller = whole.match(/\bSeller\b[\s\-_.,:;]{0,60}([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i);
      if (contextBuyer && !result.buyerName) result.buyerName = contextBuyer[1].trim();
      if (contextSeller && !result.sellerName) result.sellerName = contextSeller[1].trim();
      const sigMatch = whole.match(new RegExp(signatureRegex, 'gi'));
      if (sigMatch && !result.buyerName) {
        const m = signatureRegex.exec(whole);
        if (m && /Buyer/i.test(m[1])) result.buyerName = (m[2] || '').trim();
      }
      if (sigMatch && !result.sellerName) {
        const m = signatureRegex.exec(whole);
        if (m && /Seller/i.test(m[1])) result.sellerName = (m[2] || '').trim();
      }

      // 4) fallback: look for lines that have 2 capitalized words (likely names) near words "Buyer" or "Seller"
      if (!result.buyerName) {
        const idx = lines.findIndex(l => /\bBuyer\b/i.test(l));
        if (idx >= 0) {
          // check same line
          const same = lines[idx].replace(/Buyer[:\-]/i, '').trim();
          const candidate = same.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
          if (candidate) result.buyerName = candidate[0];
          else if (idx + 1 < lines.length) {
            const nextCandidate = lines[idx + 1].match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
            if (nextCandidate) result.buyerName = nextCandidate[0];
          }
        }
      }
      if (!result.sellerName) {
        const idx = lines.findIndex(l => /\bSeller\b/i.test(l));
        if (idx >= 0) {
          const same = lines[idx].replace(/Seller[:\-]/i, '').trim();
          const candidate = same.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
          if (candidate) result.sellerName = candidate[0];
          else if (idx + 1 < lines.length) {
            const nextCandidate = lines[idx + 1].match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
            if (nextCandidate) result.sellerName = nextCandidate[0];
          }
        }
      }

      // Final sanitization: trim and ensure not excessively long
      for (const k of Object.keys(result) as (keyof OfferDetails)[]) {
        if (typeof result[k] === 'string') result[k] = (result[k] as string).trim().slice(0, 200);
      }

      return result;
    };

    try {
      const rawText = await extractTextFromFile(file);
      const parsed = parseTextForFields(String(rawText || file.name || ''));

      // Debugging: show sample of extracted text and parsed fields in the browser console
      try {
        // avoid flooding console for very large files
        const sample = typeof rawText === 'string' ? rawText.slice(0, 200) : '';
        // eslint-disable-next-line no-console
        console.debug('[RealEstateAgent] extractedTextSample:', sample);
        // eslint-disable-next-line no-console
        console.debug('[RealEstateAgent] parsedFields:', parsed);
      } catch (_) { /* ignore logging errors in older browsers */ }

      const hasParsedValues = Object.values(parsed || {}).some((v) => v !== undefined && v !== null && String(v).trim() !== '');

      if (hasParsedValues) {
        setOfferDetails((prev) => ({
          ...prev,
          ...(parsed.propertyAddress ? { propertyAddress: parsed.propertyAddress } : {}),
          ...(parsed.salePrice ? { salePrice: parsed.salePrice } : {}),
          ...(parsed.buyerName ? { buyerName: parsed.buyerName } : {}),
          ...(parsed.sellerName ? { sellerName: parsed.sellerName } : {}),
          ...(parsed.acceptanceDate ? { acceptanceDate: parsed.acceptanceDate } : {}),
          ...(parsed.closingDate ? { closingDate: parsed.closingDate } : {}),
          ...(parsed.inspectionPeriod ? { inspectionPeriod: parsed.inspectionPeriod } : {}),
          ...(parsed.appraisalPeriod ? { appraisalPeriod: parsed.appraisalPeriod } : {}),
          ...(parsed.financingDeadline ? { financingDeadline: parsed.financingDeadline } : {})
        }));
      } else {
        setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));
      }
    } catch (err) {
      setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));
    }

    setActiveTab('details');
  };

  const calculateDeadlines = () => {
    if (!offerDetails.acceptanceDate) return;

    const acceptanceDate = new Date(offerDetails.acceptanceDate);
    const timeline: any[] = [];

    const inspectionDeadline = new Date(acceptanceDate);
    inspectionDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.inspectionPeriod || '10', 10));

    const appraisalDeadline = new Date(acceptanceDate);
    appraisalDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.appraisalPeriod || '21', 10));

    const financingDeadline = new Date(acceptanceDate);
    financingDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.financingDeadline || '30', 10));

    const titleSearch = new Date(acceptanceDate);
    titleSearch.setDate(acceptanceDate.getDate() + 7);

    const finalWalkthrough = offerDetails.closingDate ? new Date(offerDetails.closingDate) : new Date(acceptanceDate);
    finalWalkthrough.setDate(finalWalkthrough.getDate() - 1);

    timeline.push(
      { task: 'Send Welcome Emails', date: new Date(acceptanceDate.getTime() + 24 * 60 * 60 * 1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Order Title Commitment', date: new Date(acceptanceDate.getTime() + 24 * 60 * 60 * 1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Coordinate with Lender', date: new Date(acceptanceDate.getTime() + 48 * 60 * 60 * 1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Inspection Period Ends', date: inspectionDeadline, priority: 'high', responsible: 'Buyer' },
      { task: 'Follow up on Inspection Results', date: new Date(inspectionDeadline.getTime() + 24 * 60 * 60 * 1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Title Search Completion', date: titleSearch, priority: 'medium', responsible: 'Title Company' },
      { task: 'Appraisal Deadline', date: appraisalDeadline, priority: 'high', responsible: 'Lender' },
      { task: 'Monitor Financing Progress', date: new Date(financingDeadline.getTime() - 7 * 24 * 60 * 60 * 1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Financing Approval Deadline', date: financingDeadline, priority: 'critical', responsible: 'Buyer/Lender' },
      { task: 'Prepare Closing Checklist', date: new Date(finalWalkthrough.getTime() - 3 * 24 * 60 * 60 * 1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Final Walk-through', date: finalWalkthrough, priority: 'medium', responsible: 'Buyer' },
      { task: 'Closing Date', date: new Date(offerDetails.closingDate || offerDetails.acceptanceDate), priority: 'critical', responsible: 'All Parties' }
    );

    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    setGeneratedTimeline(timeline);
    generateEmailTemplates();
    setActiveTab('timeline');
    onGenerate?.();
  };

  const generateEmailTemplates = () => {
    const templates = [
      {
        title: 'Welcome Email - Buyer',
        subject: `Congratulations! Your offer on ${offerDetails.propertyAddress} has been accepted`,
        body: `Dear ${offerDetails.buyerName},

Congratulations! Your offer on ${offerDetails.propertyAddress} has been accepted for ${offerDetails.salePrice}.

Here are your important upcoming deadlines:
• Inspection Period: ${offerDetails.inspectionPeriod || '10'} days from acceptance
• Financing Deadline: ${offerDetails.financingDeadline || '30'} days from acceptance
• Closing Date: ${offerDetails.closingDate || offerDetails.acceptanceDate}

Next steps:
1. Schedule your home inspection immediately
2. Contact your lender to begin the mortgage process
3. Review all contract documents carefully

Best regards,
Your Real Estate Team`
      },
      {
        title: 'Welcome Email - Seller',
        subject: `Great news! Your property at ${offerDetails.propertyAddress} is under contract`,
        body: `Dear ${offerDetails.sellerName},

Excellent news! Your property at ${offerDetails.propertyAddress} is now under contract for ${offerDetails.salePrice}.

Key dates to remember:
• Buyer's inspection period: ${offerDetails.inspectionPeriod || '10'} days
• Expected closing: ${offerDetails.closingDate || offerDetails.acceptanceDate}

Best regards,
Your Real Estate Team`
      }
    ];

    setEmailTemplates(templates);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200">
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <Home className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Real Estate AI Agent</h1>
                <p className="text-gray-600">Post-Offer Management & Timeline Generator</p>
              </div>
            </div>
          </div>

          <nav className="flex space-x-8 px-6">
            {['upload', 'details', 'timeline', 'emails'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'upload' && <Upload className="w-4 h-4 inline mr-1" />}
                {tab === 'details' && <FileText className="w-4 h-4 inline mr-1" />}
                {tab === 'timeline' && <Calendar className="w-4 h-4 inline mr-1" />}
                {tab === 'emails' && <Mail className="w-4 h-4 inline mr-1" />}
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'upload' && (
            <div className="text-center py-12">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Upload Accepted Offer</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload the signed purchase agreement or accepted offer document
              </p>
              <div className="mt-6">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="offer-upload"
                />
                <label
                  htmlFor="offer-upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </label>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6" role="region" aria-labelledby="details-heading">
              <h3 id="details-heading" className="text-lg font-medium text-gray-900">Enter Offer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700">Property Address</label>
                  <input
                    id="propertyAddress"
                    name="propertyAddress"
                    title="Property address"
                    placeholder="123 Main St"
                    type="text"
                    value={offerDetails.propertyAddress}
                    onChange={(e) => setOfferDetails({ ...offerDetails, propertyAddress: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">Sale Price</label>
                  <input
                    id="salePrice"
                    name="salePrice"
                    title="Sale price"
                    placeholder="$350,000"
                    type="text"
                    value={offerDetails.salePrice}
                    onChange={(e) => setOfferDetails({ ...offerDetails, salePrice: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="buyerName" className="block text-sm font-medium text-gray-700">Buyer Name</label>
                  <input
                    id="buyerName"
                    name="buyerName"
                    title="Buyer name"
                    placeholder="John Doe"
                    type="text"
                    value={offerDetails.buyerName}
                    onChange={(e) => setOfferDetails({ ...offerDetails, buyerName: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="sellerName" className="block text-sm font-medium text-gray-700">Seller Name</label>
                  <input
                    id="sellerName"
                    name="sellerName"
                    title="Seller name"
                    placeholder="Jane Smith"
                    type="text"
                    value={offerDetails.sellerName}
                    onChange={(e) => setOfferDetails({ ...offerDetails, sellerName: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="acceptanceDate" className="block text-sm font-medium text-gray-700">Acceptance Date</label>
                  <input
                    id="acceptanceDate"
                    name="acceptanceDate"
                    title="Acceptance date"
                    type="date"
                    value={offerDetails.acceptanceDate}
                    onChange={(e) => setOfferDetails({ ...offerDetails, acceptanceDate: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="closingDate" className="block text-sm font-medium text-gray-700">Closing Date</label>
                  <input
                    id="closingDate"
                    name="closingDate"
                    title="Closing date"
                    type="date"
                    value={offerDetails.closingDate}
                    onChange={(e) => setOfferDetails({ ...offerDetails, closingDate: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="inspectionPeriod" className="block text-sm font-medium text-gray-700">Inspection Period (days)</label>
                  <input
                    id="inspectionPeriod"
                    name="inspectionPeriod"
                    title="Inspection period in days"
                    placeholder="10"
                    type="number"
                    value={offerDetails.inspectionPeriod}
                    onChange={(e) => setOfferDetails({ ...offerDetails, inspectionPeriod: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="appraisalPeriod" className="block text-sm font-medium text-gray-700">Appraisal Period (days)</label>
                  <input
                    id="appraisalPeriod"
                    name="appraisalPeriod"
                    title="Appraisal period in days"
                    placeholder="21"
                    type="number"
                    value={offerDetails.appraisalPeriod}
                    onChange={(e) => setOfferDetails({ ...offerDetails, appraisalPeriod: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="financingDeadline" className="block text-sm font-medium text-gray-700">Financing Deadline (days)</label>
                  <input
                    id="financingDeadline"
                    name="financingDeadline"
                    title="Financing deadline in days"
                    placeholder="30"
                    type="number"
                    value={offerDetails.financingDeadline}
                    onChange={(e) => setOfferDetails({ ...offerDetails, financingDeadline: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  onClick={calculateDeadlines}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Generate Timeline & Emails
                </button>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Transaction Timeline</h3>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Print Timeline
                </button>
              </div>
              {generatedTimeline.length === 0 ? (
                <p className="text-gray-500">Please fill out offer details and generate timeline first.</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <h4 className="font-medium text-yellow-800">HUD-Approved Housing Counseling Agencies</h4>
                    <p className="text-sm text-yellow-700 mt-1">Provide these resources to buyers who need financial guidance:</p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-yellow-800">
                      <div>• ACTS Housing - (414) 937-9295</div>
                      <div>• UCC - (414) 384-3100</div>
                      <div>• HIR - (414) 264-2622</div>
                      <div>• Green Path Financial - (877) 337-3399</div>
                    </div>
                  </div>
                  {generatedTimeline.map((item, index) => (
                    <div key={index} className={`flex items-start space-x-4 p-4 rounded-lg ${item.agentAction ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-gray-50'}`}>
                      <Clock className="w-5 h-5 text-gray-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">
                            {item.task}
                            {item.agentAction && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Agent Action</span>}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Due: {formatDate(item.date)} • Responsible: {item.responsible}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Email Templates</h3>
              {emailTemplates.length === 0 ? (
                <p className="text-gray-500">Please generate timeline first to create email templates.</p>
              ) : (
                <div className="space-y-6">
                  {emailTemplates.map((template, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900">{template.title}</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(`${template.subject}\n\n${template.body}`).catch(() => {});
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Copy Template
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Subject:</label>
                          <p className="text-sm bg-gray-50 p-2 rounded">{template.subject}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Body:</label>
                          <pre className="text-sm bg-gray-50 p-4 rounded whitespace-pre-wrap font-sans">
                            {template.body}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealEstateAgent;
