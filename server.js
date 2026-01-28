console.log("🔥 SERVER FILE LOADED 🔥");

require("dotenv").config(); 

const { uploadDoc } = require("./uploadDoc");

const downloadDoc = require("./downloadDoc");

const connectDB = require("./db");

                     
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');


const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Only accept .docx files
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are allowed'));
        }
    }
});




const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const ImageModule = require("docxtemplater-image-module-free");

const app = express();
const PORT = process.env.PORT || 3001;
const DOCUMENTS_PATH = path.join(__dirname, 'documents');

// Use the exact port for your React frontend (e.g., 5174 for Vite)
const FRONTEND_PORT = '5174'; 

const isLinkExpired = (createdAt) => {
    if (!createdAt) return false; // Fallback for old docs
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    return (new Date() - new Date(createdAt)) > threeDaysInMs;
};

// const isLinkExpired = (createdAt) => {
//     if (!createdAt) return false; // Fallback for old docs
    
//     // 20 minutes * 60 seconds * 1000 milliseconds
//     const twentyMinutesInMs = 20 * 60 * 1000; 
    
//     const timeElapsed = new Date() - new Date(createdAt);
    
//     return timeElapsed > twentyMinutesInMs;
// };
// server.js
const corsOptions = {

   origin: "https://leadway-sales-transformation-team.vercel.app", 
 //origin: "http://localhost:5174", 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, 
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"]
};



app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(cors(corsOptions));
app.use(express.json());         // 2. Parse JSON bodies
app.use(express.urlencoded({ extended: true })); 
// ...
app.use(bodyParser.json({ limit: '50mb' }));

// A simple in-memory store for demonstration (USE A DATABASE IN PRODUCTION!)
const documentStore = {};

// Ensure the documents directory exists (This should run outside the main route)
(async () => {
    try {
        await fs.mkdir(DOCUMENTS_PATH, { recursive: true });
    } catch (e) {
        console.error("Error creating documents directory:", e);
    }
})();

const imageOptions = {
  getImage: (tagValue) => {
    if (!tagValue) return null;

    const base64 = tagValue.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64, "base64");
  },

  getSize: () => [150, 50], // adjust if needed
};

const imageModule = new ImageModule(imageOptions);

 app.post("/document/send", async (req, res) => {
  try {
    const { formData } = req.body;

    if (!formData) {
      return res.status(400).json({ error: "Missing formData" });
    }

    console.log("Plans received:", formData.selectedPlans);

    const docId = uuidv4();

    // 1️⃣ Load template
    const content = await fs.readFile(
      path.join(__dirname, "template.docx"),
      "binary"
    );

    const zip = new PizZip(content);

  const imageModule = new ImageModule(imageOptions);

const doc = new Docxtemplater(zip, {
  modules: [imageModule],
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => "",
});

    // 2️⃣ Build computed tables
    const benefitsTable = buildBenefitsTable(formData);
    const benefitsTableTwo = buildBenefitsTableTwo(formData);

    // 3️⃣ Inject data
    doc.setData({
      ...formData,
      startDateFormatted: formatAgreementDate(formData.startDate),
      endDateFormatted: formatAgreementDate(formData.endDate),
      ...benefitsTable,
      ...benefitsTableTwo,
      signature_left: "",
      signature_right: "",
    });

    doc.render();

    // 4️⃣ Generate buffer (NOW it exists)
    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    // 5️⃣ Upload to Supabase
    const fileName = await uploadDoc(buffer, docId);

    // 6️⃣ Store metadata
    documentStore[docId] = {
      status: "pending",
      fileName,
      clientEmail: formData.groupContactPersonEmail,
      formData,
      benefitsTable,
      benefitsTableTwo,
      createdAt: new Date(),
    };

    // 7️⃣ Send email
      const signingLink =
        "https://leadway-sales-transformation-team.vercel.app/sign/" + docId;
    //  const signingLink =
    //    "http://localhost:5174/sign/" + docId;

    await sendEmailWithSigningLink(formData, signingLink);

    res.status(200).json({
      message: "Document generated and email sent",
      docId,
    });
  } catch (error) {
    console.error("❌ Error in /document/send:", error);
    res.status(500).json({
      error: "Failed to generate document",
      details: error.message,
    });
  }
});
// app.post("/documents/upload", async (req, res) => {
//   try {
//     const { formData } = req.body;

//     if (!formData) {
//       return res.status(400).json({ error: "Missing formData" });
//     }

//     console.log("Plans received:", formData.selectedPlans);

//     const docId = uuidv4();

//     // 1️⃣ Load template
//     const content = await fs.readFile(
//       path.join(__dirname, "template.docx"),
//       "binary"
//     );

//     const zip = new PizZip(content);

//   const imageModule = new ImageModule(imageOptions);

// const doc = new Docxtemplater(zip, {
//   modules: [imageModule],
//   paragraphLoop: true,
//   linebreaks: true,
//   nullGetter: () => "",
// });

//     // 2️⃣ Build computed tables
//     const benefitsTable = buildBenefitsTable(formData);
//     const benefitsTableTwo = buildBenefitsTableTwo(formData);

//     // 3️⃣ Inject data
//     doc.setData({
//       ...formData,
//       startDateFormatted: formatAgreementDate(formData.startDate),
//       endDateFormatted: formatAgreementDate(formData.endDate),
//       ...benefitsTable,
//       ...benefitsTableTwo,
//       signature_left: "",
//       signature_right: "",
//     });

//     doc.render();

//     // 4️⃣ Generate buffer (NOW it exists)
//     const buffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     // 5️⃣ Upload to Supabase
//     const fileName = await uploadDoc(buffer, docId);

//     // 6️⃣ Store metadata
//     documentStore[docId] = {
//       status: "pending",
//       fileName,
//       clientEmail: formData.groupContactPersonEmail,
//       formData,
//       benefitsTable,
//       benefitsTableTwo,
//       createdAt: new Date(),
//     };

//     // 7️⃣ Send email
//       const signingLink =
//         "https://leadway-sales-transformation-team.vercel.app/sign/" + docId;
//     //  const signingLink =
//     //    "http://localhost:5174/sign/" + docId;

//     await sendEmailWithSigningLink(formData, signingLink);

//     res.status(200).json({
//       message: "Document generated and email sent",
//       docId,
//     });
//   } catch (error) {
//     console.error("❌ Error in /document/send:", error);
//     res.status(500).json({
//       error: "Failed to generate document",
//       details: error.message,
//     });
//   }
// });

  const buildBenefitsTable = (formData) => {
    const { selectedPlans = [], tableData = [] } = formData;
        const activePlans = selectedPlans.filter((p) => p); // remove empty
        const numPlans = activePlans.length;

        return {
            numPlans: numPlans,
            show1: numPlans === 1,
            show2: numPlans === 2,
            show3: numPlans === 3,
            show4: numPlans === 4,
            show5: numPlans === 5,
            show6: numPlans === 6,
            show7: numPlans === 7,
            show8: numPlans === 8,

            // Simpler header access
            plan1: activePlans[0] || "",
            plan2: activePlans[1] || "",
            plan3: activePlans[2] || "",
            plan4: activePlans[3] || "",
            plan5: activePlans[4] || "",
            plan6: activePlans[5] || "",
            plan7: activePlans[6] || "",
            plan8: activePlans[7] || "",

            // Table rows
            tableRows: tableData.map((item) => ({
                col1: item.benefit,
                col2: item.values[activePlans[0]] || "",
                col3: item.values[activePlans[1]] || "",
                col4: item.values[activePlans[2]] || "",
                col5: item.values[activePlans[3]] || "",
                col6: item.values[activePlans[4]] || "",
                col7: item.values[activePlans[5]] || "",
                col8: item.values[activePlans[6]] || "",
                col9: item.values[activePlans[7]] || "",
            })),
        };
    };
    const buildBenefitsTableTwo = (formData) => {
        const { selectedPlans = [], tableDataTwo = [] } = formData;
        const activePlans = selectedPlans.filter((p) => p); // remove empty
        const numPlans = activePlans.length;

        return {
            numPlans: numPlans,
            show11: numPlans === 1,
            show22: numPlans === 2,
            show33: numPlans === 3,
            show44: numPlans === 4,
            show55: numPlans === 5,
            show66: numPlans === 6,
            show77: numPlans === 7,
            show88: numPlans === 8,

            // Simpler header access
            plan1: activePlans[0] || "",
            plan2: activePlans[1] || "",
            plan3: activePlans[2] || "",
            plan4: activePlans[3] || "",
            plan5: activePlans[4] || "",
            plan6: activePlans[5] || "",
            plan7: activePlans[6] || "",
            plan8: activePlans[7] || "",

            // Table rows
            tableRowsTwo: tableDataTwo.map((item) => ({
                col11: item.benefit,
                col22: item.values[activePlans[0]] || "",
                col33: item.values[activePlans[1]] || "",
                col44: item.values[activePlans[2]] || "",
                col55: item.values[activePlans[3]] || "",
                col66: item.values[activePlans[4]] || "",
                col77: item.values[activePlans[5]] || "",
                col88: item.values[activePlans[6]] || "",
                col99: item.values[activePlans[7]] || "",
            })),
        };
    };
function formatAgreementDate(dateString) {
    // Example implementation: '2025-01-01' -> 'January 1, 2025'
    return dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);

async function docxToPdfConverter(docxBuffer, outputPath) {
    try {
        // This uses the LibreOffice engine for a much more accurate layout
        const pdfBuffer = await libre.convertAsync(docxBuffer, '.pdf', undefined);
        await fs.writeFile(outputPath, pdfBuffer);
        return outputPath;
    } catch (err) {
        console.error("Conversion Error:", err);
        throw err;
    }
}

// --- C. Email Sender Function ---
const sendEmailWithSigningLink = async (formData, signingLink) => {
    const postData = {
        EmailAddress: formData.groupContactPersonEmail,
        CC: formData.leadwayGroupEmailCC,
        BCC: "",
        Subject: "Action Required: Standard Contract Agreement Signature",
        MessageBody: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h3>Dear ${formData.groupContactPerson}</h3>
                <p>Welcome, and thank you for choosing Leadway Health.</p>
                <p>Please click the secure link below to review and electronically sign your Service Level Agreement (SLA). The signed agreement will be emailed to you automatically upon completion.</p>
                <p style="padding: 15px; background: #f2630bff; border: 1px solid #f26f04ff; border-radius: 5px;">
                    <a href="${signingLink}" style="color: #fbfafa; text-decoration: none; font-weight: bold;">CLICK HERE TO REVIEW AND SIGN DOCUMENT</a>
                </p>
                <p>Warm regards</p>
            </div>
        `,
        Attachments: [], // NO ATTACHMENT NOW, ONLY THE LINK
        Category: "", UserId: 0, ProviderId: 0, ServiceId: 0, Reference: "", TransactionType: "",
    };

   
    const apiUrl = "https://prognosis-api.leadwayhealth.com/"; 

    const response = await fetch(
        `${apiUrl}api/EnrolleeProfile/SendEmailAlert`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postData),
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email API error! Status: ${response.status}, Details: ${errorText}`);
    }
};

// app.get("/document/fetch/:docId", async (req, res) => {
//   const docInfo = documentStore[req.params.docId];
//   if (!docInfo) return res.status(404).send("Not found");

//   try {
//     // ⬇️ Download from Supabase
//     const fileBuffer = await downloadDoc(docInfo.fileName);

//     const zip = new PizZip(fileBuffer);

//     const imageModule = new ImageModule(imageOptions);

//     const companyName = docInfo.formData.companyName.replace(/\s+/g, '_');
//     const displayName = `${companyName} Signed_Standard Contract.docx`;

//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => "",
//     });

//     doc.render({
//       signature_left: "",
//       signature_right: "",
//     });

//     const cleanBuffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );

//     res.setHeader(
//       "Content-Disposition", 
//       `attachment; filename="${displayName}"`
//     );
//     res.send(cleanBuffer);
//   } catch (err) {
//     console.error("Fetch error:", err);
//     res.status(500).send("Failed to fetch document");
//   }
// });

// app.get("/document/fetch/:docId", async (req, res) => {
//   const docInfo = documentStore[req.params.docId];
//   if (!docInfo) return res.status(404).send("Not found");

//   try {
//     const fileBuffer = await downloadDoc(docInfo.fileName);
//     const zip = new PizZip(fileBuffer);

//     const imageModule = new ImageModule(imageOptions);

//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => null, // 👈 IMPORTANT
//     });

//     doc.setData({
//       signature_left: null,
//       signature_right: null,
//     });

//     doc.render();

//     const cleanBuffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     res.setHeader("Content-Encoding", "identity");
//     res.send(cleanBuffer);
//   } catch (err) {
//     console.error("Fetch error:", err);
//     res.status(500).send("Failed to fetch document");
//   }
// });

// app.post('/document/finalize/:docId', async (req, res) => {
//     try {
//         const { signature } = req.body;
//         const docInfo = documentStore[req.params.docId];

//         if (!docInfo || docInfo.status !== 'pending') {
//             return res.status(404).json({ error: 'Document not found or already signed.' });
//         }

//         console.log("=== FINALIZE STARTED ===");
//         console.log("Document ID:", req.params.docId);
//         console.log("Signature received:", signature ? "YES" : "NO");
//         console.log("Signature length:", signature ? signature.length : 0);
//         console.log("Signature starts with:", signature ? signature.substring(0, 30) : "N/A");

//         // Read template
//         const content = await fs.readFile(path.join(__dirname, 'template.docx'), 'binary');
//         const zip = new PizZip(content);

//         // ✅ Create ImageModule instance
//        const imageModule = new ImageModule(imageOptions);

// const doc = new Docxtemplater(zip, {
//   modules: [imageModule],
//   paragraphLoop: true,
//   linebreaks: true,
//   nullGetter: () => "",
// });

     
        

//         // Prepare data
//         doc.setData({
//   ...docInfo.formData,
//   ...docInfo.benefitsTable,
//   ...docInfo.benefitsTableTwo,
//   signature_left: signature,
//   signature_right: signature,
// });

// doc.render();

//         console.log("=== GENERATING BUFFER ===");
//         const buffer = doc.getZip().generate({
//             type: "nodebuffer",
//             compression: "DEFLATE",
//         });

//         console.log("=== BUFFER GENERATED ===");
//         console.log("Buffer size:", buffer.length);

//         // Save signed version
//         // const signedPath = docInfo.originalPath.replace('_original', '_signed');
//         // await fs.writeFile(signedPath, buffer);

//         try {
//             await sendSignedDocumentEmail(docInfo.formData, buffer);
//             console.log("Completed document email sent successfully.");
//         } catch (emailError) {
//             console.error("Failed to send completed document email:", emailError);
//             // We don't throw here so the user still gets their download
//         }
// documentStore[req.params.docId].status = 'signed';

//         console.log("=== SENDING RESPONSE ===");

//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
//         res.setHeader(
//   "Content-Disposition", 
//   `attachment; filename="${displayName}"`
// );
//         res.send(buffer);

//     } catch (err) {
//         console.error("=== FINALIZE ERROR ===");
//         console.error("Error:", err.message);
//         console.error("Stack:", err.stack);
//         res.status(500).json({ 
//             error: "Document generation failed", 
//             details: err.message,
//             stack: err.stack
//         });
//     }
// });

// FETCH ENDPOINT - For viewing (no download)
app.get("/document/fetch/:docId", async (req, res) => {
  console.log("endpoint hit")
    const docInfo = documentStore[req.params.docId];
    if (!docInfo) return res.status(404).send("Not found");

if (isLinkExpired(docInfo.createdAt)) {
        console.log("⚠️ Link expired for docId:", req.params.docId);
        return res.status(403).send("This standard contract link has expired (3-day duration).");
    }

    
    try {
        console.log("📥 Fetching document for viewing:", req.params.docId);

        const fileBuffer = await downloadDoc(docInfo.fileName);
        const zip = new PizZip(fileBuffer);

        const imageModule = new ImageModule(imageOptions);

        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => null,
        });

        doc.setData({
            signature_left: null,
            signature_right: null,
        });

        doc.render();

        const cleanBuffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        // Set headers for viewing (not downloading)
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader("Content-Encoding", "identity");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-cache");
        
        res.send(cleanBuffer);
        console.log("✅ Document sent for viewing");

    } catch (err) {
        console.error("❌ Fetch error:", err);
        res.status(500).send("Failed to fetch document");
    }
});

// FINALIZE ENDPOINT - Signs and downloads
app.post('/document/finalize/:docId', async (req, res) => {
    try {
        const { signature } = req.body;
        const { docId } = req.params;
        const docInfo = documentStore[docId];

        if (!docInfo || docInfo.status !== 'pending') {
            return res.status(404).json({ 
                error: 'Document not found or already signed.' 
            });
        }

        // CHECK FOR EXPIRATION
        if (isLinkExpired(docInfo.createdAt)) {
            return res.status(403).json({ error: 'This standard contract link has expired. Please kindly reachout to Leadway Health sales teams.' });
        }

        console.log("=== FINALIZE STARTED ===");
        console.log("Document ID:", docId);
        console.log("Signature received:", signature ? "YES" : "NO");

        // Read template
        const content = await fs.readFile(
            path.join(__dirname, 'template.docx'), 
            'binary'
        );
        const zip = new PizZip(content);

        // Create ImageModule instance
        const imageModule = new ImageModule(imageOptions);

        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "",
        });

        // Prepare data with signature
        doc.setData({
            ...docInfo.formData,
            ...docInfo.benefitsTable,
            ...docInfo.benefitsTableTwo,
            startDateFormatted: formatAgreementDate(docInfo.formData.startDate), 
            endDateFormatted: formatAgreementDate(docInfo.formData.endDate), 
            signature_left: signature,
            signature_right: signature,
        });

        doc.render();

        console.log("=== GENERATING SIGNED BUFFER ===");
        const signedBuffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        console.log("✅ Signed buffer generated. Size:", signedBuffer.length);

        // Upload signed document to Supabase
        const signedFileName = await uploadDoc(
            signedBuffer,
            `${docId}_signed`,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        console.log("✅ Signed document uploaded:", signedFileName);

        // Send email with signed document
        try {
            await sendSignedDocumentEmail(docInfo.formData, signedBuffer);
            console.log("✅ Email sent successfully");
        } catch (emailError) {
            console.error("⚠️ Email failed:", emailError);
            // Don't fail the request if email fails
        }

        // Update status
        documentStore[docId].status = 'signed';
        documentStore[docId].signedFileName = signedFileName;

        console.log("=== FINALIZE COMPLETE ===");

        // Create download filename
        const companyName = docInfo.formData.companyName 
            ? docInfo.formData.companyName.replace(/\s+/g, '_') 
            : 'Company';
        const displayName = `${companyName}_Signed_Standard_Contract.docx`;

        // Send signed document for download
        res.setHeader(
            'Content-Type', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition', 
            `attachment; filename="${displayName}"`
        );
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.send(signedBuffer);

        console.log("✅ Signed document sent for download:", displayName);

    } catch (err) {
        console.error("=== FINALIZE ERROR ===");
        console.error("Error:", err.message);
        console.error("Stack:", err.stack);
        res.status(500).json({ 
            error: "Document generation failed", 
            details: err.message,
            stack: err.stack
        });
    }
});

app.get("/health", (req, res) => {
    res.status(200).send("Server is alive and well");
});

// NEW ENDPOINT: Check if document link is valid
app.get("/document/check/:docId", async (req, res) => {
    const docInfo = documentStore[req.params.docId];
    
    if (!docInfo) {
        return res.status(404).json({ 
            valid: false,
            error: "Document not found" 
        });
    }

    // Check if expired
    if (isLinkExpired(docInfo.createdAt)) {
        console.log("⚠️ Link expired for docId:", req.params.docId);
        return res.json({ 
            valid: false,
            expired: true,
            message: "This standard contract link has expired (3-day duration). Please contact Leadway Health sales team."
        });
    }

    // Check if already signed
    if (docInfo.status === 'signed') {
        return res.json({
            valid: false,
            alreadySigned: true,
            message: "This document has already been signed."
        });
    }

    // Link is valid
    res.json({
        valid: true,
        companyName: docInfo.formData.companyName,
        createdAt: docInfo.createdAt
    });
});

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port xzzx${PORT}`);
});

const sendSignedDocumentEmail = async (formData, signedBuffer) => {
    const base64File = signedBuffer.toString('base64');
    const postData = {
        // Send to a different address, or CC the relevant parties
        EmailAddress: `${formData.leadwayGroupEmailCC}`, 
        CC: "", // Add your secondary email here
        BCC: "",
        Subject: `Completed: Signed Agreement  of- ${formData.companyName}`,
        MessageBody: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h3>Hi ${formData.groupContactPerson},</h3>
                <p>The Standard Contract Agreement for <strong>${formData.companyName}</strong> has been successfully signed.</p>
                <p>Please find the fully signed document attached to this email.</p>
                <p>Warm regards,<br>Leadway Health Team</p>
            </div>
        `,
        Attachments: [
            {
                FileName: `Signed_Agreement_${formData.companyName.replace(/\s+/g, '_')}.docx`,
                Base64Data: base64File,
                ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            }
        ],
        Category: "", UserId: 0, ProviderId: 0, ServiceId: 0, Reference: "", TransactionType: "",
    };

    const apiUrl = "https://prognosis-api.leadwayhealth.com/"; 

    const response = await fetch(`${apiUrl}api/EnrolleeProfile/SendEmailAlert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Signed Email API Error:", errorText);
    }
};

app.post("/documents/upload", upload.single('file'), async (req, res) => {
    try {
        console.log("📤 Upload request received");
        console.log("File:", req.file ? req.file.originalname : "NO FILE");
        console.log("Client Email:", req.body.clientEmail);

        // Validate inputs
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        if (!req.body.clientEmail) {
            return res.status(400).json({ error: "Client email is required" });
        }

        const docId = uuidv4();
        const clientEmail = req.body.clientEmail;
        const fileBuffer = req.file.buffer; // ✅ File is in memory

        console.log("📄 File size:", fileBuffer.length, "bytes");

        // ✅ Upload to Supabase
        const fileName = await uploadDoc(fileBuffer, docId);
        console.log("✅ Uploaded to Supabase:", fileName);

        // ✅ Store metadata
        documentStore[docId] = {
            status: "pending",
            fileName,
            clientEmail: clientEmail,
            originalFileName: req.file.originalname,
            uploadedAt: new Date(),
            createdAt: new Date(),
        };

        // ✅ Send email with signing link
        const signingLink = `https://leadway-sales-transformation-team.vercel.app/sign/${docId}`;
         //const signingLink = `http://localhost:5174/sign/${docId}`;

        await sendSigningLinkForUpload(clientEmail, signingLink);

        console.log("✅ Email sent to:", clientEmail);

        res.status(200).json({
            success: true,
            message: "Document uploaded and signing link sent",
            docId: docId,
        });

    } catch (error) {
        console.error("❌ Error in /documents/upload:", error);
        res.status(500).json({
            error: "Upload failed",
            details: error.message,
        });
    }
});

// ✅ Email function for uploaded documents
async function sendSigningLinkForUpload(clientEmail, signingLink) {
    const postData = {
        EmailAddress: clientEmail,
        CC: "",
        BCC: "",
        Subject: "Action Required: Document Signature",
        MessageBody: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h3>Dear Client,</h3>
                <p>A document has been uploaded and requires your signature.</p>
                <p>Please click the secure link below to review and electronically sign the document.</p>
                <p style="padding: 15px; background: #f2630bff; border: 1px solid #f26f04ff; border-radius: 5px;">
                    <a href="${signingLink}" style="color: #fbfafa; text-decoration: none; font-weight: bold;">
                        CLICK HERE TO REVIEW AND SIGN DOCUMENT
                    </a>
                </p>
                <p>This link will expire in 3 days.</p>
                <p>Warm regards,<br/>Leadway Health Team</p>
            </div>
        `,
        Attachments: [],
        Category: "", UserId: 0, ProviderId: 0, ServiceId: 0, Reference: "", TransactionType: "",
    };

    const apiUrl = "https://prognosis-api.leadwayhealth.com/";

    const response = await fetch(
        `${apiUrl}api/EnrolleeProfile/SendEmailAlert`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postData),
        },
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email API error! Status: ${response.status}, Details: ${errorText}`);
    }
}