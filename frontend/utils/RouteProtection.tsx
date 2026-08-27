"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import React, { ReactNode, useEffect } from "react";

function getSafeRedirect(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function currentReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search || ""}`;
}

function redirectQueryFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("redirect");
}

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const isUser = localStorage.getItem("user");
    if (!loading) {
      if (!authenticated) {
        router.push(`/login?redirect=${encodeURIComponent(currentReturnPath())}`);
      } else if (!isUser) {
        router.push("/admin/");
      }
    }
  }, [loading, authenticated, router]);

  if (loading) return <div>Loading...</div>;
  if (!authenticated) return null;

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && authenticated) {
      const redirect = getSafeRedirect(redirectQueryFromUrl());
      router.push(redirect || "/landing-page");
    }
  }, [loading, authenticated, router]);

  if (loading) return <div>Loading...</div>;
  if (authenticated) return null;

  return <>{children}</>;
}

export function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const isAdmin = localStorage.getItem("admin");
    if (!loading) {
      if (!authenticated) {
        router.push("/login");
      } else if (!isAdmin) {
        router.push("/landing-page");
      }
    }
  }, [loading, authenticated, router]);

  if (loading) return <div>Loading...</div>;
  return <>{children}</>;
}

export function ProtectedUserRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const isUser = localStorage.getItem("user");
    const user = isUser ? JSON.parse(isUser) : null;
    if (!loading) {
      if (!authenticated) {
        router.push(`/login?redirect=${encodeURIComponent(currentReturnPath())}`);
      } else if (!isUser) {
        router.push("/admin/");
      } else if (user.public === true) {
        router.push("/landing-page");
        return;
      }
    }
  }, [loading, authenticated, router]);

  if (loading) return <div>Loading...</div>;
  return <>{children}</>;
}
