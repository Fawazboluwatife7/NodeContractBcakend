const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    docId: { type: String, unique: true, index: true },
    status: { type: String, enum: ["pending", "signed"], default: "pending" },
    clientEmail: String,
    formData: Object,
    benefitsTable: Object,
    benefitsTableTwo: Object,
    originalFilePath: String,   // <-- path on backend
    signedFilePath: String,     // <-- path after signing
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);
