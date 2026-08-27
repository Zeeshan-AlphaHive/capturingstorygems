const Stripe = require("stripe");
const Plan = require("../../models/plan.js");
const Group = require("../../models/group.js");
const Payment = require("../../models/payment.js");
const Subscription = require("../../models/subscription.js");
const User = require("../../models/user.js");
const { configurations } = require("../../configs/config.js");
const { sendMail } = require("../../utils/send-mail.js");
const { checkoutSuccessEmail } = require("../../data/emails.js");
const { notifyBookPaymentSuccess } = require("../../utils/bookOrderEmails.js");
const cart = require("../../models/cart.js");

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

const _toNewYorkDate = (dateInput) => {
  const date = new Date(dateInput);
  const newYorkTime = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return newYorkTime;
};

const getAllPlans = async (req, res) => {
  try {
    const { id: userId } = req.decoded || {};

    let plans;
    if (!userId) {
      plans = await Plan.find({ group: null }).sort({ price: 1 });
    } else {
      const userGroups = await Group.find({ users: userId }).select("_id");
      const groupIds = userGroups.map((g) => g._id);
      plans = await Plan.find({
        $or: [{ group: null }, { group: { $in: groupIds } }],
      }).sort({ price: 1 });
    }
    if (plans.length == 0) {
      plans = await Plan.find({}).sort({ price: 1 });
    }

    if (plans.length === 0) {
      return res.status(404).json({
        message: "No plans found",
        response: null,
        error: "No plans found",
      });
    }

    let totalDiscount = 0;
    if (userId) {
      const user = await User.findById(userId).select("totalDiscount").exec();
      if (user && typeof user.totalDiscount === "number") {
        totalDiscount = Math.max(0, user.totalDiscount);
      }
    }

    return res.status(200).json({
      message: "All plans fetched successfully",
      response: { plans, totalDiscount },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const getSubscription = async (req, res) => {
  const { id: userId } = req.decoded;

  const subscription = await Subscription.findOne({
    userId,
    status: "paid",
    expiryDate: { $gte: new Date() },
  })
    .sort({ expiryDate: -1 })
    .populate("planId", "name type")
    .select("planId expiryDate")
    .exec();

  if (!subscription) {
    return res.status(404).json({
      message: "Subscription not found",
      response: null,
      error: "Subscription not found",
    });
  }

  const data = {
    planName: subscription.planId?.name,
    planType: subscription.planId?.type,
    expiryDate: subscription.expiryDate,
  };
  return res.status(200).json({
    message: "Subscription retrieved successfully",
    response: data,
    error: null,
  });
};

const getTrialStatus = async (req, res) => {
  try {
    const { id: userId } = req.decoded;

    const user = await User.findById(userId)
      .select("isPublic trialUsed trialStartDate trialEndDate createdAt")
      .exec();

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        response: null,
        error: "User not found",
      });
    }

    if (user.isPublic) {
      return res.status(200).json({
        message: "Trial status retrieved successfully",
        response: {
          trialUsed: false,
          trialActive: false,
          trialStartDate: null,
          trialEndDate: null,
        },
        error: null,
      });
    }

    // trialActive means end date exists and it's still in the future
    const now = new Date();
    const trialActive = Boolean(user.trialEndDate && user.trialEndDate > now);

    return res.status(200).json({
      message: "Trial status retrieved successfully",
      response: {
        trialUsed: Boolean(user.trialUsed),
        trialActive,
        trialStartDate: user.trialStartDate,
        trialEndDate: user.trialEndDate,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const createCheckout = async (req, res) => {
  const { id: userId, email } = req.decoded;
  const { planId } = req.body;

  const plan = await Plan.findById(planId);
  if (!plan) {
    return res.status(404).json({
      message: "Plan not found",
      response: null,
      error: "Plan not found",
    });
  }

  if (plan.group) {
    const isMember = await Group.exists({
      _id: plan.group,
      users: userId,
    });

    // if (!isMember) {
    //   return res.status(403).json({
    //     message: "You don't have access to this plan",
    //     response: null,
    //     error: "You don't have access to this plan",
    //   });
    // }
  }

  const existingSubscription = await Subscription.findOne({
    userId,
    expiryDate: { $gte: new Date() },
    status: "paid",
  });
  if (
    existingSubscription &&
    existingSubscription.storiesCreated < existingSubscription.storiesAllowed
  ) {
    return res.status(409).json({
      message: "You already have an active subscription",
      response: null,
      error: "You already have an active subscription",
    });
  }

  const amount = plan.price;
  const billingCycle = plan.billingCycle;

  // determine discount available for user and amount to apply
  let discountToApply = 0;
  try {
    const usr = await User.findById(userId).select("totalDiscount").exec();
    if (usr && typeof usr.totalDiscount === "number") {
      discountToApply = Math.min(Number(usr.totalDiscount) || 0, Number(amount) || 0);
    }
  } catch (e) {
    discountToApply = 0;
  }

  const startDate = _toNewYorkDate(new Date());
  startDate.setHours(0, 0, 0, 0);

  let expiryDate = new Date(startDate);
  if (billingCycle === "monthly") {
    expiryDate?.setDate(expiryDate.getDate() + 30);
  } else if (billingCycle === "yearly") {
    expiryDate?.setFullYear(expiryDate.getFullYear() + 1);
  }

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: plan.name + " - " + plan.type,
        },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    },
  ];
  const stripe = getStripe();
  // create a one-time coupon for this checkout if a discount applies
  let createdCoupon = null;
  try {
    if (discountToApply && discountToApply > 0) {
      createdCoupon = await stripe.coupons.create({
        amount_off: Math.round(discountToApply * 100),
        currency: "usd",
        duration: "once",
      });
    }
  } catch (e) {
    // If coupon creation fails, log and continue without a coupon
    console.error("Failed to create coupon:", e);
    createdCoupon = null;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    customer_email: email,
    discounts: createdCoupon ? [{ coupon: createdCoupon.id }] : undefined,
    metadata: {
      userId: userId,
      planId: plan._id.toString(),
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      discountApplied: String(discountToApply),
      originalAmount: String(amount),
    },
    success_url: `${configurations.frontendBaseUrl}/landing-page?payment=true`,
    cancel_url: `${configurations.frontendBaseUrl}/landing-page?payment=false`,
  });

  const data = { id: session.id };
  return res.status(200).json({
    message: "Checkout link has been retrieved successfully",
    response: { data },
    error: null,
  });
};

const checkoutComplete = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.log("No stripe-signature header value was provided.");
    return res
      .status(400)
      .send("No stripe-signature header value was provided.");
  }

  let body;

  try {
    const rawBody = req.rawBody || req.body;
    const stripe = getStripe();
    body = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      configurations.stripeWebhookSecret
    );
  } catch (err) {
    console.log("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (body.type === "checkout.session.completed") {
      const stripe = getStripe();
      const transactionId = body.data.object.id;
      const dateCreated = new Date(body.data.object.created * 1000);

      const existingTransaction = await Payment.findOne({ transactionId });
      if (existingTransaction) {
        return res.status(409).json({
          message: "Transaction already processed",
          response: null,
          error: "Transaction already processed",
        });
      }

      const session = await stripe.checkout.sessions.retrieve(transactionId, {
        expand: ["line_items"],
      });
      const metadata = session.metadata || {};
      const { userId, planId, startDate, expiryDate, kind, cartId } = metadata;

      const amount = session.amount_total / 100;
      const status = session.payment_status;

      // try to read discountApplied from metadata
      const metadataDiscount = session.metadata && session.metadata.discountApplied ? Number(session.metadata.discountApplied) : 0;

      // If this is a cart purchase, record the printing payment and mark cart as paid
      if (kind === "cart" && cartId) {
        try {
          const PrintingPayment = require("../../models/printingPayment.js");
          const Cart = require("../../models/cart.js");
          console.log("Recording printing payment for cart checkout", { transactionId, cartId, userId, amount, status });
          // create a printing payment record
          await PrintingPayment.create({
            transactionId,
            cartId,
            userId,
            amount,
            currency: session.currency || undefined,
            status,
            metadata: session.metadata || {},
            raw: session,
          });
          console.log("Printing payment recorded successfully for cart checkout", { transactionId, cartId });
          // mark cart as paid so frontend can show Send-to-Print button
          await cart.updateOne({ _id: cartId }, { $set: { paymentPaid: true, paymentTransactionId: transactionId } });

          const paidCart = await Cart.findById(cartId).lean();
          notifyBookPaymentSuccess(paidCart || { userId, email: session.customer_email }, {
            amount,
            currency: session.currency,
            transactionId,
          }).catch(() => {});
        } catch (e) {
          console.error("Failed to record printing payment after checkout:", e);
        }
        return res.status(200).json({ message: "Cart purchase recorded", response: null, error: null });
      }

      // record net amount after discount (if any)
      const netAmount = Math.max(0, amount - (metadataDiscount || 0));
      const payment = await Payment.create({
        userId,
        transactionId,
        amount: netAmount,
        status,
        dateCreated,
        metadata: { originalAmount: amount, discountApplied: metadataDiscount || 0 },
      });
      const plan = await Plan.findById(planId);
      if (!plan) {
        return res.status(404).json({
          message: "Plan not found",
          response: null,
          error: "Plan not found",
        });
      }

      const existingSubscription = await Subscription.findOne({ userId });
      if (!existingSubscription) {
        await Subscription.create({
          userId,
          planId,
          paymentId: payment._id,
          startDate: new Date(startDate),
          expiryDate: new Date(expiryDate),
          storiesAllowed: plan.allowedStories,
          status,
        });
      } else {
        existingSubscription.planId = planId;
        existingSubscription.paymentId = payment._id;
        existingSubscription.storiesAllowed = plan.allowedStories;
        existingSubscription.storiesCreated = 0;
        existingSubscription.startDate = new Date(startDate);
        existingSubscription.expiryDate = new Date(expiryDate);
        existingSubscription.status = status;
        await existingSubscription.save();
      }

      const user = await User.findById(userId);
      const email = user.email;

      const planName = plan.name + " - " + plan.type;

      const dynamicData = {
        subject: "Plan activated successfully",
        to_email: email,
      };
      const emailTemplate = await checkoutSuccessEmail(
        planName,
        startDate,
        expiryDate
      );
      await sendMail(emailTemplate, dynamicData);

      // consume discount from user's totalDiscount
      try {
        if (metadataDiscount && metadataDiscount > 0) {
          const u = await User.findById(userId).exec();
          if (u && typeof u.totalDiscount === "number") {
            u.totalDiscount = Math.max(0, (u.totalDiscount || 0) - metadataDiscount);
            await u.save();
          }
        }
      } catch (e) {
        console.error("Failed to consume user discount after checkout:", e);
      }

      return res.status(201).json({
        message: "User subscription has been added",
        response: null,
        error: null,
      });
    }
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({
      message: error.message,
      response: null,
      error: error,
    });
  }
};

module.exports = {
  getAllPlans,
  getSubscription,
  getTrialStatus,
  createCheckout,
  checkoutComplete,
};
