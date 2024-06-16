const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const cors = require("cors"); // Import cors

const app = express(); // Initialize app before using it

// Use the cors middleware
app.use(
  cors({
    origin: "http://localhost:3000", // Allow requests from this origin
  })
);

app.use(bodyParser.json());
const PORT = 8866;

const API_KEY = "CFA1B942C9A54AED89BB9A48DE152C5B";
const OPENAI_API_KEY =
  "sk-crawlur-engine-pQMiNzu4XFr8vBodXEHKT3BlbkFJKIv4r1NuLEWgS2iiytGN";
const OPENAI_CONFIG = {
  model: "gpt-4o",
  max_tokens: 4096,
  temperature: 0.6,
  top_p: 1.0,
};

async function handleSearch(req, res) {
  const { search_product } = req.body;
  try {
    // Replace with actual API endpoint and key
    const response = await axios.get(
      `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=amazon.com&search_term=${search_product}`,
      {
        headers: {
          Accept: "application/json",
          Connection: "keep-alive",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleProductInfo(req, res) {
  const { asin } = req.body;
  let productInformation = [];
  let reviews = [];
  try {
    const response = await axios.get(
      `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=product&amazon_domain=amazon.com&asin=${asin}&include_summarization_attributes=true&include_a_plus_body=true&output=json&include_html=false`,
      {
        headers: {
          Accept: "application/json",
          Connection: "keep-alive",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }
    );
    console.log(response);
    if (response.data?.product.description) {
      productInformation.push(
        await rewriteDescription(response.data.product.description)
      );
    }
    if (response.data?.product.top_reviews.length > 0) {
      reviews = await rewriteReviews(response);
    }
    res.send([...productInformation, ...reviews]);
  } catch (error) {
    res.status(500).json({ error: "Something went wrong -- please try again" });
  }
}
async function rewriteDescription(description) {
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  console.log("first", description);

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: "user",
          content: `Rewrite the following product description in a simple manner without any business or technical jargon:\n\n${description}. 
            Once completed. Organise it into a short summary description with salient features in 
            numbered bullet points. Format the output in a valid JSON format and return the JSON. 
            Follow this JSON format: {"summary":"put 2 line summary here","put feature name here": "feature description here"`,
        },
      ],
      stream: false,
      max_tokens: OPENAI_CONFIG.max_tokens,
      temperature: OPENAI_CONFIG.temperature,
      top_p: OPENAI_CONFIG.top_p,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error rewriting description:", error);
  }
}

async function rewriteReviews(response) {
  // console.log("----------->",response);
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
  let allReviews = [];
  for (const review of response.product.top_reviews) {
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: "user",
            content: `Rewrite the following review text in a simple manner without any business or technical jargon:\n\n${review.body}. 
                Once completed. Organise it into a short summary. Also find the sentiment of the review. If it positive. mark sentiment as "POSITIVE.
                If it negative. mark sentiment as "NEGATIVE". Organise the output in a valid JSON format and return the JSON.
                Follow this JSON format: 
                {"review":"put review here","sentiment":"put sentiment here"}. Do not return any other text. Absolutely Do not insert \`\`\`json or \`\`\` or \``,
          },
        ],
        stream: false,
        max_tokens: OPENAI_CONFIG.max_tokens,
        temperature: OPENAI_CONFIG.temperature,
        top_p: OPENAI_CONFIG.top_p,
      });
      allReviews.push(completion.choices[0].message.content.trim());
    } catch (error) {
      console.error("Error rewriting description:", error);
    }
  }
  return allReviews;
}

// Function to read JSON file
const readJsonFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err); // Log the error
        return reject(err);
      }
      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseErr) {
        console.error("Error parsing JSON:", parseErr); // Log JSON parsing error
        reject(parseErr);
      }
    });
  });
};

// Get all products
app.get("/products", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "data.json");
    const products = await readJsonFile(filePath);

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error); // Log the error
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// API endpoint to get product by ASIN
app.get("/product/:asin", async (req, res) => {
  const { asin } = req.params;
  const filePath = path.join(__dirname, "data", "product.json");
  const products = await readJsonFile(filePath);

  res.json(products);
});

// API endpoint to get product by ASIN

// API endpoint to get product by ASIN
app.get("/productt/:asin", async (req, res) => {
    try {
      const { asin } = req.params;
      const filePath = path.join(__dirname, "data", "product.json");
      const products = await readJsonFile(filePath);
  
      if (!products || !products.product) {
        return res.status(404).json({ error: "Product not found" });
      }
  
      // Initialize arrays to hold additional information
      let productInformation = [];
      let reviews = [];
  
      // Rewrite the product description if available
      if (products.product.description) {
        productInformation.push(
          await rewriteDescription(products.product.description)
        );
      }
  
      // Rewrite reviews if available
      if (
        products.product.top_reviews &&
        products.product.top_reviews.length > 0
      ) {
        reviews = await rewriteReviews(products);
      }
  
      // Parse JSON strings to objects if they are strings
      if (typeof productInformation === 'string') {
        productInformation = JSON.parse(productInformation);
      }
      if (typeof reviews === 'string') {
        reviews = JSON.parse(reviews);
      }
  
      // Construct the response object
      const response = {
        products,
        productInformation,
        reviews,
      };
  
      res.json(response);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });
  
app.post("/search", handleSearch);
app.post("/product-info", handleProductInfo);
app.post("/rewrite-description", rewriteDescription);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
