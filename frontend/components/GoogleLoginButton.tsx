"use client";

import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
const serverBaseUrl = process.env.NEXT_PUBLIC_BACKEND_SERVER_URL;

interface GoogleLoginButtonProps {
  acceptedTerms?: boolean;
}

const GoogleLoginButton = ({ acceptedTerms = false }: GoogleLoginButtonProps) => {
  const router = useRouter();

  const handleLoginSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      const payload: {
        credential?: string;
        acceptedTerms?: boolean;
      } = {
        credential: credentialResponse.credential,
      };

      if (acceptedTerms) {
        payload.acceptedTerms = true;
      }

      const response = await fetch(`${serverBaseUrl}/user/auth/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok) {
        const { token, data } = result.response;
        localStorage.setItem("token", token);

        // Google users are non-public by default.
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, public: false })
        );

        // If no active paid subscription, send to select-plan.
        try {
          const subRes = await fetch(`${serverBaseUrl}/user/plan/subscription`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (subRes.ok) {
            const subData = await subRes.json();
            const expiryDate = subData?.response?.expiryDate;
            const hasActivePaidSubscription = Boolean(
              expiryDate && new Date(expiryDate) > new Date()
            );
            router.push(
              hasActivePaidSubscription ? "/landing-page" : "/select-plan"
            );
          } else {
            router.push("/select-plan");
          }
        } catch {
          router.push("/select-plan");
        }
      } else {
        console.error(result.message);
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleLoginSuccess}
      onError={() => console.log("Login Failed")}
    />
  );
};

export default GoogleLoginButton;
