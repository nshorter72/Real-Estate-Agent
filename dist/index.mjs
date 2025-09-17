// src/RealEstateAgent.tsx
import { useState } from "react";
import { Calendar, Mail, Upload, FileText, Clock, Home } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
var RealEstateAgent = ({
  initialOfferDetails = {},
  onGenerate,
  className = ""
}) => {
  const [uploadedOffer, setUploadedOffer] = useState(null);
  const [offerDetails, setOfferDetails] = useState({
    acceptanceDate: initialOfferDetails.acceptanceDate || "",
    closingDate: initialOfferDetails.closingDate || "",
    inspectionPeriod: initialOfferDetails.inspectionPeriod || "",
    appraisalPeriod: initialOfferDetails.appraisalPeriod || "",
    financingDeadline: initialOfferDetails.financingDeadline || "",
    propertyAddress: initialOfferDetails.propertyAddress || "",
    buyerName: initialOfferDetails.buyerName || "",
    sellerName: initialOfferDetails.sellerName || "",
    salePrice: initialOfferDetails.salePrice || ""
  });
  const [generatedTimeline, setGeneratedTimeline] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState("upload");
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setUploadedOffer(file);
      setActiveTab("details");
    }
  };
  const calculateDeadlines = () => {
    if (!offerDetails.acceptanceDate)
      return;
    const acceptanceDate = new Date(offerDetails.acceptanceDate);
    const timeline = [];
    const parseDays = (v, fallback = 0) => {
      const n = parseInt(v || "", 10);
      return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
    };
    const inspectionDeadline = new Date(acceptanceDate);
    inspectionDeadline.setDate(acceptanceDate.getDate() + parseDays(offerDetails.inspectionPeriod, 10));
    const appraisalDeadline = new Date(acceptanceDate);
    appraisalDeadline.setDate(acceptanceDate.getDate() + parseDays(offerDetails.appraisalPeriod, 21));
    const financingDeadline = new Date(acceptanceDate);
    financingDeadline.setDate(acceptanceDate.getDate() + parseDays(offerDetails.financingDeadline, 30));
    const titleSearch = new Date(acceptanceDate);
    titleSearch.setDate(acceptanceDate.getDate() + 7);
    const finalWalkthrough = offerDetails.closingDate ? new Date(offerDetails.closingDate) : new Date(acceptanceDate);
    finalWalkthrough.setDate(finalWalkthrough.getDate() - 1);
    timeline.push(
      { task: "Send Welcome Emails", date: new Date(acceptanceDate.getTime() + 24 * 60 * 60 * 1e3), priority: "high", responsible: "Agent", agentAction: true },
      { task: "Order Title Commitment", date: new Date(acceptanceDate.getTime() + 24 * 60 * 60 * 1e3), priority: "high", responsible: "Agent", agentAction: true },
      { task: "Coordinate with Lender", date: new Date(acceptanceDate.getTime() + 48 * 60 * 60 * 1e3), priority: "medium", responsible: "Agent", agentAction: true },
      { task: "Inspection Period Ends", date: inspectionDeadline, priority: "high", responsible: "Buyer" },
      { task: "Follow up on Inspection Results", date: new Date(inspectionDeadline.getTime() + 24 * 60 * 60 * 1e3), priority: "medium", responsible: "Agent", agentAction: true },
      { task: "Title Search Completion", date: titleSearch, priority: "medium", responsible: "Title Company" },
      { task: "Appraisal Deadline", date: appraisalDeadline, priority: "high", responsible: "Lender" },
      { task: "Monitor Financing Progress", date: new Date(financingDeadline.getTime() - 7 * 24 * 60 * 60 * 1e3), priority: "high", responsible: "Agent", agentAction: true },
      { task: "Financing Approval Deadline", date: financingDeadline, priority: "critical", responsible: "Buyer/Lender" },
      { task: "Prepare Closing Checklist", date: new Date(finalWalkthrough.getTime() - 3 * 24 * 60 * 60 * 1e3), priority: "medium", responsible: "Agent", agentAction: true },
      { task: "Final Walk-through", date: finalWalkthrough, priority: "medium", responsible: "Buyer" },
      { task: "Closing Date", date: offerDetails.closingDate ? new Date(offerDetails.closingDate) : acceptanceDate, priority: "critical", responsible: "All Parties" }
    );
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    setGeneratedTimeline(timeline);
    const templates = createEmailTemplates();
    setEmailTemplates(templates);
    if (onGenerate) {
      onGenerate(timeline, templates);
    }
    setActiveTab("timeline");
  };
  const createEmailTemplates = () => {
    const od = offerDetails;
    const templates = [
      {
        title: "Welcome Email - Buyer",
        subject: `Congratulations! Your offer on ${od.propertyAddress || ""} has been accepted`,
        body: `Dear ${od.buyerName || "Buyer"},

Congratulations! Your offer on ${od.propertyAddress || ""} has been accepted for ${od.salePrice || ""}.

Here are your important upcoming deadlines:
\u2022 Inspection Period: ${od.inspectionPeriod || "10"} days from acceptance
\u2022 Financing Deadline: ${od.financingDeadline || "30"} days from acceptance
\u2022 Closing Date: ${od.closingDate || ""}

Next steps:
1. Schedule your home inspection immediately
2. Contact your lender to begin the mortgage process
3. Review all contract documents carefully

HUD-Approved Housing Counseling Resources:
If you need assistance with homeownership counseling, budgeting, or financial guidance, these HUD-approved agencies can help:

\u2022 ACTS Housing - (414) 937-9295
\u2022 UCC (United Community Center) - (414) 384-3100
\u2022 HIR (Homeownership Initiative & Resources) - (414) 264-2622
\u2022 Green Path Financial Wellness - (877) 337-3399

We'll be in touch with detailed timeline and reminders.

Best regards,
Your Real Estate Team`
      },
      {
        title: "Welcome Email - Seller",
        subject: `Great news! Your property at ${od.propertyAddress || ""} is under contract`,
        body: `Dear ${od.sellerName || "Seller"},

Excellent news! Your property at ${od.propertyAddress || ""} is now under contract for ${od.salePrice || ""}.

Key dates to remember:
\u2022 Buyer's inspection period: ${od.inspectionPeriod || "10"} days
\u2022 Expected closing: ${od.closingDate || ""}

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
        title: "Real Estate Agent - Internal Checklist",
        subject: `Action Items: ${od.propertyAddress || ""} Under Contract`,
        body: `INTERNAL AGENT CHECKLIST - ${od.propertyAddress || ""}

CONTRACT DETAILS:
\u2022 Property: ${od.propertyAddress || ""}
\u2022 Buyer: ${od.buyerName || ""}
\u2022 Seller: ${od.sellerName || ""}
\u2022 Sale Price: ${od.salePrice || ""}
\u2022 Acceptance Date: ${od.acceptanceDate || ""}
\u2022 Closing Date: ${od.closingDate || ""}

IMMEDIATE ACTION ITEMS (Within 24-48 hours):
\u25A1 Send welcome emails to buyer and seller
\u25A1 Order title commitment
\u25A1 Coordinate with buyer's lender
\u25A1 Schedule inspection with buyer
\u25A1 Set up file with transaction coordinator
\u25A1 Send contract to all parties' attorneys (if applicable)

ONGOING DEADLINES TO MONITOR:
\u25A1 Inspection Period: ${od.inspectionPeriod || "10"} days
\u25A1 Financing Approval: ${od.financingDeadline || "30"} days
\u25A1 Appraisal Completion: ${od.appraisalPeriod || "21"} days

WEEKLY FOLLOW-UPS NEEDED:
\u25A1 Buyer's financing progress
\u25A1 Inspection results and repair negotiations
\u25A1 Appraisal scheduling and results
\u25A1 Title/survey issues resolution
\u25A1 Closing preparations

CLOSING PREPARATION (1 week before):
\u25A1 Final walk-through scheduled
\u25A1 Closing documents reviewed
\u25A1 Funds verification completed
\u25A1 Keys/garage remotes ready for transfer`
      }
    ];
    return templates;
  };
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };
  return /* @__PURE__ */ jsx("div", { className: `max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen ${className}`, children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-lg shadow-lg", children: [
    /* @__PURE__ */ jsxs("div", { className: "border-b border-gray-200", children: [
      /* @__PURE__ */ jsx("div", { className: "p-6", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ jsx(Home, { className: "w-8 h-8 text-blue-600" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Real Estate AI Agent" }),
          /* @__PURE__ */ jsx("p", { className: "text-gray-600", children: "Post-Offer Management & Timeline Generator" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("nav", { className: "flex space-x-8 px-6", children: ["upload", "details", "timeline", "emails"].map((tab) => /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setActiveTab(tab),
          className: `py-2 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`,
          children: [
            tab === "upload" && /* @__PURE__ */ jsx(Upload, { className: "w-4 h-4 inline mr-1" }),
            tab === "details" && /* @__PURE__ */ jsx(FileText, { className: "w-4 h-4 inline mr-1" }),
            tab === "timeline" && /* @__PURE__ */ jsx(Calendar, { className: "w-4 h-4 inline mr-1" }),
            tab === "emails" && /* @__PURE__ */ jsx(Mail, { className: "w-4 h-4 inline mr-1" }),
            tab
          ]
        },
        tab
      )) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
      activeTab === "upload" && /* @__PURE__ */ jsxs("div", { className: "text-center py-12", children: [
        /* @__PURE__ */ jsx(Upload, { className: "mx-auto h-12 w-12 text-gray-400" }),
        /* @__PURE__ */ jsx("h3", { className: "mt-2 text-sm font-medium text-gray-900", children: "Upload Accepted Offer" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Upload the signed purchase agreement or accepted offer document" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "file",
              accept: ".pdf,.doc,.docx",
              onChange: handleFileUpload,
              className: "hidden",
              id: "offer-upload"
            }
          ),
          /* @__PURE__ */ jsxs(
            "label",
            {
              htmlFor: "offer-upload",
              className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer",
              children: [
                /* @__PURE__ */ jsx(Upload, { className: "w-4 h-4 mr-2" }),
                "Choose File"
              ]
            }
          )
        ] })
      ] }),
      activeTab === "details" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Enter Offer Details" }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Property Address" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: offerDetails.propertyAddress,
                onChange: (e) => setOfferDetails({ ...offerDetails, propertyAddress: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Sale Price" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: offerDetails.salePrice,
                onChange: (e) => setOfferDetails({ ...offerDetails, salePrice: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Buyer Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: offerDetails.buyerName,
                onChange: (e) => setOfferDetails({ ...offerDetails, buyerName: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Seller Name" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: offerDetails.sellerName,
                onChange: (e) => setOfferDetails({ ...offerDetails, sellerName: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Acceptance Date" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                value: offerDetails.acceptanceDate,
                onChange: (e) => setOfferDetails({ ...offerDetails, acceptanceDate: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Closing Date" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "date",
                value: offerDetails.closingDate,
                onChange: (e) => setOfferDetails({ ...offerDetails, closingDate: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Inspection Period (days)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                value: offerDetails.inspectionPeriod,
                onChange: (e) => setOfferDetails({ ...offerDetails, inspectionPeriod: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "10"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Appraisal Period (days)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                value: offerDetails.appraisalPeriod,
                onChange: (e) => setOfferDetails({ ...offerDetails, appraisalPeriod: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "21"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "md:col-span-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Financing Deadline (days)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                value: offerDetails.financingDeadline,
                onChange: (e) => setOfferDetails({ ...offerDetails, financingDeadline: e.target.value }),
                className: "mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "30"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-4", children: /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: calculateDeadlines,
            className: "inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700",
            children: [
              /* @__PURE__ */ jsx(Calendar, { className: "w-5 h-5 mr-2" }),
              "Generate Timeline & Emails"
            ]
          }
        ) })
      ] }),
      activeTab === "timeline" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Transaction Timeline" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => window.print(),
              className: "inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50",
              children: "Print Timeline"
            }
          )
        ] }),
        generatedTimeline.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-gray-500", children: "Please fill out offer details and generate timeline first." }) : /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-md p-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "font-medium text-yellow-800", children: "HUD-Approved Housing Counseling Agencies" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-yellow-700 mt-1", children: "Provide these resources to buyers who need financial guidance:" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-yellow-800", children: [
              /* @__PURE__ */ jsx("div", { children: "\u2022 ACTS Housing - (414) 937-9295" }),
              /* @__PURE__ */ jsx("div", { children: "\u2022 UCC - (414) 384-3100" }),
              /* @__PURE__ */ jsx("div", { children: "\u2022 HIR - (414) 264-2622" }),
              /* @__PURE__ */ jsx("div", { children: "\u2022 Green Path Financial - (877) 337-3399" })
            ] })
          ] }),
          generatedTimeline.map((item, index) => /* @__PURE__ */ jsxs("div", { className: `flex items-start space-x-4 p-4 rounded-lg ${item.agentAction ? "bg-blue-50 border-l-4 border-blue-400" : "bg-gray-50"}`, children: [
            /* @__PURE__ */ jsx(Clock, { className: "w-5 h-5 text-gray-400 mt-1" }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("h4", { className: "font-medium text-gray-900", children: [
                  item.task,
                  item.agentAction && /* @__PURE__ */ jsx("span", { className: "ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded", children: "Agent Action" })
                ] }),
                /* @__PURE__ */ jsx("span", { className: `px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(item.priority)}`, children: item.priority })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [
                "Due: ",
                formatDate(item.date),
                " \u2022 Responsible: ",
                item.responsible
              ] })
            ] })
          ] }, index))
        ] })
      ] }),
      activeTab === "emails" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Email Templates" }),
        emailTemplates.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-gray-500", children: "Please generate timeline first to create email templates." }) : /* @__PURE__ */ jsx("div", { className: "space-y-6", children: emailTemplates.map((template, index) => /* @__PURE__ */ jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-lg font-medium text-gray-900", children: template.title }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  navigator.clipboard?.writeText(`${template.subject}

${template.body}`);
                },
                className: "text-blue-600 hover:text-blue-800 text-sm font-medium",
                children: "Copy Template"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Subject:" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm bg-gray-50 p-2 rounded", children: template.subject })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Body:" }),
              /* @__PURE__ */ jsx("pre", { className: "text-sm bg-gray-50 p-4 rounded whitespace-pre-wrap font-sans", children: template.body })
            ] })
          ] })
        ] }, index)) })
      ] })
    ] })
  ] }) });
};
var RealEstateAgent_default = RealEstateAgent;
export {
  RealEstateAgent_default as RealEstateAgent
};
