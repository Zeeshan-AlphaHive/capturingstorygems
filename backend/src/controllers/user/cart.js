const Cart = require("../../models/cart.js");
const { createPrintJob } = require("../../utils/luluClient.js");
const {
  validatePdfMatchesPodPackage,
  extractTrimCode,
} = require("../../utils/luluPodConfig.js");
const { normalizeLuluShippingAddress } = require("../../utils/luluShipping.js");
const Stripe = require("stripe");
const { configurations } = require("../../configs/config.js");
const user = require("../../models/user.js");
const { getPdfPageCount } = require("../../utils/pdfPageCount.js");
const {
  notifyBookAddedToCart,
  notifyBookSentToLulu,
} = require("../../utils/bookOrderEmails.js");

const ALLOWED_FRONTEND_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://capturingstorygems.com",
  "https://www.capturingstorygems.com",
  "https://capturingstorygems.vercel.app",
  "https://ai-story-frontend-ten.vercel.app",
  "https://ai-story-fe.vercel.app",
  "https://ai-story-front.vercel.app",
  "https://ai-story-builder-production.up.railway.app"
];

function pickCheckoutReturnUrl(requestedUrl, fallbackPath) {
  const fallbackBase = String(configurations.frontendBaseUrl || "https://capturingstorygems.com").replace(/\/+$/, "");
  const fallback = `${fallbackBase}${fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`}`;
  if (!requestedUrl || typeof requestedUrl !== "string") return fallback;

  try {
    const parsed = new URL(requestedUrl);
    const origin = parsed.origin;
    if (!ALLOWED_FRONTEND_ORIGINS.includes(origin)) return fallback;
    // Only allow same-site relative destinations under the cart/landing flows
    if (!parsed.pathname.startsWith("/")) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

let stripeClient;
function getStripe() {
  if (!configurations.stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  if (!stripeClient) {
    stripeClient = Stripe(configurations.stripeSecretKey);
  }
  return stripeClient;
}

// POST /user/cart -> create cart item
const createCartItem = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const {
      title,
      name,
      email,
      pdfUrl,
      coverPdfUrl,
      shipping_address,
      shipping_option,
      pod_package_id,
      quantity,
      total_price,
      currency,
    } = req.body || {};

    if (!pdfUrl) return res.status(400).json({ message: "pdfUrl is required", error: "Missing pdfUrl" });
    if (!shipping_address) return res.status(400).json({ message: "shipping_address is required", error: "Missing shipping_address" });
    if (!pod_package_id) {
      return res.status(400).json({
        message: "pod_package_id is required. Select book size and binding in the book builder.",
        error: "Missing pod_package_id",
      });
    }

    const dimCheck = await validatePdfMatchesPodPackage(pdfUrl, pod_package_id);
    if (!dimCheck.ok) {
      return res.status(400).json({
        message: dimCheck.message,
        error: "POD_PDF_DIMENSION_MISMATCH",
        response: {
          expected: dimCheck.expected,
          actual: dimCheck.actual,
        },
      });
    }

    const pageCount = await getPdfPageCount(pdfUrl);

      // Determine binding code from request if available (pod package id includes binding code)
      const bindingFromBody = (req.body && (req.body.binding || req.body.pod_package_id || req.body.podPackageId || req.body.podId)) || undefined;
      const detectBinding = (value) => {
        if (!value) return null;
        const v = String(value);
        // Known binding codes: PB (Perfect Bound), CW (Case Wrap), SS (Saddle Stitch), CO (Coil Bound)
        if (v.includes('PB')) return 'PB';
        if (v.includes('CW')) return 'CW';
        if (v.includes('SS')) return 'SS';
        if (v.includes('CO')) return 'CO';
        return null;
      };

      const binding = req.body && req.body.binding ? String(req.body.binding) : detectBinding(bindingFromBody);

      // Allowed page ranges per binding
      const bindingRanges = {
        PB: { name: 'Perfect Bound', min: 32, max: 800 },
        CW: { name: 'Case Wrap', min: 24, max: 800 },
        SS: { name: 'Saddle Stitch', min: 4, max: 48 },
        CO: { name: 'Coil Bound', min: 2, max: 470 },
      };
 
      // If we detected a binding and page count is known, enforce range
      if (binding && bindingRanges[binding]) {
        const { name, min, max } = bindingRanges[binding];
        if (!Number.isFinite(pageCount) || pageCount === 0) {
          return res.status(400).json({
            message: `Unable to detect page count reliably. Please regenerate the PDF and try again for ${name}.`,
            error: 'Invalid page count',
          });
        }
        if (pageCount < min || pageCount > max) {
          return res.status(400).json({
            message: `Detected PDF has ${pageCount} pages which is incompatible with ${name}. Allowed page range: ${min}-${max} pages. Please edit the book and generate the PDF again.`,
            error: 'Page count out of range for binding',
          });
        }
      }

    const normalizedAddress = normalizeLuluShippingAddress(shipping_address);

    const cart = await Cart.create({
      userId,
      title: title || undefined,
      name: name || (normalizedAddress && normalizedAddress.name) || undefined,
      email: email || undefined,
      pdfUrl,
      coverPdfUrl: coverPdfUrl || undefined,
      shipping_address: normalizedAddress,
      shipping_option: shipping_option || undefined,
      pod_package_id: pod_package_id || undefined,
      trim_code: extractTrimCode(pod_package_id) || dimCheck.trimCode || undefined,
      quantity: Number(quantity) || 1,
      page_count: pageCount,
      total_price: Number(total_price) + (Number(total_price) * (Number(process.env.BOOK_PRICE_PERCENTAGE) / 100)) || 0,
      currency: currency || "",
      status: "ready",
    });

    // Notify user (do not fail the request if email fails)
    notifyBookAddedToCart(cart).catch(() => {});

    return res.status(201).json({ message: "Cart item created", response: { data: cart }, error: null });
  } catch (err) {
    console.error("Create cart item error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// GET /user/cart -> list user's cart items
const getMyCart = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const items = await Cart.find({ userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ message: "Cart fetched", response: { data: items }, error: null });
  } catch (err) {
    console.error("Get cart error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};
                                                                        
// POST /user/cart/:id/send -> send cart item to Lulu (create print job)
const sendCartToPrint = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { id } = req.params;
    const { contact_email, production_delay } = req.body || {};
    console.log("Production delay:", production_delay);
    const cart = await Cart.findOne({ _id: id, userId }).lean();
    if (!cart) return res.status(404).json({ message: "Cart item not found" });
    console.log("Cart:", cart);
    if (!cart.pdfUrl) return res.status(400).json({ message: "Cart item missing pdfUrl" });
    if (!cart.pod_package_id) {
      return res.status(400).json({ message: "Cart item missing pod_package_id", error: "Missing pod_package_id" });
    }

    const dimCheck = await validatePdfMatchesPodPackage(cart.pdfUrl, cart.pod_package_id);
    if (!dimCheck.ok) {
      return res.status(400).json({
        message: dimCheck.message,
        error: "POD_PDF_DIMENSION_MISMATCH",
      });
    }

    console.log("Cart PDF URL:", cart.pdfUrl);
    const pageCount = await getPdfPageCount(cart.pdfUrl);
    console.log("Page count:", pageCount);

    // Compose order data for Lulu
    // const orderData = {
    //   contact_email: contact_email || (cart.shipping_address && cart.shipping_address.name) || undefined,
    //   external_id: `cart-${cart._id}`,
    //   quantity: Number(cart.quantity) || 1,
    //   shipping_level: cart.shipping_option || "MAIL",
    //   pod_package_id: cart.pod_package_id,
    //   coverUrl: cart.coverPdfUrl || undefined,
    //   shipping_address: cart.shipping_address,
    //   production_delay: production_delay || 120,
    //   // include the interior file as a line item source_url if the API accepts it
    //   // many Lulu endpoints accept `line_items` or `files`; include a reasonable line_items shape
    //   line_items: [
    //     {
    //       source_url: cart.pdfUrl,
    //       quantity: Number(cart.quantity) || 1,
    //     },
    //   ],
    // };

    cart.shipping_address.name= cart.name;

        const orderData = {
      contact_email:cart.email,
      external_id:`${cart._id}`,
      line_items: [
        {
          external_id: `${cart._id}`,
          printable_normalization: {
            cover: { source_url: cart.coverPdfUrl },    // Use the generated cover URL
            interior: { source_url: cart.pdfUrl },      // Use the generated interior URL
            pod_package_id: cart.pod_package_id,
          },
          quantity: Number(cart.quantity) > 0 ? Number(cart.quantity) : 1,
          title: cart.title || "My Book",
        },
      ],
      production_delay: typeof production_delay === "number" ? production_delay : undefined,
      shipping_address: normalizeLuluShippingAddress(cart.shipping_address),
      shipping_level:cart.shipping_option || "MAIL",
    };



    // Create print job via Lulu client
    const resp = await createPrintJob(orderData);
    console.log("Print job created:", resp);
    // mark cart as sent
    await Cart.updateOne({ _id: id }, { $set: { status: "sent" } });

    notifyBookSentToLulu(cart, {
      printJobId: resp?.id || resp?.print_job_id || null,
    }).catch(() => {});

    return res.status(200).json({ message: "Print job created", response: { data: resp } });
  } catch (err) {
    console.error("Send cart to print error:", err);
    return res.status(500).json({ message: "Failed to create print job", error: err.message });
  }
};  

module.exports = { createCartItem, getMyCart, sendCartToPrint };

// Create Stripe Checkout session for a cart item
const createCartCheckoutSession = async (req, res) => {
  try {
    const { id: userId, email } = req.decoded;
    const { id } = req.params;
    const { success_url, cancel_url } = req.body || {};
    const getuser = await user.findById(userId);
    const cart = await Cart.findOne({ _id: id, userId }).lean();
    if (!cart) return res.status(404).json({ message: "Cart item not found" });
    const amount = Number(cart.total_price || 0);
    const currency = cart.currency || "USD";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: getuser.email || email,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: cart.title || `Book ${cart._id}` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: "cart",
        cartId: cart._id.toString(),
        userId: userId,
      },
      // Prefer the browser origin so www vs non-www keeps the same localStorage session
      success_url: pickCheckoutReturnUrl(success_url, "/cart?payment=true"),
      cancel_url: pickCheckoutReturnUrl(cancel_url, "/cart?payment=false"),
    });
    return res.status(200).json({ message: "Checkout session created", response: { data: { id: session.id } }, error: null });
  } catch (err) {
    console.error("Create cart checkout error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// Helper to send cart to Lulu by ID (used by webhooks)
const sendCartToPrintById = async (userId, cartId, production_delay) => {
  const cart = await Cart.findOne({ _id: cartId, userId }).lean();
  if (!cart) throw new Error("Cart item not found");
  if (!cart.pdfUrl) throw new Error("Cart item missing pdfUrl");
  if (!cart.pod_package_id) throw new Error("Cart item missing pod_package_id");

  const dimCheck = await validatePdfMatchesPodPackage(cart.pdfUrl, cart.pod_package_id);
  if (!dimCheck.ok) {
    throw new Error(dimCheck.message);
  }

  const pageCount = await getPdfPageCount(cart.pdfUrl);
  console.log("Page count:", pageCount); 
  cart.shipping_address.name = cart.name;

  const orderData = {
    contact_email: cart.email,
    external_id: `${cart._id}`,
    line_items: [
      {
        external_id: `${cart._id}` ,
        printable_normalization: {
          cover: { source_url: cart.coverPdfUrl },
          interior: { source_url: cart.pdfUrl },
          pod_package_id: cart.pod_package_id,
        },
        quantity: Number(cart.quantity) > 0 ? Number(cart.quantity) : 1,
        title: cart.title || "My Book",
      },
    ],
    production_delay: typeof production_delay === "number" ? production_delay : undefined,
    shipping_address: normalizeLuluShippingAddress(cart.shipping_address),
    shipping_level: cart.shipping_option || "MAIL",
  };

  const resp = await createPrintJob(orderData);
  await Cart.updateOne({ _id: cartId }, { $set: { status: "sent" } });

  notifyBookSentToLulu(cart, {
    printJobId: resp?.id || resp?.print_job_id || null,
  }).catch(() => {});

  return resp;
};



// DELETE /user/cart/:id -> remove a cart item (only when status === 'ready')
const deleteCartItem = async (req, res) => {
  try {
    const { id: userId } = req.decoded;
    const { id } = req.params;

    const cart = await Cart.findOne({ _id: id, userId });
    if (!cart) return res.status(404).json({ message: "Cart item not found" });

    if (cart.paymentPaid) {
      return res.status(400).json({
        message: "Paid cart items cannot be removed",
        error: "Payment completed",
      });
    }

    if (cart.status !== "ready") {
      return res.status(400).json({ message: "Only cart items with status 'ready' can be removed", error: "Invalid status" });
    }

    await Cart.deleteOne({ _id: id });

    return res.status(200).json({ message: "Cart item removed" });
  } catch (err) {
    console.error("Delete cart item error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

module.exports = { createCartItem, getMyCart, sendCartToPrint, deleteCartItem , createCartCheckoutSession, sendCartToPrintById };
