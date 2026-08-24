"use client";

import {
  useEffect,
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


  useEffect(() => {

    // ------------------------------------------------------------
    // Wait until authentication check finishes
    // ------------------------------------------------------------

    if (isLoading) {
      return;
    }


    // ------------------------------------------------------------
    // Check whether current page is public
    // ------------------------------------------------------------

    const isPublicRoute =
      PUBLIC_ROUTES.includes(pathname);


    // ------------------------------------------------------------
    // User is NOT logged in
    // ------------------------------------------------------------

    if (
      !isAuthenticated &&
      !isPublicRoute
    ) {

      router.replace("/login");

      return;
    }


    // ------------------------------------------------------------
    // User IS logged in
    // Don't allow login/signup pages
    // ------------------------------------------------------------

    if (
      isAuthenticated &&
      isPublicRoute
    ) {

      router.replace("/");

      return;
    }

  }, [
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