"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page if someone navigates directly to /report
    router.push("/");
  }, [router]);

  return <div>Redirecting...</div>;
}
