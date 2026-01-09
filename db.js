const mongoose = require("mongoose");

const connectDB = async () => {
  try {
  console.log("frank")
 
    await mongoose.connect("mongodb+srv://fawazdevops7:987654321Musty@cluster0.kys5yhl.mongodb.net/", {
      dbName: "contracts",
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error", err);
    process.exit(1);
  }
};

module.exports = connectDB;
