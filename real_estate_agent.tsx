import React, { useState } from 'react';
import { Calendar, Mail, Upload, FileText, Clock, User, Home } from 'lucide-react';

const RealEstateAgent = () => {
  const [uploadedOffer, setUploadedOffer] = useState(null);
  const [offerDetails, setOfferDetails] = useState({
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
  const [generatedTimeline, setGeneratedTimeline] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;


    setUploadedOffer(file);
    // Immediately prefill propertyAddress with filename so the details view shows something
    // while we attempt content extraction/heuristics asynchronously.
    setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));

    // Helper: read file to text using best-effort handlers (docx -> mammoth, pdf -> pdfjs, fallback -> text)
    const extractTextFromFile = async (f) => {
      const name = f.name.toLowerCase();
      const arrayBuffer = await f.arrayBuffer().catch(() => null);

      // DOCX with mammoth
      if (name.endsWith('.docx') && arrayBuffer) {
        try {
          const mammoth = await import('mammoth');
          const res = await mammoth.extractRawText({ arrayBuffer });
          if (res && res.value) return res.value;
        } catch (_) { /* ignore and fallthrough */ }
      }

      // PDF with pdfjs (best-effort)
      if (name.endsWith('.pdf') && arrayBuffer) {
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
          const uint8 = new Uint8Array(arrayBuffer);
          const loadingTask = pdfjsLib.getDocument({ data: uint8 });
          const pdf = await loadingTask.promise;
          let fullText = '';
          const numPages = pdf.numPages || 0;
          for (let i = 1; i <= numPages; i++) {
            /* eslint-disable no-await-in-loop */
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((it) => it.str).join(' ');
            fullText += pageText + '\n';
          }
          if (fullText.trim()) return fullText;
        } catch (_) { /* ignore and fallthrough */ }
      }

      // Fallback: try plain text reading
      try {
        const txt = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsText(f);
        });
        return txt;
      } catch (_) {
        return '';
      }
    };

    // Heuristic parsing from raw text
    const parseTextForFields = (text) => {
      const result = {
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

      // Attempt address: look for a line with a number and a street type
      const addrRegex = /\d{1,5}\s+[A-Za-z0-9.\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Place)\b/i;
      const addrLine = lines.find((l) => addrRegex.test(l));
      if (addrLine) result.propertyAddress = addrLine;

      // Price: $1,234,567 or 1234567
      const priceRegex = /\$?\s?((?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{2})?/;
      for (const l of lines) {
        const m = l.match(priceRegex);
        if (m && Number(m[1].replace(/,/g, '')) > 1000) {
          result.salePrice = (m[0].startsWith('$') ? m[0] : `$${m[1]}`);
          break;
        }
      }

      // Dates: try common formats
      const dateRegexAll = /(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|(\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b)/g;
      const foundDates = [];
      for (const l of lines) {
        const m = l.match(dateRegexAll);
        if (m) m.forEach((d) => foundDates.push(d));
      }
      if (foundDates.length) {
        // heuristic: earliest found -> acceptance, latest -> closing (if plausible)
        const parsed = foundDates.map((d) => {
          const parsedDate = new Date(d);
          return isNaN(parsedDate.getTime()) ? null : parsedDate;
        }).filter(Boolean).sort((a,b) => a - b);

        if (parsed.length) {
          result.acceptanceDate = parsed[0].toISOString().slice(0,10); // yyyy-mm-dd for input[type=date]
          if (parsed.length > 1) result.closingDate = parsed[parsed.length-1].toISOString().slice(0,10);
        }
      }

      // Inspection / appraisal / financing periods: look for "inspection" + number
      const periodRegex = /inspection[^0-9\n\r]{0,20}(\d{1,3})\b/i;
      const appRegex = /apprais(?:al|e)[^\d\n\r]{0,20}(\d{1,3})\b/i;
      const finRegex = /financ(?:ing|e)[^\d\n\r]{0,20}(\d{1,3})\b/i;

      for (const l of lines) {
        const mi = l.match(periodRegex);
        if (mi && !result.inspectionPeriod) result.inspectionPeriod = mi[1];
        const ma = l.match(appRegex);
        if (ma && !result.appraisalPeriod) result.appraisalPeriod = ma[1];
        const mf = l.match(finRegex);
        if (mf && !result.financingDeadline) result.financingDeadline = mf[1];
      }

      // Names: look for "Buyer" / "Seller" labels
      const buyerRegex = /\bBuyer[:\s\-]{0,3}([A-Z][A-Za-z ,.'-]{2,})/i;
      const sellerRegex = /\bSeller[:\s\-]{0,3}([A-Z][A-Za-z ,.'-]{2,})/i;
      for (const l of lines) {
        const mb = l.match(buyerRegex);
        if (mb && !result.buyerName) result.buyerName = mb[1].trim();
        const ms = l.match(sellerRegex);
        if (ms && !result.sellerName) result.sellerName = ms[1].trim();
      }

      // Fallback: try to infer names from lines containing "Buyer" or "Seller"
      if (!result.buyerName) {
        const line = lines.find((l) => /\bBuyer\b/i && /[A-Z][a-z]+/g.test(l));
        if (line) {
          const tokens = line.split(/[:\-]/).pop().trim();
          if (tokens && tokens.length < 60) result.buyerName = tokens;
        }
      }
      if (!result.sellerName) {
        const line = lines.find((l) => /\bSeller\b/i && /[A-Z][a-z]+/g.test(l));
        if (line) {
          const tokens = line.split(/[:\-]/).pop().trim();
          if (tokens && tokens.length < 60) result.sellerName = tokens;
        }
      }

      return result;
    };

    try {
      const rawText = await extractTextFromFile(file);
      const parsed = parseTextForFields(rawText || file.name || '');

      // If parser returned any useful value, merge it; otherwise fall back to filename
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
        // No useful parse results — use filename as a minimal prefill so the user sees something
        setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));
      }
    } catch (err) {
      // If parsing throws, fall back to minimal prefill (filename -> property)
      setOfferDetails((prev) => ({ ...prev, propertyAddress: file.name }));
    }

    // Show the details tab so the user can review / correct any fields
    setActiveTab('details');
  };

  const calculateDeadlines = () => {
    if (!offerDetails.acceptanceDate) return;

    const acceptanceDate = new Date(offerDetails.acceptanceDate);
    const timeline = [];

    // Standard real estate timeline calculations
    const inspectionDeadline = new Date(acceptanceDate);
    inspectionDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.inspectionPeriod || 10));

    const appraisalDeadline = new Date(acceptanceDate);
    appraisalDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.appraisalPeriod || 21));

    const financingDeadline = new Date(acceptanceDate);
    financingDeadline.setDate(acceptanceDate.getDate() + parseInt(offerDetails.financingDeadline || 30));

    const titleSearch = new Date(acceptanceDate);
    titleSearch.setDate(acceptanceDate.getDate() + 7);

    const finalWalkthrough = new Date(offerDetails.closingDate);
    finalWalkthrough.setDate(finalWalkthrough.getDate() - 1);

    timeline.push(
      { task: 'Send Welcome Emails', date: new Date(acceptanceDate.getTime() + 24*60*60*1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Order Title Commitment', date: new Date(acceptanceDate.getTime() + 24*60*60*1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Coordinate with Lender', date: new Date(acceptanceDate.getTime() + 48*60*60*1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Inspection Period Ends', date: inspectionDeadline, priority: 'high', responsible: 'Buyer' },
      { task: 'Follow up on Inspection Results', date: new Date(inspectionDeadline.getTime() + 24*60*60*1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Title Search Completion', date: titleSearch, priority: 'medium', responsible: 'Title Company' },
      { task: 'Appraisal Deadline', date: appraisalDeadline, priority: 'high', responsible: 'Lender' },
      { task: 'Monitor Financing Progress', date: new Date(financingDeadline.getTime() - 7*24*60*60*1000), priority: 'high', responsible: 'Agent', agentAction: true },
      { task: 'Financing Approval Deadline', date: financingDeadline, priority: 'critical', responsible: 'Buyer/Lender' },
      { task: 'Prepare Closing Checklist', date: new Date(finalWalkthrough.getTime() - 3*24*60*60*1000), priority: 'medium', responsible: 'Agent', agentAction: true },
      { task: 'Final Walk-through', date: finalWalkthrough, priority: 'medium', responsible: 'Buyer' },
      { task: 'Closing Date', date: new Date(offerDetails.closingDate), priority: 'critical', responsible: 'All Parties' }
    );

    timeline.sort((a, b) => a.date - b.date);
    setGeneratedTimeline(timeline);
    generateEmailTemplates();
    setActiveTab('timeline');
  };

  const generateEmailTemplates = () => {
    const templates = [
      {
        title: 'Welcome Email - Buyer',
        subject: `Congratulations! Your offer on ${offerDetails.propertyAddress} has been accepted`,
        body: `Dear ${offerDetails.buyerName},

Congratulations! Your offer on ${offerDetails.propertyAddress} has been accepted for ${offerDetails.salePrice}.

Here are your important upcoming deadlines:
• Inspection Period: ${offerDetails.inspectionPeriod} days from acceptance
• Financing Deadline: ${offerDetails.financingDeadline} days from acceptance
• Closing Date: ${offerDetails.closingDate}

Next steps:
1. Schedule your home inspection immediately
2. Contact your lender to begin the mortgage process
3. Review all contract documents carefully

HUD-Approved Housing Counseling Resources:
If you need assistance with homeownership counseling, budgeting, or financial guidance, these HUD-approved agencies can help:

• ACTS Housing - (414) 937-9295
  Provides homeownership education and foreclosure prevention
• UCC (United Community Center) - (414) 384-3100
  Offers financial literacy and homebuyer education programs
• HIR (Homeownership Initiative & Resources) - (414) 264-2622
  Specializes in first-time homebuyer programs
• Green Path Financial Wellness - (877) 337-3399
  Comprehensive financial counseling and debt management

We'll be in touch with detailed timeline and reminders.

Best regards,
Your Real Estate Team`
      },
      {
        title: 'Welcome Email - Seller',
        subject: `Great news! Your property at ${offerDetails.propertyAddress} is under contract`,
        body: `Dear ${offerDetails.sellerName},

Excellent news! Your property at ${offerDetails.propertyAddress} is now under contract for ${offerDetails.salePrice}.

Key dates to remember:
• Buyer's inspection period: ${offerDetails.inspectionPeriod} days
• Expected closing: ${offerDetails.closingDate}

What to expect:
1. The buyer will schedule an inspection within the next few days
2. We may receive requests for repairs or credits
3. Continue to maintain the property in good condition
4. Keep all utilities on through closing

We'll keep you updated throughout the process.

Best regards,
Your Real Estate Team`
      },
      {
        title: 'Real Estate Agent - Internal Checklist',
        subject: `Action Items: ${offerDetails.propertyAddress} Under Contract`,
        body: `INTERNAL AGENT CHECKLIST - ${offerDetails.propertyAddress}

CONTRACT DETAILS:
• Property: ${offerDetails.propertyAddress}
• Buyer: ${offerDetails.buyerName}
• Seller: ${offerDetails.sellerName}
• Sale Price: ${offerDetails.salePrice}
• Acceptance Date: ${offerDetails.acceptanceDate}
• Closing Date: ${offerDetails.closingDate}

IMMEDIATE ACTION ITEMS (Within 24-48 hours):
□ Send welcome emails to buyer and seller
□ Order title commitment
□ Coordinate with buyer's lender
□ Schedule inspection with buyer
□ Set up file with transaction coordinator
□ Send contract to all parties' attorneys (if applicable)

ONGOING DEADLINES TO MONITOR:
□ Inspection Period: ${offerDetails.inspectionPeriod} days
□ Financing Approval: ${offerDetails.financingDeadline} days
□ Appraisal Completion: ${offerDetails.appraisalPeriod} days

WEEKLY FOLLOW-UPS NEEDED:
□ Buyer's financing progress
□ Inspection results and repair negotiations
□ Appraisal scheduling and results
□ Title/survey issues resolution
□ Closing preparations

CLOSING PREPARATION (1 week before):
□ Final walk-through scheduled
□ Closing documents reviewed
□ Funds verification completed
□ Keys/garage remotes ready for transfer

This checklist can be printed and kept in the transaction file.`
      },
      {
        title: 'Inspection Reminder - 3 Days Before',
        subject: 'Inspection Deadline Approaching - Action Required',
        body: `Dear ${offerDetails.buyerName},

This is a friendly reminder that your inspection period for ${offerDetails.propertyAddress} ends in 3 days.

If you haven't scheduled your inspection yet, please do so immediately. If you have completed the inspection and need to request repairs or credits, please send your requests as soon as possible.

Remember: If no inspection objections are submitted by the deadline, you waive your right to inspection-related negotiations.

If you have questions about the inspection process or need guidance on evaluating inspection results, consider contacting these HUD-approved housing counseling agencies:

• ACTS Housing - (414) 937-9295
• UCC (United Community Center) - (414) 384-3100
• HIR (Homeownership Initiative & Resources) - (414) 264-2622
• Green Path Financial Wellness - (877) 337-3399

Please let us know if you need any assistance.

Best regards,
Your Real Estate Team`
      },
      {
        title: 'Financing Deadline Reminder',
        subject: 'Financing Approval Deadline - 7 Days Remaining',
        body: `Dear ${offerDetails.buyerName},

This is an important reminder that your financing approval deadline for ${offerDetails.propertyAddress} is in 7 days.

Please contact your lender immediately if you haven't received final approval. If you're experiencing any challenges with your loan process, these HUD-approved agencies can provide assistance:

• Green Path Financial Wellness - (877) 337-3399
  Mortgage and credit counseling
• ACTS Housing - (414) 937-9295
  Homeownership financing assistance
• HIR (Homeownership Initiative & Resources) - (414) 264-2622
  First-time buyer loan programs

Time-sensitive action items:
□ Contact lender for status update
□ Provide any additional documentation requested
□ Notify us immediately of any potential delays

Failure to meet the financing deadline may result in contract cancellation.

Best regards,
Your Real Estate Team`
      }
    ];

    setEmailTemplates(templates);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
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
                onClick={() => setActiveTab(tab)}
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
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Enter Offer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Property Address</label>
                  <input
                    type="text"
                    value={offerDetails.propertyAddress}
                    onChange={(e) => setOfferDetails({...offerDetails, propertyAddress: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sale Price</label>
                  <input
                    type="text"
                    value={offerDetails.salePrice}
                    onChange={(e) => setOfferDetails({...offerDetails, salePrice: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Buyer Name</label>
                  <input
                    type="text"
                    value={offerDetails.buyerName}
                    onChange={(e) => setOfferDetails({...offerDetails, buyerName: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Seller Name</label>
                  <input
                    type="text"
                    value={offerDetails.sellerName}
                    onChange={(e) => setOfferDetails({...offerDetails, sellerName: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Acceptance Date</label>
                  <input
                    type="date"
                    value={offerDetails.acceptanceDate}
                    onChange={(e) => setOfferDetails({...offerDetails, acceptanceDate: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Closing Date</label>
                  <input
                    type="date"
                    value={offerDetails.closingDate}
                    onChange={(e) => setOfferDetails({...offerDetails, closingDate: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inspection Period (days)</label>
                  <input
                    type="number"
                    value={offerDetails.inspectionPeriod}
                    onChange={(e) => setOfferDetails({...offerDetails, inspectionPeriod: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Appraisal Period (days)</label>
                  <input
                    type="number"
                    value={offerDetails.appraisalPeriod}
                    onChange={(e) => setOfferDetails({...offerDetails, appraisalPeriod: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="21"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Financing Deadline (days)</label>
                  <input
                    type="number"
                    value={offerDetails.financingDeadline}
                    onChange={(e) => setOfferDetails({...offerDetails, financingDeadline: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="30"
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
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
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
