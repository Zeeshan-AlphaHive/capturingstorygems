const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { configurations } = require("../../configs/config.js");
const { sendMail } = require("../../utils/send-mail.js");
const User = require("../../models/user.js");
const TermsAcceptance = require("../../models/termsAcceptance.js");
const { getClientIp } = require("../../utils/getClientIp.js");
const {
  signupEmail,
  resendOtpEmail,
  forgotPasswordEmail,
  passwordResetConfirmationEmail,
  supportRequestEmail,
} = require("../../data/emails.js");

const salt = configurations.salt;
const jwtSecret = configurations.jwtSecret;

const TRIAL_DAYS = 10;

function _calcTrialEndDate(startDate) {
  const end = new Date(startDate);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

function _initTrialFieldsOnUser(userDoc, { startDate }) {
  // Trial applies only to non-public users.
  if (!userDoc || userDoc.isPublic) return;

  // Never reset an existing trial.
  if (userDoc.trialUsed || userDoc.trialStartDate || userDoc.trialEndDate) return;

  const start = startDate ? new Date(startDate) : new Date();
  userDoc.trialUsed = true;
  userDoc.trialStartDate = start;
  userDoc.trialEndDate = _calcTrialEndDate(start);
}

async function _recordTermsAcceptance(userId, req) {
  await TermsAcceptance.create({
    userId,
    ipAddress: getClientIp(req),
    acceptedAt: new Date(),
  });
}

const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const isExpired =
        existingUser.emailVerified === false &&
        existingUser.emailVerificationCodeExpiry < new Date();

      if (!isExpired) {
        return res.status(409).json({
          message: "User already exists",
          response: null,
          error: "User already exists",
        });
      }
    }
                                                           
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationCode = Math.floor(
      10000 + Math.random() * 90000
    ).toString();
    const codeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    let savedUser;

    if (!existingUser) {
      const newUser = new User({
        email,
        password: hashedPassword,
        emailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpiry: codeExpiry,
      });

      _initTrialFieldsOnUser(newUser, { startDate: new Date() });
      savedUser = await newUser.save();
    } else {
      existingUser.password = hashedPassword;
      existingUser.emailVerificationCode = verificationCode;
      existingUser.emailVerificationCodeExpiry = codeExpiry;

      // If trial fields are missing for older accounts, initialize once based on original createdAt.
      _initTrialFieldsOnUser(existingUser, { startDate: existingUser.createdAt || new Date() });
      savedUser = await existingUser.save();
    }

    await _recordTermsAcceptance(savedUser._id, req);
    const dynamicData = {
      subject: "Verify Your Email",
      to_email: email,
    };
    const emailTemplate = await signupEmail(verificationCode);
    await sendMail(emailTemplate, dynamicData);

    return res.status(201).json({
      message:
        "Signup successfully! Email has been sent successfully for email verification",
      response: null,
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
   
const googleLoginUser = async (req, res) => {
  const { credential, acceptedTerms } = req.body;
  const client = new OAuth2Client(configurations.googleClientId);

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: configurations.googleClientId,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const googleId = payload?.sub;
    const normalizedEmail = email?.toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      if (!acceptedTerms) {
        return res.status(400).json({
          message:
            "You must accept the Terms of Service and Privacy Policy to create an account",
          response: null,
          error: "Terms not accepted",
        });
      }

      user = new User({
        email: normalizedEmail,
        googleId,
        emailVerified: true,
        status: "active",
      });

      _initTrialFieldsOnUser(user, { startDate: new Date() });
      await user.save();
      await _recordTermsAcceptance(user._id, req);
    } else {
      if (user.status === "blocked") {
        return res.status(400).json({
          message:
            "Your account has been blocked. Please contact administration",
          response: null,
          error: "Account blocked",
        });
      } else if (!user.googleId) {
        user.googleId = googleId;
        user.emailVerified = true;
        user.status = "active";

        // Backfill trial fields if missing, but never reset.
        _initTrialFieldsOnUser(user, { startDate: user.createdAt || new Date() });
        await user.save();
      }
    }

    const token = jwt.sign({ user: { email: user.email } }, jwtSecret, {
      expiresIn: "24h",
    });

    return res.status(200).json({
      message: "You've successfully logged in!",
      response: {
        token,
        data: {
          email: user.email,
        },
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

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        response: null,
        error: "User not found",
      });
    }
    if (!user.emailVerified) {
      if (!user.password) {
        return res.status(400).json({
          message:
            "Password has not been set for this user. Use Google Sign-In to continue",
          response: null,
          error:
            "Password has not been set for this user. Use Google Sign-In to continue",
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid credentials",
          response: null,
          error: "Invalid credentials",
        });
      }

      const verificationCode = Math.floor(
        10000 + Math.random() * 90000
      ).toString();
      const codeExpiry = new Date(Date.now() + 5 * 60 * 1000);

      user.emailVerificationCode = verificationCode;
      user.emailVerificationCodeExpiry = codeExpiry;
      await user.save();

      const dynamicData = {
        subject: "Verify Your Email",
        to_email: email,
      };
      const emailTemplate = await resendOtpEmail(verificationCode, "verify");
      await sendMail(emailTemplate, dynamicData);

      return res.status(400).json({
        message:
          "Email not verified. A new verification code has been sent to your email.",
        response: { requiresVerification: true },
        error: "Email not verified",
      });
    }

    if (!user.password) {
      if (user.isPublic) {
        return res.status(400).json({
          message: "Password has been expired for this user",
          response: null,
          error: "Password has been expired for this user",
        });
      } else {
        return res.status(400).json({
          message:
            "Password has not been set for this user. Use Google Sign-In to continue",
          response: null,
          error:
            "Password has not been set for this user. Use Google Sign-In to continue",
        });
      }
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        response: null,
        error: "Invalid credentials",
      });
    }

    const token = jwt.sign({ user: { email } }, jwtSecret, {
      expiresIn: "24h",
    });

    return res.status(200).json({
      message: "You've successfully logged in!",
      response: {
        token,
        data: {
          email,
          public: user.isPublic,
        },
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

const verifyUser = async (req, res) => {
  const { code, email } = req.body;
  try {
    const user = await User.findOne({
      email,
      emailVerificationCode: code,
      emailVerificationCodeExpiry: { $gt: Date.now() },
    }).select("id");
    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired verification code",
        response: null,
        error: "Invalid or expired verification code",
      });
    }

    await User.findByIdAndUpdate(user.id, {
      status: "active",
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpiry: null,
    });

    return res.status(200).json({
      message: "Email verification successful",
      response: null,
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

const resendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    const user = await User.findOne({ email }).select("emailVerified");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        response: null,
        error: "User not found",
      });
    }

    const verificationCode = Math.floor(
      10000 + Math.random() * 90000
    ).toString();
    const verificationCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    if (type === "verify") {
      await User.findByIdAndUpdate(user.id, {
        emailVerificationCode: verificationCode,
        emailVerificationCodeExpiry: verificationCodeExpiry,
      });

      const dynamicData = {
        subject: "Resent Verification Code",
        to_email: email,
      };
      const emailTemplate = await resendOtpEmail(verificationCode, type);
      await sendMail(emailTemplate, dynamicData);

      return res.status(200).json({
        message: "Verification code resent to your email successfully",
        response: null,
        error: null,
      });
    } else {
      await User.findByIdAndUpdate(user.id, {
        forgotPasswordCode: verificationCode,
        forgotPasswordCodeExpiry: verificationCodeExpiry,
      });

      const dynamicData = {
        subject: "Resent Verification Code",
        to_email: email,
      };
      const emailTemplate = await resendOtpEmail(verificationCode, type);
      await sendMail(emailTemplate, dynamicData);

      return res.status(200).json({
        message: "Email has been resent successfully for reset password",
        response: null,
        error: null,
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: error.message,
    });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { id } = req.decoded;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(id).select("password");
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({
        message: "Current password does not match",
        response: null,
        error: "Current password does not match",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(id, { password: hashedPassword });

    return res.status(200).json({
      message: "Password updated successfully",
      response: null,
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      response: null,
      error: err.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        response: null,
        error: "User not found",
      });
    }
    if (user.isPublic) {
      return res.status(403).json({
        message: "This action not allowed for public users",
        response: null,
        error: "This action not allowed for public users",
      });
    }

    if (!user.emailVerified) {
      return res.status(400).json({
        message: "Email not verified",
        response: null,
        error: "Email not verified",
      });
    }

    const verificationCode = Math.floor(
      10000 + Math.random() * 90000
    ).toString();
    const forgotPasswordCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await User.findByIdAndUpdate(user.id, {
      forgotPasswordCode: verificationCode,
      forgotPasswordCodeExpiry,
    });

    const dynamicData = {
      subject: "Reset Password Code",
      to_email: email,
    };
    const emailTemplate = await forgotPasswordEmail(verificationCode);
    await sendMail(emailTemplate, dynamicData);

    return res.status(200).json({
      message: "Email has been sent successfully for reset password",
      response: null,
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

const resetPassword = async (req, res) => {
  try {
    const { code, email, password } = req.body;

    const user = await User.findOne({
      email,
      forgotPasswordCode: code,
      forgotPasswordCodeExpiry: { $gt: Date.now() },
    }).select("email");
    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired reset code",
        response: null,
        error: "Invalid or expired reset code",
      });
    }

    const hashedPassword = await bcrypt.hash(password, salt);
    await User.findByIdAndUpdate(user.id, {
      password: hashedPassword,
      forgotPasswordCode: null,
      forgotPasswordCodeExpiry: null,
    });

    const dynamicData = {
      subject: "Reset Password Confirmation",
      to_email: email,
    };
    const emailTemplate = await passwordResetConfirmationEmail();
    await sendMail(emailTemplate, dynamicData);

    return res.status(200).json({
      message: "Password reset successfully",
      response: null,
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

const supportRequest = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const dynamicData = {
      subject: "New Support Request",
      to_email: configurations.supportEmail,
    };
    const emailTemplate = await supportRequestEmail(name, email, message);
    await sendMail(emailTemplate, dynamicData);

    return res.status(200).json({
      message: "Thanks for reaching out! Our team will get back to you shortly",
      response: null,
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

module.exports = {
  registerUser,
  googleLoginUser,
  loginUser,
  verifyUser,
  resendOtp,
  updatePassword,
  forgotPassword,
  resetPassword,
  supportRequest,
};
