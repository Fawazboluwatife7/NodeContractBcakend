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




const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const ImageModule = require("docxtemplater-image-module-free");

const app = express();
const PORT = process.env.PORT || 3001;
const DOCUMENTS_PATH = path.join(__dirname, 'documents');

// Use the exact port for your React frontend (e.g., 5174 for Vite)
const FRONTEND_PORT = '5174'; 

// server.js
const corsOptions = {

  origin: "https://leadway-sales-transformation-team.vercel.app", 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, 
  allowedHeaders: ["Content-Type", "Authorization"]
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

// const imageOptions = {
//     getImage: (tagValue) => {
//         console.log("=== IMAGE MODULE CALLED ===");
//         console.log("Tag value type:", typeof tagValue);
//         console.log("Tag value length:", tagValue ? tagValue.length : 0);
//         console.log("First 50 chars:", tagValue ? tagValue.substring(0, 50) : "null");
        
//         try {
//             // Handle data URL format (data:image/png;base64,...)
//             if (tagValue.startsWith('data:')) {
//                 const base64Data = tagValue.split(',')[1];
//                 console.log("Extracted base64 length:", base64Data.length);
//                 const buffer = Buffer.from(base64Data, 'base64');
//                 console.log("Buffer created, size:", buffer.length);
//                 return buffer;
//             }
            
//             // Handle raw base64
//             const buffer = Buffer.from(tagValue, 'base64');
//             console.log("Buffer created from raw base64, size:", buffer.length);
//             return buffer;
//         } catch (err) {
//             console.error("Error processing image:", err);
//             throw err;
//         }
//     },
//     getSize: (img, tagValue, tagName) => {
//         console.log("getSize called for tag:", tagName);
//         // Return [width, height] in pixels
//         return [200, 80];
//     },
//     // ✅ IMPORTANT: Add centered option
//     centered: false,
// };


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
    };

    // 7️⃣ Send email
    const signingLink =
      "https://leadway-sales-transformation-team.vercel.app/sign/" + docId;

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

// app.post('/document/send', async (req, res) => {
//     console.log("Plans received:", req.body.formData.selectedPlans);
//     const docId = uuidv4();
//    const fileName = await uploadDoc(buffer, docId);

//     const { formData } = req.body;

//     if (!formData) {
//         return res.status(400).json({ error: 'Missing formData' });
//     }

//     try {
//         const content = await fs.readFile(path.join(__dirname, 'template.docx'), 'binary');
//         const zip = new PizZip(content);
        
//         const imageModule = new ImageModule(imageOptions);
//        const doc = new Docxtemplater(zip, {
//             modules: [imageModule], // ✅ Add this
//             paragraphLoop: true,
//             linebreaks: true,
            
//             nullGetter: () => "" 
//         });

//         const benefitsTable = buildBenefitsTable(formData);
//         const benefitsTableTwo = buildBenefitsTableTwo(formData);

//         // ✅ Generate document with all data EXCEPT signature
//         doc.setData({
//             ...formData,
//             startDateFormatted: formatAgreementDate(formData.startDate),
//             endDateFormatted: formatAgreementDate(formData.endDate),
//             ...benefitsTable,
//             ...benefitsTableTwo,
//            signature_left: "",  
//             signature_right: ""  
//         });

//         doc.render();
// const buffer = doc.getZip().generate({
//   type: "nodebuffer",
//   compression: "DEFLATE",
// });

// // ✅ Now buffer exists
// const fileName = await uploadDoc(buffer, docId);
        

//         // const buffer = doc.getZip().generate({ type: 'nodebuffer' });
//         // await fs.writeFile(originalDocxPath, buffer);

        

//         // ✅ Store BOTH the path AND the form data
//         documentStore[docId] = {
//             status: 'pending',
//             fileName,
//             clientEmail: formData.groupContactPersonEmail,
//             formData: formData, // ✅ Store original form data for regeneration
//             benefitsTable: benefitsTable, // ✅ Store computed tables too
//             benefitsTableTwo: benefitsTableTwo,
//         };

//         const signingLink = `http://localhost:${FRONTEND_PORT}/sign/${docId}`;
//         await sendEmailWithSigningLink(formData, signingLink);

//         res.status(200).json({ message: 'Word document generated and link sent.' });
//     } catch (error) {
//         console.error("Error in /document/send:", error);
//         res.status(500).json({ error: 'Failed to generate Word doc: ' + error.message });
//     }
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

// app.get("/document/fetch/:docId", async (req, res) => {
//   const docInfo = documentStore[req.params.docId];
//   if (!docInfo) return res.status(404).send("Not found");

//   try {
//     const fileBuffer = await downloadDoc(docInfo.fileName);
    
//     // DO NOT RENDER HERE. 
//     // Just send the buffer as is so the {%signature_left} tags stay in the file.

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     res.send(fileBuffer);
//   } catch (err) {
//     res.status(500).send("Failed to fetch document");
//   }
// });
// app.post("/document/finalize/:docIdzzxx", async (req, res) => {
//   try {
//     const { signature } = req.body;

//     console.log("=== Received Signature ===");
//     console.log("Signature length:", signature?.length);

//     const docInfo = documentStore[req.params.docId];

//     if (!docInfo || docInfo.status !== "pending") {
//       return res.status(404).json({ error: "Document not found or already signed" });
//     }

//     // ✅ Correct ImageModule v3 configuration
//     const opts = {
//       centered: false,
//       getImage: function(tagValue, tagName) {
//         console.log("🔥 getImage CALLED for tag:", tagName);
//         console.log("🔥 tagValue type:", typeof tagValue);
        
//         if (!tagValue || typeof tagValue !== 'string') {
//           console.log("❌ Invalid tagValue");
//           return null;
//         }
        
//         console.log("🔥 tagValue starts with:", tagValue.substring(0, 30));
        
//         // Handle data URL
//         if (tagValue.indexOf('data:image') === 0) {
//           const base64Data = tagValue.split(',')[1];
//           if (!base64Data) {
//             console.log("❌ No base64 data found");
//             return null;
//           }
//           const buffer = Buffer.from(base64Data, 'base64');
//           console.log("✅ Buffer created, size:", buffer.length);
//           return buffer;
//         }
        
//         console.log("❌ Not a data URL");
//         return null;
//       },
//       getSize: function(img, tagValue, tagName) {
//         console.log("📏 getSize CALLED for tag:", tagName);
//         // Return [width, height] in pixels
//         return [150, 50];
//       }
//     };

//     console.log("📥 Downloading original document...");
//     const originalBuffer = await downloadDoc(docInfo.fileName);
    
//     const zip = new PizZip(originalBuffer);
    
//     console.log("📦 Creating ImageModule...");
//     const imageModule = new ImageModule(opts);
//     console.log("✅ ImageModule created");

//     console.log("📝 Creating Docxtemplater...");
//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => ""
//     });

//     const renderData = {
//       ...docInfo.formData,
//       ...docInfo.benefitsTable,
//       ...docInfo.benefitsTableTwo,
//       startDateFormatted: formatAgreementDate(docInfo.formData.startDate),
//       endDateFormatted: formatAgreementDate(docInfo.formData.endDate),
//       signature_left: signature,  // Pass the full data URL
//       signature_right: signature 
//     };

//     console.log("📋 signature_left in data?", !!renderData.signature_left);
//     console.log("📄 Calling renderAsync...");
    
//     await doc.renderAsync(renderData);
    
//     console.log("✅ Render completed");

//     const signedBuffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     console.log("✅ Document generated, size:", signedBuffer.length);

//     // Upload and send
//     const signedFileName = `${req.params.docId}-signed.docx`;
//     await uploadDoc(signedBuffer, `${req.params.docId}-signed`);

//     documentStore[req.params.docId] = {
//       ...docInfo,
//       status: "signed",
//       signedFileName,
//     };

//     await sendSignedDocumentEmail(docInfo.formData, signedBuffer);

//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       "attachment; filename=Signed_Agreement.docx"
//     );
//     res.send(signedBuffer);

//     console.log("✅ Document finalized and sent successfully");
//   } catch (err) {
//     console.error("❌ Error:", err);
//     console.error("❌ Stack:", err.stack);
//     res.status(500).json({ error: "Failed to finalize: " + err.message });
//   }
// });
// app.post("/document/finalize/:docId", async (req, res) => {
//   try {
//     const { signature } = req.body;

//     const docInfo = documentStore[req.params.docId];
//     if (!docInfo) {
//       return res.status(404).json({ error: "Document not found" });
//     }

//     const buffer = await downloadDoc(docInfo.fileName);
//     const zip = new PizZip(buffer);

//     const imageModule = new ImageModule(imageOptions);

//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => "",
//     });

//     doc.setData({
//       ...docInfo.formData,
//       ...docInfo.benefitsTable,
//       ...docInfo.benefitsTableTwo,
//       startDateFormatted: formatAgreementDate(docInfo.formData.startDate),
//       endDateFormatted: formatAgreementDate(docInfo.formData.endDate),
//       signature_left: signature,   // ✅ IMAGE
//       signature_right: signature,
//     });

//     doc.render();

//     const signedBuffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     await uploadDoc(signedBuffer, `${req.params.docId}-signed`);

//     res.send(signedBuffer);
//   } catch (err) {
//     console.error("Finalize error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// app.post("/document/finalize/:docId", async (req, res) => {
//   try {
//     const { signature } = req.body;

//     console.log("=== Received Signature ===");
//     if (!signature) {
//       console.log("No signature received");
//     } else {
//       console.log("Signature length:", signature.length);
//       console.log("First 100 chars:", signature.substring(0, 100));
//       console.log("Data URL prefix:", signature.split(",")[0]); // shows "data:image/png;base64"
//     }

//     const docInfo = documentStore[req.params.docId];

//     if (!docInfo || docInfo.status !== "pending") {
//       return res
//         .status(404)
//         .json({ error: "Document not found or already signed" });
//     }

//     // ImageModule configuration
//     const imageOptions = {
//       getImage: (tagValue) => {
//         if (!tagValue) return null;
//         // Convert base64 Data URL to Buffer
//         const base64Data = tagValue.split(",")[1];
//         return Buffer.from(base64Data, "base64");
//       },
//       getSize: () => [150, 50], // adjust signature width x height
//     };

//     // 1️⃣ Download original DOCX from Supabase
//     const originalBuffer = await downloadDoc(docInfo.fileName);

//     const zip = new PizZip(originalBuffer);
//     const imageModule = new ImageModule(imageOptions);

//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => "",
//     });

//     // 2️⃣ Insert data + signature (Buffer will be handled by ImageModule)
//     doc.setData({
//       ...docInfo.formData,
//       ...docInfo.benefitsTable,
//       ...docInfo.benefitsTableTwo,
//       startDateFormatted: formatAgreementDate(docInfo.formData.startDate),
//       endDateFormatted: formatAgreementDate(docInfo.formData.endDate),
//       signature_left: signature,  // pass Data URL, ImageModule converts it
//       signature_right: signature,
//     });

//     // Use async render to avoid deprecation warning
//     await doc.renderAsync();

//     // 3️⃣ Generate signed DOCX buffer
//     const signedBuffer = doc.getZip().generate({
//       type: "nodebuffer",
//       compression: "DEFLATE",
//     });

//     // 4️⃣ Upload signed DOCX to Supabase
//     const signedFileName = `${req.params.docId}-signed.docx`;
//     await uploadDoc(signedBuffer, `${req.params.docId}-signed`);

//     // 5️⃣ Update memory store
//     documentStore[req.params.docId] = {
//       ...docInfo,
//       status: "signed",
//       signedFileName,
//     };

//     // 6️⃣ Email signed document
//     await sendSignedDocumentEmail(docInfo.formData, signedBuffer);

//     // 7️⃣ Send file to browser
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       "attachment; filename=Signed_Agreement.docx"
//     );
//     res.send(signedBuffer);

//     console.log("✅ Document finalized and sent successfully");
//   } catch (err) {
//     console.error("Finalize error:", err);
//     res.status(500).json({ error: "Failed to finalize document" });
//   }
// });


app.post('/document/finalize/:docId', async (req, res) => {
    try {
        const { signature } = req.body;
        const docInfo = documentStore[req.params.docId];

        if (!docInfo || docInfo.status !== 'pending') {
            return res.status(404).json({ error: 'Document not found or already signed.' });
        }

        console.log("=== FINALIZE STARTED ===");
        console.log("Document ID:", req.params.docId);
        console.log("Signature received:", signature ? "YES" : "NO");
        console.log("Signature length:", signature ? signature.length : 0);
        console.log("Signature starts with:", signature ? signature.substring(0, 30) : "N/A");

        // Read template
        const content = await fs.readFile(path.join(__dirname, 'template.docx'), 'binary');
        const zip = new PizZip(content);

        // ✅ Create ImageModule instance
       const imageModule = new ImageModule(imageOptions);

const doc = new Docxtemplater(zip, {
  modules: [imageModule],
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => "",
});


     
        

        // Prepare data
        doc.setData({
  ...docInfo.formData,
  ...docInfo.benefitsTable,
  ...docInfo.benefitsTableTwo,
  signature_left: signature,
  signature_right: signature,
});

doc.render();


        console.log("=== GENERATING BUFFER ===");
        const buffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        console.log("=== BUFFER GENERATED ===");
        console.log("Buffer size:", buffer.length);

        // Save signed version
        // const signedPath = docInfo.originalPath.replace('_original', '_signed');
        // await fs.writeFile(signedPath, buffer);

        try {
            await sendSignedDocumentEmail(docInfo.formData, buffer);
            console.log("Completed document email sent successfully.");
        } catch (emailError) {
            console.error("Failed to send completed document email:", emailError);
            // We don't throw here so the user still gets their download
        }
documentStore[req.params.docId].status = 'signed';


        console.log("=== SENDING RESPONSE ===");

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename=Signed_Agreement.docx');
        res.send(buffer);

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


// app.post("/document/finalize/:docId", async (req, res) => {
//   try {
//     const { signature } = req.body;
//     console.log("=== Received Signature ===");
//     if (!signature) {
//       console.log("No signature received");
//     } else {
//       console.log("Signature length:", signature.length);
//       console.log("First 100 chars:", signature.substring(0, 100));
//       console.log("Data URL prefix:", signature.split(',')[0]); // shows "data:image/png;base64"
//     }
//     const docInfo = documentStore[req.params.docId];

//     if (!docInfo || docInfo.status !== "pending") {
//       return res.status(404).json({ error: "Document not found or already signed" });
//     }

//        const imageOptions = {
//   getImage: (tagValue) => {
//     if (!tagValue) return null;
//     return Buffer.from(tagValue.split(',')[1], 'base64'); // remove 'data:image/png;base64,'
//   },
//   getSize: () => [150, 50], // width x height
// };

//     // 1️⃣ Download original DOCX from Supabase
//     const originalBuffer = await downloadDoc(docInfo.fileName);

//     const zip = new PizZip(originalBuffer);
//     const imageModule = new ImageModule(imageOptions);

//     const doc = new Docxtemplater(zip, {
//       modules: [imageModule],
//       paragraphLoop: true,
//       linebreaks: true,
//       nullGetter: () => "",
//     });

 


//     // 2️⃣ Insert data + signature
//     doc.setData({
//       ...docInfo.formData,
//       ...docInfo.benefitsTable,
//       ...docInfo.benefitsTableTwo,
//       startDateFormatted: formatAgreementDate(docInfo.formData.startDate),
//       endDateFormatted: formatAgreementDate(docInfo.formData.endDate),
//       signature_left: signature,
//       signature_right: signature,
//     });

//     doc.render();

//     // 3️⃣ Generate signed DOCX buffer
//     // const signedBuffer = doc.getZip().generate({
//     //   type: "nodebuffer",
//     //   compression: "DEFLATE",
//     // });
// ///
//     // 4️⃣ Upload signed DOCX to Supabase
//     const signedFileName = `${req.params.docId}-signed.docx`;

//     // const { error } = await supabase.storage
//     //   .from("documents")
//     //   .upload(signedFileName, signedBuffer, {
//     //     contentType:
//     //       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     //     upsert: true,
//     //   });

//     // if (error) throw error;
//     const signedBuffer = doc.getZip().generate({ type: 'nodebuffer' });
//     await uploadDoc(signedBuffer, `${req.params.docId}-signed`);


//     // 5️⃣ Update memory store
//     documentStore[req.params.docId] = {
//       ...docInfo,
//       status: "signed",
//       signedFileName,
//     };

//     // 6️⃣ Email signed document
//     await sendSignedDocumentEmail(docInfo.formData, signedBuffer);

//     // 7️⃣ Send file to browser
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       "attachment; filename=Signed_Agreement.docx"
//     );

//     res.send(signedBuffer);
//   } catch (err) {
//     console.error("Finalize error:", err);
//     res.status(500).json({ error: "Failed to finalize document" });
//   }
// });

// app.listen(PORT, () => {
//     console.log(`Backend server running on http://localhost:${PORT}`);
// });

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port xzzx${PORT}`);
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