"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/context/AuthContext";


const PUBLIC_ROUTES = [
  "/login",
  "/signup",
];


export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {

  const router = useRouter();

  const pathname = usePathname();

  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ------------------------------------------------------------
    // Wait until router is mounted and authentication check finishes
    // ------------------------------------------------------------
    if (!isMounted || isLoading) {
      return;
    }

    // ------------------------------------------------------------
    // Check whether current page is public
    // ------------------------------------------------------------
    const isPublicRoute =
      PUBLIC_ROUTES.includes(pathname);

    // User is NOT logged in
    if (
      !isAuthenticated &&
      !isPublicRoute
    ) {
      const timer = setTimeout(() => {
        try {
          router.replace("/login");
        } catch {
          window.location.replace("/login");
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    // User IS logged in - don't allow login/signup pages
    if (
      isAuthenticated &&
      isPublicRoute
    ) {
      const timer = setTimeout(() => {
        try {
          router.replace("/");
        } catch {
          window.location.replace("/");
        }
      }, 0);
      return () => clearTimeout(timer);
    }

  }, [
    isMounted,
    isAuthenticated,
    isLoading,
    pathname,
    router,
  ]);


  // --------------------------------------------------------------
  // Don't render protected content while checking auth
  // --------------------------------------------------------------

  if (isLoading) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E8E0D0]">

        <div className="text-sm text-zinc-500">
          Loading...
        </div>

      </div>
    );
  }


  // --------------------------------------------------------------
  // Prevent protected page from briefly appearing
  // --------------------------------------------------------------

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname);


  if (
    !isAuthenticated &&
    !isPublicRoute
  ) {

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E8E0D0]">

        <div className="text-sm text-zinc-500">
          Redirecting...
        </div>

      </div>
    );
  }


  return <>{children}</>;
}