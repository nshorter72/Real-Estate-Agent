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

      if (name.endsWith('.docx') && arrayBuffer) {
        try {
          const mammoth = await import('mammoth');
          // mammoth.extractRawText expects a buffer-like; use as any to avoid bundler typing issues
          const res = await (mammoth as any).extractRawText({ arrayBuffer });
          if (res && res.value) return String(res.value);
        } catch (_) { /* ignore and continue */ }
      }

      if (name.endsWith('.pdf') && arrayBuffer) {
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
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
        } catch (_) { /* ignore and continue */ }
      }

      try {
        const txt = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = reject;
          reader.readAsText(f);
        });
        return txt;
      } catch (_) {
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

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      // ADDRESS
      const addrRegex = /\d{1,5}\s+[A-Za-z0-9.\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Place)\b/i;
      const addrLine = lines.find((l) => addrRegex.test(l));
      if (addrLine) result.propertyAddress = addrLine;

      // PRICE
      const priceRegex = /\$?\s?((?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{2})?/;
      for (const l of lines) {
        const m = l.match(priceRegex);
        if (m && Number(m[1].replace(/,/g, '')) > 1000) {
          result.salePrice = (m[0].trim().startsWith('$') ? m[0].trim() : `$${m[1].trim()}`);
          break;
        }
      }

      // DATES - include MM/DD/YYYY, YYYY-MM-DD and Month name formats like "September 1, 2025"
      const numericDateRegex = /(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b)/g;
      const monthNameRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i;
      const foundDates: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        let m = l.match(numericDateRegex);
        if (m) m.forEach((d) => foundDates.push(d));
        const mm = l.match(monthNameRegex);
        if (mm) mm.forEach((d) => foundDates.push(d));
        // Also check if a line is just "Acceptance Date" and the next line is a date
        if (/\bAcceptance Date\b/i.test(l) && i + 1 < lines.length) {
          foundDates.push(lines[i + 1]);
        }
        if (/\bClosing Date\b/i.test(l) && i + 1 < lines.length) {
          foundDates.push(lines[i + 1]);
        }
      }

      if (foundDates.length) {
        const parsedDates = foundDates
          .map((d) => {
            // Normalize month-name dates by letting JS Date parse them
            const parsedDate = new Date(d);
            return isNaN(parsedDate.getTime()) ? null : parsedDate;
          })
          .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (parsedDates.length) {
          result.acceptanceDate = parsedDates[0].toISOString().slice(0, 10);
          if (parsedDates.length > 1) result.closingDate = parsedDates[parsedDates.length - 1].toISOString().slice(0, 10);
        }
      }

      // PERIODS: handle "Inspection: 10 days", "Inspection Period - 10 days", or "Inspection 10"
      const periodRegex = /inspection[^0-9\n\r]{0,20}(\d{1,3})\b/i;
      const appRegex = /apprais(?:al|e)[^\d\n\r]{0,20}(\d{1,3})\b/i;
      const finRegex = /financ(?:ing|e)[^\d\n\r]{0,20}(\d{1,3})\b/i;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const mi = l.match(periodRegex) || (/\bInspection Period\b/i.test(l) && (lines[i + 1] || '').match(/\d{1,3}/));
        if (mi && !result.inspectionPeriod) result.inspectionPeriod = (mi[1] || (mi as any)[0] || '').toString().replace(/\D/g, '');
        const ma = l.match(appRegex) || (/\bAppraisal Period\b/i.test(l) && (lines[i + 1] || '').match(/\d{1,3}/));
        if (ma && !result.appraisalPeriod) result.appraisalPeriod = (ma[1] || (ma as any)[0] || '').toString().replace(/\D/g, '');
        const mf = l.match(finRegex) || (/\bFinancing Deadline\b/i.test(l) && (lines[i + 1] || '').match(/\d{1,3}/));
        if (mf && !result.financingDeadline) result.financingDeadline = (mf[1] || (mf as any)[0] || '').toString().replace(/\D/g, '');
      }

      // NAMES: try direct "Buyer: John Doe" or label + next-line pattern
      const buyerRegex = /\bBuyer(?: Name)?[:\s\-]{0,3}([A-Z][A-Za-z ,.'-]{2,})/i;
      const sellerRegex = /\bSeller(?: Name)?[:\s\-]{0,3}([A-Z][A-Za-z ,.'-]{2,})/i;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const mb = l.match(buyerRegex);
        if (mb && !result.buyerName) result.buyerName = mb[1].trim();
        else if (!result.buyerName && /\bBuyer\b/i.test(l) && i + 1 < lines.length && /^[A-Z][A-Za-z ,.'-]{2,}$/.test(lines[i + 1])) {
          result.buyerName = lines[i + 1].trim();
        }

        const ms = l.match(sellerRegex);
        if (ms && !result.sellerName) result.sellerName = ms[1].trim();
        else if (!result.sellerName && /\bSeller\b/i.test(l) && i + 1 < lines.length && /^[A-Z][A-Za-z ,.'-]{2,}$/.test(lines[i + 1])) {
          result.sellerName = lines[i + 1].trim();
        }
      }

      // Extra fallback: sometimes names appear with "Buyer" and a name on same line after commas
      if (!result.buyerName) {
        const line = lines.find((l) => /\bBuyer\b/i.test(l) && /[A-Z][a-z]+/.test(l));
        if (line) {
          const tokens = line.split(/Buyer[:\-]/i).pop()?.replace(/[^A-Za-z ,.'-]/g, '').trim() ?? '';
          if (tokens && tokens.length < 80) result.buyerName = tokens;
        }
      }
      if (!result.sellerName) {
        const line = lines.find((l) => /\bSeller\b/i.test(l) && /[A-Z][a-z]+/.test(l));
        if (line) {
          const tokens = line.split(/Seller[:\-]/i).pop()?.replace(/[^A-Za-z ,.'-]/g, '').trim() ?? '';
          if (tokens && tokens.length < 80) result.sellerName = tokens;
        }
      }

      return result;
    };

    try {
      const rawText = await extractTextFromFile(file);
      const parsed = parseTextForFields(String(rawText || file.name || ''));

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
