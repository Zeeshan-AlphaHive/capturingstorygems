"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import InputField from "@/components/ui/InputField";
import AuthButton from "@/components/ui/AuthButton";
import { PublicRoute } from "@/utils/RouteProtection";
import GoogleLoginButton from "@/components/GoogleLoginButton";
const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

const SignUp = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [alertMessage, setAlertMessage] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // States to handle password visibility
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfirmPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      toast.error("Please accept the Terms of Service and Privacy Policy.");
      return;
    }

    setDisabled(true);
    setErrors({
      email: "",
      password: "",
      confirmPassword: "",
    });

    const formData = { email, password, confirmPassword, acceptedTerms: true };
    try {
      const response = await fetch(`${serverBaseUrl}/user/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const responseData = await response.json();
      if (response.ok) {
        sessionStorage.setItem("signupEmail", email);
        router.push("/verify-otp");
        toast.success(responseData.message)
      } else if (response.status === 403) {
        const error = typeof responseData.error;
        if (error === "object") {
          setErrors(responseData.error);
        } else {
          setAlertMessage(responseData.message || "An error occurred");
          setTimeout(() => setAlertMessage(false), 3000);
        }
      } else {
        setAlertMessage(
          responseData.message || "Login failed. Please try again"
        );
        setTimeout(() => setAlertMessage(false), 3000);
      }
    } catch (error) {
      console.error("Error during login:", error);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <PublicRoute>
      <div className="flex-1 flex justify-center items-center min-h-screen font-inter px-4">
        <div className="bg-white p-6 rounded-lg w-full max-w-[400px] sm:w-[380px]">
          <h2 className="text-[#1D3557] text-3xl sm:text-4xl font-bold mb-4 font-cormorant-garamond">
            Create Account!
          </h2>
          {alertMessage && (
            <div
              className={`mt-4 mb-8 bg-red-100 border-red-400 text-red-700 border px-4 py-3 rounded relative`}
              role="alert"
            >
              <span className="block sm:inline">{alertMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              id="email"
              className={`${errors?.email && "!mb-0"}`}
            />
            {errors?.email && (
              <p className="joi-error-message mb-4">{errors?.email[0]}</p>
            )}

            <InputField
              label="Password"
              type={passwordVisible ? "text" : "password"} // Toggle between password and text
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password"
              id="password"
              showPasswordToggle={true}
              onTogglePassword={() => setPasswordVisible(!passwordVisible)} // Toggle password visibility
              className={`${errors?.password && "!mb-0"}`}
            />
            {errors?.password && (
              <p className="joi-error-message mb-4">{errors?.password[0]}</p>
            )}

            <InputField
              label="Confirm Password"
              type={confirmPasswordVisible ? "text" : "password"} // Toggle between password and text
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="Re-enter Password"
              id="confirmPassword"
              showPasswordToggle={true}
              onTogglePassword={() =>
                setConfirmPasswordVisible(!confirmPasswordVisible)
              } // Toggle password visibility
              className={`${errors?.confirmPassword && "!mb-0"}`}
            />
            {errors?.confirmPassword && (
              <p className="joi-error-message mb-2">
                {errors?.confirmPassword[0]}
              </p>
            )}

            <label className="flex items-start gap-3 mt-5 mb-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#A8DADC] accent-[#457B9D] cursor-pointer"
              />
              <span className="text-sm text-[#1D3557] leading-relaxed">
                I agree to the{" "}
                <a
                  href="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#457B9D] underline decoration-[#457B9D]/40 hover:decoration-[#457B9D]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#457B9D] underline decoration-[#457B9D]/40 hover:decoration-[#457B9D]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            <AuthButton
              text="Sign Up"
              type="submit"
              className="mt-4 w-full"
              isDisabled={disabled || !acceptedTerms}
            />
          </form>

          <div className="flex items-center justify-center my-3">
            <div className="h-[1px] w-full bg-[#A8DADC]"></div>
            <span className="mx-4 text-[#1D3557] text-sm font-bold">Or</span>
            <div className="h-[1px] w-full bg-[#A8DADC]"></div>
          </div>
          <div
            className={`${!acceptedTerms ? "opacity-50 pointer-events-none" : ""}`}
            title={
              !acceptedTerms
                ? "Please accept the Terms of Service and Privacy Policy first"
                : undefined
            }
          >
            <GoogleLoginButton acceptedTerms={acceptedTerms} />
          </div>

          <div className="flex justify-center text-sm text-[#1D3557] gap-2 mt-3">
            <span className="">Already have an account?</span>
            <Link
              href="/login"
              className="font-semibold underline decoration-[#1D3557] hover:decoration-transparent"
            >
              Login here
            </Link>
          </div>
        </div>
      </div>
    </PublicRoute>
  );
};

export default SignUp;
