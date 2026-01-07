require("dotenv").config(); 
const uploadDoc = require("./uploadDoc");
const downloadDoc = require("./downloadDoc");


const connectDB = require("./db");

connectDB();                     
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// --- DOCXTEMPLATER IMPORTS ---
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const docxToPdf = require('docx-pdf');

const app = express();
const PORT = 3001;
const DOCUMENTS_PATH = path.join(__dirname, 'documents');
const ImageModule = require("docxtemplater-image-module-free");
// Use the exact port for your React frontend (e.g., 5174 for Vite)
const FRONTEND_PORT = '5174'; 

// server.js
const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: false, 
  allowedHeaders: ["Content-Type"]
};

app.use(cors(corsOptions)); 
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
        console.log("=== IMAGE MODULE CALLED ===");
        console.log("Tag value type:", typeof tagValue);
        console.log("Tag value length:", tagValue ? tagValue.length : 0);
        console.log("First 50 chars:", tagValue ? tagValue.substring(0, 50) : "null");
        
        try {
            // Handle data URL format (data:image/png;base64,...)
            if (tagValue.startsWith('data:')) {
                const base64Data = tagValue.split(',')[1];
                console.log("Extracted base64 length:", base64Data.length);
                const buffer = Buffer.from(base64Data, 'base64');
                console.log("Buffer created, size:", buffer.length);
                return buffer;
            }
            
            // Handle raw base64
            const buffer = Buffer.from(tagValue, 'base64');
            console.log("Buffer created from raw base64, size:", buffer.length);
            return buffer;
        } catch (err) {
            console.error("Error processing image:", err);
            throw err;
        }
    },
    getSize: (img, tagValue, tagName) => {
        console.log("getSize called for tag:", tagName);
        // Return [width, height] in pixels
        return [200, 80];
    },
    // ✅ IMPORTANT: Add centered option
    centered: false,
};



app.post('/document/send', async (req, res) => {
    console.log("Plans received:", req.body.formData.selectedPlans);
    const docId = uuidv4();
   const fileName = await uploadDoc(buffer, docId);

    const { formData } = req.body;

    if (!formData) {
        return res.status(400).json({ error: 'Missing formData' });
    }

    try {
        const content = await fs.readFile(path.join(__dirname, 'template.docx'), 'binary');
        const zip = new PizZip(content);
        
        const imageModule = new ImageModule(imageOptions);
       const doc = new Docxtemplater(zip, {
            modules: [imageModule], // ✅ Add this
            paragraphLoop: true,
            linebreaks: true,
            
            nullGetter: () => "" 
        });

        const benefitsTable = buildBenefitsTable(formData);
        const benefitsTableTwo = buildBenefitsTableTwo(formData);

        // ✅ Generate document with all data EXCEPT signature
        doc.setData({
            ...formData,
            startDateFormatted: formatAgreementDate(formData.startDate),
            endDateFormatted: formatAgreementDate(formData.endDate),
            ...benefitsTable,
            ...benefitsTableTwo,
           signature_left: "",  
            signature_right: ""  
        });

        doc.render();
const buffer = doc.getZip().generate({
  type: "nodebuffer",
  compression: "DEFLATE",
});

// ✅ Now buffer exists
const fileName = await uploadDoc(buffer, docId);
        
console.log("Plans received:")
        // const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        // await fs.writeFile(originalDocxPath, buffer);

        

        // ✅ Store BOTH the path AND the form data
        documentStore[docId] = {
            status: 'pending',
            fileName,
            clientEmail: formData.groupContactPersonEmail,
            formData: formData, // ✅ Store original form data for regeneration
            benefitsTable: benefitsTable, // ✅ Store computed tables too
            benefitsTableTwo: benefitsTableTwo,
        };

        const signingLink = `http://localhost:${FRONTEND_PORT}/sign/${docId}`;
        await sendEmailWithSigningLink(formData, signingLink);

        res.status(200).json({ message: 'Word document generated and link sent.' });
    } catch (error) {
        console.error("Error in /document/send:", error);
        res.status(500).json({ error: 'Failed to generate Word doc: ' + error.message });
    }
});


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


// app.get('/document/fetch/:docId', async (req, res) => {
//     const docInfo = documentStore[req.params.docId];
//     if (!docInfo) return res.status(404).send('Not found');

//     try {
//         const fileBuffer = await fs.readFile(docInfo.originalPath); // Load as raw Buffer
//         const zip = new PizZip(fileBuffer);

//         // MUST include ImageModule here too so it recognizes {% tags
//         const imageModule = new ImageModule(imageOptions);

//         const doc = new Docxtemplater(zip, {
//             modules: [imageModule], 
//             paragraphLoop: true,
//             linebreaks: true,
//             nullGetter: () => "" 
//         });

//         // Pass empty strings for the signature tags specifically
//         doc.render({
//             signature_left: "",
//             signature_right: ""
//         }); 

//         const cleanBuffer = doc.getZip().generate({
//             type: "nodebuffer",
//             compression: "DEFLATE",
//         });

//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
//         res.send(cleanBuffer);
//     } catch (e) {
//         console.error("Fetch error:", e);
//         res.status(500).send('Read error');
//     }
// });


app.get("/document/fetch/:docId", async (req, res) => {
  const docInfo = documentStore[req.params.docId];
  if (!docInfo) return res.status(404).send("Not found");

  try {
    // ⬇️ Download from Supabase
    const fileBuffer = await downloadDoc(docInfo.fileName);

    const zip = new PizZip(fileBuffer);

    const imageModule = new ImageModule(imageOptions);

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    doc.render({
      signature_left: "",
      signature_right: "",
    });

    const cleanBuffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.send(cleanBuffer);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).send("Failed to fetch document");
  }
});


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
//         const imageModule = new ImageModule(imageOptions);

//         const doc = new Docxtemplater(zip, {
//             modules: [imageModule],
//             paragraphLoop: true,
//             linebreaks: true,
//             nullGetter: () => ""
//         });

     
        

//         // Prepare data
//         const dataToSet = {
//             ...docInfo.formData,
//             startDateFormatted: formatAgreementDate(docInfo.formData.startDate),
//             endDateFormatted: formatAgreementDate(docInfo.formData.endDate),
//             ...docInfo.benefitsTable,
//             ...docInfo.benefitsTableTwo,
//             signature_left: signature || "",  
//     signature_right: signature || ""
//         };

//         console.log("=== DATA BEING SET ===");
//         console.log("Keys:", Object.keys(dataToSet));
//         console.log("Signature key present:", 'signature' in dataToSet);
//         console.log("Signature value type:", typeof dataToSet.signature);

//         doc.setData(dataToSet);

//         console.log("=== RENDERING DOCUMENT ===");
//         doc.render();

//         console.log("=== GENERATING BUFFER ===");
//         const buffer = doc.getZip().generate({
//             type: "nodebuffer",
//             compression: "DEFLATE",
//         });

//         console.log("=== BUFFER GENERATED ===");
//         console.log("Buffer size:", buffer.length);

//         // Save signed version
//         const signedPath = docInfo.originalPath.replace('_original', '_signed');
//         await fs.writeFile(signedPath, buffer);

//         try {
//             await sendSignedDocumentEmail(docInfo.formData, buffer);
//             console.log("Completed document email sent successfully.");
//         } catch (emailError) {
//             console.error("Failed to send completed document email:", emailError);
//             // We don't throw here so the user still gets their download
//         }

//         documentStore[req.params.docId].status = 'signed';
//         documentStore[req.params.docId].signedPath = signedPath;

//         console.log("=== SENDING RESPONSE ===");

//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
//         res.setHeader('Content-Disposition', 'attachment; filename=Signed_Agreement.docx');
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


app.post("/document/finalize/:docId", async (req, res) => {
  try {
    const { signature } = req.body;
    const docInfo = documentStore[req.params.docId];

    if (!docInfo || docInfo.status !== "pending") {
      return res.status(404).json({ error: "Document not found or already signed" });
    }

    // 1️⃣ Download original DOCX from Supabase
    const originalBuffer = await downloadDoc(docInfo.fileName);

    const zip = new PizZip(originalBuffer);
    const imageModule = new ImageModule(imageOptions);

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    // 2️⃣ Insert data + signature
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

    // 3️⃣ Generate signed DOCX buffer
    const signedBuffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
///
    // 4️⃣ Upload signed DOCX to Supabase
    const signedFileName = `${req.params.docId}-signed.docx`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(signedFileName, signedBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (error) throw error;

    // 5️⃣ Update memory store
    documentStore[req.params.docId] = {
      ...docInfo,
      status: "signed",
      signedFileName,
    };

    // 6️⃣ Email signed document
    await sendSignedDocumentEmail(docInfo.formData, signedBuffer);

    // 7️⃣ Send file to browser
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Signed_Agreement.docx"
    );

    res.send(signedBuffer);
  } catch (err) {
    console.error("Finalize error:", err);
    res.status(500).json({ error: "Failed to finalize document" });
  }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});


const sendSignedDocumentEmail = async (formData, signedBuffer) => {
    const base64File = signedBuffer.toString('base64');
    const postData = {
        // Send to a different address, or CC the relevant parties
        EmailAddress: "fawazboluwatife7@gmail.com", 
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